#!/usr/bin/env python3
"""عدّاء قطر — builds the realistic 11-year-old Qatari boy from MakeHuman CC0 data.

Derived from the project's own fishing pipeline (games/fishing/tools/makehuman/build_fisherman.py).
Reads MakeHuman 1.x CC0 data (base mesh hm08, child macro targets, default skeleton + weights,
high-poly eyes + brown iris) and writes boy.json + PNG textures. tools/pack-boy.cjs packs them into
js/boy-data.js (offline, no network). The thobe skirt, ghutra, agal and shoes are generated at runtime
(js/boy.js) so they can follow the legs and head without clipping.

All code is original to this project; only the *data files* come from MakeHuman (CC0 1.0).
The face is a parametric average of the MakeHuman targets — not a portrait of any real person.
Usage: python3 build_boy.py <makehuman/data dir> <out dir>
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- base mesh
V, VT, FACES = [], [], []
grp = None
for line in open(os.path.join(DATA, '3dobjs/base.obj')):
    if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
    elif line.startswith('g '): grp = line.split()[1]
    elif line.startswith('f '):
        idx = [t.split('/') for t in line.split()[1:]]
        FACES.append(([int(a[0]) - 1 for a in idx], [int(a[1]) - 1 for a in idx], grp))
V = np.array(V, dtype=np.float64); VT = np.array(VT, dtype=np.float64)

def target(name, w):
    if w == 0: return
    for line in open(os.path.join(DATA, 'targets/macrodetails', name)):
        if not line[0].isdigit(): continue
        a = line.split(); V[int(a[0])] += w * np.array([float(a[1]), float(a[2]), float(a[3])])

# boy ≈ 11½ years (MakeHuman: child target = 11 y, young = 25 y), slim-average build, Gulf-Arab–leaning blend
AGE = {'child': 0.96, 'young': 0.04}
for age, aw in AGE.items():
    target(f'universal-male-{age}-averagemuscle-averageweight.target', aw * 0.72)
    target(f'universal-male-{age}-averagemuscle-minweight.target', aw * 0.28)
    for race, rw in (('caucasian', 0.74), ('african', 0.14), ('asian', 0.12)):
        target(f'{race}-male-{age}.target', aw * rw)
target('proportions/male-child-averagemuscle-averageweight-idealproportions.target', 0.6 * AGE['child'])
target('height/male-child-averagemuscle-averageweight-maxheight.target', 0.25 * AGE['child'])

# face detail targets (MakeHuman CC0 modifiers): an 11-year-old's softer, rounder face — slightly larger, more open
# eyes, smaller nose, fuller cheeks and lips, rounder chin. Applied symmetrically.
def tgt(path, w):
    if w == 0: return
    for line in open(os.path.join(DATA, 'targets', path)):
        if not line[0].isdigit(): continue
        a = line.split(); V[int(a[0])] += w * np.array([float(a[1]), float(a[2]), float(a[3])])
FACE = [('head/head-age-decr.target', 0.35), ('head/head-fat-incr.target', 0.18), ('head/head-round.target', 0.15),
        ('eyes/%s-eye-scale-incr.target', 0.16), ('eyes/%s-eye-height2-incr.target', 0.28), ('eyes/%s-eye-bag-decr.target', 0.4),
        ('nose/nose-scale-vert-decr.target', 0.18), ('nose/nose-volume-decr.target', 0.12), ('nose/nose-point-width-decr.target', 0.1), ('nose/nose-hump-decr.target', 0.3),
        ('cheek/%s-cheek-volume-incr.target', 0.3), ('cheek/%s-cheek-bones-decr.target', 0.2),
        ('mouth/mouth-lowerlip-volume-incr.target', 0.25), ('mouth/mouth-upperlip-volume-incr.target', 0.12), ('mouth/mouth-scale-horiz-decr.target', 0.08),
        ('chin/chin-prominent-decr.target', 0.2), ('chin/chin-width-decr.target', 0.1), ('neck/neck-scale-horiz-decr.target', 0.1)]
for path, w in FACE:
    for side in (('l', 'r') if '%s' in path else (None,)):
        f = path % side if side else path
        if os.path.exists(os.path.join(DATA, 'targets', f)): tgt(f, w)
        else: print('missing target', f)

# ---------------------------------------------------------------- skeleton (reduced)
skel = json.load(open(os.path.join(DATA, 'rigs/default.mhskel')))
J = skel['joints']
def joint(n): return V[J[n]].mean(axis=0)
KEEP_PREFIX = ('root', 'pelvis', 'upperleg', 'lowerleg', 'foot', 'spine', 'clavicle', 'shoulder01', 'upperarm', 'lowerarm', 'wrist', 'finger', 'neck', 'head')
bones_src = skel['bones']
def kept(n): return n.startswith(KEEP_PREFIX)
def mapped(n):
    while not kept(n): n = bones_src[n]['parent']
    return n
order = []
def walk(n):
    if kept(n): order.append(n)
    for k in sorted(c for c in bones_src if bones_src[c]['parent'] == n): walk(k)
walk('root')
bindex = {n: i for i, n in enumerate(order)}

W = json.load(open(os.path.join(DATA, 'rigs/default_weights.mhw')))['weights']
nv = len(V); acc = [dict() for _ in range(nv)]
for b, lst in W.items():
    t = bindex[mapped(b)]
    for vi, w in lst: acc[vi][t] = acc[vi].get(t, 0) + w
def top4(d):
    items = sorted(d.items(), key=lambda x: -x[1])[:4]
    s = sum(w for _, w in items) or 1
    items = [(i, w / s) for i, w in items] + [(0, 0.0)] * (4 - len(items))
    return items

# ---------------------------------------------------------------- metres, feet on the floor
HEIGHT = 1.47
body_faces = [f for f in FACES if f[2] == 'body']
body_vids = sorted({v for f in body_faces for v in f[0]})
floor = V[body_vids, 1].min()
raw_h = (V[body_vids, 1].max() - floor)
SCALE = HEIGHT / raw_h
P = (V - np.array([0, floor, 0])) * SCALE
height = P[body_vids, 1].max()
K = HEIGHT / 1.76          # garment constants were tuned on a 1.76 m adult
print('boy height %.3f m' % height)

def vnormals(pos, faces):
    n = np.zeros_like(pos)
    for f in faces:
        ids = f[0]; a, b, c = pos[ids[0]], pos[ids[1]], pos[ids[2]]
        fn = np.cross(b - a, c - a)
        for i in ids: n[i] += fn
    l = np.linalg.norm(n, axis=1, keepdims=True); l[l == 0] = 1
    return n / l
N = vnormals(P, body_faces)

dom = np.full(nv, -1)
for i in body_vids:
    if acc[i]: dom[i] = max(acc[i].items(), key=lambda x: x[1])[0]
def bones_like(*prefixes): return {bindex[n] for n in order if n.startswith(prefixes)}
B_HEAD = bones_like('head', 'neck'); B_ARM = bones_like('shoulder01', 'upperarm', 'lowerarm'); B_HAND = bones_like('wrist', 'finger')
B_LEG = bones_like('upperleg', 'lowerleg'); B_FOOT = bones_like('foot')
L = lambda n: (joint(n) - [0, floor, 0]) * SCALE
LM = dict(neck=L('neck01____head'), head=L('head____head'), top=L('head____tail'), eye=L('eye.L____head'), chin=L('jaw____tail'),
          sh={s: L(f'upperarm01.{s}____head') for s in 'LR'}, el={s: L(f'lowerarm01.{s}____head') for s in 'LR'}, wr={s: L(f'wrist.{s}____head') for s in 'LR'},
          hip=L('spine05____head'), ankle=L('foot.L____head'), navel=L('spine04____head'),
          thigh={s: L(f'upperleg01.{s}____head') for s in 'LR'}, knee={s: L(f'lowerleg01.{s}____head') for s in 'LR'})
def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vec_arm_t(p):
    out = np.zeros(len(p))
    for sd, sg in (('L', 1), ('R', -1)):
        a, w = LM['sh'][sd], LM['wr'][sd]; t = ((p - a) @ (w - a)) / np.dot(w - a, w - a); m = np.sign(p[:, 0]) == sg; out[m] = t[m]
    return out
def arm_t(p):
    s = 'L' if p[0] > 0 else 'R'; a, w = LM['sh'][s], LM['wr'][s]; return float(np.dot(p - a, w - a) / np.dot(w - a, w - a)), float(np.linalg.norm(w - a))

HEM = LM['hip'][1] + 0.02 * K   # upper-thobe hem at the hips; the runtime skirt (js/boy.js) overlaps it
CUFF = 0.965                     # sleeve ends just above the wrist joint
def collar_y(p):
    front = ss(0.0, 0.05 * K, p[..., 2] - LM['neck'][2]) * ss(0.06 * K, 0.0, np.abs(p[..., 0]))
    return LM['neck'][1] + 0.01 * K - 0.022 * K * front
# Signed garment fields (metres, > 0 inside the garment)
def g_thobe(i):
    p, d = P[i], dom[i]
    if d in B_HAND or d in B_FOOT or d < 0: return -1
    c = collar_y(p) - p[1]
    if d in B_HEAD: return c
    if d in B_ARM:
        t, al = arm_t(p); return min(c + 0.2, (CUFF - t) * al)
    return min(c, p[1] - HEM)
def pf_thobe(p):
    al = np.linalg.norm(LM['wr']['L'] - LM['sh']['L']); armness = ss(LM['sh']['L'][0] - 0.03 * K, LM['sh']['L'][0] + 0.02 * K, np.abs(p[:, 0]))
    return np.minimum(collar_y(p) - p[:, 1], np.where(armness > 0.5, (CUFF - vec_arm_t(p)) * al, p[:, 1] - HEM))
def g_sirwal(i):
    p, d = P[i], dom[i]
    if d in B_HAND or d < 0: return -1
    if d in B_ARM or d in B_HEAD: return -0.05
    return min(LM['hip'][1] + 0.05 * K - p[1], p[1] - (LM['ankle'][1] + 0.01))
def pf_sirwal(p): return np.minimum(LM['hip'][1] + 0.05 * K - p[:, 1], p[:, 1] - (LM['ankle'][1] + 0.01))
def g_shoes(i):
    p, d = P[i], dom[i]
    if d not in B_FOOT and d not in B_LEG: return -1
    return (LM['ankle'][1] + 0.035) - p[1]
PF = {'thobe': pf_thobe, 'sirwal': pf_sirwal}
GARMENTS = {  # name: (field, offset, smoothing iterations)
    'thobe': (g_thobe, lambda i: 0.0075 if dom[i] in B_ARM else 0.0095, 5),
    'sirwal': (g_sirwal, lambda i: 0.006, 4),
}
BODYSET = set(body_vids)
G = {n: np.array([f(i) if i in BODYSET else -1.0 for i in range(nv)]) for n, (f, _, _) in GARMENTS.items()}

adj = [set() for _ in range(nv)]
for vids, _, _ in body_faces:
    for k in range(len(vids)): adj[vids[k]].add(vids[(k + 1) % len(vids)]); adj[vids[(k + 1) % len(vids)]].add(vids[k])

def build_mesh(face_list, offset=None, smooth=0, field=None):
    used = sorted({v for f in face_list for v in f[0]}); base = {v: P[v].copy() for v in used}
    for _ in range(smooth):
        base = {v: base[v] * 0.5 + 0.5 * np.mean([base.get(u, P[u]) for u in adj[v]], axis=0) for v in used}
    sn = {v: np.zeros(3) for v in used}
    for vids, _, _ in face_list:
        a0, b0, c0 = base[vids[0]], base[vids[1]], base[vids[2]]; fn = np.cross(b0 - a0, c0 - a0)
        for v in vids: sn[v] += fn
    for v in used:
        l = np.linalg.norm(sn[v]); sn[v] = sn[v] / l if l > 0 else N[v]
        if np.dot(sn[v], N[v]) < 0: sn[v] = -sn[v]
    key2idx, pos, nrm, uv, si, sw, idx, src = {}, [], [], [], [], [], [], []
    for vids, tids, _ in face_list:
        loop = []
        for v, t in zip(vids, tids):
            k = (v, t)
            if k not in key2idx:
                key2idx[k] = len(pos); o = 0.0
                if offset: o = offset(v) * (0.3 + 0.7 * ss(0.0, 0.025, field[v])) if field is not None else offset(v)
                q = base[v] + sn[v] * o
                pos.append(q.tolist()); nrm.append(N[v].tolist()); uv.append([VT[t][0], VT[t][1]]); src.append(v)
                w = top4(acc[v]); si.append([i for i, _ in w]); sw.append([round(x, 4) for _, x in w])
            loop.append(key2idx[k])
        for k in range(1, len(loop) - 1): idx += [loop[0], loop[k], loop[k + 1]]
    return dict(pos=pos, nrm=nrm, uv=uv, skinIndex=si, skinWeight=sw, index=idx, src=src)

def faces_where(pred): return [f for f in body_faces if pred(f[0])]
meshes = {}
for name, (fn, off, sm) in GARMENTS.items():
    g = G[name]
    meshes[name] = build_mesh(faces_where(lambda ids: max(g[i] for i in ids) > -0.012 and min(g[i] for i in ids) > -0.2), off, sm, g)
G['shoes'] = np.array([g_shoes(i) if i in BODYSET else -1.0 for i in range(nv)])
covered = np.maximum.reduce([G['thobe'], G['sirwal'], G['shoes']])
# the scalp is hidden by the ghutra: drop skin faces above the brow band that are fully inside the head-cloth
brow_cut = LM['eye'][1] + 0.05 * K
scalp = np.array([(P[i][1] > brow_cut and dom[i] in B_HEAD and P[i][2] < LM['head'][2] + 0.07 * K) if i in BODYSET else False for i in range(nv)])
meshes['skin'] = build_mesh(faces_where(lambda ids: not all(covered[i] > 0.015 for i in ids)))

# ---------------------------------------------------------------- eyes
def fit_mhclo(path):
    lines = [l.split() for l in open(path) if l.strip() and not l.startswith('#')]
    scales, refs, mode = {}, [], None
    for a in lines:
        if a[0] in ('x_scale', 'y_scale', 'z_scale'): scales[a[0][0]] = (int(a[1]), int(a[2]), float(a[3]))
        elif a[0] == 'verts': mode = 'v'; continue
        elif mode == 'v' and len(a) == 9 and a[0].lstrip('-').isdigit(): refs.append(a)
        elif mode == 'v' and len(a) == 1 and a[0].isdigit(): refs.append(a)
        elif mode == 'v' and len(a) > 1 and not a[0].lstrip('-').isdigit(): mode = None
    sc = [abs(V[scales[k][0]][i] - V[scales[k][1]][i]) / scales[k][2] for i, k in enumerate('xyz')]
    out = []
    for a in refs:
        if len(a) == 1: out.append(V[int(a[0])]); continue
        v = [int(x) for x in a[:3]]; w = [float(x) for x in a[3:6]]; o = np.array([float(x) for x in a[6:9]]) * sc
        out.append(w[0] * V[v[0]] + w[1] * V[v[1]] + w[2] * V[v[2]] + o)
    return np.array(out)
def load_obj(path):
    pv, pt, pf = [], [], []
    for l in open(path):
        if l.startswith('v '): pv.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '): pt.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('f '):
            t = [x.split('/') for x in l.split()[1:]]; pf.append(([int(a[0]) - 1 for a in t], [int(a[1]) - 1 for a in t]))
    return np.array(pv), np.array(pt), pf
ev, et, ef = load_obj(os.path.join(DATA, 'eyes/high-poly/high-poly.obj'))
fitted = (fit_mhclo(os.path.join(DATA, 'eyes/high-poly/high-poly.mhclo')) - np.array([0, floor, 0])) * SCALE
hb = bindex['head']
def eye_part(want_cornea):
    E = dict(pos=[], uv=[], skinIndex=[], skinWeight=[], index=[]); key = {}
    for vids, tids in ef:
        cu = np.mean([et[t][0] for t in tids]); cv = np.mean([et[t][1] for t in tids])
        if (cu > 0.85 and cv < 0.15) != want_cornea: continue
        loop = []
        for v, t in zip(vids, tids):
            k = (v, t)
            if k not in key:
                key[k] = len(E['pos']); E['pos'].append(fitted[v].tolist()); E['uv'].append(et[t].tolist()); E['skinIndex'].append([hb, 0, 0, 0]); E['skinWeight'].append([1, 0, 0, 0])
            loop.append(key[k])
        for k in range(1, len(loop) - 1): E['index'] += [loop[0], loop[k], loop[k + 1]]
    return E
meshes['eyes'] = eye_part(False); meshes['cornea'] = eye_part(True)

# ---------------------------------------------------------------- eyelashes: MakeHuman's lash helper strips (3 rows each),
# re-parameterised (u along the lid, v from root to tip) and textured with an alpha card of individual curved lashes
from scipy.spatial import cKDTree
btree = cKDTree(P[body_vids])
def lash_part():
    E = dict(pos=[], uv=[], skinIndex=[], skinWeight=[], index=[])
    for g, upper in (('helper-l-eyelashes-2', 1), ('helper-l-eyelashes-1', 0), ('helper-r-eyelashes-2', 1), ('helper-r-eyelashes-1', 0)):
        fl = [f for f in FACES if f[2] == g]
        if not fl: print('no lash helper', g); continue
        vs = sorted({v for f in fl for v in f[0]})
        d, nn = btree.query(P[vs]); dmax = max(d.max(), 1e-6)
        c = P[vs].mean(0); ang = np.arctan2(P[vs, 1] - c[1], P[vs, 0] - c[0])
        xs = P[vs, 0]; u = (xs - xs.min()) / max(xs.max() - xs.min(), 1e-6)
        if c[0] < 0: u = 1 - u
        base = len(E['pos']); key = {}
        for k, v in enumerate(vs):
            key[v] = len(E['pos']); E['pos'].append(P[v].tolist())
            E['uv'].append([float(u[k]) * 0.5 + (0 if upper else 0.5), float(d[k] / dmax)])
            w = top4(acc[body_vids[nn[k]]]); E['skinIndex'].append([i for i, _ in w]); E['skinWeight'].append([round(x, 4) for _, x in w])
        for vids, _, _ in fl:
            loop = [key[v] for v in vids]
            for k in range(1, len(loop) - 1): E['index'] += [loop[0], loop[k], loop[k + 1]]
    return E
meshes['lashes'] = lash_part()
print('lashes', len(meshes['lashes']['pos']), 'verts')

# ---------------------------------------------------------------- textures (UV-space painting from 3-D position)
def raster(mesh, shade, size, field=None, dilate=6, pfield=None):
    img = np.zeros((size, size, 4), dtype=np.float32)
    uv = np.array(mesh['uv']); src = np.array(mesh['src']); idx = np.array(mesh['index']).reshape(-1, 3)
    base = P[src]; nrm = N[src]; fv = field[src] if field is not None else np.zeros(len(src))
    for tri in idx:
        t = uv[tri] * [size, size]; t[:, 1] = size - t[:, 1]
        x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = t
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-9: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d; l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d; l3 = 1 - l1 - l2
        m = (l1 >= -0.03) & (l2 >= -0.03) & (l3 >= -0.03)
        if not m.any(): continue
        w = np.stack([l1[m], l2[m], l3[m]], 1)
        p3 = w @ base[tri]; col = shade(p3, w @ nrm[tri], pfield(p3) if pfield else w @ fv[tri])
        img[y0:y1 + 1, x0:x1 + 1][m] = col
    a = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')
    rgb = a.convert('RGB'); alpha = a.split()[3]; cov = alpha.point(lambda v: 255 if v > 0 else 0)
    for _ in range(dilate):
        grown = rgb.filter(ImageFilter.MaxFilter(3)); rgb = Image.composite(rgb, grown, cov); cov = cov.filter(ImageFilter.MaxFilter(3))
    out = rgb.convert('RGBA'); out.putalpha(alpha); return out

def hash3(p, scale, seed=0):
    q = np.floor(p * scale); return (np.sin(q[:, 0] * 12.9898 + q[:, 1] * 78.233 + q[:, 2] * 37.719 + seed) * 43758.5453) % 1.0
def vnoise(p, scale, seed=0):
    q = p * scale; i = np.floor(q); f = q - i; f = f * f * (3 - 2 * f); out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = (np.sin((i[:, 0] + dx) * 12.9898 + (i[:, 1] + dy) * 78.233 + (i[:, 2] + dz) * 37.719 + seed) * 43758.5453) % 1.0
                out = out + h * np.where(dx, f[:, 0], 1 - f[:, 0]) * np.where(dy, f[:, 1], 1 - f[:, 1]) * np.where(dz, f[:, 2], 1 - f[:, 2])
    return out
def mix(a, b, t):
    t = np.asarray(t, dtype=np.float64)
    if t.ndim == 1: t = t[:, None]
    return a * (1 - t) + b * t
def fbm(p, scale, seed=0): return 0.5 * vnoise(p, scale, seed) + 0.3 * vnoise(p, scale * 2.1, seed + 3) + 0.2 * vnoise(p, scale * 4.3, seed + 7)

# ---------------------------------------------------------------- skin: colour, cavity occlusion, eyebrows, pores
# per-vertex cavity (concavity from the mesh Laplacian, widened by smoothing) → soft occlusion in creases
lap = np.zeros_like(P); cnt = np.zeros(nv)
for v in body_vids:
    nb = list(adj[v]); lap[v] = P[nb].mean(0) - P[v]; cnt[v] = len(nb)
el = np.array([np.mean([np.linalg.norm(P[u] - P[v]) for u in adj[v]]) if adj[v] else 1 for v in range(nv)])
CAV = np.einsum('ij,ij->i', lap, N) / np.maximum(el, 1e-6)
for _ in range(3): CAV = np.array([0.5 * CAV[v] + 0.5 * np.mean(CAV[list(adj[v])]) if adj[v] else CAV[v] for v in range(nv)])
CAV = np.clip(CAV / 0.18, -1, 1)
head_v = np.array([i for i in body_vids if dom[i] in B_HEAD])
fr = head_v[np.abs(P[head_v, 0]) < 0.004]; fr = fr[(P[fr, 1] < LM['eye'][1]) & (P[fr, 1] > LM['chin'][1] + 0.03 * K)]
NOSE = P[fr[np.argmax(P[fr, 2])]]
# mouth slit = the deepest point (smallest z) of the outer midline profile between the lips
midl = head_v[(np.abs(P[head_v, 0]) < 0.0025) & (P[head_v, 1] < NOSE[1] - 0.022) & (P[head_v, 1] > NOSE[1] - 0.036)]
zmax = P[midl, 2].max(); midl = midl[P[midl, 2] > zmax - 0.008]
slit = midl[np.argmin(P[midl, 2])]
MOUTH = np.array([0.0, P[slit, 1], P[slit, 2]]); MOUTH_W = 0.0255 * K
print('nose tip', NOSE, 'mouth', MOUTH, 'eye', LM['eye'])
SKIN = np.array([199, 151, 118]) / 255     # light wheat-tan (Gulf), sRGB
RED = np.array([196, 118, 100]) / 255; BROW = np.array([38, 27, 21]) / 255
H = LM['head']; EYE_Y, CHIN_Y = LM['eye'][1], LM['chin'][1]; EX = abs(LM['eye'][0]); EZ = LM['eye'][2]
def gauss2(dx, dy, rx, ry): return np.exp(-(dx * dx / (rx * rx) + dy * dy / (ry * ry)))
def brow_field(p):
    """eyebrow density with hair-stroke direction (inner hairs point up, outer hairs sweep outwards)."""
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    s = (ax - 0.007 * K) / (0.052 * K)                       # 0 inner … 1 tail
    cy = EYE_Y + 0.0215 * K + 0.0065 * K * np.sin(np.pi * np.clip(s, 0, 1) * 0.85) - 0.006 * K * np.clip(s - 0.6, 0, 1) / 0.4
    half = (0.0075 - 0.0042 * np.clip(s, 0, 1)) * K
    d = (y - cy) / half
    inside = ss(1.35, 0.55, np.abs(d) * (0.9 + 0.25 * fbm(p, 260, 33))) * ss(-0.08, 0.08, s) * ss(1.06, 0.88, s) * (z > EZ - 0.012)
    ang = np.radians(80 - 75 * np.clip(s, 0, 1))             # hair angle from horizontal
    across = ax * np.sin(ang) - (y - cy) * np.cos(ang); along = ax * np.cos(ang) + (y - cy) * np.sin(ang)
    q = np.stack([across / (0.0011 * K), along / (0.0075 * K), z * 0], 1)
    strands = 0.6 * vnoise(q, 1.0, 71) + 0.4 * vnoise(q * 1.9, 1.0, 73)
    strands = ss(0.35, 0.75, strands)
    broken = ss(0.3, 0.7, fbm(p, 420, 37))
    return np.clip(inside * (0.62 + 0.38 * strands * (0.6 + 0.4 * broken)), 0, 1)
def shade_skin(p, n, cav):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    c = np.tile(SKIN, (len(p), 1))
    c = c * (0.955 + 0.07 * fbm(p, 22, 1))[:, None] * (0.985 + 0.03 * fbm(p, 160, 4))[:, None]
    head = y > LM['neck'][1] - 0.03
    front = head & (z > H[2] + 0.02 * K)
    red = (0.55 * gauss2(ax - 0.036 * K, y - (EYE_Y - 0.032 * K), 0.02 * K, 0.018 * K) * front
           + 0.6 * np.exp(-np.sum((p - NOSE) ** 2, 1) / (0.012 * K) ** 2)
           + 0.25 * gauss2(x, y - (CHIN_Y + 0.012 * K), 0.018 * K, 0.012 * K) * front)
    ears = head & (ax > abs(H[0]) + 0.055 * K) & (np.abs(z - H[2]) < 0.04 * K)
    red = red + 0.45 * ears
    hand = y < LM['wr']['L'][1] + 0.02
    red = red + 0.18 * hand * fbm(p, 60, 9)
    c = mix(c, c * RED / SKIN * 0.98, np.clip(red, 0, 1) * 0.35)
    # darker, slightly cooler under the eyes; upper-lid crease; lash line
    ue = gauss2(ax - EX, y - (EYE_Y - 0.013 * K), 0.016 * K, 0.006 * K) * front
    c = c * (1 - 0.1 * ue)[:, None] * np.array([1.0, 0.985, 1.01])[None] ** ue[:, None]
    crease = gauss2(ax - EX, y - (EYE_Y + 0.0105 * K + 0.004 * K * np.cos((ax - EX) / (0.018 * K))), 0.014 * K, 0.0017 * K) * front
    c = c * (1 - 0.18 * crease)[:, None]
    lash = gauss2(ax - EX, y - (EYE_Y + 0.0055 * K), 0.012 * K, 0.0012 * K) * front * (z > EZ)
    c = mix(c, BROW, np.clip(lash * 0.55, 0, 1))
    # occlusion in creases (eye sockets, nostrils, mouth corners, ears, neck, between fingers), warm in the deepest parts
    occ = np.clip(cav, 0, 1)
    c = c * (1 - 0.42 * occ)[:, None] * (np.array([1.0, 0.93, 0.9]) ** occ[:, None])
    c = c * (1 + 0.05 * np.clip(-cav, 0, 1))[:, None]
    # lips: shape from the mouth slit (cupid's bow on the upper lip, fuller lower lip), soft vermilion border
    lx = x / (MOUTH_W * 1.02); dyl = y - MOUTH[1]
    up = (0.0078) * np.sqrt(np.clip(1 - lx ** 2, 0, 1)) * (1 - 0.18 * np.exp(-(lx / 0.16) ** 2)) * (1 + 0.12 * np.exp(-((np.abs(lx) - 0.3) / 0.15) ** 2))
    lo = (0.0092) * np.clip(1 - lx ** 2, 0, 1) ** 0.6
    lipm = np.where(dyl >= 0, ss(1.15, 0.8, dyl / np.maximum(up, 1e-5)), ss(1.15, 0.8, -dyl / np.maximum(lo, 1e-5))) * ss(1.08, 0.9, np.abs(lx)) * (z > MOUTH[2] - 0.02)
    lipc = np.array([171, 101, 92]) / 255 * (0.96 + 0.06 * fbm(p, 700, 61))[:, None] * np.where(dyl < 0, 1.06, 1.0)[:, None]
    c = mix(c, c * 0.3 + lipc * 0.7, lipm * 0.85)
    # eyebrows (hair strokes)
    b = brow_field(p) * front
    c = mix(c, BROW * (0.9 + 0.2 * fbm(p, 300, 41))[:, None], b * 0.92)
    return np.concatenate([np.clip(c, 0, 1), np.ones((len(p), 1))], 1)
def shade_skin_rough(p, n, cav):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    r = np.full(len(p), 0.56)
    tz = gauss2(x, y - (EYE_Y + 0.03 * K), 0.03 * K, 0.03 * K) + np.exp(-np.sum((p - NOSE) ** 2, 1) / (0.02 * K) ** 2)
    r = r - 0.12 * np.clip(tz, 0, 1) + 0.06 * fbm(p, 80, 12) + 0.08 * np.clip(cav, 0, 1)
    r = r + 0.12 * brow_field(p)
    return np.concatenate([np.repeat(np.clip(r, 0, 1)[:, None], 3, 1), np.ones((len(p), 1))], 1)
def shade_skin_height(p, n, cav):
    pores = fbm(p, 900, 51); fine = fbm(p, 2400, 53)
    h = 0.5 + 0.18 * (pores - 0.5) + 0.08 * (fine - 0.5) - 0.25 * brow_field(p) * 0
    return np.concatenate([np.repeat(np.clip(h, 0, 1)[:, None], 3, 1), np.ones((len(p), 1))], 1)
def fabric(colorA, colorB, scale, detail=None, cut=True, weave=900):
    a = np.array(colorA) / 255; b = np.array(colorB) / 255
    def fn(p, n, g):
        t = 0.35 * hash3(p, scale) + 0.65 * fbm(p, 55, 2)
        c = a * (1 - t[:, None] * 0.22) + b * (t[:, None] * 0.22)
        c *= (0.95 + 0.05 * fbm(p, 12, 9))[:, None]
        tw = 0.985 + 0.015 * np.sin(p[:, 1] * weave * 6.283)  # fine twill
        c *= tw[:, None]
        if detail is not None: c = detail(p, c, g)
        alpha = ss(-0.0015, 0.0015, g) if cut else np.ones(len(p))
        return np.concatenate([np.clip(c, 0, 1), alpha[:, None]], 1)
    return fn
def thobe_detail(p, c, g):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    front = z > LM['neck'][2] - 0.01
    placket_bottom = LM['navel'][1] + 0.06 * K
    pl = front & (np.abs(x - 0.004) < 0.012 * K) & (y > placket_bottom) & (y < LM['neck'][1])
    c[pl] *= 0.965
    edge = front & (np.abs(np.abs(x - 0.004) - 0.012 * K) < 0.0012) & (y > placket_bottom) & (y < LM['neck'][1])
    c[edge] *= 0.9
    for k in range(3):  # hidden-placket buttons
        by = LM['neck'][1] - 0.035 * K - k * 0.055 * K
        bt = front & (np.abs(x - 0.004) ** 2 + (y - by) ** 2 < (0.0045 * K) ** 2)
        c[bt] = np.array([226, 224, 216]) / 255
    hem = (g < 0.007) & (g > 0); c[hem] *= 0.93           # collar band / cuffs
    cuff = (vec_arm_t(p) > CUFF - 0.09) & (np.abs(x) > LM['sh']['L'][0] - 0.02); c[cuff] *= 0.975
    return c
def sirwal_detail(p, c, g):
    c[(g < 0.008) & (g > 0)] *= 0.92; return c
def thobe_height(p, n, g):
    """fold & seam relief for the thobe's normal map: elbow and armpit folds, soft drape, seams, placket, cuffs, collar band."""
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    h = 0.5 + 0.05 * (fbm(p, 30, 81) - 0.5) + 0.01 * (fbm(p, 260, 83) - 0.5)
    at = vec_arm_t(p); armness = ss(LM['sh']['L'][0] - 0.02 * K, LM['sh']['L'][0] + 0.03 * K, ax)
    al = np.linalg.norm(LM['wr']['L'] - LM['sh']['L'])
    ph = fbm(p, 18, 85) * 6.0
    inner = ss(-0.2, 0.6, (LM['sh']['L'][2] - z) / 0.03)          # folds bunch on the inside of the elbow
    elbow = np.exp(-((at - 0.5) / 0.08) ** 2) * armness * (0.35 + 0.65 * inner)
    h += 0.12 * elbow * np.sin((at * al) / 0.022 * 2 * np.pi + ph) * (0.6 + 0.4 * fbm(p, 50, 86))
    # armpit / chest diagonal folds
    pit = np.exp(-((ax - (LM['sh']['L'][0] - 0.035 * K)) / (0.05 * K)) ** 2) * np.exp(-((y - (LM['sh']['L'][1] - 0.07 * K)) / (0.06 * K)) ** 2) * (1 - armness)
    h += 0.1 * pit * np.sin((ax * 0.7 + y) / 0.028 * 2 * np.pi + ph)
    # soft vertical drape on the lower torso
    low = ss(LM['navel'][1] + 0.05 * K, LM['hip'][1], y) * (1 - armness)
    q = np.stack([x / (0.03 * K), y / (0.25 * K), z / (0.03 * K)], 1)
    h += 0.14 * low * (vnoise(q, 1.0, 87) - 0.5)
    # seams: shoulder seam (raised groove), side seams, cuffs, placket edges, collar band
    sh_seam = np.exp(-((z - (LM['neck'][2] - 0.004)) / 0.0022) ** 2) * ss(0.045 * K, 0.06 * K, ax) * ss(LM['sh']['L'][0] + 0.02, LM['sh']['L'][0] - 0.01, ax) * (y > LM['sh']['L'][1] - 0.03)
    h -= 0.2 * sh_seam
    side = np.exp(-((z - LM['hip'][2]) / 0.0022) ** 2) * (1 - armness) * (y < LM['sh']['L'][1] - 0.08 * K)
    h -= 0.15 * side
    front = z > LM['neck'][2] - 0.01; placket_bottom = LM['navel'][1] + 0.06 * K
    pe = front & (np.abs(np.abs(x - 0.004) - 0.012 * K) < 0.0016) & (y > placket_bottom) & (y < LM['neck'][1])
    h += 0.12 * pe
    cuff = np.exp(-((at - (CUFF - 0.09)) / 0.006) ** 2) * armness; h -= 0.2 * cuff
    collar = (g < 0.009) & (g > 0) & (y > LM['neck'][1] - 0.03); h += 0.1 * collar
    return np.concatenate([np.repeat(np.clip(h, 0, 1)[:, None], 3, 1), np.ones((len(p), 1))], 1)
