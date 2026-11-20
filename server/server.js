'use strict';
// ADC waiting-room kiosk, self-hosted. One file, no dependencies (Node 18+).
// Serves ../layar-info-perawatan-adc.html wrapped as skeleton + shim + page, and implements what the page reaches through
// window.claude.use('db' | 'user' | 'assets'): documents at slash paths with live updates (Server-Sent Events), two sign-in
// roles (editor, display), and uploaded files at /_blob/<id>. See README.md for deployment.
//
//   node server.js            start the server
//   node server.js init       write config.json with two accounts and random passwords (prints them once)
//   node server.js hash <pw>  print a scrypt hash to use as "passwordHash" in config.json
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const HERE = __dirname;
const CONFIG_PATH = path.resolve(process.env.KIOSK_CONFIG || path.join(HERE, 'config.json'));
const MAX_ASSET = 20 * 1024 * 1024;      // same cap as the claude.ai asset store, so the page's own messages stay true
const MAX_DOC = 2 * 1024 * 1024;
const COOKIE = 'adc_kiosk_session';
const DAY = 86400;
const ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'application/pdf']);
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}$/;

/* ---------------- passwords ---------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('base64url') + '$' + crypto.scryptSync(String(pw), salt, 32).toString('base64url');
}
function safeEqual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function checkPassword(user, pw) {
  if (user.passwordHash) {
    const [kind, salt, hash] = String(user.passwordHash).split('$');
    if (kind !== 'scrypt' || !salt || !hash) return false;
    return safeEqual(crypto.scryptSync(String(pw), Buffer.from(salt, 'base64url'), 32).toString('base64url'), hash);
  }
  return !!user.password && safeEqual(sha(pw), sha(user.password));
}

/* ---------------- command line helpers ---------------- */
if (process.argv[2] === 'hash') {
  if (!process.argv[3]) { console.error('usage: node server.js hash <password>'); process.exit(1); }
  console.log(hashPassword(process.argv[3])); process.exit(0);
}
if (process.argv[2] === 'init') {
  if (fs.existsSync(CONFIG_PATH)) { console.error(CONFIG_PATH + ' already exists; edit it instead (or delete it first).'); process.exit(1); }
  const example = JSON.parse(fs.readFileSync(path.join(HERE, 'config.example.json'), 'utf8'));
  const shown = [];
  example.users.forEach((u) => { const p = crypto.randomBytes(12).toString('base64url'); shown.push([u.role, u.username, p]); delete u.password; u.passwordHash = hashPassword(p); });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(example, null, 2) + '\n', { mode: 0o600 });
  console.log('Wrote ' + CONFIG_PATH + '\nWrite these down now; only their hashes are stored:\n');
  shown.forEach(([role, name, p]) => console.log('  ' + role.padEnd(8) + ' username: ' + name.padEnd(12) + ' password: ' + p));
  console.log('\nChange a password later with: node server.js hash <new password>  (paste the result as "passwordHash").');
  process.exit(0);
}

