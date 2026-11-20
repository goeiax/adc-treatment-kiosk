// Self-hosted shim: gives the page window.claude.use('db' | 'user' | 'assets') over this server's HTTP API (/_api/*) and its
// Server-Sent Events stream, in place of the claude.ai artifact runtime. Modelled on harness/shim.js, which fakes the same
// namespaces in memory. Documents come back with their keys sorted, as the real artifact database returns them, so the
// page's canonical draft-versus-live comparison behaves the same here.
(function () {
  const MAX_ASSET = 20 * 1024 * 1024;
  const EMBED = /pratinjau-embed/.test(location.hash);   // the admin's mini preview frames only show what their parent posts: no event stream for them
  const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys) : (x && typeof x === 'object') ? Object.keys(x).sort().reduce((o, k) => { o[k] = sortKeys(x[k]); return o; }, {}) : x;
  const clone = (x) => sortKeys(JSON.parse(JSON.stringify(x)));
  const fail = (code, message) => Object.assign(new Error(message || code), { code });
  const split = (path) => { const i = path.lastIndexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  const newId = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);

  /* ---- transport ---- */
  let leaving = false;
  function signedOut() { if (leaving) return; leaving = true; location.reload(); }   // the server answers the reload with its sign-in form
  async function api(method, url, body, type) {
    let res;
    const init = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (type) { init.headers['Content-Type'] = type; init.body = body; }
    else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    try { res = await fetch(url, init); } catch (e) { throw fail('unavailable', 'Server tidak terjangkau'); }
    let j = null; try { j = await res.json(); } catch (e) {}
    if (res.status === 401) { signedOut(); throw fail('unauthenticated', 'Sesi berakhir'); }
    if (!res.ok) throw fail((j && j.code) || (res.status === 403 ? 'permission_denied' : res.status >= 500 ? 'unavailable' : 'invalid_argument'), (j && j.message) || ('HTTP ' + res.status));
    return j;
  }
  const docUrl = (path) => '/_api/doc?path=' + encodeURIComponent(path);

  /* ---- snapshots ---- */
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapOf = (id, data) => ({ id, exists: data != null, data: () => (data != null ? clone(data) : undefined), metadata: meta });
  const liveIds = (col) => [...col.keys()].filter((id) => col.get(id).data != null).sort();
  const querySnap = (col) => { const docs = liveIds(col).map((id) => snapOf(id, col.get(id).data)); return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn), docChanges: () => [], metadata: meta }; };

  /* ---- subscriptions: one record per watched document ('d:' + path) or collection ('c:' + path) ----
     Every document carries the server's revision of its last write. A change is applied only when its revision is newer than
     what is already known, so a slow first read can never overwrite a newer event, and an event can never undo a newer read. */
  const watched = new Map();
  const signature = (w) => JSON.stringify(w.kind === 'd' ? (w.doc.data == null ? null : sortKeys(w.doc.data)) : liveIds(w.col).map((id) => [id, sortKeys(w.col.get(id).data)]));
  function emit(w, force) {
    const sig = signature(w);
    [...w.subs].forEach((sub) => {
      if (!force && sub.last === sig) return;   // listeners hear about changes only, as with the real database
      sub.last = sig;
      try { sub.next(w.kind === 'd' ? snapOf(split(w.path)[1], w.doc.data) : querySnap(w.col)); } catch (e) { console.error(e); }
    });
  }
  async function load(w, attempt) {
    if (w.loading) return; w.loading = true;
    try {
      if (w.kind === 'd') {
        const r = await api('GET', docUrl(w.path));
        if (r.rev >= w.doc.rev) w.doc = { data: r.exists ? r.data : null, rev: r.rev };
      } else {
        const r = await api('GET', '/_api/collection?path=' + encodeURIComponent(w.path));
        const seen = new Set();
        r.docs.forEach((d) => { seen.add(d.id); const cur = w.col.get(d.id); if (!cur || d.rev >= cur.rev) w.col.set(d.id, { data: d.data, rev: d.rev }); });
        for (const [id, v] of w.col) if (!seen.has(id) && v.rev < r.rev) w.col.delete(id);
      }
      w.loading = false; w.loaded = true;
      const recovered = w.failed; w.failed = false;
      emit(w, recovered);   // after an error was reported, always follow up with a snapshot so the page can show it is connected again
    } catch (e) {
      w.loading = false;
      if (!watched.has(w.kind + ':' + w.path) || leaving) return;
      if (!w.failed) { w.failed = true; w.subs.forEach((sub) => { if (sub.error) { try { sub.error(e); } catch (x) {} } }); }
      setTimeout(() => load(w, (attempt || 0) + 1), Math.min(30000, 2000 * Math.pow(2, attempt || 0)));
    }
  }
  function watch(kind, path, next, error) {
    const key = kind + ':' + path;
    let w = watched.get(key);
    if (!w) { w = { kind, path, subs: new Set(), doc: { data: null, rev: -1 }, col: new Map(), loaded: false, loading: false, failed: false }; watched.set(key, w); }
    const sub = { next, error, last: undefined };
    w.subs.add(sub);
    if (w.loaded) setTimeout(() => { if (w.subs.has(sub) && sub.last === undefined) { sub.last = signature(w); next(w.kind === 'd' ? snapOf(split(path)[1], w.doc.data) : querySnap(w.col)); } }, 0);
    else load(w);
    connect();
    return () => { w.subs.delete(sub); if (!w.subs.size) watched.delete(key); };
  }
  // one change, from the event stream or from this tab's own write
  function applyChange(c) {
    const [col, id] = split(c.path);
    const wd = watched.get('d:' + c.path);
    if (wd && c.rev > wd.doc.rev) { wd.doc = { data: c.exists ? c.data : null, rev: c.rev }; if (wd.loaded) emit(wd); }
    const wc = watched.get('c:' + col);
    if (wc) { const cur = wc.col.get(id); if (!cur || c.rev > cur.rev) { wc.col.set(id, { data: c.exists ? c.data : null, rev: c.rev }); if (wc.loaded) emit(wc); } }
  }
  const resync = () => watched.forEach((w) => load(w));

  /* ---- event stream, with a watchdog: the server pings every 20 s; a silent stream is reopened and everything re-read ---- */
  let es = null, everOpened = false, lastBeat = 0;
  function connect() {
    if (es || EMBED || leaving || !window.EventSource) return;
    es = new EventSource('/_api/events');
    lastBeat = Date.now();
    es.onopen = () => { lastBeat = Date.now(); if (everOpened) resync(); everOpened = true; };
    es.addEventListener('ping', () => { lastBeat = Date.now(); });
    es.onmessage = (ev) => { lastBeat = Date.now(); let c; try { c = JSON.parse(ev.data); } catch (e) { return; } if (c && c.path) applyChange(c); };
    es.onerror = () => {
      if (!es || es.readyState !== 2) return;          // still retrying by itself
      es = null;                                       // closed for good (for example the session ended): find out why, then try again
      api('GET', '/_api/me').then(() => setTimeout(connect, 5000), () => setTimeout(connect, 5000));
    };
  }
  setInterval(() => {
    if (!es || leaving) return;
    if (Date.now() - lastBeat > 50000) { try { es.close(); } catch (e) {} es = null; everOpened = true; connect(); }
  }, 10000);
  window.addEventListener('online', () => { if (everOpened) resync(); });

  /* ---- db ---- */
  const wrote = (path) => (r) => { if (r && r.rev) applyChange({ path, exists: r.exists !== false, data: r.data, rev: r.rev }); };
  const docRef = (path) => { const id = split(path)[1]; return {
    id, path,
    get: async () => { const r = await api('GET', docUrl(path)); return snapOf(id, r.exists ? r.data : null); },
    set: async (d, opts) => {
      if (opts && opts.merge) { try { return wrote(path)(await api('PATCH', docUrl(path), clone(d))); } catch (e) { if (e.code !== 'not_found') throw e; } }
      wrote(path)(await api('PUT', docUrl(path), clone(d)));
    },
    update: async (d) => { wrote(path)(await api('PATCH', docUrl(path), clone(d))); },
    delete: async () => { wrote(path)(await api('DELETE', docUrl(path))); },
    onSnapshot: (next, error) => watch('d', path, next, error),
    collection: (p) => colRef(path + '/' + p)
  }; };
  const colRef = (c) => ({
    path: c,
    doc: (id) => docRef(c + '/' + (id || newId())),
    add: async (d) => { const r = docRef(c + '/' + newId()); await r.set(d); return r; },
    get: async () => { const r = await api('GET', '/_api/collection?path=' + encodeURIComponent(c)); const col = new Map(r.docs.map((d) => [d.id, { data: d.data }])); return querySnap(col); },
    onSnapshot: (next, error) => watch('c', c, next, error),
    where() { return this; }, orderBy() { return this; }, limit() { return this; }
  });
  const db = { doc: docRef, collection: colRef };

  /* ---- user ---- */
  let mePromise = null;
  const loadMe = () => mePromise || (mePromise = api('GET', '/_api/me').catch((e) => { mePromise = null; throw e; }));
  const user = {
    me: async () => Object.assign({}, await loadMe()),
    canEdit: async () => (await loadMe()).canEdit, isOwner: async () => (await loadMe()).isOwner, can: async () => (await loadMe()).canEdit,
    id: async () => (await loadMe()).id, name: async () => (await loadMe()).name,
    profiles: async (ids) => api('POST', '/_api/profiles', { ids: [].concat(ids || []) }),
    search: async () => []
  };

  /* ---- assets ---- */
  const assets = {
    upload: async (blob, opts) => {
      if (!blob || typeof blob.size !== 'number') throw fail('invalid_argument', 'upload() needs a Blob or File');
      if (blob.size > MAX_ASSET) throw fail('resource_exhausted', 'Berkas melebihi batas 20 MB');
      return api('POST', '/_api/assets', blob, (opts && opts.type) || blob.type || 'application/octet-stream');
    },
    list: async () => api('GET', '/_api/assets'),
    delete: async (id) => api('DELETE', '/_api/assets/' + encodeURIComponent(id))
  };

  /* ---- the page's "no edit rights" notice ----
     The page file is shared with claude.ai, where the way to get edit rights is the Share menu. On this server it is the
     editor account, so the sentence is reworded after the page writes it and a button to change account is added. The page
     only ever sets the text of #gateMsg, so the button stays in place. */
  function selfHostedGate() {
    const msg = document.getElementById('gateMsg');
    if (!msg || !window.MutationObserver) return;
    const reword = () => {
      const gate = document.getElementById('gate');
      if (gate && gate.hidden) return;                 // the untouched markup holds the same sentence while the notice is hidden
      // shown for a moment on #admin while the page connects; here the database is this server, so it always arrives
      if (/claude\.ai/.test(msg.textContent)) { msg.textContent = 'Menghubungkan ke server…'; return; }
      if (!/menu Share/.test(msg.textContent)) return;
      msg.textContent = 'Akun ini hanya menayangkan layar dan tidak dapat mengubah isinya. Untuk mengubah isi layar, masuk dengan akun admin.';
      if (!document.getElementById('gateSwitch')) {
        const a = document.createElement('a');
        a.id = 'gateSwitch'; a.className = 'btn solid'; a.href = '/_auth/logout'; a.textContent = 'Ganti akun';
        msg.insertAdjacentElement('afterend', a);
      }
    };
    new MutationObserver(reword).observe(msg, { childList: true, characterData: true, subtree: true });
    reword();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selfHostedGate); else selfHostedGate();

  window.claude = { use: (n) => Promise.resolve({ db, user, assets }[n] || null) };
})();
