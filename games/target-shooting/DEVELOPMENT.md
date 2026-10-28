# التصويب على الهدف — Target Shooting 3D · developer notes

One platform game (`target-shooting`) with four challenges inside it: `archery`, `birds`, `balloons`, `clay`.
Plain scripts (no bundler, no modules) so the same files run online, in the platform iframe and from `file://`.

## Load order (index.html)
`../vendor/three.min.js` (shared r128) → `vendor/*` (meshopt, GLTFLoader, SkeletonUtils) → `core/util` → `core/config`
→ `core/assets` → `core/world` → `core/fx` → `core/diagnostics` → `physics/projectile` → `character/rig` → `character/gear`
→ `character/archer` → `aiming/aim` → `targets/common` → `modes/*` → `audio/audio` → `ui/questions` → `ui/teacher`
→ `ui/export` → `game.js` → `../../js/platform-nav.js` (standalone only; skipped by the offline export).

| File | Role |
|---|---|
| `core/config.js` | Game name, mode catalogue, difficulty presets, teacher configuration + `sanitize()` (the only gate for localStorage, exported files and platform settings). Node-testable. |
| `core/assets.js` | Asset access: fetch next to the page, or base64 from `window.TS_BUNDLE` (offline files). |
| `core/world.js` | Renderer, quality tiers, sky shader, sun/hemisphere/fill lights, fog, procedural ground/mountains/trees/grass/signs, sRGB→linear colour handling (`linearize`). |
| `core/fx.js` | Pooled instanced particles (shards, rubber, sparks, dust, confetti) and rings. |
| `core/diagnostics.js` | Animation QA: per-bone angular velocity/acceleration, oscillation (tremble), hand/head positional jitter, root teleports, planted-foot slide, sole penetration, joint ranges, scale drift, camera spikes, state conflicts. |
| `physics/projectile.js` | Exact ballistics (g, 62 m/s, no drag), launch solver, fixed 1/240 s sub-steps, swept sphere/disc/plane tests, ring scoring. Node-testable. |
| `character/rig.js` | Rocketbox rig, single-writer procedural pipeline (see below), constructive two-bone IK with soft reach, swivel continuity, forearm roll sharing, head look that keeps the clavicles on the chest. |
| `character/gear.js` | Original recurve bow (riser, flexing limbs, string through the nocking point, sight, stabiliser), arrows, arm guard, hip quiver, belt. |
| `character/archer.js` | Animation state machine and pose computation. |
| `aiming/aim.js` | Line-of-sight aim with springs + swing-rate limit, aim assist with exact lead, launch direction; over-the-shoulder camera rig. |
| `targets/common.js` | Archery face/boss/stand, birds, balloons, clay discs, trap launchers, flags; `Mode` base (targets, colliders, ray hits). |
| `modes/*` | Environment + target behaviour + scoring per challenge. |
| `audio/audio.js` | Synthesised effects, ambience and original music; separate effect/music buses; autoplay-safe unlock. |
| `ui/questions.js` | Offline/standalone question panel and grading (multiple choice, true/false, open text). |
| `ui/teacher.js` | Teacher panel (settings, question editor, export). |
| `ui/export.js` | Self-contained HTML assembly (browser and Node). |
| `game.js` | UI, input, rounds, educational flow, platform contract, QA hooks. |
| `tools/build-offline.cjs` | Builds the offline teacher/student files and the ZIP. |
| `tools/make_archer_kit.py` | Derives `archer_kit.jpg` from the Rocketbox-derived kit (removes the bowling emblem, adds a shoulder yoke). |
| `tools/rig-harness.html` | Dev page: the archer alone, step by step (not linked from the game). |

## Animation pipeline — why it cannot jitter
* **One writer.** No mixer, no mocap clip, no second system touches the bones. Each frame starts from the bind pose
  (rotation, position **and** scale) and applies, in a fixed order: pelvis/spine → leg IK → clavicles → head look →
  bow frame + hand targets (`beforeArms`) → arm IK + palms + fingers → blink → one matrix update.
* **No feedback loops.** The aim direction is computed from a stance-fixed origin; hand targets depend only on the
  chest/head joints that are final before the arms are solved.