/* ---------------- configuration ---------------- */
function loadConfig() {
  let c = {};
  if (fs.existsSync(CONFIG_PATH)) c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const env = process.env;
  const users = Array.isArray(c.users) ? c.users.slice() : [];
  // environment accounts (an environment account replaces a config account with the same username)
  [['editor', 'KIOSK_EDITOR'], ['display', 'KIOSK_DISPLAY']].forEach(([role, p]) => {
    if (!env[p + '_USER']) return;
    const u = { id: env[p + '_USER'], role, username: env[p + '_USER'], name: env[p + '_NAME'] || (role === 'editor' ? 'Marketing' : 'Layar klinik') };
    if (env[p + '_PASSWORD_HASH']) u.passwordHash = env[p + '_PASSWORD_HASH']; else u.password = env[p + '_PASSWORD'];
    const i = users.findIndex((x) => x.username === u.username); if (i >= 0) users[i] = u; else users.push(u);
  });
  users.forEach((u) => {
    if (!u.username || !/^(editor|display)$/.test(u.role || '')) throw new Error('config: every user needs "username" and "role" (editor or display)');
    if (!u.password && !u.passwordHash) throw new Error('config: user "' + u.username + '" has no password');
    if (/^(GANTI|CHANGE)/i.test(u.password || '')) throw new Error('config: user "' + u.username + '" still has the example password; set a real one (or run: node server.js init)');
    u.id = u.id || u.username; u.name = u.name || u.username;
  });
  const cfgDir = path.dirname(CONFIG_PATH);
  return {
    port: +(env.PORT || env.KIOSK_PORT || c.port || 8080),
    host: env.KIOSK_HOST || c.host || '127.0.0.1',
    dataDir: path.resolve(cfgDir, env.KIOSK_DATA || c.dataDir || './data'),
    pageFile: path.resolve(cfgDir, env.KIOSK_PAGE || c.pageFile || '../layar-info-perawatan-adc.html'),
    secureCookies: c.secureCookies === undefined ? 'auto' : c.secureCookies,   // true | false | "auto" (follow X-Forwarded-Proto)
    editorSessionDays: +(c.editorSessionDays || 30),
    displaySessionDays: +(c.displaySessionDays || 400),                         // browsers cap cookie life at 400 days; renewed on every page load
    sessionSecret: env.KIOSK_SESSION_SECRET || c.sessionSecret || '',
    users,
  };
}
let cfg;
try { cfg = loadConfig(); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
if (!cfg.users.some((u) => u.role === 'editor') || !cfg.users.some((u) => u.role === 'display')) {
  console.error('No accounts configured. Run "node server.js init" (writes config.json with an editor and a display account),\nor copy config.example.json to config.json and set the passwords, or set KIOSK_EDITOR_USER/KIOSK_EDITOR_PASSWORD and\nKIOSK_DISPLAY_USER/KIOSK_DISPLAY_PASSWORD in the environment.');
  process.exit(1);
}
const DB_DIR = path.join(cfg.dataDir, 'db');
const ASSET_DIR = path.join(cfg.dataDir, 'assets');
fs.mkdirSync(DB_DIR, { recursive: true }); fs.mkdirSync(ASSET_DIR, { recursive: true });
if (!cfg.sessionSecret) {
  const f = path.join(cfg.dataDir, 'session-secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('base64url'), { mode: 0o600 });
  cfg.sessionSecret = fs.readFileSync(f, 'utf8').trim();
}

/* ---------------- documents: one JSON file per document, data/db/<collection>/<id>.json ---------------- */
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys) : (x && typeof x === 'object') ? Object.keys(x).sort().reduce((o, k) => { o[k] = sortKeys(x[k]); return o; }, {}) : x;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const docs = new Map();   // path -> data
const revs = new Map();   // path -> revision of the last write (kept for deleted documents too, until restart)
let seq = Date.now() * 1000;   // revisions only ever grow, across restarts as well
(function load(dir, prefix) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) load(path.join(dir, e.name), prefix + e.name + '/');
    else if (e.name.endsWith('.json')) {
      try { docs.set(prefix + e.name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, e.name), 'utf8'))); }
      catch (err) { console.error('skipped unreadable document ' + path.join(dir, e.name) + ': ' + err.message); }
    }
  }
})(DB_DIR, '');
function parsePath(p, kind) {
  const seg = String(p || '').split('/');
  if (seg.length > 16 || !seg.every((s) => SEGMENT.test(s) && !s.endsWith('.'))) return null;
  if (kind === 'doc' ? seg.length % 2 !== 0 : seg.length % 2 !== 1) return null;
  return seg;
}
const docFile = (seg) => path.join(DB_DIR, ...seg.slice(0, -1), seg[seg.length - 1] + '.json');
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text); fs.renameSync(tmp, file);
}
function putDoc(seg, data) {
  const p = seg.join('/'); data = sortKeys(data);
  writeAtomic(docFile(seg), JSON.stringify(data, null, 1) + '\n');
  docs.set(p, data); revs.set(p, ++seq); broadcast({ path: p, exists: true, data, rev: seq });
  return { ok: true, exists: true, data, rev: seq };
}
function dropDoc(seg) {
  const p = seg.join('/');
  try { fs.unlinkSync(docFile(seg)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  docs.delete(p); revs.set(p, ++seq); broadcast({ path: p, exists: false, rev: seq });
  return { ok: true, exists: false, rev: seq };
}

/* ---------------- live updates (Server-Sent Events) ---------------- */
const streams = new Set();
function broadcast(change) { const msg = 'data: ' + JSON.stringify(change) + '\n\n'; for (const res of streams) res.write(msg); }
// a named ping every 20 s keeps proxies from closing the stream and lets the shim notice a stalled one
setInterval(() => { for (const res of streams) res.write('event: ping\ndata: 1\n\n'); }, 20000).unref();

/* ---------------- sessions: signed cookie, no server-side state ---------------- */
const sign = (s) => crypto.createHmac('sha256', cfg.sessionSecret).update(s).digest('base64url');
const userKey = (u) => sign('pw:' + (u.passwordHash || u.password)).slice(0, 12);   // changing a password ends that account's sessions
const sessionDays = (u) => u.role === 'display' ? cfg.displaySessionDays : cfg.editorSessionDays;
function makeToken(u) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ u: u.username, k: userKey(u), iat: now, exp: now + sessionDays(u) * DAY })).toString('base64url');
  return body + '.' + sign(body);
}
function readSession(req) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(req.headers.cookie || '');
  if (!m) return null;
  const [body, mac] = m[1].split('.');
  if (!body || !mac || !safeEqual(sign(body), mac)) return null;
  let t; try { t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!t || t.exp < Date.now() / 1000) return null;
  const user = cfg.users.find((u) => u.username === t.u);
  if (!user || userKey(user) !== t.k) return null;
  return { user, iat: t.iat };
}
function isHttps(req) { return cfg.secureCookies === true || (cfg.secureCookies === 'auto' && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'); }
function sessionCookie(req, user) {
  return COOKIE + '=' + (user ? makeToken(user) : '') + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (user ? sessionDays(user) * DAY : 0) + (isHttps(req) ? '; Secure' : '');
}
// a session older than a day gets a fresh cookie whenever the page loads or reconnects, so the display never reaches its expiry
function renew(req, res, session) { if (Date.now() / 1000 - session.iat > DAY) res.setHeader('Set-Cookie', sessionCookie(req, session.user)); }
const canWrite = (user, p) => user.role === 'editor' || (user.role === 'display' && /^heartTallies\/[^/]+$/.test(p));
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, canEdit: u.role === 'editor', isOwner: false, avatarUrl: '', color: u.role === 'editor' ? '#212121' : '#888888', email: null });

