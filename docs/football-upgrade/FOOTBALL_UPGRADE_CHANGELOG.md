# Football Ultra-Realism Upgrade — Changelog (V21)

Scope: the football game only (`games/football/`). Basketball and every other game share nothing that changed. Nothing here was deployed, pushed, or run against a live database.

## Summary (ملخص بالعربية)
كرة القدم أصبحت لعبة ثلاثية الأبعاد بمحرك خاص: لاعبون بهياكل عظمية حقيقية وحركة مبنية على IK (مشي، ركض، ركلة بتوقيت تماس، لمسة أولى)، حارس يتفاعل مع مسار الكرة، مدافعون وزملاء، ملعب مستوحى من الملاعب القطرية، شبكة تتشوّه، جماهير متحركة، كاميرات سينمائية وإعادة بعد الهدف، صوت متعدد الطبقات (مع كتم ظاهر ومحفوظ)، وواجهة عربية RTL بأسلوب البث. السؤال يظهر داخل البث عند تجمّد الكرة في منتصف الطريق. التصحيح ما زال في الخادم، وبروتوكول `school-football-*` لم يتغيّر.

## What changed for the player
| Area | Before (V19.3, shared `games/sports/` engine) | Now (V21, football-only engine) |
|---|---|---|
| Players | Articulated primitive-shape athletes (one build) | 3 rigged human builds (athlete, runner, keeper), 26-bone skinned meshes, kits with numbers; 11 actors on the pitch (5 attackers, 4 defenders, keeper, referee) |
| Motion | Timed joint poses | Procedural world-space IK: stepping locomotion (planted feet do not slide), approach → plant → swing → contact → follow-through kick, first-touch, keeper ready/dive/hold/rise, celebrations |
| Ball | Scripted path | Deterministic 480 Hz physics: drag, Magnus spin, turf bounce/roll, post/bar capsules, net surfaces, goal-line detection, anti-tunnelling, body colliders |
| Goalkeeper | Animation only | Plans a dive from the ball's predicted path; save = catch or parry with a real glove contact; goal = shot is guaranteed to beat the dive |
| Opponents/teammates | none | Role-based AI (marking, cover, pass receivers), kept out of the shot lane |
| Stadium | Photo backdrop on a simple venue | Generated bowl (2 tiers, roof, masts, floodlights), LED boards with Arabic school messages, scoreboard, dugouts, tunnel, striped turf with detail shader |
| Net | Static | 4 deformable panels (membrane model) reacting to the real impact point and speed |
| Crowd | Part of the backdrop image | Instanced 3D spectators (1,200 / 3,200 / 6,000 by tier), excitement-driven animation, waves, pennants |
| Cameras | One scripted view | Welcome orbit, skippable establishing fly-in, attack/aim/run-up/flight chase, held "frozen" frame at the question, goal-side and behind-goal cuts, reaction shots that pick a clear sight line, 2-angle slow-motion replay after a goal |
| Question | Modal over the scene | The ball freezes at 52 % of the way; the live pitch stays visible, dimmed and softly blurred; broadcast-style panel; any question type; very long RTL text scrolls inside the panel only |
| Audio | 2 samples + clicks | Layered Web Audio: ambience that follows excitement, chants/claps, whistle, boot and pass contact, bounce, post/bar, net, glove, dive, landing, footsteps, goal/near-miss reactions; gesture-gated; limiter + voice cap; mute is visible and remembered |
| Controls | Aim / height buttons | Drag on the pitch to aim, large buttons, power slider, keyboard (arrows, +/−, Space/Enter, Esc); pass choice by tapping a teammate marker or a button; modes light / standard / pro; difficulty easy / medium / hard |
| HUD | Basic | Arabic RTL broadcast bug, score bug with round pips, ticker, safe-area aware, ≥44 px targets, no page scroll |
| Resilience | WebGL-required message | Quality tiers + dynamic resolution, WebGL context-loss message and recovery, pause on hidden tab, reduced-motion setting, simplified no-WebGL "lite" mode |

## Game rules that did **not** change
- A correct answer is always a goal; a wrong answer is a save on even rounds and a miss (post / over / side) on odd rounds, all reported to the platform as `save` / `wide` exactly as before.
- A pending essay answer is visually neutral: no cheer, no groan, no "miss" styling, no goal.
- Difficulty and mode only change player speed and the number of passes. They never change whether a correct answer scores (covered by `tests/football-engine.cjs`).
- The server (`school-api`) still grades. The game receives `{correct, pending, feedback}` and only turns it into physics. No answer key reaches the client.

