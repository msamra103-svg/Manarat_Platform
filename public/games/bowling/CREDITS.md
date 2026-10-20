# Bowling V19.4

Original procedural venue, pin geometry, textures, synthesized rolling/pin sounds and fixed-step collision code. Three.js MIT and the original shared athlete rig are reused locally.

Nominal dimensions reference: USBC Equipment Specifications manual, https://bowl.com/getmedia/7b8b2ee2-cd3a-4fe1-ba31-1389d8fc9bbf/es_manual.pdf — 60 feet foul line to head pin, nominal lane width 41.5 inches and 12-inch pin spacing. World coordinates are metres and seconds. Ball mass is 6.4 kg; pin mass is 1.53 kg.

This is an educational training simulation, not a certified bowling simulator. Collision response uses planar circle approximations and animated tipping rather than full 3D rigid-body contacts; oil/hook and friction are approximated. Same input produces deterministic results. Each question starts a fresh ten-pin rack; the full ten-frame/two-ball competition scoring system is not implemented. The answer never forces a strike: actual pin collisions decide the fallen count, and a correct answer enables those local game points. Teacher reports grade the answer independently.

Validation: real Three.js transforms with GPU rendering stubbed, physics/state-machine/bridge tests and static resource checks. No actual browser/GPU visual QA or physical iPhone test in this release.
