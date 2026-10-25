# Basketball V23.1 — QA results

Date: 25 Oct 2026. Environment: Linux container, Node 22.23, Chromium (Playwright, headless) with **SwiftShader software WebGL (no GPU)**, Intel Xeon 2.8 GHz × 2 vCPU. Every screenshot and the video in `qa/` were captured from the actual running game of this build (no generated or mock-up imagery).

## 0. Starting point

The delivered package was half-merged: `games/basketball/{scene.js, motion.js, index.html, basketball.css}` were still V22 (SHA-256 identical to the V22 manifest) while the V23 modules, assets and tests were present. Before this work the page loaded the geometric V22 mannequins and `node tests/basketball-motion-v23.cjs` failed with `TypeError: Cannot read properties of undefined (reading 'rim')`. The four files were rebuilt; the QA material from the previous session was replaced by evidence from this build.

## 1. Automated test suites (`qa/node-tests.txt`, `qa/e2e-results.json`, `qa/pose-check.txt`)

| Suite | Result |
|---|---|
| `node tests/basketball-motion-v23.cjs` | PASS — 152 check groups: shot solver hits target and descent angle; simulation equals the analytic arc before contact (< 0.2 mm); for 12 release points × 12 seeds a make always scores with no rim/board contact and ≥ 5 mm rim clearance, a miss never scores; identical displayed path up to the question; position + velocity continuity when the shot resumes; position continuity and correct arrival velocity at the first rim contact; no rim penetration during the blend; no per-frame jumps; ball never below the floor; net then floor after a make; exact dribble floor/hand contact; continuous jump curve; release while airborne; shooter landed before the question. |
| `node tests/basketball-flow-v23.cjs` | PASS — standalone demo and embedded platform contract (origin, source, token, index and phase validation; pending neutral; title preserved; no answer keys embedded; all posts to `location.origin`). |
| `node tests/basketball-rig-v23.cjs` | PASS — two-bone IK on a real three.js r128 bone chain. |
| `node tests/sports-flow.cjs`, `node tests/sports-motion.cjs` | PASS — football (and the old shared basketball path) unchanged. |
| `tests/browser/basketball-e2e.cjs` | **21/21 PASS**. |
| `tests/browser/pose-check.cjs` | **0 anomalies** over ≈ 59 s and six rounds (make, miss, pending, miss, make, miss), every athlete, every frame: pelvis 0.5–1.35 m, head > 1.0 m, torso tilt < 55°, ankle ≥ 3 cm. One defect found and fixed during QA (defenders' ankles dipped 3 mm below the limit while standing up from the stance). |

Shared files verified byte-identical to the original package by SHA-256: `games/sports/{athlete,scene,game}.js`, `games/vendor/three.min.js`, `games/football/*`, `js/platform-nav.js`, `integration/HOST_REFERENCE.js`, `tests/sports-*.cjs`.

## 2. Acceptance checklist (brief §16)

| # | Requirement | How it was verified | Result |
|---|---|---|---|
| 1 | Standalone demo starts | flow test; e2e; `desktop_01_welcome`, `desktop_02_ready_dribble` | ✅ |
| 2 | Natural dribbling | analytic dribble tests (hand on the ball during contact, continuous hand/ball); close-ups; video | ✅ (procedural, see limitations) |
| 3 | Hand contact and release synchronised | ball path in the hands is keyed on the shot clock and reaches the release point with the launch velocity; hands are IK-placed on the ball surface; `jump_shot_phases` strip | ✅ |
| 4 | Question at the intended flight position | clock freezes at half the flight time after release; e2e; `desktop_04` | ✅ |
| 5 | Shot waits for the answer | e2e: ball position identical after 1.5 s of waiting | ✅ |
| 6 | Correct answer scores | 144 planned shots + e2e + flow | ✅ |
| 7 | Wrong answer misses | 144 planned misses + e2e + flow | ✅ |
| 8 | Pending stays neutral | flow + e2e (no score, no miss, ball fades under a soft halo, neutral card); `embedded_pending` | ✅ |
| 9 | Next round starts cleanly | e2e (host advance → rebounder pass → catch → dribble → ready) | ✅ |
| 10 | No accumulation over rounds | e2e, 9 rounds with a restart: geometries 62 → 62, textures 58 → 58, draw calls 66, JS heap 23 MB stable, active audio voices 3–5; one animation loop | ✅ |
| 11 | Sound controls | e2e mute + volume | ✅ |
| 12 | Restart and early exit | flow tests (`ManaratGameControls.restart/end`), e2e restart after completion | ✅ |
| 13 | Fullscreen and resizing | e2e (embedded delegates to the platform; canvas follows the viewport, no horizontal scroll) | ✅ |
| 14 | Mobile controls usable | e2e 390×844 portrait and 844×390 landscape with touch: shoot 370×54 / 220×48 px, answers ≥ 44 px, question fully in view | ✅ |
| 15 | Invalid-origin messages ignored | flow + e2e (cross-origin frame on another port) | ✅ |
| 16 | Invalid-source messages ignored | flow + e2e (same-origin sibling frame with a valid token) | ✅ |
| 17 | Wrong tokens / indexes rejected | flow + e2e (forged token, index + 5, stale advance) | ✅ |
| 18 | Football unaffected | shared files byte-identical; football suites pass | ✅ |
| 19 | Missing asset → useful error | e2e (aborted `athlete_b.glb` → Arabic error with retry, file named in the detail line); `error_missing_asset` | ✅ |
| 20 | Assignment title correct to the end | flow + e2e: «لعبة النباتات المائية» in the HUD and on the host's final result page | ✅ |

## 3. Visual review (done by looking at the captured frames)

Checked and corrected during this build: guide hand position in the follow-through, outcome card no longer covers the hoop, dribbled ball no longer hidden by the shoot button, help defenders spaced ≈ 1.8–1.9 m from the players they guard (they previously reached into them). Close-ups in `qa/screenshots/` show the shooter's face, defensive stance, contest (hand up, clear of the ball), the net after a swish, crowd celebration and the rebounder's two-hand catch.

## 4. Audio

Synthesised contact sounds come from `audio.js` (unchanged from V23). Timing is now tied to the simulation: dribble sounds fire when the dribble clock passes the floor-contact instant; rim, glass, net, floor and wall sounds fire when the flight clock passes each simulated contact; release, landing, catch and pass sounds fire on the same clock. The crowd layers use the platform's existing recordings (licence not documented). **No subjective listening was possible in this environment**; a listening pass on the school's speakers is recommended.

## 5. Performance (measured here — read the caveat) — `qa/perf.json`, 1280×720

| Tier (auto: phones / software → low) | Crowd | Triangles | Draw calls | JS animation + simulation per frame | CPU per update + render submission | Load to welcome (local server, software GL) |
|---|---|---|---|---|---|---|
| low | 520 | 0.77 M | 66 | 1.4 ms | 10.1 ms | 11.3 s |
| medium | 950 | 1.33 M | 66 | 1.2 ms | 6.9 ms | 16.5 s |
| high | 1,500 | 2.01 M | 66 | 1.8 ms | 6.7 ms | 19.7 s |

**Caveat:** there is no GPU here. A full frame on the SwiftShader software rasteriser takes 4–11 s, which says nothing about real graphics hardware, so **no frame rate is claimed**. Load times above are dominated by software shader compilation. The CPU figures show the JavaScript budget is small (≈ 1–2 ms per frame) and the scene is draw-call-light (66). Measure on the school's laptops, tablets and classroom boards with `tests/browser/perf.cjs` or the browser's performance panel; force `?quality=medium` or `low` if a device struggles. The runtime governor lowers the pixel ratio (to 0.7), then thins the crowd by 40 %, when 4-second windows average > 28 ms per frame.

## 6. Evidence in `qa/`

- `video/basketball-runtime.mp4` — recorded from the real page at low quality, 854×480, 15 fps, fixed-step capture, no audio track: entry → pass → dribble → jump shot → freeze + question → swish → celebration → rebound and pass → second shot → wrong answer → rim miss and restrained reaction.
- `screenshots/desktop_01…07` (high quality, 1280×720): welcome, dribble, jump shot, frozen ball with question, make celebration, miss reaction, summary.
- `screenshots/e2e_*`: inside the host replica (platform question, pending, make, platform result page with the assignment title, missing-asset error).
- `screenshots/mobile_portrait_*`, `mobile_landscape_*`: phone layouts with touch.
- `screenshots/jump_shot_phases.png`, `athlete_shooter_face_closeup`, `defender_stance_closeup`, `help_defender_*`, `contest_and_followthrough`, `net_after_swish`, `crowd_celebration`, `rebounder_catch`.

## 7. Remaining limitations (precise)

1. **Character fidelity.** Real rigged, photo-textured humans (Microsoft Rocketbox, MIT; ≈ 7.5 k triangles, 1024 px textures). Convincing at game-camera distance, not current-generation console quality: no facial expressions beyond blinking, jersey/shorts skinned to the body (no cloth simulation), one curly-hair head reads as a dark mass from behind, three faces shared across seven players.
2. **Basketball-specific motion is procedural.** Dribble, gather, jump shot, follow-through, defensive stance and slides, contest, catch and chest pass are authored curves + IK on the real skeleton, not motion capture. Motion capture is used for idles, looking around, celebrations, clapping, disappointment, walking and running. Licensed basketball mocap (dribble, jump shot, defensive slide, pass) is the next quality step; the rig accepts additional clips by name.
3. **Rebounder locomotion** uses in-place walk/run clips with speed-matched playback along a smooth path; small foot slip is possible while accelerating or turning.
4. **Net** is a light 12-strand verlet net drawn as thin cylinders; it reacts to the ball, and the ball's net drag is modelled separately in the simulation.
5. **Crowd** uses 11 people models with instancing; repetition is visible on close inspection; no facial animation; the crowd casts no shadows; seated children may hover slightly above the tread.
6. **Audio** contact sounds are synthesised (no recorded foley); the crowd murmur/cheer/groan layers are the platform's existing files whose licence is **not documented**; no listening test was possible.
7. **Performance on real hardware not measured** (software renderer only); tier heuristics and the runtime governor are untested on the school's devices.
8. **Browser coverage:** Chromium only. Safari/iOS, Firefox and WebGL1-only devices were not available.
9. **Platform integration** was tested against a replica of the `HOST_REFERENCE.js` logic, not the real `school.js`; the repository's `public/` sync was not run (the full repository is not in the package).
10. The arena is an original design inspired by premium indoor venues; it does not reproduce a specific Qatari arena. No official or ministry artwork is used.
11. Subject/teacher and platform points appear only if the host adds the optional fields; the HUD shows correct answers, not official grades.
12. In the standalone demo a wrong practice answer reveals the correct option (as in V22); real assignments never contain answer keys.
13. Only one shooting spot is used (shooter at a fixed mid-range position); the motion tests cover 12 positions, but the scene does not yet move the shooter between rounds.
