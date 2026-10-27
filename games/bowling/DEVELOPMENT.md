# Bowling V20 — developer notes

Bowling-only code. Entry: `index.html` → `../vendor/three.min.js` (shared r128) → `vendor/*` (r128 add-ons) → `physics.js` → `motion.js` → `athlete.js` → `bowler.js` → `crowd.js` → `venue.js` → `hall.js` → `audio.js` → `scene.js` → `game.js` → `../../js/platform-nav.js`.

| File | Role |
|---|---|
| `physics.js` | 3D rigid-body solver (Node + browser). Ball sphere, pin sphere-compounds + base ring, lane/gutters/deck/pit/cushion/kickbacks, oil friction, sleeping, settle + pin count, de-duplicated contact events. `releaseState(inputs)` maps start/angle/power/spin to a physical release. |
| `motion.js` | Pure choreography (Node + browser): `plan(inputs)` and `sample(plan, t)` give pelvis, torso, feet (toe-joint ground points + heel raise + contact state), swing angle, held-ball anchor, support-hand weight and the release flag. |
| `athlete.js` | Rocketbox rig + clips + procedural layer (pelvis placement, spine, leg IK with poles, foot/toe/sole constraint, clavicles, arm IK, palm orientation, fingers, head look, blink). Fork of basketball `athletes.js`. |
| `bowler.js` | Applies the plan to the rig; derives the ball from the shoulder/chest every frame; hand targets on the ball surface; exact release evaluation; stance side-steps; recovery + reaction clips; pose/clearance reports for tests. |
| `venue.js` | Procedural hall (lanes, markings, gutters, deck, pit, masking signage, monitors, sweep + spotting table, ball return, seats, walls, lights). |
| `crowd.js` | Instanced GPU-skinned spectators (fork of basketball `crowd.js`) with bowling-sized reactions. |
| `hall.js` | Hall interior over the venue shell: slat wainscot, acoustic panels, columns, ceiling, exit door, LED wall (ball-path diagram, educational slides, live progress via `scene.setInfo`), side-wall slide screens, promotion lightboxes, scrolling tickers. Canvas screens redraw at a capped rate; static parts merged per material. |
| `audio.js` | Synthesised spatial audio (modal resonators, seamless loops, ambience, distant lanes), time-sliced background synthesis, voice limits and lifecycle; accepts an `OfflineAudioContext` (`create({ context })`, `.at(t)`) for QA renders. |
| `scene.js` | Renderer, quality tiers, lighting, pins/ball meshes, camera director, aim guide, physics stepping (fixed sub-steps, halfway stop), release hand-off, next-rack sequence. |
| `game.js` | UI, input, educational flow, platform contract, `ManaratGameControls`, quality governor, QA hooks. |

## Conventions (rig and world)
- World: metres, +Y up, foul line z = 0, pins toward −Z (head pin z = −18.288), +X = bowler's right when facing the pins.
- Rig (Biped, measured): bind pose faces **+Z**, character's left at **+X**, bones' local **+X** runs along the bone to the child,
  knee/elbow hinge = local **Z**. Pelvis 0.895 m, hip→ankle 0.794 m, ankle 0.099 m above / 0.134 m behind the toe joint.
- Character yaw = π − aim, so the rig's forward equals the lane heading `d = (sin a, 0, −cos a)`. The body is never turned
  around to "fix" walking; knee and elbow directions come only from pole vectors.
- Approach frame: local (s, l, y) → `O + d·s + r·(hs·l) + up·y`; `hs = +1` right-handed, `−1` left-handed (mirroring happens only here).

## One clock, exact release
`scene.update(dt)` advances the bowler; when `t` crosses `plan.t.release` the scene evaluates the rig at exactly that time
(`bowler.evaluate`) and launches the physics from that pose (position + orientation from the hand, velocity/spin from the
inputs), then steps the remaining time. The physics uses fixed 1/600 s steps and stops at the step whose ball centre passes
z = −9.144 m (halfway); during the question nothing physical advances.

## Modes
`loading → ready → approach → rolling → frozen (question) → resolve → settled → resetting → ready`

## QA hooks
`?qa=1` exposes `window.__bowlingQA` (inputs, deterministic stepping, answers); `?qa=1&manual=1` disables the rAF loop so tests
step frames themselves. `window.Bowling` is read-only state (phase, points, pins, snapshot, pose, audio, quality). Neither
contains answers or secrets. `tests/browser/rig-harness.html` renders the bowler alone.
