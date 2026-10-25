# Football Ultra-Realism Upgrade — QA Results

Everything below was run in the build sandbox on the working copy. Nothing was deployed and no live service was contacted.

## Environment (what this QA can and cannot show)
- Linux container, Node 22.22, Playwright Chromium headless shell, **software WebGL (SwiftShader), no GPU, no audio device, no touch hardware**.
- Software GL renders about 1 frame per second, so frame-rate numbers from it mean nothing for real phones or laptops. Tests therefore advance the simulation with the deterministic `Football.step(seconds)` hook (`?manual=1`) instead of real time.
- Browsers: Chromium only. Firefox, Safari/iOS WebKit, Android Chrome and real touch input were **not** tested. Audio was never heard (headless); sound code ran without error but mixing/levels are unverified by ear.

## Commands and outcomes
| Command | Result |
|---|---|
| `node tests/football-engine.cjs` | PASS — ball solver/goal-line/post/no-tunnelling/net events; stepping IK, planted-foot slide = 0, foot IK ≤ 2.5 cm at every gait, kick contact window and ankle-to-ball distance; 90 randomised shots (all three modes, all difficulties) freeze at 52 % ± 8 % and resolve as instructed; difficulty/mode parity |
| `FOOTBALL_SWEEP=200 node tests/football-engine.cjs` | PASS — 200 randomised shots, 0 failures on the final build. An earlier sweep had 6 failures out of 200 caused by a defender drifting into the shot lane; fixed (lane clearance + hard guard) |
| `node tests/football.cjs` | PASS — controls (buttons, keyboard, drag, power), freeze at `flight == 0.5` and stays there, correct → goal, wrong → wide (odd round) / save (even round), final screen + restart, mute persists across reload, light mode + hard difficulty still scores, viewports, WebGL context loss + recovery, reduced-motion default, no-WebGL lite round, zero page errors |
| `node tests/football-integration.cjs` | PASS — real `js/school.js` + iframe + mocked `school-api`: server grading path, a forged result (wrong token / other sport) is ignored, goal, pending essay stays neutral (goal count unchanged, no miss class), final report "الدرجة مبدئية", and a very long RTL question with 6 long options at 390×844, 844×390, 768×1024, 1366×768 (panel inside viewport, scroll inside the panel only, every option reachable, all option buttons ≥ 44 px) |
| `npm run test:football` | exit 0 (the three above in sequence) |
| `npm run test:sports` | PASS — shared `games/sports/` engine untouched; basketball regression passes (its football cases exercise the legacy shared engine, which the new football page no longer loads) |
| `npm run check` | PASS — 143 JS/inline syntax checks; 307 local references; public/ mirror identical after `npm run sync` |
| `npm test` | `test:unit` 5/5 PASS, `check` PASS, `test:db` PASS ("SQL ALL PASS"), `test:school` → `school-api` ALL PASS, then **`school-browser.cjs` FAILS** at `#activeHomeVideoTitle` ("مراجعة الهندسة الفضائية"). The same assertion fails identically on the untouched original archive, in this sandbox, so it is **pre-existing here**; cause not investigated (home-page video block, nothing football-related). The `&&` chain stops there, so `test:edge` was run separately: PASS |
| `node tests/{edge,game-session,navigation,home-covers,game-modes,regression}.cjs` | all PASS |
| Original `tests/football.cjs` on the untouched archive | FAILS here with a 30 s `waitForFunction` timeout (software GL is too slow for its real-time flow). That is why the new tests step the simulation deterministically |

Re-run everything with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chromium> npm run test:football` (see the integration guide).

## Viewports
Automated (standalone page, aim phase): 390×844, 844×390, 768×1024, 1366×768, 1920×1080 — no horizontal or vertical page scroll, shoot button fully inside the viewport, every visible button/slider ≥ 44 px, including the platform navigation strip on this page.
Automated (embedded, long question): 390×844, 844×390, 768×1024, 1366×768 — see integration row above.
Looked at by eye in screenshots: 360×740, 390×844, 844×390, 1366×768. Two real layout defects were found this way and fixed (HUD crowding at ≤ 390 px, landscape question panel taller than the screen). Screenshots are in `FOOTBALL_SCREENSHOTS/` — they are software-GL captures, so edges are aliased and shadows are the simplest tier.

## Defects found and fixed during QA (by tests or by looking)
Audio `stop()` before `start()` threw inside the match loop; reaction camera read the wrong position field (NaN); a defender could stand in the shot lane and block the ball (freeze never reached); pending answers received the "miss" class; jog/curve running left a planted foot 6–7 cm from its target; the post-goal reaction shot was occluded by a defender; touch targets of the slider and the shared navigation strip were 32–36 px; the question panel in landscape was 1,847 px tall.

## Performance (only what was measured)
| Measurement | Value | Note |
|---|---|---|
| Simulation + AI + IK for all 11 actors, one 1/60 s step | ≈ 0.6–0.8 ms | Node/V8 on the sandbox CPU, no rendering. Phones will be slower; not measured |
| Draw calls / triangles in the held "question" frame | light tier 132 / 231 k; balanced 168 / 640 k; high 160 / 837 k | `Football.stats()`, one frame, 1280×720 |
| Bytes fetched until the welcome screen is ready | 4.43 MB in 35 requests (JS 0.85 MB incl. three.js, character data 2.7 MB, textures 0.85 MB); crowd MP3s (0.66 MB) load only after the first tap | Local server, no compression; engine JS is 241 KB raw / 82 KB gzipped |
| Time to welcome with software GL | 3–4.5 s | Dominated by shader compilation on the CPU; meaningless for real GPUs |
| Real fps on desktop or mobile | **not measured** | The 60 fps desktop / 30+ fps mobile targets are design goals only |

The `high` tier at ~837 k triangles per frame is heavy for a low-end phone. Automatic selection picks a lower tier from `deviceMemory` / `hardwareConcurrency` and the loop scales resolution down (floor 0.58) then drops shadows then simplifies characters when the smoothed frame time exceeds budget. That logic was reviewed and exercised only on software GL; it needs a check on real devices before it is called reliable. `?q=0|1|2` forces a tier and `?debug=1` shows a live overlay.

## Not tested
Real GPUs, iOS/Safari, Firefox, Android, real touch gestures (drag aim was tested with a mouse), audio by ear, screen readers (the HUD uses `role=status`, labelled buttons and radio groups, but no assistive-technology run was done), low-memory behaviour, long soak runs, and the Supabase-connected production flow (the integration test mocks `school-api`).
