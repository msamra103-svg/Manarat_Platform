# CLAUDE MASTER DEVELOPMENT ORDER — BASKETBALL V24
# Abu Ubaida Educational Games Platform — full engineering upgrade

ROLE: Act as a AAA-quality 3D sports gameplay engineer, motion/rigging director, Three.js developer, technical artist, sound designer, accessibility specialist and software QA lead. Deliver working code and assets, NOT mockups or suggestions.

## 0. Starting point
The attached bundle is an authentic, complete, version-pinned extraction of the platform's Basketball V23.1 module from:
https://github.com/msamra103-svg/Manarat_Platform
Git source snapshot: ea399ee2ea0bd24a18b4823c7d84f4b7d41e0026

Inspect EVERY provided source file, existing tests, 3D GLB assets, textures, crowd files, renderer and current developer notes BEFORE changing anything. Existing entry: games/basketball/index.html. Current architecture: motion.js, athletes.js, crowd.js, arena.js, audio.js, scene.js, game.js, basketball.css; GLTFLoader, SkeletonUtils, meshopt decoder, shared three.min.js. Preserve established good physics and API behavior. This is an upgrade IN PLACE, not a brand-new disconnected application or cosmetic facelift.

## 1. Actual photographic-style 3D basketball
Deliver a visually striking, believable professional INDOOR basketball arena:
- FIBA-sized wood court, correct three-point and free-throw markings, realistic varnish and subtle wood grain, accurate 3.05 m rim height, glass backboard, volumetric rim/net geometry, realistic shadows and reflections.
- Detailed tribunes, varied seated/standing spectators, benches, indoor sports lighting, video scoreboard, animated LED boards, suitable maroon/white Qatar-inspired identity.
- Strictly avoid misrepresenting real licensed NBA clubs, jerseys, sponsors, official emblems, or real players.
- Natural visual tone and athletic proportions, not cartoon toys, low-quality plastic avatars or floating 2D sprites.
- Optimize 3D assets and GPU use for iPads/iPhones, tablets, smart classroom screens and lower-end PCs. Quality modes must be visibly differentiated yet remain playable.

## 2. Players, basketball motion and believable teamwork
Upgrade existing Rocketbox models/rigs/textures as needed. Players need consistent faces, hands, realistic kit texture and folds, hair, skin shading, shoes and distinct team appearances. Preserve proper attributions.
Animate entire believable basketball sequence:
possession -> catch -> dribble with actual palm/ball sync -> pivots/foot planting -> movement/pass -> gather -> preparation -> jump -> release -> follow-through -> landing -> transition/celebration. Add contextual defenders with footwork, contest/block attempts that do NOT break answer determinism, teammates, rebound retrieval and purposeful positioning. No feet skating, teleporting, backward knees, clipping through each other, duplicated basketballs, unnatural limbs, jitter, impossible jump paths, or stiff arms. Employ AnimationMixer, improved blend transitions, IK and interpolation as needed.
Allow thoughtful camera moves: establishing shot, readable active play, stabilized shot tracking, tasteful rim closeup/replay on scoring, crowd reaction, controlled celebratory moment. NEVER obstruct the educational question interface or disorient the student.

## 3. Physics / result correctness are invariants
Retain or improve motion.js' ball solver, gravity, spin, rim contacts, glass backboard, net deformation, collision continuity. Realistically sync rim, backboard, net, floor, squeaks, bounce and crowd sound. Preserve freeze of basketball in flight as ONE education question is shown; resume same exact ball and camera motion after answer (no cut or teleport).
In production host sessions:
CORRECT = exactly one unquestionably scored basket through hoop;
WRONG = believable miss, NEVER scored;
PENDING teacher-reviewed/essay = neutral shot state, not graded success/failure.
Scoring must not depend on device frame rate or chance. No false positives, missed true basket, impossible path, double result message, or grading inside the embedded game. Separate in-game basket score and official learning grade.

## 4. Preserve school platform integration EXACTLY
Brand: مدرسة أبو عبيدة الإعدادية للبنين. Suitable male athlete cast and classroom friendly Arabic RTL copy. Use game name 'كرة السلة' on ALL screens, including ending, reporting and session resume.
Do NOT break games/basketball/index.html iframe embedding and the existing school-basketball-* postMessage contract: ready/config/question/result/outcome/next/advance/retry/fullscreen. Maintain strict event.origin === location.origin, event.source === window.parent, session token validation, question index validation and allowed-phase checks. The HOST owns real questions, correctness and official results. Keep school teacher admin control, question banks, class data, grade reporting, session counts and return to the platform. Standalone DEMO questions must never be confused with assigned data.
Shared references games/vendor/three.min.js, js/platform-nav.js and package.json are read-only; DO NOT replace or edit js/school.js, football, bowling, racing or other games. If a change is indispensable, produce a minimal separate patch and ask for review. No Supabase credential modifications.