## Files
**New** (all football-only)
- `games/football/engine/` — `fb-core, fb-kit, fb-char, fb-rig, fb-anim, fb-keeper, fb-ball, fb-ballview, fb-net, fb-stadium, fb-crowd, fb-match, fb-match-flow, fb-camera, fb-replay, fb-fx, fb-audio, fb-game` (~2,900 lines)
- `games/football/assets/characters/` — `athlete|runner|keeper` `.json` + `.bin`, skin textures, eye texture (3.5 MB)
- `tools/football-assets/` — the reproducible asset pipeline (`build_body.py`, `build_character.py`, `mh_common.py`) and three dev viewers (`viewer.html`, `anim.html`, `stadium.html`)
- `scripts/preview-football.js` — zero-dependency local preview server
- `tests/football-engine.cjs` — Node unit tests (physics, IK, match outcomes)

**Rewritten**
- `games/football/index.html`, `games/football/football.css` (RTL broadcast UI)
- `tests/football.cjs`, `tests/football-integration.cjs`

**Small edits to shared files**
- `js/school.js` — one line in `dialog()`: adds a `football-question` class to the question dialog when the template is football and the content is a game question. No logic change.
- `css/game-session.css` — appended the `dialog.football-question` broadcast skin (scoped; other games untouched).
- `package.json` — `test:football` also runs `tests/football-engine.cjs`.
- `README.md` — V21 section. `games/football/CREDITS.md` — full attribution.

**Untouched on purpose**: `games/sports/*` (basketball), the old `games/football/football.js` (no longer loaded, kept for history), `games/vendor/three.min.js`, every database/edge-function file.

## Protocol and API compatibility
- iframe messages unchanged: `school-football-ready / config / question / result / outcome / next / advance / retry / fullscreen` with the same token, index, origin and source checks.
- Element IDs that tests and the parent rely on are kept (`pitch start shoot next reopen question questionText choices controls instruction sound fullscreen score round feedback momentLabel momentTitle momentText welcome loadingError modeLabel [data-aim]`).
- `window.Football` keeps `phase, flight, goals, outcome, audioReady, round, snapshot()` and adds `step(seconds)`, `manual(on)`, `render()`, `stats()`, `match`, `camera`, `aim`, `tier` for deterministic tests. `flight` is `0.5` while the question is up.
- Test hook: `?manual=1` (or `window.__FOOTBALL_MANUAL = true` set before load) stops the real-time loop so tests advance the simulation with `Football.step()`.

## Implementation notes (how the hard parts work)
- **Locomotion.** Feet are fixed in world space while planted; swing targets are recomputed every frame from the body's velocity; steps alternate, with a short double-swing from 2.4 m/s so the planted leg never over-extends (measured foot-IK error ≤ 1.1 cm at jog, 0 at run/sprint).
- **Kick contact.** The kick is an IK ankle path with a contact event. The ball receives the shot at the contact frame using the real foot velocity, so the foot visibly meets the ball (measured: contact at ≈0.37 s, foot speed ≈14.8 m/s, ankle-to-ball distance 8.5 cm).
- **Shots.** `solveShot()` finds the launch velocity that reaches a target on the goal plane with drag and spin. The match director slows time from 36 % to 52 % of the flight and freezes at 52 % (the question). On resolution it plans the outcome: for a goal it simulates the goalkeeper's dive on a shadow keeper and aims where he cannot reach; for a save it makes the dive meet the ball (catch when slow/central, parry when fast); for a miss it chooses post, over-the-bar or wide; for pending it lets the ball come to rest short of the goal.
- **Collisions.** Capsules for posts/bar, surface patches for the net, spheres for defenders and the keeper (gloves are separate), sub-stepped at 1/480 s with a swept test.
- **Replay.** Records every bone quaternion, root transform and the ball at 40 Hz in a ring buffer, so the replay is exact without re-simulating; net bulges are re-applied from recorded impacts.
- **Colour.** three r128 does not colour-manage material hex values, so `FB.color()` converts them to linear before use (otherwise the scene looks washed out).

## Concessions on realism (stated plainly)
- Characters are stylised real-time game models built from CC0 MakeHuman data. They are not photoreal, have simple hair and faces, and use painted procedural skin. No motion capture was used; all movement is procedural IK, so unusual gestures (tackles, headers) are not available.
- The crowd is instanced 3D figures with GPU animation, not individual people. The stadium is an original design *inspired by* Gulf stadiums, not a model of a real one.
- Audio is synthesised plus two existing CC0 crowd samples. It was never listened to in this environment (headless), so mixing levels are set by code review only.
- This document makes no photorealism claim.

## Known issues / not done
- Real-device performance and audio were not measured (see `FOOTBALL_QA_RESULTS.md`).
- Dynamic resolution and the "last resort" simplification are implemented but only exercised by code review on software GL.
- `games/football/football.js` and `assets/players.png` are dead weight kept for history; remove them in a later clean-up if desired.
