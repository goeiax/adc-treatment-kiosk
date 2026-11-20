'use strict';
// Smoke test of the HTTP contract: starts the server on a throwaway data folder with two throwaway accounts and checks
// sign-in, the access rules, documents, live events, uploads and range reads.   node test.js
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = 'http://127.0.0.1:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'adc-kiosk-test-'));
const PW = { editor: crypto.randomBytes(9).toString('base64url'), display: crypto.randomBytes(9).toString('base64url') };
const env = Object.assign({}, process.env, { KIOSK_CONFIG: path.join(DATA, 'none.json'), KIOSK_DATA: DATA, PORT: String(PORT), KIOSK_PAGE: path.join(__dirname, '..', 'layar-info-perawatan-adc.html'),
  KIOSK_EDITOR_USER: 'ed', KIOSK_EDITOR_PASSWORD: PW.editor, KIOSK_DISPLAY_USER: 'scr', KIOSK_DISPLAY_PASSWORD: PW.display });
const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env, stdio: ['ignore', 'pipe', 'inherit'] });

async function login(username, password) {
  const r = await fetch(BASE + '/_auth/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password, next: '#tinjau' }) });
  return { status: r.status, location: r.headers.get('location'), cookie: (r.headers.get('set-cookie') || '').split(';')[0], raw: r.headers.get('set-cookie') || '' };
}
const call = async (cookie, method, url, body, type) => {
  const r = await fetch(BASE + url, { method, headers: Object.assign({ Cookie: cookie }, body !== undefined ? { 'Content-Type': type || 'application/json' } : {}), body: body === undefined ? undefined : type ? body : JSON.stringify(body) });
  let j = null; const text = await r.text(); try { j = JSON.parse(text); } catch (e) {}
  return { status: r.status, json: j, text, headers: r.headers };
};
let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); passed++; console.log('  ok  ' + name); };

