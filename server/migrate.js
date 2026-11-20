'use strict';
// One-off migration: fills this server's data folder from the claude.ai artifact.
//
//   node migrate.js                         import export/live-<latest date>/ and ../media
//   node migrate.js --export <dir|writes.json> --media <dir> --assets-dir <dir> --data <dir> --force
//
// Documents come from an export of the artifact's database: a folder laid out <collection>/<doc id>.json (what the
// ArtifactData tool writes with out_dir; see README.md "Exporting the live database"), or a seed manifest such as
// ../seed/writes.json. Files come from ../media under the asset ids the documents and the page already reference
// (the id -> file map is read from ../harness/server.py BLOBS), plus any <asset id>.<ext> file in --assets-dir for
// assets downloaded from the artifact later. Nothing in a document is rewritten: the ids stay the same.
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname, ROOT = path.dirname(HERE);
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const FORCE = args.includes('--force');
const TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys) : (x && typeof x === 'object') ? Object.keys(x).sort().reduce((o, k) => { o[k] = sortKeys(x[k]); return o; }, {}) : x;
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));

function dataDir() {
  if (opt('data')) return path.resolve(opt('data'));
  if (process.env.KIOSK_DATA) return path.resolve(process.env.KIOSK_DATA);
  const cfgPath = path.resolve(process.env.KIOSK_CONFIG || path.join(HERE, 'config.json'));
  if (fs.existsSync(cfgPath)) { const c = readJson(cfgPath); if (c.dataDir) return path.resolve(path.dirname(cfgPath), c.dataDir); }
  return path.join(HERE, 'data');
}
function latestExport() {
  const dir = path.join(HERE, 'export');
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^live-/.test(n) && fs.statSync(path.join(dir, n)).isDirectory()).sort() : [];
  if (!found.length) { console.error('No export found under ' + dir + '. Pass --export <folder or writes.json> (see README.md).'); process.exit(1); }
  return path.join(dir, found[found.length - 1]);
}

/* ---- read the documents ---- */
function readExport(src) {
  const out = [];   // [path, data]
  if (fs.statSync(src).isDirectory()) {
    (function walk(dir, prefix) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
        if (e.isDirectory()) walk(path.join(dir, e.name), prefix + e.name + '/');
        else if (e.name.endsWith('.json') && prefix) out.push([prefix + e.name.slice(0, -5), readJson(path.join(dir, e.name))]);
      }
    })(src, '');
  } else {
    // seed manifest: [{ op: 'set', collection, doc_id, file_path }] (paths may be absolute paths from another machine)
    for (const w of readJson(src)) {
      if (w.op !== 'set') continue;
      let f = w.file_path; if (!fs.existsSync(f)) f = path.join(path.dirname(src), path.basename(String(w.file_path).replace(/\\/g, '/')));
      out.push([w.collection + '/' + w.doc_id, w.data || readJson(f)]);
    }
  }
  return out;
}

/* ---- read the asset map ---- */
function assetSources(mediaDir, extraDir) {
  const map = new Map();   // id -> { file, contentType }
  const harness = path.join(ROOT, 'harness', 'server.py');
  if (fs.existsSync(harness)) {
    const re = /'([0-9a-f]{32})':\s*\('([^']+)',\s*'([^']+)'\)/g; let m; const src = fs.readFileSync(harness, 'utf8');
    while ((m = re.exec(src))) map.set(m[1], { file: path.join(mediaDir, m[2]), contentType: m[3] });
  }
  if (extraDir && fs.existsSync(extraDir)) {
    for (const n of fs.readdirSync(extraDir)) {
      const m = /^([0-9a-f]{32})(\.[a-z0-9]+)$/i.exec(n);
      if (m && TYPES[m[2].toLowerCase()]) map.set(m[1], { file: path.join(extraDir, n), contentType: TYPES[m[2].toLowerCase()] });
    }
  }
  return map;
}
function referencedAssets(docs) {
  const ids = new Map();   // id -> where it is used
  const note = (id, where) => { if (typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) && !ids.has(id)) ids.set(id, where); };
  const scan = (x, where) => { if (Array.isArray(x)) x.forEach((y) => scan(y, where)); else if (x && typeof x === 'object') Object.keys(x).forEach((k) => scan(x[k], where)); else note(x, where); };
  docs.forEach(([p, d]) => scan(d, p));
  const page = path.join(ROOT, 'layar-info-perawatan-adc.html');
  if (fs.existsSync(page)) (fs.readFileSync(page, 'utf8').match(/\b[0-9a-f]{32}\b/g) || []).forEach((id) => note(id, 'the page itself (doctor photos)'));
  return ids;
}