/* ---------------- sign-in throttling ---------------- */
const fails = new Map();   // client address -> { n, until }
function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'; }
function throttled(ip) { const f = fails.get(ip); return !!f && f.until > Date.now(); }
function noteFail(ip) { const f = fails.get(ip) || { n: 0, until: 0 }; f.n++; if (f.n >= 8) { f.until = Date.now() + 5 * 60000; f.n = 0; } fails.set(ip, f); if (fails.size > 5000) fails.clear(); }

/* ---------------- pages ---------------- */
const SKEL = '<!doctype html><html lang="id"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
const cache = {};
function readCached(file) {
  const st = fs.statSync(file); const c = cache[file];
  if (c && c.mtime === st.mtimeMs) return c.text;
  cache[file] = { mtime: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }; return cache[file].text;
}
// the page file stays the single source of the UI: it is re-read whenever it changes, so "git pull" updates the screen without a restart
function kioskPage() { return SKEL + '<script>' + readCached(path.join(HERE, 'shim.js')) + '</script>' + readCached(cfg.pageFile) + '</body></html>'; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// The sign-in and sign-out pages follow the page's own brand tokens (ADC Design System v2.0, see its :root): warm page, shadow
// card, square controls, Archivo heading over Archivo Narrow body, ink buttons in the button voice. The logotype is taken from
// the page file's <symbol id="adc-logo"> so it is never drawn twice.
let logoCache = { src: null, svg: '' };
function logoSvg() {
  try {
    const src = readCached(cfg.pageFile);
    if (logoCache.src !== src) {
      const m = /<symbol id="adc-logo" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/.exec(src);
      logoCache = { src, svg: m ? '<svg class="logo" viewBox="' + m[1] + '" role="img" aria-label="ADC Aesthetic Derma Centre">' + m[2] + '</svg>' : '' };
    }
  } catch (e) { return ''; }
  return logoCache.svg;
}
const SHELL = (title, body) => '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + title + '</title>' +
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Archivo+Narrow:wght@400;500;600&display=swap"><style>' +
  ':root{--bg:#f5f2ec;--card:#fcfbf9;--text:#212121;--muted:#545454;--border:#d1cdc4;--gold:#ab8c52;--greige:#c0bcb4;--error:#c85c42;color-scheme:light}' +
  '*{box-sizing:border-box}html,body{min-height:100%}' +
  'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:var(--bg);color:var(--text);font-family:"Archivo Narrow","Archivo",sans-serif;font-size:16px;line-height:1.4;letter-spacing:.025em}' +
  'main{width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}' +
  '.logo{display:block;width:250px;max-width:100%;height:auto;aspect-ratio:609.4/56.7;margin-bottom:16px}.logo path,.logo rect,.logo polygon{fill:#000}' +
  'h1{margin:0;font-family:"Archivo","Helvetica Neue",Helvetica,sans-serif;font-weight:400;font-size:32px;line-height:40px;letter-spacing:0;text-wrap:balance}' +
  'p{margin:0;color:var(--muted);text-wrap:pretty}p b{color:var(--text);font-weight:600}' +
  '.card{width:100%;margin-top:16px;padding:24px;display:flex;flex-direction:column;gap:16px;background:var(--card);box-shadow:0 2px 8px rgba(0,0,0,.06);text-align:left}' +
  'form{display:contents}.field{display:flex;flex-direction:column;gap:8px}label{font-size:14px;line-height:18px;font-weight:500}' +
  'input{width:100%;min-height:44px;padding:0 12px;font:inherit;letter-spacing:inherit;color:inherit;border:1px solid var(--border);border-radius:0;background:var(--bg)}' +
  'input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--text);outline-offset:2px}' +
  '.btn{display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin:0;padding:0 24px;font:inherit;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.125em;text-transform:uppercase;text-decoration:none;border:1px solid transparent;border-radius:0;cursor:pointer}' +
  '.btn.solid{margin-top:8px;background:var(--text);color:#fff}.btn.solid:hover{color:var(--gold)}' +
  '.btn.outline{background:var(--greige);border-color:var(--muted);color:var(--text)}.btn.outline:hover{border-color:var(--gold)}' +
  '.err{padding:12px;border:1px solid var(--error);background:var(--bg);color:var(--text);font-size:14px;line-height:20px}' +
  '</style></head><body><main>' + logoSvg() + body + '</main></body></html>';
function signInPage(error, next) {
  return SHELL('Masuk · Layar Info Perawatan ADC', '<h1>Layar info perawatan</h1><p>Masuk dengan akun admin untuk mengubah isi layar, atau akun layar untuk menayangkannya.</p>' +
    '<div class="card"><form method="post" action="/_auth/login"><input type="hidden" name="next" id="next" value="' + esc(next || '') + '">' +
    (error ? '<div class="err" role="alert">' + esc(error) + '</div>' : '') +
    '<div class="field"><label for="u">Nama pengguna</label><input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></div>' +
    '<div class="field"><label for="p">Kata sandi</label><input id="p" name="password" type="password" autocomplete="current-password" required></div>' +
    '<button class="btn solid" type="submit">Masuk</button></form></div>' +
    '<script>document.forms[0].addEventListener("submit",function(){if(location.hash)document.getElementById("next").value=location.hash;});</script>');
}
function signOutPage(user) {
  return SHELL('Keluar · Layar Info Perawatan ADC', '<h1>Keluar dari akun ini?</h1><p>Anda masuk sebagai <b>' + esc(user.name) + '</b>. Layar klinik sebaiknya tetap masuk.</p>' +
    '<div class="card"><form method="post" action="/_auth/logout"><button class="btn solid" type="submit" style="margin-top:0">Keluar</button></form>' +
    '<a class="btn outline" href="/">Kembali</a></div>');
}

/* ---------------- http helpers ---------------- */
function send(res, status, body, headers) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? '' : body);
  res.writeHead(status, Object.assign({ 'Content-Length': buf.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' }, headers));
  res.end(buf);
}
const html = (res, status, text, headers) => send(res, status, text, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, headers));
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
const fail = (res, status, code, message) => json(res, status, { code, message });
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    if (+req.headers['content-length'] > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.resume(); return; }
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, MAX_DOC);
  try { return JSON.parse(buf.toString('utf8') || 'null'); } catch (e) { throw Object.assign(new Error('body is not JSON'), { status: 400 }); }
}
// a write must come from this site's own pages: browsers send Origin on every cross-site write
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { const h = new URL(o).host; return h === req.headers.host || h === String(req.headers['x-forwarded-host'] || ''); } catch (e) { return false; }
}