async function main() {
  await new Promise((resolve, reject) => { child.stdout.on('data', (d) => { if (/ADC kiosk on/.test(String(d))) resolve(); }); child.on('exit', (c) => reject(new Error('server exited ' + c))); });

  // signed out
  let r = await call('', 'GET', '/');
  ok('signed out: / shows the sign-in form, not the page', r.status === 200 && /name="password"/.test(r.text) && !/window\.claude/.test(r.text));
  ok('sign-in page is in the brand style: logotype, ink button, no maroon', /<svg class="logo"/.test(r.text) && /class="btn solid"/.test(r.text) && /--text:#212121/.test(r.text) && !/80002e/i.test(r.text));
  ok('signed out: the API answers 401', (await call('', 'GET', '/_api/doc?path=published/live')).status === 401);
  ok('signed out: blobs answer 401', (await call('', 'GET', '/_blob/' + '0'.repeat(32))).status === 401);
  ok('wrong password is refused', (await login('ed', 'nope')).status === 401);

  // sign-in
  const ed = await login('ed', PW.editor), scr = await login('scr', PW.display);
  ok('editor signs in and returns to the tab it asked for', ed.status === 303 && ed.location === '/#tinjau' && !!ed.cookie);
  ok('display cookie lasts 400 days, editor 30', /Max-Age=34560000/.test(scr.raw) && /Max-Age=2592000/.test(ed.raw) && /HttpOnly/.test(scr.raw));
  r = await call(ed.cookie, 'GET', '/');
  ok('signed in: / is skeleton + shim + page', /window\.claude = \{ use/.test(r.text) && /Layar Info Perawatan ADC/.test(r.text) && r.text.indexOf('window.claude = { use') < r.text.indexOf('<title>Layar Info'));
  r = await call(ed.cookie, 'GET', '/_auth/logout');
  ok('sign-out page asks first, in the same style', r.status === 200 && /Keluar dari akun ini/.test(r.text) && /<svg class="logo"/.test(r.text) && !/80002e/i.test(r.text));
  const meE = (await call(ed.cookie, 'GET', '/_api/me')).json, meD = (await call(scr.cookie, 'GET', '/_api/me')).json;
  ok('user.me(): canEdit only for the editor', meE.canEdit === true && meD.canEdit === false && meE.id === 'ed' && typeof meE.name === 'string' && meE.isOwner === false);
  r = await call(ed.cookie, 'POST', '/_api/profiles', { ids: ['ed', 'scr', 'u_unknown'] });
  ok('user.profiles(): names for known ids only', r.json.ed.name && r.json.scr.name && !r.json.u_unknown);

  // live events
  const events = []; const ac = new AbortController();
  const stream = await fetch(BASE + '/_api/events', { headers: { Cookie: scr.cookie }, signal: ac.signal });
  (async () => { const dec = new TextDecoder(); let buf = ''; try { for await (const chunk of stream.body) { buf += dec.decode(chunk, { stream: true }); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const m = /^data: (.*)$/m.exec(buf.slice(0, i)); buf = buf.slice(i + 2); if (m && m[1][0] === '{') events.push(JSON.parse(m[1])); } } } catch (e) {} })();

  // documents and rules
  r = await call(ed.cookie, 'PUT', '/_api/doc?path=treatments/t1', { name: 'B', id: 't1', a: { z: 1, b: 2 } });
  ok('editor writes a draft', r.status === 200 && r.json.rev > 0);
  r = await call(scr.cookie, 'GET', '/_api/doc?path=treatments/t1');
  ok('display reads it, keys sorted at every depth', r.json.exists && JSON.stringify(r.json.data) === '{"a":{"b":2,"z":1},"id":"t1","name":"B"}');
  ok('display cannot write content', (await call(scr.cookie, 'PUT', '/_api/doc?path=published/live', { x: 1 })).status === 403);
  ok('display cannot delete content', (await call(scr.cookie, 'DELETE', '/_api/doc?path=treatments/t1')).status === 403);
  ok('display writes its own heart tally', (await call(scr.cookie, 'PUT', '/_api/doc?path=heartTallies/scr-abc', { epoch: 0, counts: { d1: 1 } })).status === 200);
  ok('display cannot write config/hearts', (await call(scr.cookie, 'PUT', '/_api/doc?path=config/hearts', { epoch: 9 })).status === 403);
  r = await call(ed.cookie, 'PATCH', '/_api/doc?path=treatments/t1', { name: 'C' });
  ok('update merges fields', r.status === 200 && r.json.data.name === 'C' && r.json.data.id === 't1');
  ok('update of a missing document fails', (await call(ed.cookie, 'PATCH', '/_api/doc?path=treatments/none', { a: 1 })).status === 404);
  ok('path traversal is refused', (await call(ed.cookie, 'PUT', '/_api/doc?path=' + encodeURIComponent('../x/y'), { a: 1 })).status === 400 && (await call(ed.cookie, 'GET', '/_api/doc?path=a')).status === 400);
  ok('a cross-site write is refused', (await fetch(BASE + '/_api/doc?path=treatments/t1', { method: 'DELETE', headers: { Cookie: ed.cookie, Origin: 'https://evil.example' } })).status === 403);
  await call(ed.cookie, 'PUT', '/_api/doc?path=treatments/t0', { id: 't0' });
  r = await call(scr.cookie, 'GET', '/_api/collection?path=treatments');
  ok('collection lists its documents by id', r.json.docs.map((d) => d.id).join() === 't0,t1');
  ok('the document is a JSON file on disk', JSON.parse(fs.readFileSync(path.join(DATA, 'db', 'treatments', 't1.json'), 'utf8')).name === 'C');
  await call(ed.cookie, 'DELETE', '/_api/doc?path=treatments/t0');
  await new Promise((s) => setTimeout(s, 300));
  ok('the display hears every change over the event stream', events.filter((e) => e.path === 'treatments/t1').length === 2 && events.some((e) => e.path === 'treatments/t0' && e.exists === false) && events.some((e) => e.path === 'heartTallies/scr-abc'));
  ac.abort();

  // assets
  const bytes = crypto.randomBytes(300000);
  ok('display cannot upload', (await call(scr.cookie, 'POST', '/_api/assets', bytes, 'video/mp4')).status === 403);
  ok('an html upload is refused', (await call(ed.cookie, 'POST', '/_api/assets', Buffer.from('<script>'), 'text/html')).status === 415);
  r = await call(ed.cookie, 'POST', '/_api/assets', bytes, 'video/mp4');
  const id = r.json && r.json.id;
  ok('editor uploads: { id, url, sizeBytes }', r.status === 200 && /^[0-9a-f]{32}$/.test(id) && r.json.url === '/_blob/' + id && r.json.sizeBytes === bytes.length);
  ok('the file is stored under data/assets', fs.statSync(path.join(DATA, 'assets', id)).size === bytes.length);
  const full = await fetch(BASE + '/_blob/' + id, { headers: { Cookie: scr.cookie } });
  ok('the display reads it back with its type', full.status === 200 && full.headers.get('content-type') === 'video/mp4' && Buffer.from(await full.arrayBuffer()).equals(bytes));
  const part = await fetch(BASE + '/_blob/' + id, { headers: { Cookie: scr.cookie, Range: 'bytes=100-199' } });
  ok('range reads work (video seeking)', part.status === 206 && part.headers.get('content-range') === 'bytes 100-199/' + bytes.length && Buffer.from(await part.arrayBuffer()).equals(bytes.subarray(100, 200)));
  r = await call(ed.cookie, 'POST', '/_api/assets', Buffer.alloc(20 * 1024 * 1024 + 1), 'video/mp4');
  ok('over 20 MiB is refused', r.status === 413 && r.json.code === 'resource_exhausted');
  ok('display cannot delete an asset', (await call(scr.cookie, 'DELETE', '/_api/assets/' + id)).status === 403);
  ok('editor deletes it', (await call(ed.cookie, 'DELETE', '/_api/assets/' + id)).json.deleted === true && !fs.existsSync(path.join(DATA, 'assets', id)));

  // sign-out
  r = await fetch(BASE + '/_auth/logout', { method: 'POST', redirect: 'manual', headers: { Cookie: ed.cookie } });
  ok('sign-out clears the cookie', r.status === 303 && /Max-Age=0/.test(r.headers.get('set-cookie')));
}
main().then(() => { console.log('\n' + passed + ' checks passed'); }, (e) => { console.error('\nFAILED: ' + e.message); process.exitCode = 1; })
  .finally(() => { child.kill(); setTimeout(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} }, 300); });
