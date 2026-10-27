# CLAUDE MASTER DEVELOPMENT ORDER — REALISTIC 3D FISHING V24
# Abu Ubaida Preparatory School for Boys | Educational Games Platform

YOU ARE: a senior game technical director, Three.js/WebGL programmer, real-time water rendering expert, fisherman character animator, rope/fishing-line physics engineer, underwater wildlife artist, UX sound designer and QA engineer.

MISSION: Upgrade the provided REAL EXISTING "صيد الأسماك" game from the Abu Ubaida platform into an extraordinarily immersive and BELIEVABLE 3D fishing simulation, suitable for classroom learning. This must be functional 3D source code, never just mock-ups, UI polish, illustrative images or a self-contained game that no longer integrates with the platform.

## 0. IMPORTANT — SOURCE AND ARCHITECTURE
Attached source is a reproducible export of https://github.com/msamra103-svg/Manarat_Platform, source commit 7828f379927dd857d8c33a40a072859a75d2b3aa.
Entry point games/fishing/index.html presently imports:
- games/vendor/three.min.js (shared Three.js r128)
- games/sports/athlete.js (shared)
- games/experiences/motion.js, scene.js, game.js, experience.css (SHARED by fishing, volleyball, puzzle, classic)
- games/sports/legacy-sport.css (shared)
- js/platform-nav.js (shared)
- school platform host lives in js/school.js (reference only).
READ ALL THESE FILES and existing tests BEFORE making changes. You MUST NOT modify shared experiences, sports or host files or break unrelated games. Build an INDEPENDENT fishing engine and UI inside games/fishing/*, e.g. index.html, fishing.css, game.js, fishing-motion.js, fishing-scene.js, fisherman.js, fish-ai.js, rod-line.js, water.js, audio.js, assets/* (choose maintainable structure). Reference shared Three.js without replacing it. If an exception is unavoidable produce a separate small patch requiring approval, NOT a silent edit.
No credentials or private Supabase data are required. Do not change the database.

## 1. Visual quality: realistic Qatari sea fishing scene
REPLACE the simple aquatic display with a beautiful premium cinematic realistic fishing environment:
- Rich animated seawater with wind-driven waves, swell, ripples, realistic Fresnel reflection, specular highlights, foam and underwater transparency according to depth. Good above/below-water boundary, not a flat blue slab.
- Qatar-inspired natural coastline environment (clean blue-green sea, distant shoreline, gentle golden-hour sun, plausible Gulf lighting, dunes/buildings on the horizon where appropriate). Do not invent official logos.
- A detailed small fishing boat with gunwales, seats, tackle box, fishing gear, rod holder and non-distracting details; physically stable and gently bobbing with the waves. Allow shoreline/pier variant if feasible. Character stands/sits safely, naturally, with a life jacket when fishing from the boat.
- Sea depth, sunlight shafts and underwater lighting, caustics (where performance allows), tiny floating particles, bubbles, rocks, corals or sandy bottom appropriate to the scene. Real time 3D rendering rather than photographic background pasted over cartoon objects.
- Option to switch between cinematic above-water third-person camera, over-the-shoulder rod camera, surface bobber camera and smooth underwater fish camera. An underwater cinematic shot should never hide/interrupt the question overlay.
- A polished local 3D male fisherman with realistic face/body proportions, hand grip, fishing clothes, shoes, natural body mechanics and expressive animations; no toy-like geometry or static paper character.
- Detailed rod: tapering flexible carbon blank, line guides, reel body/spool, handle, bail, fishing line, float, hook and bait at visually sensible sizes and locations. All visible as functional moving objects, not decorative props.

## 2. Fishing should ACTUALLY FEEL LIKE FISHING
Implement a coherent end-to-end fishing sequence:
1. Select fishing location, target area or casting direction (left/center/right or improved touch targeting).
2. Prepare rod: correct hand positions, wind up, realistic cast/release.
3. Bobber, weight and bait travel on a ballistic arc, enter water with localized splash/ripples.
4. Float behavior and hook depth respond to water/waves; line goes from rod tip to float/hook and remains coherent (no disconnected lines).
5. Underwater fish swim naturally, investigate bait, turn their bodies, flick their tails, accelerate/slow, and nibble.
6. Bite moment: subtle bobber dips, rod-tip vibration, rising audio tension; educational question triggers near bite/hook-set moment, and the action suspends smoothly.
7. After platform result:
   - CORRECT answer: guaranteed legitimate catch; fish is hooked and resists, angler sets hook, reel line shortens, fish fights and swims under tension, rod bends realistically, water splashes; fisherman gradually lands fish aboard (with a net if needed), scores exactly one catch and celebrates.
   - WRONG answer: realistic failed catch, e.g. fish rejects bait, hook fails, fish shakes loose or escapes without being hauled aboard; no catch score.
   - PENDING essay/review: NEUTRAL hold state with no catch, no escape-as-failure, no positive/negative score until host explicitly decides; reflect awaiting teacher review.
8. Show next cast with clean movement and seamless continuity, no resets that teleport fish or boat.
Offer meaningful user interaction during cast and optional reeling (press-and-hold/touch/keyboard, reel dial, tension zone, rod-angle guidance), but educational grading MUST control final success deterministically. Skill affects performance/visual challenge only and must not overturn a correctly answered question.

## 3. Authentic physics
Create stable deterministic (fixed timestep if appropriate) simulations:
- Rod bending as a function of tension with plausible lag, no clipping into the fisherman.
- Fishing line spline or Verlet rope between rod tip, float/hook and fish, taut/slack transitions, gravity, water resistance, collision/occlusion handling, controllable tension and winding mechanism. Line must never snap visually due to teleporting.
- Realistic casting projectile trajectory, bobber buoyancy, waterline crossings, wave bobbing, hook descent, splash on entry.
- Fish movement and steering (schooling and cautious approach), buoyancy, fin-tail swimming and fight patterns depending on size/species.
- Reeling speed and fish drag modeled with safe bounds; smooth hand/spool synchronization.
- Realistic water ripples and wakes around boat, float and fighting fish.
- No fish clipping through boat, waves, rock, water surface or hook; no duplicate caught fish, out-of-sync effects or reversed line geometry.
- Every correct answer guaranteed to land exactly one fish within a reasonable cinematic duration without artificially teleporting it; wrong guaranteed NOT to count. No stochastic failure over correct answer.
- Stable at 30, 60 and 120 fps and when tab visibility changes.

## 4. Fish visual fidelity
Use genuinely good-quality local 3D models (GLB/glTF, licensed appropriately) for multiple believable fish species, each with species-specific material, body shape, scales, fins and natural swimming (tail undulation, turning and acceleration). Species should be plausible for the Gulf/Arabian Sea; avoid scientifically false labels. Optional examples: grouper (هامور), sea bream (شعري), barracuda (عقام) only where a credible representation is implemented. The player should be able to view the caught fish in an elegant realistic reveal with correct name and size ONLY if those values are truly modeled, not fabricated biology. Never present fictitious catches as real student record or a physical catch.

## 5. Cinema, sound and atmosphere
Set a visually strong intro with calm waves, boat drift, fisherman preparing the rod, fish below water. Seamless realistic cuts/tracks: wide boat -> over-shoulder cast -> lure flight -> underwater fish -> bobber bite -> freeze/educational question -> fight -> landing -> celebration. Avoid excessive camera shake and seasickness; default easy classroom readability and reduced-motion accommodation.
Layered spatial ambient audio: sea waves, gentle breeze, boat creaks, reel clicking, line hiss, splash, bubbles, underwater ambience, bite-alert bell, tension rise, reeling sound, successful landing sound, audience-free motivational jingle for success, gentle failure sound and final victory music. Interactive volume/mute controls, separate music and effects where possible. Sounds must be original synthesized or licensed and included locally. No online audio/CDN or autoplay before user gesture.

## 6. Exciting integrated question flow, but exact educational contract
This is a school EDUCATIONAL game embedded in an iframe. Do not turn it into a generic standalone fishing simulator.
Preserve exact school-fishing-* messages:
school-fishing-ready, school-fishing-config, school-fishing-question, school-fishing-result, school-fishing-outcome, school-fishing-next, school-fishing-advance, school-fishing-retry, school-fishing-fullscreen.
Preserve the original message properties and semantics (token, index, title, count, images, feedback, correct, pending), strict origin + parent source validation, permitted phase guards and one event per question. The parent school platform supplies questions and grades; the game NEVER independently grades real school questions, sends grades directly to Supabase or reads personal student data. Keep standalone demo questions separate, never report demo scores as actual grades.
Freeze the simulation at the best moment before hooking, keep water/ambient subtleties optional without advancing the fish to a result; resume exact position smoothly from answer. Host-controlled modal may overlay the iframe; do not obscure questions with 3D HUD. Correct = exactly one landed fish; wrong = escaped/unhooked; pending = neutral review state and no fish score. Respect host next/advance/retry and completed official report navigation. Name everywhere: صيد الأسماك. School everywhere: مدرسة أبو عبيدة الإعدادية للبنين.
DO NOT alter js/school.js, teacher admin, question banks, student reports, Supabase APIs or any other game.

## 7. Engaging game mechanics and teacher-friendly controls
Clean Arabic RTL interface with professional fisherman HUD, caught fish count, number of questions, optional species and catch weight where genuinely simulated, rod tension meter, reel progress, tackle, volume, camera button and fullscreen. Offer intuitive one-tap/drag/mobile touch controls and keyboard. Aim selection should actually affect the cast; if host has no settings for difficulty, maintain backwards-compatible defaults and expose local optional settings only where appropriate. Optional modes may include dock fishing, boat fishing, timed challenge or calm beginner mode. Never add a hard timer by default if it would invalidate a teacher's question. Use optional educational question countdown with clear sound and expiry handling exclusively if supported by host's scoring/timeout decisions; never autonomously submit as wrong.
At 1920×1080 or 16:9 classroom projector FULL SCREEN display all HUD and major scene elements with absolutely no vertical/horizontal page scrolling. Responsive mobile portrait/landscape and iPad. Large contrast, accessible tap targets, reduced-motion, low-power presets and gracefully recovering WebGL context.

## 8. Performance, quality, licensing
Everything essential must run from local bundled source (existing Three.js r128 unless a self-contained migration is justified) and local assets; no external CDNs, secrets, copyrighted console assets or famous-person likenesses. Build optimized, LOD-enabled meshes, compressed textures where available, water quality settings, draw-call budgeting, capped device pixel ratio, lazy loading, adaptive performance, cleanup/dispose and context recovery. If improving water requires custom shaders, ship shader code. Clearly document origin/licence for every model, font, texture, sound and image. Don't bundle unlicensed files.
The source must be a TRUE runnable upgrade, not a mock page, 2D animation or image-only prototype.

## 9. QA and backward-compatible integration
Current base tests include:
node tests/experiences-motion.cjs
node tests/experiences-flow.cjs
node tests/experiences-scene.cjs
node tests/game-session.cjs
node tests/game-modes.cjs
Run/check and KEEP the existing tests passing.
Add fishing-only unit and browser integration suites:
- deterministic trajectory & continuity, waterline buoyancy, rod bending, reel tension and line constraint;
- real GLB asset loading and no missing resources;
- one correct answer = exactly 1 realistic catch; wrong = 0; pending = neutral 0, no duplicate outcomes;
- trusted parent, origin and token/index security; host start/finish;
- representative desktop, smartboard, iOS, Android viewports; fullscreen no scroll;
- offline network-blocked game; keyboard/touch; asset licences;
- measurable FPS/CPU/GPU memory at 30/60/120 where testing is possible;
- regressions: volleyball, puzzle and classic must still function because they share existing experiences modules.
When integrating into existing repo, mirror public/games/fishing via scripts/sync-public.js / npm run build; don't edit public mirror only. Do not touch main branch or deploy. Avoid changes outside games/fishing/ unless separated as reviewable patches.

## 10. MANDATORY DELIVERABLES
(A) ONE COMPLETE SOURCE ZIP with games/fishing/ and all new assets, not snippets, placeholders or missing textures.
(B) Runnable real 3D browser preview of cast -> bite -> question -> fish fight -> landing/escape, plus 3 sample questions in clearly labeled standalone demo mode.
(C) docs: CHANGELOG_V24.md, INTEGRATION_V24.md, LICENCES_V24.md, TEST_RESULTS_V24.md, file change manifest; tested/untested conditions honestly noted.
(D) Provide independent offline TEACHER and STUDENT exports where feasible; mark limitations of access to platform host questions and official reports.
(E) Screenshots or video capture of actual gameplay if available, not AI-generated promotional art impersonating functionality.
(F) Deliver completed package FOR USER REVIEW AND ASSISTANT INTEGRATION ONLY. DO NOT DEPLOY OR MERGE PRODUCTION.
Every requested feature must be functional or explicitly disclosed as incomplete; do not falsely claim completed work.

MOST IMPORTANT: The upgraded experience must truly look AND feel like catching a real fish: natural fisherman, realistic boat and sea, baited hook, physically connected flexible rod/line, underwater fish behavior, visible bite, tense reeling struggle and believable landing. A redesigned CSS panel without this complete fishing sequence is NOT ACCEPTABLE.
