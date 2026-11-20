---
target: the kiosk page (layar-info-perawatan-adc.html)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Alex Workspace\\ADC Files\\kiosk\\layar-info-perawatan-adc.html"
target_fingerprint: "sha256:a923ea770915f2c64db185278bf1ed6fa78f6ab2c17c803eb04fb967b142a6cd"
target_path: "C:\\Alex Workspace\\ADC Files\\kiosk\\layar-info-perawatan-adc.html"
timestamp: 2026-10-24T16-19-42Z
slug: layar-info-perawatan-adc-html
---
Method: dual-agent (A: design review · B: detector + browser evidence). Harness at http://localhost:8787; kiosk at stage scale 1 and 800×1422 fit; admin at 1440×1000 and 390×844; light theme.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Pause signalled only by badge text; admin toasts have no live region. |
| 2 | Match system / real world | 4 | Plain Bahasa, Indonesian dates, clinic hours. |
| 3 | User control and freedom | 2 | Publikasikan has no confirm/undo; "Pratinjau layar" on a phone has no in-page return. |
| 4 | Consistency and standards | 3 | WhatsApp line still a 56 px wine-outlined pill that does nothing; promo save keeps plus icon on "Simpan perubahan". |
| 5 | Error prevention | 3 | 20-char promo value overflows the 360 px value box past the stage edge; video delete removes an asset the live snapshot still references. |
| 6 | Recognition rather than recall | 3 | Promo "Ubah" 29×32 px; treatment delete at foot of a 2,261 px form. |
| 7 | Flexibility and efficiency | 3 | Phone: promo form 2,466 px down, Publish only at top. |
| 8 | Aesthetic and minimalist design | 2 | 350–544 px empty surface between last card and footer in 8 of 10 categories; deeper when band hidden. |
| 9 | Error recovery | 3 | Failed clips skipped; no upload retry; K.failed never cleared. |
| 10 | Help and documentation | 4 | Contextual help on every admin field. |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

LLM: authored for ADC (inlined wordmark, Doctor Hearts tokens with wine as the only accent, Cormorant/Jost, compliance-shaped copy and banned-word gate, kiosk pins light tokens, two-zone architecture verified live). Generic patch: text-only hero over a card grid for most categories since only 2 of 31 treatments have video.

Deterministic scan: 3 CLI low-contrast findings, all false positives (cross-theme token pairs; logo fill vs dark surface where a CSS filter inverts the logo). broken-image ignore honoured. Browser: kiosk 1 (cream-palette = surface token) in both states; admin 4, promo 11, video 4. Real: placeholders 4.1:1 (5 fields), drop hints ink-muted on surface-300 4.4:1, 9–10 px type in the promo miniature, eyebrow-above-h1 in admin header (2 pages), two 12 px line orphans. Kiosk: 0 console errors, 0/17 targets under 48 px, no pill overflow (2 rows), halo fully wraps title, text 4.9–7.1:1.

Visual overlays: injected in the agent's own tab and closed afterwards; no [Human] tab left open.

## Overall Impression

Up three points, earned where the patient stands: whole clips, findable categories, treatment leads with price. Held at Good by a dashboard still sized for content that does not exist, a contact line that reads as a button, and one-tap publish/delete in the admin. Biggest opportunity: let the hero absorb the empty space with the "Untuk keluhan apa" field already captured in admin and never shown.

## What's Working

- Fallback copy designed, not defaulted (grammatical missing-facts sentence; missing price never looks like a price).
- Zone B independence legible; single promo drops stale cues instead of freezing.
- Admin previews mirror the kiosk (card typography, band miniature).

## Priority Issues

1. [P1] Long promo value overflows band and stage (20 chars → 497 px in a 360 px box; preview does not show it). Fix: maxlength 14, `.long` step to 40 px above 12 chars, overflow-wrap anywhere, preview reproduces overflow. Command: /impeccable harden.
2. [P1] Dashboard leaves 350–544 px empty in 8 of 10 categories (+540 when band hidden); `sel.concerns` never rendered. Fix: render concerns in hero as "Untuk keluhan", let hero/after-care take the space, grid flex 0 0 auto, footer follows content. Command: /impeccable layout.
3. [P1] WhatsApp line still reads as a button (56 px outlined wine pill, span); band "Tanya resepsionis" solid pill is a span too. Fix: text with glyph, no border/fill, or a real button revealing a QR. Command: /impeccable clarify.
4. [P2] Publish and delete are one-tap; deleteVideo removes an asset the live snapshot still references. Fix: inline confirm naming the diff when count > 0; delete confirm naming the cascade; defer asset deletion until a publish removes the reference. Command: /impeccable harden.
5. [P2] Admin accessibility and header pattern: no aria-live toast, focus lost on hidden file inputs, 28–32 px controls, 1.2:1 hairlines, placeholders 4.1:1, hints 4.4:1, eyebrow-above-h1 (craft-floor ban). Fix: 44 px controls, role=status toast, tabindex=-1 hidden inputs + focusable drop label, darker hints/placeholders, 3:1 borders, fold zone name into title/sidebar. Command: /impeccable audit then /impeccable harden.

## Persona Red Flags

- Jordan: jargon pills without gloss or "Semua"; 40 px price vs 12 px reassurance 500 px lower; taps the WhatsApp pill; pause has no glyph/hint; video end snaps back with no cue.
- Sam: no live region; focus vanishes on uploads; 29×32 px "Ubah"; 28–32 px icon buttons; 1.2:1 control borders; switch without visible label; 12 px help text.
- Riley: empty states all worded; 0 promos deepens void by 540 px; 1 promo removes dots/nav/bar so layout shifts when a second goes live; 60-char name wraps hero to 3 lines and stacks "Mulai / dari"; 20-char value overflows; K.failed never cleared.
- Resepsionis ADC (phone): ~440 px collapsed sidebar first; promo form at 2,466 px; Publish 2,500 px back up, no sticky bar; "Pratinjau layar" no in-page return; "Tayang" toggle writes draft instantly and reads as live.

## Minor Observations

Category chip orphaned at far right of hero; plus icon kept on "Simpan perubahan"; playlist titles truncate; whole-mode saver hides "1 / 4"; selected card ring is the only cue at 1.5 m; 12 px text remains on kiosk (legal, hours, fact labels, date, validity, duration) against PRODUCT.md's 14 px; reduced-motion respected.

## Questions to Consider

- Is the treatment the wrong unit? Lead with the four Elle films and hang treatments off them?
- Why a 40 px price when every price is "mulai dari" and the receptionist sells? Would a quieter 22 px line serve the positioning better?
- The band's "Tanya resepsionis" is the most button-like element and does nothing. Is "never navigates away" a constraint or a missed moment (QR to WhatsApp, ping the desk)?
