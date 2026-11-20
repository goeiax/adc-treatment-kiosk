import json, os, datetime
os.chdir(os.path.dirname(os.path.abspath(__file__)))
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
C = {'laser': 'Laser', 'facial': 'Facial', 'hair': 'Hair', 'inj': 'Injectables', 'mn': 'Microneedling', 'body': 'Body Health', 'lift': 'Contouring & Face Lifting', 'bodyc': 'Body Contouring', 'intima': 'Intima', 'bleph': 'Blepharoplasty'}
T = [
 ('picosure','laser','PicoSure Pro','Laser picosecond untuk flek, melasma, dan bekas jerawat.','Rp4.500.000','3–5 sesi','±45 mnt anestesi + 15–20 mnt laser','Kemerahan ringan, hilang dalam hitungan jam','Skincare lembut, hindari sinar matahari, sunscreen setiap hari, tanpa makeup 3 hari.','Flek, melasma, bekas jerawat, pori, garis halus, tato','v1'),
 ('excelv','laser','Excel-V','Laser vaskular untuk kemerahan dan pembuluh darah halus.','Rp2.500.000','','','','','Kemerahan, pembuluh darah halus',None),
 ('fractional','laser','Fractional Laser by Lutronic','Perbaikan tekstur dan peremajaan kulit.','Rp1.900.000','','','','','Tekstur kulit, bekas jerawat, peremajaan',None),
 ('dpc','facial','Deep Pore Cleansing','Pembersihan pori mendalam, perawatan dasar rutin.','Rp450.000','','','Minimal','','Komedo, pori tersumbat, jerawat ringan','v4'),
 ('peeling','facial','Peeling','Glow peel untuk kulit lebih halus dan cerah.','Rp675.000','','','','','Kulit kusam, tekstur kasar','v4'),
 ('dpcombo','facial','Deep Pore Combo','Deep Pore Cleansing dipadukan dengan peeling.','','','','','','Komedo, kulit kusam','v4'),
 ('ipl','hair','IPL Hair Removal','Terapi cahaya untuk mengurangi rambut tubuh.','Rp299.000','','','','','Rambut tubuh',None),
 ('hgl','hair','Hair Growth Laser','Penanganan kerontokan rambut.','Rp500.000','','','','','Kerontokan rambut',None),
 ('phg','hair','Premium Hair Growth Treatment','Perawatan pertumbuhan rambut (serum terpisah).','Rp1.500.000','','','','','Kerontokan rambut, rambut tipis',None),
 ('sb','inj','Skin Boosters','Injeksi untuk hidrasi dan peremajaan kulit.','Rp3.500.000','','','','','Kulit kering, garis halus',None),
 ('botox','inj','Botox','Untuk kerutan dinamis.','Rp3.500.000','','','','','Kerutan dinamis',None),
 ('fli','inj','Fat Loss Injection','Injeksi untuk lemak lokal.','Rp900.000','','','','','Lemak lokal',None),
 ('mnrf','mn','Microneedling RF by Exion','Stimulasi kolagen dengan radiofrekuensi, wajah dan tubuh.','','','','','','Tekstur kulit, bekas jerawat, pori',None),
 ('dp4','mn','Dermapen 4','Stimulasi kolagen untuk tekstur kulit.','Rp1.250.000','','','','','Tekstur kulit, bekas jerawat',None),
 ('slim','body','Slimming Program','Program penurunan berat dengan dokter Sp.GK.','','','','Tidak ada','','Berat badan',None),
 ('meta','body','Metabolic Health Treatment','Penanganan kesehatan metabolik bersama dokter Sp.GK.','','','','Tidak ada','','Kesehatan metabolik',None),
 ('pcos','body','PMOS (PCOS) Promil Treatment','Program promil untuk PCOS bersama dokter Sp.GK.','','','','Tidak ada','','PCOS, program hamil',None),
 ('fd','body','Food Detective Test','Tes intoleransi makanan.','','1 kali','','Tidak ada','','Intoleransi makanan',None),
 ('ulth','lift','Ultherapy PRIME','Lifting non-bedah berbasis MFU-V.','','','','','','Kulit kendur, kontur wajah',None),
 ('lifu','lift','Ultra Lifting','Pengencangan dengan focused ultrasound.','','','','','','Kulit kendur',None),
 ('exion','lift','Exion','Peremajaan kulit wajah dengan Exion.','','','','','','Peremajaan wajah',None),
 ('exilisf','lift','Exilis Ultra 360','Pengencangan kulit wajah.','','','','','','Kulit kendur wajah',None),
 ('exipro','bodyc','ExiPro','Body slimming dengan ExiPro.','Rp650.000','','','','','Lemak tubuh, kontur tubuh',None),
 ('xwave','bodyc','X-Wave','Terapi gelombang untuk selulit.','','','','','','Selulit',None),
 ('exilisb','bodyc','Exilis Ultra 360 Body','Pengencangan kulit tubuh.','','','','','','Kulit kendur tubuh',None),
 ('emsella','intima','Emsella','Terapi kursi untuk otot dasar panggul.','','','','Tidak ada','','Otot dasar panggul',None),
 ('bella','intima','Bella Laser','Laser area intim oleh dokter.','','','','','','Area intim',None),
 ('iplb','intima','IPL Hair Removal & Brightening','Hair removal dan brightening area intim.','Rp499.000','','','','','Rambut dan warna kulit area intim',None),
 ('femme','intima','Exilis Ultra Femme','Perawatan area intim dengan Exilis Ultra Femme.','Rp500.000','','','','','Area intim',None),
 ('eyebag','bleph','Eye Bag Removal','Tindakan bedah minor, diawali konsultasi dokter.','','1 kali','','','','Kantung mata',None),
 ('eyelid','bleph','Eye Lid','Tindakan bedah minor, diawali konsultasi dokter.','','1 kali','','','','Kelopak mata',None),
]
treat = []
for i, (id, cat, name, desc, price, ses, dur, dt, after, conc, vid) in enumerate(T):
    treat.append({'id': id, 'name': name, 'cat': C[cat], 'desc': desc, 'price': price, 'sessions': ses, 'duration': dur, 'downtime': dt, 'after': after, 'concerns': conc, 'photo': None, 'video': vid, 'show': True, 'order': i + 1})
