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
    # doctor photos for the hearts panel
    '247f6bc85315b2a51c393b6e12487f36': ('doctors/yogi-faldian.jpg', 'image/jpeg'),
    'f0776784520b821cad94cded1cc602c5': ('doctors/renata-yuliasari.jpg', 'image/jpeg'),
    'b5223bfbcda959e4498c7775f9a0cbf9': ('doctors/erda-avriyanti.jpg', 'image/jpeg'),
    '4dd3dc98b6ba6b007545e658e10bde56': ('doctors/kamelia-utami.jpg', 'image/jpeg'),
    '91976c1f7d5f6bccfba42ccaa2e720f7': ('doctors/nadila-ayu-karisa.jpg', 'image/jpeg'),
    '1b88fd0324bde746dc497308eeaf35ef': ('doctors/syafira-andiani.jpg', 'image/jpeg'),
    '372e16860a70bb38ea5a7bffff3917df': ('doctors/keshia-amalia.jpg', 'image/jpeg'),
    '4323e2f39e0d98dd62e74c3efea09bc8': ('doctors/stephanie-widjaja.jpg', 'image/jpeg'),
    '2112ac3124f17a343624a9c234b0b39d': ('doctors/nita-nurul-rachman.jpg', 'image/jpeg'),
    'dd62fca52ba90e26d4dbf9660d412b12': ('doctors/shiela-stefani.jpg', 'image/jpeg'),
    'd4f4260f22fa0116dd0215005d02cb9f': ('doctors/annisa-fauziah.jpg', 'image/jpeg'),
}
# harness-only driver for headless screenshots: ?act=click:<css>,wait:<ms>,... runs after the page has booted (selectors URL-encoded)
DRIVER = '''<script>(function(){var q=new URLSearchParams(location.search).get('act');if(!q)return;var steps=q.split(',');var i=0;function run(){if(i>=steps.length)return;var st=steps[i++];var m=st.indexOf(':');var k=st.slice(0,m),v=decodeURIComponent(st.slice(m+1));if(k==='wait'){setTimeout(run,parseInt(v,10)||500);return;}if(k==='click'){var el=document.querySelector(v);if(el)el.click();}if(k==='hash'){location.hash=v;}if(k==='js'){try{(0,eval)(v);}catch(e){}}if(k==='type'){var t=document.querySelector(v.split('|')[0]);if(t){t.value=v.split('|')[1];t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));}}setTimeout(run,400);}setTimeout(run,1800);})();</script>'''
SKEL = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'

def seed(query=''):
    d = {}
    # writes.json is the real seed; writes-harness.json adds the canvas sample pages and a live snapshot with one page (never written live)
    for name in ('writes.json', 'writes-harness.json'):
        fp = os.path.join(SEED, name)
        if not os.path.exists(fp): continue
        for w in json.load(open(fp)):
            d.setdefault(w['collection'], {})[w['doc_id']] = json.load(open(w['file_path'], encoding='utf-8'))
    # ?h=v1 shows a video as horizontal 16:9 in this harness only, for layout checks
    # ?live=p1,p4 clears those promos' end dates in this harness only, to look at band layouts for expired October titles
    for part in [x for x in query.split('&') if x.startswith('live=')]:
        for pid in part[5:].split(','):
            for doc in [d.get('promos', {}).get(pid)] + [v for v in d.get('published', {}).get('live', {}).get('promos', []) if v['id'] == pid]:
                if doc: doc['to'] = ''; doc['live'] = True
    for part in [x for x in query.split('&') if x.startswith('h=')]:
        vid = part[2:]
        doc = d.get('videos', {}).get(vid)
        if doc: doc['orient'] = 'h'
        for v in d.get('published', {}).get('live', {}).get('videos', []):
            if v['id'] == vid: v['orient'] = 'h'
    return d

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, f, *a): sys.stderr.write('%s\n' % (f % a))
    def do_GET(self):
        p = self.path.split('?')[0]; q = self.path.split('?')[1] if '?' in self.path else ''
        if p in ('/', '/index.html'):
            page = open(PAGE, encoding='utf-8').read()
            shim = open(os.path.join(HERE, 'shim.js'), encoding='utf-8').read()
            body = (SKEL + '<script>window.__SEED__=' + json.dumps(seed(q), ensure_ascii=False) + ';</script><script>' + shim + '</script>' + DRIVER + page + '</body></html>').encode('utf-8')
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
