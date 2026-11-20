# Layar Info Perawatan ADC (waiting-room kiosk)

Live page (private until shared from its Share menu): https://claude.ai/artifact/YaWie8hkPz4CsJd4XKUgj6
Kiosk = the link itself. Admin = `#admin` (also `#perawatan`, `#promo`, `#video`, `#heart`, `#halaman`, `#tinjau`); `#pratinjau` is the admin's full-size screen preview with a way back to the admin.

- `layar-info-perawatan-adc.html` — the whole page (kiosk + admin). Publish it with the Artifact tool to the URL above to update the live page.
- `seed/` — `make_seed.py` writes the JSON documents and `writes.json` used to seed the artifact database (ArtifactData batch). Re-run it after editing, then batch-write.
- `media/` — the four videos (transcoded under the 20 MiB asset cap) and their poster frames, already uploaded as artifact assets (ids are in `seed/v-*.json`).
- `harness/` — local test server: `python -I harness/server.py 8787` serves the page at http://localhost:8787 with a shim standing in for the artifact's db/user/assets, backed by `seed/` and `media/`. The shim hands documents back with sorted keys, as the real database does, so a key-order bug in the change detection shows up here. Harness-only query switches: `?h=v1` shows that video as horizontal 16:9, `?live=p1,p4` clears those promos' end dates, `?act=click:<css>,wait:<ms>,...` drives the page for headless screenshots (for example `chrome --headless=new --window-size=1080,1920 --virtual-time-budget=9000 --screenshot=out.png "http://localhost:8787/?act=click:%23saver#kiosk"`). `seed/make_pages_seed.py` writes the three sample pages from the design canvas plus a live snapshot that already shows "Tentang ADC"; they are harness-only (`seed/writes-harness.json`) and never part of the live seed.
- Quick check after any change to the change detection: open `#tinjau` in the harness, publish a change, and confirm the sidebar badge reads 0 afterwards (drafts and the new live snapshot compare equal through `canon()`).
- `PRODUCT.md` — product context for Impeccable. Run Impeccable commands with this folder as the working directory.
- `design/canvas/` — source files of the approved design canvas (https://claude.ai/artifact/TaJF1szBgcrpF4EcEKs7Km): kiosk frames, admin pages, page editor and the review-before-publish screen, styled to `ADC Files\Branding\ADC_Design_System_Final.md` (v2.0). Open them on the canvas, not as standalone pages.

## How content reaches the screen

Every edit in the admin (treatments, promos, videos, settings, pages) only writes a draft. The screen reads `published/live`, which changes only from **Tinjau & publikasikan**: the page lists each pending change (drafts compared with the live snapshot, key order ignored), lets the admin include or exclude each one, runs the automatic checks (banned words, promos still marked live past their end date, Elle videos without the AI label, tab labels over 18 characters), shows a mini preview of the screen "after publishing" and "live now", and publishes the included changes as a numbered version (`versions/vN`, index in `published/history`). "Kembalikan ke draf" marks the selected changes as returned with a note; a returned draft stays out of the list until it is edited again. Restoring an old version from the history creates a pending change that is published like any other, after which the drafts are rewritten to match. Pages (`pages/`) are composed from blocks (heading, text, list, note, image, video) and enter the review list only after "Kirim ke tinjauan". Hearts (`heartTallies/`, `config/hearts`) are the patients' own data and bypass the review step.

## Branches

- `main` — what is live on the clinic display. Only merge into it what has been published to the live page.
- `develop` — work in progress: the brand restyle and the admin pages + review-before-publish flow. Merge into `main` once it is published and checked on the kiosk.
