# صيد الأسماك V24.1 — Test results

Run on 27 Oct 2026 in a Linux container: Node 22.23.4, Playwright 1.61 / Chromium (headless) with **SwiftShader software WebGL** (no GPU). All results below are real outputs of the suites in this package, re-run after the V24.1 realism pass (skinned MakeHuman-based angler, CC0 barramundi-based fish, FFT normal-mapped water with planar reflection, sliding float, hull/outboard fixes).

## Summary

| Suite | Command | Result |
|---|---|---|
| Physics & simulation | `node tests/fishing-physics.cjs` | **PASS** — 12,189 checks |
| Platform bridge & flow | `node tests/fishing-flow.cjs` | **PASS** — 90 checks |
| Assets, licences, isolation | `node tests/fishing-assets.cjs` | **PASS** — 1,532 checks (fish GLBs now carry one textured `body` mesh instead of many procedural parts, so fewer node checks; `assets/textures` added to the licence check) |
| Browser integration | `node tests/fishing-browser.cjs --dist=dist` | **PASS** — 215 checks (≈ 25 min on software WebGL) |
| Existing: experiences motion | `node tests/experiences-motion.cjs` | **PASS** |
| Existing: experiences flow (volleyball, fishing-legacy, puzzle, classic) | `node tests/experiences-flow.cjs` | **PASS** ×4 |
| Existing: experiences scene (volleyball, fishing-legacy, puzzle, classic) | `node tests/experiences-scene.cjs` | **PASS** ×4 |
| Existing: game session (7 demos incl. fishing) | `node tests/game-session.cjs` | **PASS** |
| Existing: game modes | `node tests/game-modes.cjs` | **PASS** |

## What is covered

**Physics / simulation (`fishing-physics.cjs`)**
- Gerstner sea deterministic, calm amplitude, finite normals; float rides the waterline (max deviation < 9 cm) with the hook ~1.5 m below.
- Ballistic cast lands exactly on the target, no jumps along the arc.
- Rod: straight when unloaded, bend grows monotonically with tension and saturates, blank length preserved while bending, dynamic overshoot (lag) present, never NaN.
- Fight model: every species × 4 player strategies (none / always reel / pulsed / random) lands in < 16 s; tension bounded 0–1.
- Weights computed from the GLB body volume are plausible (hamour 0.98–2.63 kg for 36–50 cm, shaari 0.54–1.71 kg for 30–44 cm, safi 0.15–0.46 kg for 20–29 cm).
- Sliding float (V24.1): out of the water the float rests on the sinker; in the water the sinker draws line through it to the 1.5 m stop knot — all line-integrity checks run with the variable float–sinker length.
- Full sequence at **30, 60 and 120 fps** for correct / wrong / pending: question reached, fish + hook frozen during the question, first `resolve` accepted and a second ignored, exactly one `question` and one `done` event, **correct = 1 catch, wrong = 0, pending = 0**, correct goes fight → net → ice box, wrong goes strike → escape with no fight, pending goes to a neutral review; fish speed ≤ 5.5 m/s (no teleport), line segments never more than 15 cm over rest length (transient monofilament stretch at the strike), fish never above the surface outside the landing phases, never below the seabed, never inside the hull; next cast returns to ready without moving remaining fish.
- Identical simulation state after the same simulated time at 30/60/120 fps (fixed 120 Hz step); a 5 s frame spike stays finite.

**Platform contract (`fishing-flow.cjs`, game.js in a VM with the real simulation)**
- `ready` posted on load to the page's own origin; config from a foreign origin or a non-parent window ignored; second config ignored.
- Per round: one `question` post (re-post only by the "عرض السؤال" button) carrying token + index; result with wrong token, wrong index or foreign origin ignored; duplicate result ignored; one `outcome` post; `next` once, re-enabled by `retry`; `advance` with a wrong or stale index ignored; `fullscreen` delegated to the host; only `school-fishing-*` messages ever sent; no API / Supabase access in the game code.
- Correct = +1 catch, wrong = +1 miss and no catch, pending = neutral (no catch, no miss); host feedback text shown.
- Standalone demo: 3 labelled sample questions, never posts to a parent, ends with 1 catch / 1 escape / 1 neutral review; teacher practice link (`#q=`) loads local questions.