* **Continuous inputs.** Key-pose weights use cascaded critically damped springs (C2-continuous when retargeted); the
  draw uses an exact timed smootherstep so full draw is reached at a known instant and then holds perfectly still.
  Hand orientations are blended as sign-aligned quaternions (blending direction vectors can flip the hand).
* **Constructive IK.** The elbow/knee is built from the law of cosines in the pole plane and each bone's orientation
  is constructed from (bone direction, hinge axis = mid bone local Z): no path dependence. Soft reach near full
  extension removes the elbow "pop"; the bow is always placed inside the exact range, so the hand is on the grip
  (measured error 0.0 mm). Swivel continuity takes over when a pole is nearly parallel to the reach axis.
* **Bow/hand/string/arrow are one system.** The bow frame is computed first; the bow hand is solved onto its grip
  (the bow can never rotate on its own); while hooked, the string's nocking point *is* the hook point; the arrow is
  placed after the rig solve from the solved finger bones, and the flying arrow starts from that exact transform.
* **Feet.** Toe joints are fixed world points; soft knees keep the legs in the exact IK range (slide ≈ 0 mm). TURN
  steps one foot then the other along lifted arcs.

States: `IDLE, TARGET_ACQUIRE, RAISE_BOW, DRAW_BOW, AIM_HOLD, RELEASE, FOLLOW_THROUGH, RECOVER, TURN, MODE_TRANSITION`.
Illegal transitions are rejected and counted (`archer.conflicts`), never applied.

## Aim, reticle and impact
Mouse/touch → ray from the *neutral* camera (no camera feedback) → first hit in the mode (`rayHit`) → line of sight
from the aim origin. Yaw/pitch/range are smoothed (springs), the aim target swings at most 2.6 rad/s, yaw is limited
to the archer's comfortable range (35° closing, 57° opening). The reticle is drawn at the aim point P; the arrow is
launched with the exact ballistic solution from its real position to P. Measured: launch/integrator meet P within
0.02 mm; on the archery face the embedded tip is within 11.2 mm of the reticle (tolerance 20 mm). For a moving target
the reticle marks where the arrow crosses the line of sight at the smoothed range; aim assist (teacher/difficulty)
leads with the mode's exact future position (`target.predict`).

## Modes
* **Archery** — 122 cm face at 12 m (beginner), 80 cm faces at 18–22 m with a sliding rail (intermediate), 60–80 cm at
  25–40 m, two moving (advanced). Ring value 1–10; boss hits score 0; arrows embed 7.5 cm along their flight.
* **Birds** — centripetal Catmull-Rom paths in a tree-free flight volume, formations, speed varying with climb,
  banking from heading rate, flap/glide. Hit = non-graphic tag (gold ring, sparks), the bird climbs away and fades.
* **Balloons** — tied (wind sway), rising (buoyancy + wind), drifting, bunches, golden bonus; strings are verlet chains.
  The envelope disappears in the sub-step of contact; the arrow continues.
* **Clay** — trap house, high/low houses, pit; discs released on the archer's readiness ("pull"), flight with lift
  (0.62 g) and linear drag in closed form; spin + attitude from velocity; shards inherit the disc velocity.
During the question every moving target leaves smoothly (no freeze), the archer lowers the bow.

## Platform contract (prefix `school-target-shooting-`)
game → host: `ready`, `question{token,index}`, `outcome{token,index,outcome,earned,hits}`, `next{token,index}`, `fullscreen{token,index}`
host → game: `config{title,count,images,token,school,student,shooting}`, `result{token,index,correct,pending,feedback}`, `advance{token,index}`, `retry{token,index}`
Every incoming message is checked for origin, source (= parent), prefix, token (8–200 `[\w-]`), exact index and phase.
The host renders the question with the platform's own renderer and the server grades it; the game never sees answers.
On the last round the game shows its own results (game name, mode, school, student, answers, points, accuracy) and
sends `next` only when the student presses «حفظ النتيجة في المنصة»; the platform then finishes and shows its report.

## QA hooks
`?qa=1` exposes `window.__tsQA` (state, start, aim, draw/loose, deterministic `step`, diagnostics, targets, answer for
the offline panel only). `?qa=1&manual=1` stops the rAF loop. Neither exposes answers, tokens or secrets.
Tests: `npm run test:target-shooting` (physics, motion, modes, platform integration, offline).