paint = {
    'skin': (shade_skin, 'cav', 2048),
    'skin_r': (shade_skin_rough, 'cav', 1024),
    'skin_h': (shade_skin_height, 'cav', 2048),
    'thobe': (fabric((247, 247, 243), (214, 214, 206), 1700, thobe_detail, weave=700), 'thobe', 1024),
    'thobe_h': (thobe_height, 'thobe', 1024),
    'sirwal': (fabric((236, 236, 230), (200, 200, 192), 1500, sirwal_detail), 'sirwal', 512),
}
G['cav'] = CAV
MASKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'masks')
def lips_and_nails(img):
    a = np.asarray(img).astype(np.float32) / 255; rgb = a[..., :3]; sz = rgb.shape[0]
    def mask(n, blur):
        m = Image.open(os.path.join(MASKS, f'mpfb_{n}.jpg')).convert('L').resize((sz, sz), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur * sz / 2048))
        return (np.asarray(m).astype(np.float32) / 255)[..., None]
    nails = mask('fingernails', 1.0)
    yy, xx = np.mgrid[0:sz, 0:sz]
    rgb = rgb * (1 - nails * 0.6) + np.array([224, 186, 170]) / 255 * nails * 0.6
    out = np.concatenate([rgb, a[..., 3:]], -1)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA')
