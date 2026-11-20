// Local test shim: stands in for window.claude.use('db' | 'user' | 'assets') with in-memory data seeded from window.__SEED__.
(function () {
  const data = window.__SEED__ || {};
  const listeners = {};
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const notify = (k) => (listeners[k] || []).forEach((fn) => fn());
  const snap = (c, id) => { const d = data[c] && data[c][id]; return { id, exists: !!d, data: () => (d ? clone(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } }; };
  const split = (path) => { const i = path.lastIndexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  const docRef = (path) => { const [c, id] = split(path); return {
    id, path,
    get: async () => snap(c, id),
    set: async (d) => { data[c] = data[c] || {}; data[c][id] = clone(d); notify(c); notify(path); },
    update: async (d) => { if (!data[c] || !data[c][id]) throw { code: 'invalid_argument', message: 'missing doc ' + path }; Object.assign(data[c][id], clone(d)); notify(c); notify(path); },
    delete: async () => { if (data[c]) delete data[c][id]; notify(c); notify(path); },
    onSnapshot: (next) => { const fn = () => next(snap(c, id)); (listeners[path] = listeners[path] || []).push(fn); setTimeout(fn, 60); return () => {}; },
    collection: (p) => colRef(path + '/' + p)
  }; };
  const colRef = (c) => ({
    path: c,
    doc: (id) => docRef(c + '/' + (id || Math.random().toString(36).slice(2))),
    add: async (d) => { const r = docRef(c + '/' + Math.random().toString(36).slice(2)); await r.set(d); return r; },
    get: async () => { const docs = Object.keys(data[c] || {}).sort().map((id) => snap(c, id)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; },
    onSnapshot: (next) => { const fn = () => { const docs = Object.keys(data[c] || {}).sort().map((id) => snap(c, id)); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }); }; (listeners[c] = listeners[c] || []).push(fn); setTimeout(fn, 60); return () => {}; },
    where() { return this; }, orderBy() { return this; }, limit() { return this; }
  });
  const db = { doc: docRef, collection: colRef };
  const meObj = { id: 'u_test', name: 'Staf Uji', avatarUrl: '', color: '#888888', email: null, isOwner: true, canEdit: true };
  const user = { me: async () => meObj, canEdit: async () => true, isOwner: async () => true, can: async () => true, id: async () => 'u_test', name: async () => 'Staf Uji', profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: 'Staf Uji', avatarUrl: '', color: '#888', email: null, isMe: true, guest: false }])), search: async () => [] };
  const assets = { upload: async (b) => { const id = 'local' + Math.random().toString(36).slice(2); const url = URL.createObjectURL(b); return { id, url, sizeBytes: b.size, contentType: b.type }; }, list: async () => ({ assets: [], usage: { files: 0, bytes: 0, maxFiles: 0, maxBytes: 0 } }), delete: async () => ({ deleted: true }) };
  window.claude = { use: (n) => Promise.resolve({ db, user, assets }[n] || null) };
  window.__HARNESS__ = { data };
})();
