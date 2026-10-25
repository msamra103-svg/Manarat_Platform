#!/usr/bin/env bash
# Rebuild all basketball character/crowd assets from Microsoft Rocketbox (MIT).
# Requirements: a checkout of https://github.com/microsoft/Microsoft-Rocketbox (git LFS not needed),
# Python with the Blender module (pip install bpy==5.2.3 numpy pillow scipy), Node (npx gltfpack@1.3.0).
# Usage: ROCKETBOX=/path/to/Microsoft-Rocketbox PY=/path/to/python-with-bpy tools/basketball-assets/build.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/games/basketball/assets"; TMP="$(mktemp -d)"
PY="${PY:-python3}"; : "${ROCKETBOX:?set ROCKETBOX to a Microsoft-Rocketbox checkout}"
export ROCKETBOX
"$PY" "$HERE/bl_athletes.py" -- "$TMP"
for v in a b c; do npx -y gltfpack@1.3.0 -i "$TMP/athlete_$v.glb" -o "$OUT/models/athlete_$v.glb" -cc -kn -km -kv -vtf; done
(cd "$HERE" && "$PY" bl_clips.py -- spec_athlete.json "$TMP/clips.glb")
python3 "$HERE/prune_anim.py" "$TMP/clips.glb" "$TMP/clips_pruned.glb"
npx -y gltfpack@1.3.0 -i "$TMP/clips_pruned.glb" -o "$OUT/models/clips.glb" -cc -kn -af 30
cp "$TMP/clips.json" "$OUT/models/clips.json"
"$PY" "$HERE/kits.py" "$OUT/textures/"
"$PY" "$HERE/bl_crowd.py" -- "$OUT/crowd"
echo "assets rebuilt in $OUT"
