# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Patients** of Aesthetic Derma Centre (ADC), Bandung, waiting 5–20 minutes in the waiting room before a consultation. They browse treatments on a standing portrait touch screen: what a treatment is for, roughly what it costs, how many sessions, downtime, and what to do afterwards. They are not signed in and never type.
- **Clinic staff** (receptionist, marketing), as Editors of the published page: they keep treatments, promos and videos current from the admin route (`#admin`) and publish changes to the screen. Confirmed 2026-10-24.

## Product Purpose

An in-clinic information screen ("Layar Info Perawatan ADC") so patients can learn about treatments while they wait, and staff can change what the screen shows without a developer. Success: patients arrive at the consultation already oriented (and ask the receptionist about a promo), and staff publish a change in under five minutes.

The kiosk has two independent zones on one 1080×1920 portrait screen: zone A (video screen saver when idle, treatment dashboard on touch, full-zone video player) and zone B (a promo band that cycles on its own timer, whatever zone A is doing).

## Positioning

Treatment information vetted by ADC's own doctors, with "mulai dari" prices taken from the clinic's official Daftar Harga, Elle explainer videos, a calm no-hard-sell tone, and a staff publish gate so nothing unreviewed reaches the screen. Confirmed 2026-10-24.

## Operating Context

- Device: a Windows PC with a portrait touch display in a kiosk browser, like the "Give Your Doctor a Heart" kiosk. Confirmed 2026-10-24. Signed in with an account that can view the artifact; the admin needs Editor.
- Room: waiting room, sound off by default; patients may walk up mid-video. Idle returns to the screen saver (default 2 minutes).
- Content sources: treatment names, categories and prices from the website's Treatments menu and Daftar Harga page (aestheticdermacentre.com, Shopify); promos entered by staff (the website's Promotions page is empty); videos from the Elle spokesperson series and the PicoSure Pro explainer.
- Booking and questions go through the receptionist and WhatsApp +62 821-3014-4778 (shown on the kiosk as a peach information strip, never a link: a link on a public screen would open WhatsApp Web on the clinic display); the kiosk never navigates away.
- Hours shown on screen: Sen–Jum 09.00–20.00, Sab 09.00–18.00; Jl. Ir. H. Juanda No. 88, Bandung.

## Capabilities and Constraints

- Runs as a published claude.ai Artifact: https://claude.ai/artifact/YaWie8hkPz4CsJd4XKUgj6 (kiosk = the link, admin = `#admin`, tabs `#perawatan`, `#promo`, `#video`). Source: `layar-info-perawatan-adc.html` in this folder; local test harness in `harness/`; seed data in `seed/`; uploaded media in `media/`.
- Data lives in the artifact database: drafts in `treatments/`, `promos/`, `videos/`, `config/settings`, `config/log`; the kiosk reads only `published/live`, rewritten by "Publikasikan ke layar". Everyone who can open the page reads; only Editors write.
- Assets (videos, posters, treatment photos) are artifact assets, capped at 20 MiB per file by the platform. Videos must be transcoded before upload (H.264, 1080×1920, about 2.1–2.9 Mbps, AAC 96 kbps).
- Copy is Bahasa Indonesia. Treatment categories are the ten from the website menu: Laser, Facial, Hair, Injectables, Microneedling, Body Health, Contouring & Face Lifting, Body Contouring, Intima, Blepharoplasty.
- Empty price = "Tanya resepsionis"; empty sessions/duration/downtime = "Ditentukan dokter"; empty after-care = "Mengikuti anjuran dokter setelah tindakan."
- Promos are packages, bonuses or vouchers with validity dates; the kiosk shows only live promos whose dates include today, so scheduled promos start on their own.
- Health-advertising compliance (binding): no "sembuh", "terbaik", "dijamin", "garansi", "permanen", "paling", "#1"; no urgency words ("buruan", "sekarang juga", "segera", "terbatas"); no strikethrough prices; no before/after photos; videos with the Elle character carry the label "Karakter virtual (AI)". The admin blocks saves that contain banned words.
- Undecided: whether more than one screen will run in the clinic (the database already supports it); whether treatment photos will be added (none uploaded yet).

## Brand Commitments

- Name: ADC, Aesthetic Derma Centre. Logo: the official wordmark, black on light grounds, never redrawn, stretched or shadowed; logotype at least 250 px wide on screen.
- Design system (since 2026-11-20): `C:\Alex Workspace\ADC Files\Branding\ADC_Design_System_Final.md` (v2.0), the only token source. Page #f5f2ec, cards #fcfbf9, text #212121, muted #545454, dividers #d1cdc4, promo band #eae6dd, peach #e9d2c2 for badges and highlights, gold #ab8c52 for admin hover only, greige #c0bcb4 with a #545454 border for secondary buttons, near-black #212121 for primary buttons. Archivo for headings (400–500, sentence case), Archivo Narrow for body and UI with 0.025em body tracking, 0.05em labels, 0.125em uppercase 600 buttons. Buttons, inputs, badges and toggles square; cards by shadow 0 2px 8px rgba(0,0,0,0.06), not hairlines; avatars and dots stay circles. No dark theme. The earlier "ADC Doctor Hearts" look (wine, blush, Cormorant, Jost) is retired for this product.
- Voice: professional medical authority with aesthetic elegance; calm, not hype ("gentle, balance, calm, restorative"). Tagline in use: "Modern Technology for Modern People." Sentence case everywhere; numbers under ten spelled out in prose, prices and durations as digits; no emoji.
- Elle: the clinic's fictional 3D-cartoon/photoreal spokesperson for education only, always labelled as a virtual character.
- Approved visual design of this product: the Design canvas https://claude.ai/artifact/TaJF1szBgcrpF4EcEKs7Km (Main + four admin pages).

## Evidence on Hand

- 31 treatments with categories and prices from the website (seeded; see `seed/make_seed.py`).
- 4 explainer videos in `media/`: PicoSure Pro (real footage, 0:53), Kasus Kulit #1: Melasma (Elle, 0:41), Flek hitam (Elle, 0:58), Jerawat: 4 faktor (Elle, 0:31), with poster frames.
- 6 promos entered by staff for October/November 2026 (one scheduled, one ended).
- Absent, do not fabricate: patient testimonials, before/after results, clinical outcome claims, treatment photos.

## Product Principles

1. The screen informs; the receptionist and doctor sell and decide. Every price is "mulai dari" and every outcome is "dapat berbeda".
2. Nothing reaches patients unreviewed: staff draft, then publish.
3. Zone B never interrupts zone A: promos cycle on their own clock, and a patient's touch pauses only the band.
4. Idle is the default state: the screen saver must look right with no one in front of it.
5. Staff can do everything from the admin page on a phone or laptop without a developer.

## Accessibility & Inclusion

Standing touch screen at 1080×1920: targets at least 48 px, body text at least 14 px at native scale, ink-muted on surfaces at 4.5:1. Sound off by default; subtitles are burned into the Elle videos. No time-limited inputs for patients.
