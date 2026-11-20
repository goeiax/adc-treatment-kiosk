---
target: the kiosk page (layar-info-perawatan-adc.html)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Alex Workspace\\ADC Files\\kiosk\\layar-info-perawatan-adc.html"
target_fingerprint: "sha256:8e368b8576001328dbdcb345df92322f8bda32bfdba9a3e64182852494a09770"
target_path: "C:\\Alex Workspace\\ADC Files\\kiosk\\layar-info-perawatan-adc.html"
timestamp: 2026-10-24T11-22-25Z
slug: layar-info-perawatan-adc-html
closed: true
---
Method: dual-agent (A: design review · B: detector + browser evidence). Harness at http://localhost:8787, kiosk 1080×1920, admin 1440×1000 and 390×844, light theme.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Kiosk feedback good; admin toasts have no live region; upload bar animates without real progress. |
| 2 | Match system / real world | 3 | Upload copy promises framing for 16:9 and "9:16 paling pas", but zone A is 1080×1380 and object-fit: cover crops. |
| 3 | User control and freedom | 2 | No pause in player; no video error handler; promos cannot be deleted; Publikasikan has no confirm/preview/undo. |
| 4 | Consistency and standards | 3 | WhatsApp pill is a span styled as a primary button; AI label rendered three different ways. |
| 5 | Error prevention | 3 | Good gates; lists print title without accent; long promo titles overflow the fixed 583×104 halo. |
| 6 | Recognition rather than recall | 2 | Category pills overflow with hidden scrollbar: Intima half-clipped, Blepharoplasty off-screen. Phone admin table hides columns. |
| 7 | Flexibility and efficiency | 3 | Search and toggles fine; reorder arrow-only, playlist arrows 13 px wide. |
| 8 | Aesthetic and minimalist design | 2 | ~370 px void between card grid and detail; "Ditentukan dokter" ×3 for 27/31; HTML titles over burned-in titles. |
| 9 | Error recovery | 3 | Specific Bahasa toasts, but vanish in 6 s and never name the field. |
| 10 | Help and documentation | 3 | Strong inline help; nothing explains what Publikasikan publishes. |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict

LLM: authored for ADC (real wordmark symbol, Doctor Hearts tokens, Cormorant/Jost, ten website categories, "mulai dari / dapat berbeda" register, WA number and hours, banned-word gate, canvas's rose-halo promo title). Template slips: 2-up grid sized for a catalogue that never exceeds four per category; generic lower-third title overlay on clips that already carry titles/subtitles. Comped against PicoSure Pro; the other 27 treatments show it.

Deterministic scan: 6 CLI findings (4 low-contrast, 2 broken-image), all false positives (cross-theme token pairs, a shadow colour read as text, hidden imgs with runtime src). Browser overlay: kiosk 1 (cream-palette = surface-100 token), admin 4, promo 11, video 9. Real among them: placeholders 4.1:1 (five fields), drop-zone hints ink-muted on surface-300 4.4:1, 9–10 px type inside the miniature promo preview, promo form column 146% of viewport. text-occlusion ×5 were the detector's own overlay labels. Kiosk measured: 0 console errors, 0/17 visible targets under 48 px, body text 4.9–5.4:1.

Visual overlays: injected in the agent's own tab, closed afterwards; no [Human] tab left open.

## Overall Impression

Chrome and compliance thinking are right; product principles honoured in code (zone B runs independently). The middle of the kiosk screen is the weak point: biggest area spent on whitespace, loudest type on headline and clock, price the quietest text. Biggest opportunity: re-centre zone A's dashboard on the treatment and show the videos whole.

## What's Working

- Compliance designed in: bannedIn() across all patient-facing fields, pre-emptive placeholders, doctor-voiced fallbacks.
- Zone independence holds: band advanced while the player ran; touch pauses only the band; empty case covered.
- Admin live previews reuse kiosk components and tokens; per-row Aktif/Terjadwal/Berakhir status makes scheduling legible.

## Priority Issues

1. [P1] 9:16 videos cover-cropped into 1080×1380 (bottom 432 px lost, where burned-in subtitles sit) and HTML title painted over the remaining captions. Fix: object-fit: contain on #1e1819, move/suppress HTML title when clip carries its own, honour showTitles per clip, correct upload copy. Command: /impeccable adapt.
2. [P1] Category pills overflow (scrollWidth 1236 vs 1016) with hidden scrollbar; Intima half-clipped, Blepharoplasty off-screen. Fix: wrap into two rows or 2×5 grid; drop hidden-scrollbar on kiosk. Command: /impeccable layout.
3. [P1] Dashboard laid out for a catalogue that does not exist; ~370 px void; price lowest weight; "Ditentukan dokter" ×3 for 27/31. Fix: detail as hero under pills (name 34 px, price 28–32 px wine, 2×2 facts showing filled ones + one consolidated line), grid after with no flex-grow, .tcard .p 16 px ink, clock 20 px. Command: /impeccable layout.
4. [P2] Admin fails phone/low-vision staff: 32 px buttons/links, 13 px playlist arrows, Tab lands on 1×1 file inputs, no aria-live on toasts, no role="switch", hints 4.4:1, placeholders 4.1:1, hairlines 1.2:1. Fix: 44 px minimum, flex: 0 0 auto on list buttons, tabindex=-1 on .sr inputs with focusable drop label, role="status" on toast, role="switch", darker placeholder/hint colours. Command: /impeccable audit then /impeccable harden.
5. [P2] Publikasikan has no confirm/diff/preview; video delete cascades silently; promos cannot be deleted. Fix: confirm step listing diff() with preview link, disabled when nothing changed; cascade-naming video confirm; two-step "Hapus promo". Command: /impeccable harden.

## Persona Red Flags

- Jordan: "Belum ada video" fills the biggest panel for most categories; Intima/Blepharoplasty unfindable; price 13 px grey; WhatsApp pill does nothing; player end drops back mid-reading.
- Sam: Tab focus vanishes on hidden file inputs; unannounced toasts; 12–13 px controls; switches without role; 1.2:1 hairline boundaries.
- Riley: single active promo → progress bar never moves; 40+40-char title overflows halo; single failing saver clip → black forever; no player error handler; split title/accent prints "Ajak teman,"; OS dark mode flips the kiosk.
- Resepsionis ADC (phone): 314 px stacked sidebar first; promo edit form ~2,000 px down; after save the form resets far from the row and from Publikasikan; table needs hidden horizontal scroll.

## Minor Observations

Saver logo pill disappears on bright footage; double AI label on saver, none in player; uppercase Cormorant tracking too tight at 0.01em; wine shared by brand and warning tile; raw kind labels ("Bonus · Gratis"); honest upload copy under a fake bar; user-select: text on WA pill; "—" for empty promo value; kiosk follows prefers-color-scheme.

## Questions to Consider

- Why does zone A render a title at all when every clip carries its own?
- Is a 2-up grid right when the biggest category has four items and 27/31 lack video/sessions/duration?
- What is the publish gate protecting if the drafter publishes two seconds later with no summary?