## 5. Add genuinely engaging game options
With graceful backward compatibility, add game states or teacher-controlled modes where feasible: free throws, 2-point/3-point shooting, timed challenge, realistic match sequence, practice mode. Never silently invent school rounds or auto-generate marks. Gameplay may include user-controlled aim/power or pass/dribble assistance so students feel involved, but exact success remains determined by the educational result. Preserve one educational question per shot. Show dynamic game HUD: score, question/round count, remaining time if configured, match state, assignment/school name. The camera must show ball, shooter, basket and scoreboard when appropriate.
Do NOT clutter the interface or introduce scrolling in 16:9 fullscreen. Modern Qatari maroon/white theme, legible Arabic, accessible contrast, large tap targets and low-text onboarding.

## 6. Spectacular audio and celebrating learning
Natural sneaker squeaks, bounce rhythm, net swish, backboard/rim clang, whistle, crowd tension and cheering synchronized to physical events. Optional encouraging Arabic sports announcer using compliant, licensed voice or synthesized local speech only if feasible offline and configurable; no autoplay violations.
Exciting question-start cue, optional ticking COUNTDOWN while the question remains visible, end-of-time cue, motivational correct/wrong answer stingers, separate sliders/mutes for music/effects/crowd/announcer. Teacher may supply an optional local music file or URL in future compatible settings; avoid making the game depend on remote internet. Preserve muting preferences and audio unlock gesture.
On each scored basket: coherent crowd roar, light sweep, tasteful confetti and brief replay; on misses: natural reaction without humiliation. At the end: premium celebration with arena lights and trophy/results using ACTUAL student records. If a multi-player teacher session supplies ranked players, reveal 3rd then 2nd then 1st; if no leaderboard provided, NEVER invent participants and instead present accurate single-player result.

## 7. Usability, offline, performance and accessibility
Entire game and HUD visible without page scroll at 1920x1080 and classroom smart board fullscreen. Landscape/portrait responsive including iPhone and iPad; tap anywhere relevant on playfield when expected, rather than relying only on tiny buttons. Keyboard accessibility.
Keep all runtime three.js assets local: GLB, textures, crowd recordings where licensed, shaders, decoder, fonts, audio. No CDN or network requirement for offline teacher/student exports; no fetch to unapproved services. The included old crowd mp3 in football are OPTIONAL and have unverified license; do not repackage unlicensed recordings as original.
Fast load, quality switch, graceful WebGL failure, reduced motion, stable animation across 30/60/120 fps, no leaking render loops, handles visibility/resizing/context loss, retains smooth display on mobiles.

## 8. Strict testing and integration deliverables
Run or preserve these suites:
- node tests/basketball-motion-v23.cjs
- node tests/basketball-flow-v23.cjs
- node tests/basketball-rig-v23.cjs
- node tests/basketball-integration.cjs
- tests/basketball-browser/* Playwright end-to-end, mobile viewports, performance and visual captures
Extend tests to cover new V24 transitions and physical motion. Validate correct/wrong/pending 20+ trajectories, high/low FPS, postMessage security, visual asset loading, offline mode, orientation changes, touch and keyboard. When copied into main project run npm run build and npm run test:basketball and appropriate football/sports regression tests; rebuild the production public/ mirror with scripts/sync-public.js (NEVER directly hand-edit only the mirror).
Deliver:
A) full modified source ZIP with exact games/basketball relative paths and ALL new assets;
B) a real working browser preview (not screenshots pretending to be a game);
C) detailed CHANGELOG_V24.md, INTEGRATION_V24.md, LICENSES_V24.md, TEST_RESULTS_V24.md, manifest of changes;
D) teacher/student offline bundles if feasible, with real question-host functionality separated from demo;
E) screenshots/screen capture where possible, and candid limitations/untested device combinations.
Do NOT merge or deploy to production yourself; return ready-to-integrate source for the platform owner to review.

CRITICAL: The priority is REAL, immediately perceptible realism in PEOPLE + MOVEMENT + COURT + GAMEPLAY + SOUND. Do not claim improvement based solely on color updates, added CSS, improved marketing text or a mock 3D frame. Every promised capability must actually work in the provided code.
