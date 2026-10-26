# CLAUDE MASTER DEVELOPMENT ORDER — VOLLEYBALL V24 (ABU UBAIDA)

ROLE: You are a senior AAA-quality browser-based 3D sports game engineer, volleyball animation director, gameplay designer, physics engineer, technical artist, accessibility and educational-platform integration lead. Your deliverable is COMPLETE WORKING SOURCE CODE and playable 3D game, NOT a concept, screenshots or cosmetic CSS makeover.

## 0. Critical source facts — inspect before coding
This archive is a real source snapshot of the existing educational VOLLEYBALL game from https://github.com/msamra103-svg/Manarat_Platform, commit 2d9f6513672fe408d183521190f89f924aebf4b7.
Current entrypoint: games/volleyball/index.html.
IMPORTANT: Volleyball currently loads games/experiences/motion.js, scene.js, game.js, experience.css; games/sports/athlete.js and legacy-sport.css; shared games/vendor/three.min.js; js/platform-nav.js. The experiences engine is SHARED with fishing, puzzle and classic. The sports athlete and legacy CSS are shared by other games. Do not replace or change shared modules in place. Create a VOLLEYBALL-SPECIFIC implementation inside games/volleyball/ (e.g., motion.js, scene.js, athletes.js, volleyball.css, audio.js, game.js, index.html and assets/) and update ONLY volleyball's entrypoint to load those. Treat all shared source in this archive as READ-ONLY references. Do not modify football, basketball, bowling, racing, fishing, puzzle, classic, Supabase, js/school.js, js/platform-nav.js, or other games.

## 1. Transform the actual game into a realistic 3D volleyball match
Create a modern premium INDOOR volleyball stadium with a believable full-size 18m x 9m court, correct attack lines and boundaries, professional net and posts with realistic net tension, 2.43m men's net height, scorer's table, electronic scoreboard, LED perimeter panels, team benches, referees where appropriate, overhead lighting, polished surface and correct volleyball scale. Qatari maroon/white identity and school branding: مدرسة أبو عبيدة الإعدادية للبنين. Realistic shadows, reflections and PBR materials; avoid cheap cartoon geometry or toy-like players. No unauthorized professional team logos or real-player likenesses.

## 2. Six players on EACH team, natural positions and authentic action
Use six active players per side, rotating positions when gameplay calls for it, and visually distinct, athletic male avatars. Build/obtain appropriately licensed local GLB assets if needed; all new models, textures, clips and licences must be included. Realistic rigs, face and hands, skin, cloth, uniforms, shoes and natural proportions.
Core actions MUST be physically coherent and visually clear:
serve (overhand/jump serve), receive/bump with forearms, set with fingertips, approach, jump, spike, double block, dig, defensive recovery, team rotation, ready stance, purposeful running, landing and rally reactions. Smooth animation blending, precise hand/forearm-to-ball contact, stable planted feet, believable jump heights and shoulder/elbow motions. No skating, teleporting, clipping, joint inversion, duplicated balls or random uncoordinated movement. Volleyball players should look and move like actual volleyball athletes, not football/basketball avatars repurposed with one repetitive gesture.

## 3. Rally gameplay that feels real
Design engaging, comprehensible rally sequences: serve -> reception -> set -> spike -> block/dig -> return, with a believable number of touches and positional transitions. Add optional practice modes for serve, receive, spike and blocks; only if they preserve the educational question flow. Offer meaningful touch/keyboard controls (aim zones, timing or power) without making success/failure contradict assessment. Student choices may influence animation, but educational result always determines point outcome. Maintain clean rule-based rally outcome: ball in/out, net touch, opponent point and correct scoreboard. Do not pretend to implement full regulation officiating unless tested.

## 4. Advanced deterministic volleyball physics
Ball flight must use coherent gravity, velocity, rotation, hand/forearm impact, net-plane collisions, court/floor collision, out-of-bounds, and visual continuity. Freeze the SAME ball smoothly at a natural decisive moment near the net before the question, then resume WITHOUT teleport, hard cut or arbitrary trajectory jump. Correct answers ALWAYS yield a visibly earned point for the student team, wrong answers ALWAYS yield an opposing point / believable failed rally, pending teacher-reviewed essays remain NEUTRAL (no automatic success/failure). The official assessment authority belongs ONLY to the parent platform. Never grade school questions locally. Guarantee one question per intended rally, one official outcome message and no duplicated scores. Keep transitions consistent at 30/60/120 FPS.

