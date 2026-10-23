# Football V22 Human Player Assets & Licenses

- Motion and base players: \`clips.glb\` from [soccerviewer](https://github.com/andrewRowlinson/soccerviewer), based on [GameplayFootball](https://github.com/BazkieBumpercar/GameplayFootball) / [Google Research Football](https://github.com/google-research/football). Original models and animation assets: **Unlicense (public domain)**.
- Sculpted player geometry: \`tpose_sculpted.glb\`, improvements by soccerviewer contributors licensed **MIT**, underlying original models Unlicense.
- Loader and skeleton utilities: three.js **r128**, copyright three.js authors, licensed **MIT**. Kept as static scripts to match the platform's existing THREE.REVISION=128.
- Conversion/source details: https://github.com/andrewRowlinson/soccerviewer/blob/main/THIRD_PARTY_NOTICES.md
- The build downloads both pinned-size models at build time, then copies them into the public games directory. Neither model needs to be fetched from third-party hosts while students play.
- These game-ready humanoid meshes are far more anatomically faithful than the former sphere/cylinder avatars, but they are **not photogrammetry-level human scans**. Approval requires inspecting a real iPhone preview first.
