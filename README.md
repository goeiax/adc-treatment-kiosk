# Layar Info Perawatan ADC (waiting-room kiosk)

Live page (private until shared from its Share menu): https://claude.ai/artifact/YaWie8hkPz4CsJd4XKUgj6
Kiosk = the link itself. Admin = `#admin` (also `#perawatan`, `#promo`, `#video`).

- `layar-info-perawatan-adc.html` — the whole page (kiosk + admin). Publish it with the Artifact tool to the URL above to update the live page.
- `seed/` — `make_seed.py` writes the JSON documents and `writes.json` used to seed the artifact database (ArtifactData batch). Re-run it after editing, then batch-write.
- `media/` — the four videos (transcoded under the 20 MiB asset cap) and their poster frames, already uploaded as artifact assets (ids are in `seed/v-*.json`).
- `harness/` — local test server: `python -I harness/server.py 8787` serves the page at http://localhost:8787 with a shim standing in for the artifact's db/user/assets, backed by `seed/` and `media/`. Use it to check layout and behaviour at 1080×1920 without signing in.
- `PRODUCT.md` — product context for Impeccable. Run Impeccable commands with this folder as the working directory.
- `design/canvas/` — source files of the approved design canvas (https://claude.ai/artifact/TaJF1szBgcrpF4EcEKs7Km): kiosk frames, admin pages, page editor and the review-before-publish screen, styled to `ADC Files\Branding\ADC_Design_System_Final.md` (v2.0). Open them on the canvas, not as standalone pages.

## Branches

- `main` — what is live on the clinic display. Only merge into it what has been published to the live page.
- `develop` — work in progress: the brand restyle and the admin pages + review-before-publish flow. Merge into `main` once it is published and checked on the kiosk.