## 5. Preserve existing integration contract EXACTLY
The game MUST continue working inside the platform's iframe at games/volleyball/index.html.
Keep school-volleyball-ready, school-volleyball-config, school-volleyball-question, school-volleyball-result, school-volleyball-outcome, school-volleyball-next, school-volleyball-advance, school-volleyball-retry and school-volleyball-fullscreen messages. Respect current host message shapes, token/index validation, event.source===window.parent, event.origin===location.origin and state/phase guards. Keep official student results, assignments, teacher-controlled questions, assessment, navigation, round counts and platform grading unchanged. Preserve standalone DEMO mode separately and label it clearly. Never invent real student grades or results. Retain correct game name الكرة الطائرة on ALL pages including summary/end screen.

## 6. Cinematic broadcast-quality visuals and presentation
Add professional arena intro, readable main gameplay camera, tracking during a spike, brief slow-motion close-up/replay on scoring, restrained camera changes that keep the ball visible, net-level shots, athlete reactions, scoreboard and arena light cues. Make the audience varied and responsive, not synchronized mannequins. Premium Arabic RTL HUD in maroon/white with school name, score for both teams, rally/round counter, current mode, educational progress and responsive full-screen layout. In 16:9 1920x1080 or school smartboards, everything visible with ZERO scrolling; adapt to iPhone portrait/landscape and iPad.

## 7. Immersive sounds, music, effects and celebrations
Use local/licensed ball contact, serve, bump, set, spike, block, net, floor, sneaker squeaks, whistle, announcer where available, crowd ambience, rising anticipation, team chants, success/failure cues. Add optional exciting start-question and countdown ticking that remains active while the question is displayed, deadline cue, volume/mute controls for SFX, crowd, music. Obey browser user-gesture audio restrictions. Do not make remote sound/music necessary. Old optional crowd mp3 references have unverified provenance; don't redistribute as licensed originals.
Celebrate winning points with scoreboard animation, crowd roar, team celebration and tasteful light/confetti effects. Final results should be accurate. Only if the parent platform provides real multi-player ranking may you show a podium from 3rd to 1st; otherwise show honest single-player performance.

## 8. Technical excellence
Keep Three.js local, assets local and offline-capable. Optimize for classroom PCs, touch smartboards and iOS Safari with device quality tiers, fast startup and responsive resize, devicePixelRatio caps, WebGL fallback, context loss recovery, reduced-motion support, accessibility and no memory leaks. Avoid external CDN/runtime dependencies. The code should be readable and maintainable with clear volleyball-specific modules. Keep separate teacher/student offline packages if possible, without breaking real host mode.

## 9. Quality assurance and factual reporting
First run current baseline tests: node tests/experiences-motion.cjs; node tests/experiences-flow.cjs; node tests/experiences-scene.cjs; node tests/sports-motion.cjs; node tests/sports-flow.cjs.
Create new tests/volleyball-* suites and browser end-to-end tests covering: full rally, six players per side, correct/wrong/pending, origin/token/index protection, single-question/single-score, realistic ball paths, net collision, animation IK, phone landscape/portrait, keyboard/touch, no scroll, offline, resize, WebGL, performance at 30/60/120 FPS. When integrating into the complete platform, rebuild public mirror with npm run build / scripts/sync-public.js; do NOT hand-edit public files only. Run regression tests for fishing, puzzle, classic and all other experiences. Never claim tests were run unless actually run.

## 10. Mandatory deliverables
1. Complete ready-to-integrate ZIP containing games/volleyball/ source, every new asset (GLB, textures, animation clips, local sounds/fonts), and volleyball-specific tests. NO placeholders or partial code snippets.
2. A real playable HTML browser preview with actual 3D athletes and rally action, not a mockup.
3. CHANGELOG_V24.md, INTEGRATION_V24.md, TEST_RESULTS_V24.md, LICENSES_V24.md, manifest of added/changed/deleted files.
4. Offline teacher/student versions if feasible, with accurate feature limitations.
5. Screenshots or demonstration video if possible.
6. Explicit statement of unimplemented/untested features and measured FPS.
7. DO NOT DEPLOY OR MERGE to production. Return completed ZIP to user for assistant review and integration.

NON-NEGOTIABLE: I want substantial, immediately visible improvements in PLAYER REALISM, MOVEMENT, RALLY PHYSICS, STADIUM, CAMERA and AUDIO — NOT a cosmetic reskin. Preserve educational integrity and all other platform games.