/* ---------------- assets: data/assets/<id> (the bytes) + data/assets/<id>.json (type, size) ---------------- */
const assetMeta = (id) => { try { return JSON.parse(fs.readFileSync(path.join(ASSET_DIR, id + '.json'), 'utf8')); } catch (e) { return null; } };
function receiveAsset(req, res, user) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!ASSET_TYPES.has(type)) { req.resume(); return fail(res, 415, 'invalid_argument', 'Jenis berkas ' + (type || '(kosong)') + ' tidak didukung'); }
  if (+req.headers['content-length'] > MAX_ASSET) { req.resume(); return fail(res, 413, 'resource_exhausted', 'Berkas melebihi batas 20 MB'); }
  const id = crypto.randomBytes(16).toString('hex');
  const tmp = path.join(ASSET_DIR, id + '.upload');
  const out = fs.createWriteStream(tmp); let n = 0, done = false;
  const abort = (status, code, message) => { if (done) return; done = true; req.unpipe(out); out.destroy(); fs.rm(tmp, { force: true }, () => {}); req.resume(); if (!res.headersSent) fail(res, status, code, message); };
  req.on('data', (c) => { n += c.length; if (n > MAX_ASSET) abort(413, 'resource_exhausted', 'Berkas melebihi batas 20 MB'); });
  req.on('aborted', () => abort(400, 'aborted', 'Unggahan terputus'));
  out.on('error', (e) => abort(500, 'internal', e.message));
  out.on('finish', () => {
    if (done) return; done = true;
    if (!n) { fs.rm(tmp, { force: true }, () => {}); return fail(res, 400, 'invalid_argument', 'Berkas kosong'); }
    fs.renameSync(tmp, path.join(ASSET_DIR, id));
    writeAtomic(path.join(ASSET_DIR, id + '.json'), JSON.stringify({ contentType: type, sizeBytes: n, createdAt: new Date().toISOString(), by: user.id }) + '\n');
    json(res, 200, { id, url: '/_blob/' + id, sizeBytes: n, contentType: type });
  });
  req.pipe(out);
}
function serveBlob(req, res, id) {
  const meta = assetMeta(id); const file = path.join(ASSET_DIR, id);
  let size; try { size = fs.statSync(file).size; } catch (e) { return send(res, 404, 'not found'); }
  const head = { 'Content-Type': (meta && meta.contentType) || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
  let start = 0, end = size - 1, status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], size - 1); } else { start = Math.max(0, size - +m[2]); }
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
    status = 206; head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  }
  head['Content-Length'] = end - start + 1;
  res.writeHead(status, head);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}