/* ---- run ---- */
const DATA = dataDir();
const DB = path.join(DATA, 'db'), ASSETS = path.join(DATA, 'assets');
const SRC = path.resolve(opt('export') || latestExport());
const MEDIA = path.resolve(opt('media') || path.join(ROOT, 'media'));
const EXTRA = opt('assets-dir') ? path.resolve(opt('assets-dir')) : (fs.statSync(SRC).isDirectory() ? path.join(SRC, '_assets') : null);

const existing = fs.existsSync(DB) && fs.readdirSync(DB).length > 0;
if (existing && !FORCE) {
  console.error(DB + ' already holds documents. This script is for the first import.\nRe-run with --force to overwrite documents that share a path with the export (others are left alone). Back up first.');
  process.exit(1);
}
fs.mkdirSync(DB, { recursive: true }); fs.mkdirSync(ASSETS, { recursive: true });

const docs = readExport(SRC);
const perColl = {};
for (const [p, d] of docs) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) { console.error('skipped ' + p + ': not a JSON object'); continue; }
  const seg = p.split('/'); const file = path.join(DB, ...seg.slice(0, -1), seg[seg.length - 1] + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sortKeys(d), null, 1) + '\n');
  const coll = seg.slice(0, -1).join('/'); perColl[coll] = (perColl[coll] || 0) + 1;
}

const sources = assetSources(MEDIA, EXTRA);
const wanted = referencedAssets(docs);
let copied = 0, kept = 0, bytes = 0; const missing = [];
for (const [id, where] of wanted) {
  const src = sources.get(id);
  if (!src || !fs.existsSync(src.file)) { if (!fs.existsSync(path.join(ASSETS, id))) missing.push(id + '  (used by ' + where + ')'); continue; }
  const dest = path.join(ASSETS, id); const size = fs.statSync(src.file).size;
  if (fs.existsSync(dest) && fs.statSync(dest).size === size) kept++; else { fs.copyFileSync(src.file, dest); copied++; }
  fs.writeFileSync(dest + '.json', JSON.stringify({ contentType: src.contentType, sizeBytes: size, createdAt: new Date().toISOString(), by: 'migrate', source: path.basename(src.file) }) + '\n');
  bytes += size;
}
const unused = [...sources.keys()].filter((id) => !wanted.has(id));

console.log('Export:  ' + SRC);
console.log('Data:    ' + DATA);
console.log('Documents written: ' + docs.length + '  (' + Object.keys(perColl).sort().map((c) => c + ' ' + perColl[c]).join(', ') + ')');
console.log('Assets:  ' + copied + ' copied, ' + kept + ' already in place, ' + (bytes / 1048576).toFixed(1) + ' MB referenced in total');
if (unused.length) console.log('Not imported (in the id map but no document or page uses them): ' + unused.length);
if (missing.length) {
  console.log('\nMISSING: ' + missing.length + ' asset(s) are referenced but have no source file:\n  ' + missing.join('\n  '));
  console.log('Download each from the artifact by its id (README.md, "Assets added on claude.ai after this export"), put the files in\n' + (EXTRA || '<export>/_assets') + ' as <id>.<ext> and run again with --force.');
  process.exitCode = 2;
} else console.log('Every asset the documents and the page reference is in place.');