ONLY = os.environ.get('ONLY')
for name, (fn, field, size) in paint.items():
    if ONLY and name not in ONLY.split(','): continue
    mname = 'skin' if name.startswith('skin') else name.split('_')[0]
    img = raster(meshes[mname], fn, size, G[field] if field else None, pfield=PF.get(field))
    if name == 'skin': img = lips_and_nails(img)
    if name.endswith('_h'):  # height → tangent-space normal map in UV space (OpenGL convention)
        h = np.asarray(img).astype(np.float32)[..., 0] / 255
        if name == 'thobe_h': h = np.asarray(img.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., 0] / 255
        dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5; dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
        k = 3.0; nx, ny, nz = -dx * k * 255 / 40, dy * k * 255 / 40, np.ones_like(h); l = np.sqrt(nx * nx + ny * ny + nz * nz)
        nm = np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5
        img = Image.fromarray((nm * 255).astype(np.uint8), 'RGB').resize((1024, 1024), Image.LANCZOS); name = name[:-2] + '_n'
    img.save(os.path.join(OUT, name + '.png'), optimize=True); print('texture', name, img.size)
# eyes: MakeHuman iris texture, re-toned to a warm mid/deep brown with a visible fibre pattern and dark limbal ring;
# pupil kept black; sclera off-white with slight warmth towards the corners
eye = np.asarray(Image.open(os.path.join(DATA, 'eyes/materials/brown_eye.png')).convert('RGB').resize((512, 512), Image.LANCZOS)).astype(np.float32) / 255
r_, g_, b_ = eye[..., 0], eye[..., 1], eye[..., 2]
iris = np.clip((r_ - (g_ + b_) / 2 - 0.08) / 0.15, 0, 1)[..., None]
lum = (0.3 * r_ + 0.59 * g_ + 0.11 * b_)[..., None]
dark = (lum < 0.09).astype(np.float32)                         # pupil
fib = np.clip((lum - 0.05) / 0.35, 0, 1)
brown = np.concatenate([0.20 + 0.38 * fib, 0.11 + 0.22 * fib, 0.05 + 0.10 * fib], -1)
pupil = np.full_like(brown, 0.015)
sclera = np.clip(eye * 1.06 + 0.03, 0, 1) * np.array([1.0, 0.975, 0.95])
eye = sclera * (1 - iris) + (brown * (1 - dark) + pupil * dark) * iris
Image.fromarray((np.clip(eye, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'eyes.png'))
import cv2
LW, LH, SC = 512, 128, 4
big = np.zeros((LH * SC, LW * SC), np.float32); rr = np.random.default_rng(7)
for half, n, lmin, lmax in ((0, 64, 0.5, 0.9), (1, 30, 0.25, 0.5)):
    for k in range(n):
        u0 = half * 0.5 + rr.uniform(0.02, 0.48); LL = rr.uniform(lmin, lmax) * (0.75 + 0.25 * np.sin(np.pi * ((u0 - half * 0.5) / 0.5)))
        curl = rr.uniform(-0.03, 0.03) + (0.05 if half == 0 else 0.0); pts = []
        for t in np.linspace(0, 1, 12):
            x = (u0 + curl * t * t) * LW * SC; y = (1 - t * LL) * LH * SC
            pts.append((x, y, t))
        for (x0, y0, t0), (x1, y1, t1) in zip(pts[:-1], pts[1:]):
            wdt = max(1, int(round((1 - t0 * 0.85) * 1.3 * SC)))
            cv2.line(big, (int(x0), int(y0)), (int(x1), int(y1)), 1.0, wdt, cv2.LINE_AA)
la = cv2.resize(big, (LW, LH), interpolation=cv2.INTER_AREA)
lrgb = np.zeros((LH, LW, 3), np.float32) + np.array([0.13, 0.09, 0.07])
Image.fromarray((np.concatenate([lrgb, np.clip(la, 0, 1)[..., None]], -1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'lashes.png'))


bones_out = []
for n in order:
    par = bones_src[n]['parent']
    while par and not kept(par): par = bones_src[par]['parent']
    h = (joint(n + '____head') - [0, floor, 0]) * SCALE; t = (joint(n + '____tail') - [0, floor, 0]) * SCALE
    bones_out.append(dict(name=n.replace('.', '_'), parent=par.replace('.', '_') if par else None, head=[round(v, 5) for v in h.tolist()], tail=[round(v, 5) for v in t.tolist()]))
for m in meshes.values(): m.pop('src', None)
feet = {}
for sd, sg in (('L', 1), ('R', -1)):
    fv = np.array([P[i] for i in body_vids if dom[i] in B_FOOT and np.sign(P[i][0]) == sg])
    feet[sd] = dict(min=fv.min(0).tolist(), max=fv.max(0).tolist(), ankle=L(f'foot.{sd}____head').tolist())
hv = np.array([P[i] for i in body_vids if dom[i] in B_HEAD and P[i][1] > LM['eye'][1] + 0.01])
# head profile samples (for fitting the ghutra): radius of the skull in 24 directions per height band
hc = (hv.min(0) + hv.max(0)) / 2
allhead = np.array([P[i] for i in body_vids if dom[i] in B_HEAD])
prof = []
for yb in np.linspace(LM['chin'][1], hv[:, 1].max(), 14):
    band = allhead[np.abs(allhead[:, 1] - yb) < 0.012]
    row = []
    for k in range(24):
        th = k / 24 * 2 * np.pi; d = np.array([np.sin(th), np.cos(th)])
        if len(band) == 0: row.append(0.0); continue
        rel = band[:, [0, 2]] - hc[[0, 2]]
        row.append(float(max(0.0, (rel @ d).max())))
    prof.append(dict(y=float(yb), r=row))
B_UPPERARM = bones_like('upperarm', 'lowerarm')
torso = np.array([P[i] for i in body_vids if dom[i] not in B_HEAD and dom[i] not in B_HAND and dom[i] not in B_UPPERARM and dom[i] not in B_LEG and P[i][1] > LM['hip'][1] and P[i][1] < LM['neck'][1] + 0.02])
tprof = []
for yb in np.linspace(LM['sh']['L'][1] - 0.25 * K, LM['neck'][1] + 0.01, 10):
    band = torso[np.abs(torso[:, 1] - yb) < 0.012]
    row = []
    for k in range(24):
        th = k / 24 * 2 * np.pi; d = np.array([np.sin(th), np.cos(th)])
        rel = band[:, [0, 2]] - np.array([0, LM['neck'][2]])
        row.append(float(max(0.0, (rel @ d).max())) if len(band) else 0.0)
    tprof.append(dict(y=float(yb), r=row))
hips = np.array([P[i] for i in body_vids if dom[i] not in B_HAND and dom[i] not in B_UPPERARM and P[i][1] > LM['hip'][1] - 0.12 and P[i][1] < LM['hip'][1] + 0.08])
hprof = []
for yb in np.linspace(LM['hip'][1] - 0.10, LM['hip'][1] + 0.06, 9):
    band = hips[np.abs(hips[:, 1] - yb) < 0.01]
    row = []
    for k in range(24):
        th = k / 24 * 2 * np.pi; d = np.array([np.sin(th), np.cos(th)])
        rel = band[:, [0, 2]] - np.array([0, LM['hip'][2]])
        row.append(float(max(0.0, (rel @ d).max())) if len(band) else 0.0)
    hprof.append(dict(y=float(yb), r=row))
cap = dict(hips=hprof, center=hc.tolist(), half=((hv.max(0) - hv.min(0)) / 2).tolist(), top=float(hv[:, 1].max()), brow=float(LM['eye'][1] + 0.05 * K), profile=prof, torso=tprof)
lm = {k: (v.tolist() if isinstance(v, np.ndarray) else {s: w.tolist() for s, w in v.items()}) for k, v in LM.items()}
json.dump(dict(feet=feet, cap=cap, lm=lm, hem=float(HEM), bones=bones_out, meshes=meshes, height=float(height),
               source='MakeHuman hm08 base mesh, child macro targets, default skeleton/weights, high-poly eyes (CC0 1.0)'),
          open(os.path.join(OUT, 'boy.json'), 'w'), separators=(',', ':'))
print('bones', len(bones_out), {k: len(v['index']) // 3 for k, v in meshes.items()})
print('LM hip', LM['hip'], 'knee', LM['knee']['L'], 'ankle', LM['ankle'], 'neck', LM['neck'], 'top', cap['top'])