/* ---------------- router ---------------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://x'); const p = url.pathname; const method = req.method;
  const session = readSession(req); const user = session && session.user;
  const reading = method === 'GET' || method === 'HEAD';
  if (!reading && !sameOrigin(req)) return fail(res, 403, 'permission_denied', 'cross-site request refused');

  if (p === '/_health') return json(res, 200, { ok: true });

  /* sign-in and sign-out */
  if (p === '/_auth/login' && method === 'POST') {
    const ip = clientIp(req);
    const form = new URLSearchParams((await readBody(req, 4096)).toString('utf8'));
    const next = /^#[a-z0-9-]{1,40}$/.test(form.get('next') || '') ? form.get('next') : '';
    if (throttled(ip)) return html(res, 429, signInPage('Terlalu banyak percobaan. Coba lagi dalam beberapa menit.', next));
    const u = cfg.users.find((x) => x.username.toLowerCase() === String(form.get('username') || '').trim().toLowerCase());
    const ok = u ? checkPassword(u, form.get('password') || '') : false;
    if (!ok) { noteFail(ip); await new Promise((r) => setTimeout(r, 400)); return html(res, 401, signInPage('Nama pengguna atau kata sandi tidak cocok.', next)); }
    fails.delete(ip);
    res.setHeader('Set-Cookie', sessionCookie(req, u));
    res.writeHead(303, { Location: '/' + (next || (u.role === 'editor' ? '#admin' : '#kiosk')), 'Cache-Control': 'no-store' }); return res.end();
  }
  if (p === '/_auth/logout') {
    if (method === 'POST') { res.setHeader('Set-Cookie', sessionCookie(req, null)); res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store' }); return res.end(); }
    if (!user) { res.writeHead(303, { Location: '/' }); return res.end(); }
    return html(res, 200, signOutPage(user));
  }

  /* the page */
  if (p === '/' || p === '/index.html') {
    if (!reading) return send(res, 405, '');
    if (!user) return html(res, 200, signInPage('', ''));
    renew(req, res, session);
    return html(res, 200, kioskPage());
  }
  if (p === '/favicon.ico') return send(res, 204, '');

  /* everything below needs a signed-in account */
  if (!user) return p.startsWith('/_api/') || p.startsWith('/_blob/') ? fail(res, 401, 'unauthenticated', 'Belum masuk') : send(res, 404, 'not found');

  const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(p);
  if (blob && reading) return serveBlob(req, res, blob[1]);

  if (p === '/_api/me' && reading) { renew(req, res, session); return json(res, 200, publicUser(user)); }
  if (p === '/_api/profiles' && method === 'POST') {
    const body = await readJson(req); const out = {};
    [].concat((body && body.ids) || []).slice(0, 200).forEach((id) => { const u = cfg.users.find((x) => x.id === id); if (u) out[id] = { id, name: u.name, avatarUrl: '', color: '#888888', email: null, isMe: u.id === user.id, guest: false }; });
    return json(res, 200, out);
  }
  if (p === '/_api/events' && reading) {
    renew(req, res, session);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n: connected\n\n');
    streams.add(res); req.on('close', () => streams.delete(res)); return;
  }
  if (p === '/_api/doc') {
    const seg = parsePath(url.searchParams.get('path'), 'doc'); if (!seg) return fail(res, 400, 'invalid_argument', 'Bad document path');
    const key = seg.join('/');
    if (reading) return json(res, 200, { exists: docs.has(key), data: docs.get(key), rev: revs.get(key) || 0 });
    if (!canWrite(user, key)) return fail(res, 403, 'permission_denied', 'Akun ini tidak boleh mengubah ' + key);
    if (method === 'DELETE') return json(res, 200, dropDoc(seg));
    const body = await readJson(req);
    if (!isObj(body)) return fail(res, 400, 'invalid_argument', 'A document must be a JSON object');
    if (method === 'PUT') return json(res, 200, putDoc(seg, body));
    if (method === 'PATCH') {
      if (!docs.has(key)) return fail(res, 404, 'not_found', 'No document at ' + key);
      return json(res, 200, putDoc(seg, Object.assign({}, docs.get(key), body)));
    }
    return send(res, 405, '');
  }
  if (p === '/_api/collection' && reading) {
    const seg = parsePath(url.searchParams.get('path'), 'collection'); if (!seg) return fail(res, 400, 'invalid_argument', 'Bad collection path');
    const prefix = seg.join('/') + '/'; const out = [];
    for (const [k, v] of docs) if (k.startsWith(prefix) && k.indexOf('/', prefix.length) < 0) out.push({ id: k.slice(prefix.length), data: v, rev: revs.get(k) || 0 });
    out.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return json(res, 200, { docs: out, rev: seq });
  }
  if (p === '/_api/assets') {
    if (method === 'POST') { if (user.role !== 'editor') { req.resume(); return fail(res, 403, 'permission_denied', 'Hanya admin yang boleh mengunggah'); } return receiveAsset(req, res, user); }
    if (reading) {
      const list = fs.readdirSync(ASSET_DIR).filter((f) => /^[0-9a-f]{32}$/.test(f)).map((id) => Object.assign({ id, url: '/_blob/' + id }, assetMeta(id) || { sizeBytes: fs.statSync(path.join(ASSET_DIR, id)).size }));
      return json(res, 200, { assets: list, usage: { files: list.length, bytes: list.reduce((s, a) => s + (a.sizeBytes || 0), 0), maxFiles: 0, maxBytes: 0 } });
    }
  }
  const asset = /^\/_api\/assets\/([0-9a-f]{32})$/.exec(p);
  if (asset && method === 'DELETE') {
    if (user.role !== 'editor') return fail(res, 403, 'permission_denied', 'Hanya admin yang boleh menghapus');
    const existed = fs.existsSync(path.join(ASSET_DIR, asset[1]));
    fs.rmSync(path.join(ASSET_DIR, asset[1]), { force: true }); fs.rmSync(path.join(ASSET_DIR, asset[1] + '.json'), { force: true });
    return json(res, 200, { deleted: existed });
  }
  return p.startsWith('/_api/') ? fail(res, 404, 'not_found', 'No such endpoint') : send(res, 404, 'not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (res.headersSent) { res.destroy(); return; }
    const status = e.status || 500;
    if (status >= 500) console.error(new Date().toISOString(), req.method, req.url, e);
    fail(res, status, status === 413 ? 'resource_exhausted' : status >= 500 ? 'internal' : 'invalid_argument', status >= 500 ? 'Kesalahan server' : e.message);
  });
});
server.requestTimeout = 0;        // uploads over a slow clinic line and the event stream must not be cut off
server.keepAliveTimeout = 65000;
server.listen(cfg.port, cfg.host, () => {
  console.log('ADC kiosk on http://' + (cfg.host === '0.0.0.0' ? 'localhost' : cfg.host) + ':' + cfg.port + '  ·  data: ' + cfg.dataDir + '  ·  ' + docs.size + ' documents  ·  page: ' + cfg.pageFile);
});
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => { for (const r of streams) r.end(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); }));