videos = [
 {'id': 'v1', 'title': 'PicoSure Pro: apa yang terjadi saat laser bekerja', 'desc': 'Cara kerja laser picosecond, rasa saat tindakan, dan perawatan setelahnya.', 'dur': 53, 'asset': '3190c05c3f64f0f199396765bbb31bea', 'poster': 'f6ec3cdc1df117e52002d6de587b2a0a', 'ai': False, 'ratio': '9:16'},
 {'id': 'v2', 'title': 'Kasus Kulit #1: Melasma', 'desc': 'Elle menjelaskan apa itu melasma, kenapa muncul kembali, dan bagaimana dokter menyusun programnya.', 'dur': 41, 'asset': 'd3336a38604c448526c2238fc1e57b2a', 'poster': 'ee6c442cd6c4bd99082a416bc4005ed0', 'ai': True, 'ratio': '9:16'},
 {'id': 'v3', 'title': 'Flek hitam: kenapa muncul dan apa pilihannya', 'desc': 'Penyebab flek hitam dan pilihan perawatan yang dibahas bersama dokter.', 'dur': 58, 'asset': '6431d7d559872bd5a6d9593548dc6a81', 'poster': '4cd0714aaddf131c4d38ddd7fcdd3bc3', 'ai': True, 'ratio': '9:16'},
 {'id': 'v4', 'title': 'Jerawat: 4 faktor penyebabnya', 'desc': 'Empat faktor di balik jerawat dan kenapa penanganannya dimulai dari diagnosis.', 'dur': 31, 'asset': '3dbe5d12e799f626e55da5800287e855', 'poster': 'b6bf88aacb1e802d5fab266bfbf5a84f', 'ai': True, 'ratio': '9:16'},
]
promos = [
 {'id': 'p1', 'title': 'Ultherapy PRIME', 'accent': '+ skinbooster gratis', 'eyebrow': 'Promo Oktober', 'kind': 'Bonus', 'value': 'Gratis', 'valueLabel': 'Bonus', 'valueNote': '1 sesi skinbooster', 'lede': 'Satu sesi skinbooster gratis untuk Ultherapy PRIME 500, 600 atau 700 shots.', 'chip': 'Ultherapy PRIME', 'from': '2026-10-01', 'to': '2026-10-31', 'live': True, 'order': 1},
 {'id': 'p2', 'title': 'Paket PicoSure Glow', 'accent': '6 sesi', 'eyebrow': 'Paket perawatan', 'kind': 'Paket', 'value': 'Rp21.600.000', 'valueLabel': 'Harga paket', 'valueNote': '6 sesi + Signature Facial', 'lede': 'Enam sesi PicoSure Glow dengan Signature Facial gratis. Paket berlaku 6 bulan sejak pembelian.', 'chip': 'PicoSure Pro', 'from': '2026-10-01', 'to': '2026-10-31', 'live': True, 'order': 2},
 {'id': 'p3', 'title': 'Selamat ulang tahun', 'accent': 'dari ADC', 'eyebrow': 'Bulan ulang tahun', 'kind': 'Voucher', 'value': 'Rp100.000', 'valueLabel': 'Voucher', 'valueNote': 'min. transaksi Rp1.000.000', 'lede': 'Voucher Rp100.000 untuk perawatan di bulan ulang tahun Anda, minimum transaksi Rp1.000.000.', 'chip': 'Semua perawatan', 'from': '', 'to': '', 'live': True, 'order': 3},
 {'id': 'p4', 'title': 'Ajak teman,', 'accent': 'dapat voucher', 'eyebrow': 'Program referral', 'kind': 'Voucher', 'value': 'Rp200.000', 'valueLabel': 'Voucher', 'valueNote': 'untuk setiap teman baru', 'lede': 'Voucher Rp200.000 untuk Anda saat teman yang Anda ajak melakukan perawatan pertamanya di ADC.', 'chip': 'Program referral', 'from': '2026-10-01', 'to': '2026-10-31', 'live': True, 'order': 4},
 {'id': 'p5', 'title': 'Paket Hair Loss', 'accent': 'November', 'eyebrow': 'Paket perawatan', 'kind': 'Paket', 'value': 'Tanya resepsionis', 'valueLabel': 'Harga paket', 'valueNote': 'Hair Growth Laser + Plazion', 'lede': 'Paket Hair Growth Laser dengan Plazion gratis.', 'chip': 'Hair Growth Laser', 'from': '2026-11-01', 'to': '2026-11-30', 'live': True, 'order': 5},
 {'id': 'p6', 'title': 'Skincare Neostrata', 'accent': '& La Roche-Posay', 'eyebrow': 'Produk skincare', 'kind': 'Produk', 'value': 'Sampel gratis', 'valueLabel': 'Produk', 'valueNote': 'pembelian min. Rp3.000.000', 'lede': 'Sampel gratis untuk pembelian skincare Rp3.000.000.', 'chip': 'Produk skincare', 'from': '2026-09-01', 'to': '2026-09-30', 'live': False, 'order': 6},
]
settings = {'idleMin': 2, 'slideSecs': 8, 'hideBandWhenEmpty': True, 'holdOnTouch': True, 'saverOn': True, 'sound': False, 'showTitles': True, 'playlist': ['v1', 'v2', 'v3', 'v4'], 'updatedAt': now}
log = {'entries': [{'text': 'Layar dipublikasikan', 'when': now, 'by': None}, {'text': 'Data awal dimuat: 31 perawatan, 6 promo, 4 video', 'when': now, 'by': None}]}
def stamp(d):
    d = dict(d); d['updatedAt'] = now; return d
live = {'treatments': treat, 'promos': promos, 'videos': videos, 'settings': {k: v for k, v in settings.items() if k != 'updatedAt'}, 'publishedAt': now, 'by': None}
writes = []
def put(path, obj, coll, doc_id):
    json.dump(obj, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    writes.append({'op': 'set', 'collection': coll, 'doc_id': doc_id, 'file_path': os.path.abspath(path)})
for t in treat: put(f't-{t["id"]}.json', stamp(t), 'treatments', t['id'])
for v in videos: put(f'v-{v["id"]}.json', stamp(v), 'videos', v['id'])
for p in promos: put(f'p-{p["id"]}.json', stamp(p), 'promos', p['id'])
put('settings.json', settings, 'config', 'settings')
put('log.json', log, 'config', 'log')
put('live.json', live, 'published', 'live')
json.dump(writes, open('writes.json', 'w'), indent=1)
print(len(writes), 'writes; live.json', os.path.getsize('live.json'), 'bytes')
