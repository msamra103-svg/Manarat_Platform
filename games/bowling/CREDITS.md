# Bowling V20 — credits

Full provenance and licenses: `ASSETS_AND_LICENSES.md` at the package root; license texts in `assets/LICENSES/`.

- Human bowler, other bowlers and spectators: Microsoft Rocketbox avatars and their textures (MIT), reused locally from the
  platform's basketball package. Bowling outfit textures derived from them (number removed, repainted) by `tools/make_bowler_kit.py`.
- Reaction/idle clips: supplied with the basketball package under its Rocketbox MIT notice (per-clip origin not independently verified).
  The bowling delivery itself is procedural (`motion.js` + IK).
- Three.js r128 and its example add-ons (MIT); meshoptimizer decoder (MIT); Tajawal font (SIL OFL 1.1).
- Venue, ball, pins, physics, choreography and all sounds: original work for this upgrade (procedural / synthesised).

Nominal dimensions: USBC Equipment Specifications manual, https://bowl.com/getmedia/7b8b2ee2-cd3a-4fe1-ba31-1389d8fc9bbf/es_manual.pdf —
60 ft foul line to head pin, nominal lane width 41.5 in, 12 in pin spacing. World units: metres, seconds, kilograms.
Ball 6.4 kg, R = 0.1085 m, radius of gyration 2.5 in; pin 1.53 kg, 0.381 m, centre of mass 0.145 m.

This is an educational training simulation, not a certified bowling simulator. One throw per question on a fresh ten-pin rack;
the regulation ten-frame / two-ball scoring is not implemented. The answer never changes the physics.
