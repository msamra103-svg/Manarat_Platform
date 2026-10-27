# Basketball — developer notes (V23.1)

Basketball-only code; football keeps `games/sports/*`. Entry: `index.html` → scripts in this order:
`../vendor/three.min.js` (r128, shared) → `vendor/GLTFLoader.js`, `meshopt_decoder.js`, `SkeletonUtils.js`, `RoomEnvironment.js` (r128 add-ons) → `motion.js` → `athletes.js` → `crowd.js` → `arena.js` → `audio.js` → `scene.js` → `game.js` → `../../js/platform-nav.js`.

| File | Role |
|---|---|
| `motion.js` | Pure physics/timing (also runs in Node). Court geometry, deterministic ball simulation (exact ballistic sub-steps, CCD vs rim torus/board/floor/walls/pad, hollow-sphere spin coupling, net drag, rolling), `planMake`/`planMiss` (make always scores cleanly, miss never scores), `shotBall` (shared path to the question, C¹ blend to the miss), analytic dribble (`dribbleAt`/`dribbleHand`), jump curve (`pelvisShot`/`feetLift`/`heelRaise`), `SHOT`/`DRIBBLE` timings. |
| `scene.js` | `SportScene` used by `game.js`: renderer, quality tiers, lights + PMREM environment, loading with progress, athletes' choreography (shooter dribble → gather → dip → jump → set → release → follow-through → landing; close-out contest; help defenders' stance and lateral slides; rebounder catch planning from the simulated path, catch, chest pass, or ball cart fetch; teammates' reactions), ball (procedural leather/seam texture, spin), verlet net, crowd reactions, sports camera, pose checks and QA snapshot. |
| `athletes.js` | Rigged Rocketbox athletes: mocap clips via `AnimationMixer` + procedural layer (two-bone IK arms/legs, palm orientation, finger curl, spine, head look, blinking). |
| `crowd.js` | Instanced, GPU-skinned spectators with per-person clips/phases/fades. |
| `arena.js` | Procedural venue: FIBA court, floor, hoop, stands/seats, LED ribbons, scoreboard, roof, courtside. |
| `audio.js` | Web Audio: synthesised contacts, room tone, reverb, optional crowd recordings; voice limits, mute/volume, suspend/close. |
| `game.js` | Controller + platform contract (`school-basketball-*`), demo questions, HUD, keyboard, governor. |

## One clock
`scene.update(dt)` advances one simulation clock. The shot clock `tau` positions the shooter's pelvis, feet, hands and the ball in the hands; at `SHOT.release` the ball follows `motion.shotBall` with flight time `tau - release`; at `release + questionTime` the clock stops (`mode = 'frozen'`) and `question` is emitted. `resolve()` restarts the same clock. Contact sounds are emitted when the flight time passes each simulated contact time; dribble sounds when the dribble clock passes the floor-contact time `DRIBBLE.t1`.

## Modes
`loading → intro → ready → windup → shot → frozen → resolve | pendingFade → post → pass → ready …`

## QA hooks
`?capture=1&manual=1` lets tests step frames deterministically (`window.__qaStep`). `tests/browser/scene-harness.html` exposes the scene without UI (`step`, `until`, `closeup`, `sc.poseCheck()`).

## Rules that prevent jitter (V23.2)
- Never reset animated bones to the bind pose before `mixer.update`: three.js' `PropertyMixer` skips writing unchanged values. `Athlete.update` restores the mixer's previous output instead.
- Rocketbox/Biped hierarchy: clavicles hang from `Neck`, thighs from `Spine`. Head look and spine bend run before limb IK and keep those bones' world orientation (`keepWorld`).
- Controllers request targets; `finishRig` (scene.js) owns all smoothing: springs for IK weights and the procedural pelvis/torso, velocity-preserving cross-fades for hand targets at phase changes (`c.state` at frame start + optional `c.phase`), automatic blending of sudden target/pole jumps. Do not snap targets in controllers.
- Keep IK targets inside reach (wrist ≤ ~0.55 m from the shoulder) so the elbow never sits at the straight-arm singularity.
- Check with `node tests/browser/jitter-check.cjs` (and `… var`) after any animation change.
