import http.server, json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PAGE = os.path.join(ROOT, 'layar-info-perawatan-adc.html')
SEED = os.path.join(ROOT, 'seed')
MEDIA = os.path.join(ROOT, 'media')
BLOBS = {
    '3190c05c3f64f0f199396765bbb31bea': ('video-picosure.mp4', 'video/mp4'),
    'd3336a38604c448526c2238fc1e57b2a': ('video-melasma.mp4', 'video/mp4'),
    '6431d7d559872bd5a6d9593548dc6a81': ('video-flek.mp4', 'video/mp4'),
    '3dbe5d12e799f626e55da5800287e855': ('video-acne.mp4', 'video/mp4'),
    'f6ec3cdc1df117e52002d6de587b2a0a': ('poster-picosure.jpg', 'image/jpeg'),
    'ee6c442cd6c4bd99082a416bc4005ed0': ('poster-melasma.jpg', 'image/jpeg'),
    '4cd0714aaddf131c4d38ddd7fcdd3bc3': ('poster-flek.jpg', 'image/jpeg'),
    'b6bf88aacb1e802d5fab266bfbf5a84f': ('poster-acne.jpg', 'image/jpeg'),
}
SKEL = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'

def seed():
    d = {}
    for w in json.load(open(os.path.join(SEED, 'writes.json'))):
        d.setdefault(w['collection'], {})[w['doc_id']] = json.load(open(w['file_path'], encoding='utf-8'))
    return d

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, f, *a): sys.stderr.write('%s\n' % (f % a))
    def do_GET(self):
        p = self.path.split('?')[0]
        if p in ('/', '/index.html'):
            page = open(PAGE, encoding='utf-8').read()
            shim = open(os.path.join(HERE, 'shim.js'), encoding='utf-8').read()
            body = (SKEL + '<script>window.__SEED__=' + json.dumps(seed(), ensure_ascii=False) + ';</script><script>' + shim + '</script>' + page + '</body></html>').encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        m = re.match(r'^/_blob/([0-9a-f]{32})$', p)
        if m and m.group(1) in BLOBS:
            name, ct = BLOBS[m.group(1)]; fp = os.path.join(MEDIA, name); size = os.path.getsize(fp)
            rng = self.headers.get('Range'); start, end = 0, size - 1
            if rng:
                mm = re.match(r'bytes=(\d*)-(\d*)', rng)
                if mm:
                    if mm.group(1): start = int(mm.group(1))
                    if mm.group(2): end = int(mm.group(2))
                    end = min(end, size - 1)
            self.send_response(206 if rng else 200)
            self.send_header('Content-Type', ct); self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Length', str(end - start + 1))
            if rng: self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
            self.end_headers()
            with open(fp, 'rb') as f:
                f.seek(start); left = end - start + 1
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk: break
                    try: self.wfile.write(chunk)
                    except (ConnectionAbortedError, BrokenPipeError): return
                    left -= len(chunk)
            return
        self.send_response(404); self.end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    print('harness on http://localhost:%d' % port, flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
