# Harness-only sample pages, taken from the design canvas (Admin-Halaman / Main). Not part of writes.json, so they are never
# batch-written to the live database by accident; harness/server.py loads them next to the main seed.
import json, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def blk(id, type, text='', items=None, video=None):
    return {'id': id, 'type': type, 'text': text, 'items': items or [], 'asset': None, 'alt': '', 'video': video, 'orient': ''}
pages = [
 {'id': 'tentang', 'title': 'Tentang ADC', 'tab': 'Tentang ADC', 'order': 1, 'showTab': True, 'inSaver': False, 'from': '', 'to': '', 'status': 'draft',
  'blocks': [
   blk('b1', 'heading', 'Klinik estetika medis di Dago, Bandung'),
   blk('b2', 'text', 'Perawatan di ADC ditangani dokter spesialis kulit (Sp.DVE) dan dokter spesialis gizi klinik (Sp.GK), dengan teknologi yang dipilih sesuai kebutuhan kulit Anda.'),
   blk('b3', 'list', items=['PicoSure Pro Star Award Asia Pacific 2024', 'Klinik pertama di Bandung dengan Ultherapy PRIME', 'Jl. Ir. H. Juanda No. 88, Bandung', 'Sen–Jum 09.00–20.00 · Sab 09.00–18.00']),
   blk('b4', 'note', 'Ingin tahu perawatan yang sesuai? Tanyakan ke resepsionis untuk jadwal konsultasi dokter.')],
  'updatedAt': '2026-11-12T07:10:00Z', 'updatedBy': 'u_mkt'},
 {'id': 'sebelumlaser', 'title': 'Sebelum perawatan laser', 'tab': 'Sebelum laser', 'order': 2, 'showTab': True, 'inSaver': True, 'from': '', 'to': '', 'status': 'review',
  'blocks': [
   blk('c1', 'heading', 'Persiapan sebelum perawatan laser'),
   blk('c2', 'text', 'Beberapa langkah sederhana membantu kulit Anda siap untuk perawatan laser seperti PicoSure Pro.'),
   blk('c5', 'video', video='v1'),
   blk('c3', 'list', items=['Hentikan retinol dan AHA 3–7 hari sebelum tindakan.', 'Hindari paparan matahari dan produk tanning.', 'Beri tahu dokter jika baru melakukan skinbooster, Botox atau filler.', 'Jerawat aktif yang berat mungkin ditangani lebih dulu.']),
   blk('c4', 'note', 'Dokter akan menyesuaikan persiapan dengan kondisi kulit Anda saat konsultasi.')],
  'updatedAt': '2026-11-20T07:20:00Z', 'updatedBy': 'u_resep'},
 {'id': 'event1', 'title': 'Event klinik [judul event]', 'tab': '[judul tab]', 'order': 3, 'showTab': False, 'inSaver': False, 'from': '', 'to': '', 'status': 'draft',
  'blocks': [blk('d1', 'heading', '[Judul event]'), blk('d2', 'text', '[Tanggal, tempat dan detail event]')],
  'updatedAt': '2026-11-18T09:00:00Z', 'updatedBy': 'u_mkt'},
]
writes = []
for p in pages:
    path = f'pg-{p["id"]}.json'
    json.dump(p, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    writes.append({'op': 'set', 'collection': 'pages', 'doc_id': p['id'], 'file_path': os.path.abspath(path)})
# "Tentang ADC" is already on the screen in the harness: the live snapshot carries it as its only page
live = json.load(open('live.json', encoding='utf-8'))
live['pages'] = [{k: v for k, v in pages[0].items() if k not in ('status', 'updatedAt', 'updatedBy')}]
live['version'] = 1
json.dump(live, open('live-harness.json', 'w', encoding='utf-8'), ensure_ascii=False)
writes.append({'op': 'set', 'collection': 'published', 'doc_id': 'live', 'file_path': os.path.abspath('live-harness.json')})
json.dump(writes, open('writes-harness.json', 'w'), indent=1)
print(len(writes), 'harness-only writes')