**Assets & isolation (`fishing-assets.cjs`)**
- 6 GLB files are valid glTF 2.0 binaries with embedded buffers and textures, all rig/scene nodes required by the loader present (angler: 66-bone skeleton incl. arm/leg/finger bones, skin and life-jacket meshes), finite bounds, ≈ 62k triangles in total; the base64 offline copy is byte-identical.
- 20 WAV files valid (32 kHz/16-bit), reproducible bit-for-bit from `js/audio-dsp.js`.
- Every file in `assets/models`, `assets/audio`, `assets/textures` and `vendor` has a licence entry.
- No remote URL / CDN in runtime files; `index.html` no longer loads `games/experiences` or `games/sports`; exact names «صيد الأسماك» and «مدرسة أبو عبيدة الإعدادية للبنين».
- All shared/base files listed in `SOURCE_MANIFEST.json` (except `games/fishing/index.html`) are **byte-identical** to the base commit.

**Browser (`fishing-browser.cjs`)** — V24.1 raised the Playwright per-action timeout to 180 s and the audio-start wait to 60 s, because the first frames (shader compilation for the skinned angler + reflection variants) take much longer on software WebGL; no assertion was relaxed.
- All six models loaded from GLB over HTTP; audio loaded from WAV after the first gesture.
- Standalone demo end-to-end with all three outcomes; question freeze verified in the browser.
- Embedded through `tools/host-harness.html` (mirrors `js/school.js` gating): host log `ready → config → question#0 → result#0 → outcome#0 → next#0 → advance#0 → … → next#2 → finish`; a forged `result` with the correct token sent from a sibling frame was ignored; final counts 1 / 1 / 1.
- Viewports — projector 1920×1080, smartboard 1366×768, iPad 1024×768 and 768×1024, iPhone 390×844 and 844×390, Android 412×915: **no page scroll** in welcome, ready and outcome states; score, round, camera, sound, fullscreen, cast/next and the result card fully inside the screen. Keyboard (arrow keys + Space) and touch (tap) casting verified.
- Every visible scene object has finite transforms through the whole cinematic sequence (a NaN in the buoy/dhow bobbing was found by this check and fixed).
- WebGL context loss via `WEBGL_lose_context` → restored, no error panel, no page errors.
- Offline export opened from `file://`: models from the embedded GLB copy, audio synthesised locally, full catch played.
- **0 external network requests** (all non-local requests were intercepted and would have failed the test).

## Measurements (software rendering — not representative of classroom hardware)

| Metric | Value |
|---|---|
| Frame time, medium quality, 1280×720, SwiftShader on 2 CPU cores | median 3567 ms, p90 3817 ms (V24: 2017 ms — the planar-reflection pass and the skinned angler roughly add 75 % on a CPU renderer) |
| Draw calls / triangles of the main pass (medium) | 136 / 257,799 (+ the reflection pass at ⅓ resolution) |
| GPU geometries / textures | 193 / 33 |
| JS heap | 18 MB |
| Model download (HTTP) | 6.0 MB GLB + 0.25 MB water normal map; audio 3 MB WAV (after first gesture) |

## Visual verification of V24.1 (manual, from captured frames)
- Angler checked from front, side and close-up in ready, windup, stroke, flight, wait, fight, net and celebrate: right hand closes round the reel seat, left hand on the reel handle (ready/wait/fight), on the butt (cast) and on the net handle (landing); knees forward, feet planted; rod butt along the forearm/hip, no body intersection seen.
- Fish GLBs rendered side by side in daylight (`tools/glb-viewer.html?m=fish`): head at +Z (forward), spiny dorsal ahead of the soft dorsal; underwater the fish swim head-first towards the bait.
- Hull rendered from outside (`?m=boat`): sheer stripe, boot stripe and antifouling visible after the face-winding fix.
- Two black frames seen during QA stepping were traced to the adaptive-resolution resize running while the simulation was paused; that resize is now skipped during QA pause (no effect on players).

## Not tested / not measured
- Real GPU frame rates at 30 / 60 / 120 Hz displays (now more important: V24.1 renders the scene twice per frame on high/medium), GPU memory, thermal behaviour on phones and tablets: **not measured** (no GPU device available). The adaptive pixel-ratio fallback (drops resolution after 4 s below 28 fps) is implemented but unverified on real hardware.
- Real iOS Safari / Android Chrome devices: only emulated viewports in Chromium.
- Sound quality was verified by rendering and file checks, not by listening.
- Volleyball, puzzle and classic were regression-tested through the existing Node suites only (their pages are not in this source package).
- The real `js/school.js` page was not loaded in a browser (it needs the platform API); the harness reproduces its fishing message handling.
