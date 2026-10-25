"""Drop redundant animation channels (bone scale; translation except pelvis root) and repack GLB."""
import json, struct, sys
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl])
bin_off = 20 + jl; bl = struct.unpack('<I', d[bin_off:bin_off + 4])[0]; binc = d[bin_off + 8:bin_off + 8 + bl]
FACE = ('Eye', 'Jaw', 'Lip', 'Tongue', 'Mouth', 'Masseter', 'Caninus', 'Upperlip', 'Cheek', 'Eyebrow', 'MNose', 'Blink')
keep_acc = set()
for a in j['animations']:
    ch = []
    for c in a['channels']:
        n = j['nodes'][c['target']['node']]['name']; path = c['target']['path']
        if path == 'scale': continue
        if path == 'translation' and n != 'Bip01 Pelvis': continue
        if any(k in n for k in FACE): continue
        ch.append(c)
    used = sorted({c['sampler'] for c in ch}); remap = {o: i for i, o in enumerate(used)}
    a['samplers'] = [a['samplers'][i] for i in used]
    for c in ch: c['sampler'] = remap[c['sampler']]
    a['channels'] = ch
    for s in a['samplers']: keep_acc.update([s['input'], s['output']])
# skin inverse bind accessors etc. must stay
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: keep_acc.add(s['inverseBindMatrices'])
for m in j.get('meshes', []):
    for p in m['primitives']:
        keep_acc.update(p['attributes'].values())
        if 'indices' in p: keep_acc.add(p['indices'])
# rebuild buffer views/accessors compactly
acc_map = {}; new_acc = []; new_bv = []; out = bytearray()
for i in sorted(keep_acc):
    acc = j['accessors'][i]; bv = j['bufferViews'][acc['bufferView']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    comp = {5126: 4, 5123: 2, 5121: 1, 5125: 4, 5122: 2, 5120: 1}[acc['componentType']]
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
    stride = bv.get('byteStride', comp * ncomp)
    size = comp * ncomp
    data = b''.join(binc[start + k * stride:start + k * stride + size] for k in range(acc['count']))
    while len(out) % 4: out.append(0)
    nbv = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
    if 'target' in bv: nbv['target'] = bv['target']
    out += data; new_bv.append(nbv)
    acc = dict(acc); acc['bufferView'] = len(new_bv) - 1; acc.pop('byteOffset', None)
    acc_map[i] = len(new_acc); new_acc.append(acc)
for a in j['animations']:
    for s in a['samplers']: s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
for m in j.get('meshes', []):
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
j['accessors'] = new_acc; j['bufferViews'] = new_bv; j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(out) % 4: out.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb); print('pruned', len(d), '->', len(glb))
