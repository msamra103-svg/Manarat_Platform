#!/usr/bin/env python3
"""صيد الأسماك V24.1 — builds the realistic angler from MakeHuman CC0 assets.

Reads the CC0 data of the MakeHuman project (base mesh hm08, macro targets, default skeleton + weights,
high-poly eyes + brown iris texture) and writes an intermediate (JSON + PNG textures) that
tools/build-assets.cjs turns into assets/models/fisherman.glb (skinned glTF).

All code here is original to this project; only the *data files* come from MakeHuman (CC0 1.0).
Usage: python3 build_fisherman.py <makehuman/data dir> <out dir>
"""
import json, os, sys, math
import numpy as np
from PIL import Image, ImageFilter

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(2410)

# ---------------------------------------------------------------- base mesh
V, VT, FACES, groups = [], [], [], []
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

# adult man ≈ 35 years, average muscle (slightly toned), average weight, Middle-Eastern–leaning ethnic blend
age_old = (35 - 25) / (90 - 25)
for age, aw in (('young', 1 - age_old), ('old', age_old)):
    target(f'universal-male-{age}-averagemuscle-averageweight.target', aw * 0.75)
    target(f'universal-male-{age}-maxmuscle-averageweight.target', aw * 0.25)
    for race, rw in (('caucasian', 0.7), ('african', 0.2), ('asian', 0.1)):
        target(f'{race}-male-{age}.target', aw * rw)

# ---------------------------------------------------------------- skeleton
skel = json.load(open(os.path.join(DATA, 'rigs/default.mhskel')))
J = skel['joints']
def joint(n): return V[J[n]].mean(axis=0)
KEEP_PREFIX = ('root', 'pelvis', 'upperleg', 'lowerleg', 'foot', 'spine', 'clavicle', 'shoulder01', 'upperarm', 'lowerarm', 'wrist', 'finger', 'neck', 'head')
bones_src = skel['bones']
def kept(n): return n.startswith(KEEP_PREFIX)
def mapped(n):  # merge non-kept bones into their nearest kept ancestor
    while not kept(n): n = bones_src[n]['parent']
    return n
order = []
def walk(n):
    if kept(n): order.append(n)
    for k in sorted(c for c in bones_src if bones_src[c]['parent'] == n): walk(k)
walk('root')
bindex = {n: i for i, n in enumerate(order)}

# ---------------------------------------------------------------- weights
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

# ---------------------------------------------------------------- units: metres, feet on the floor
SCALE = 0.1
body_faces = [f for f in FACES if f[2] == 'body']
body_vids = sorted({v for f in body_faces for v in f[0]})
floor = V[body_vids, 1].min()
raw_h = (V[body_vids, 1].max() - floor) * SCALE
SCALE = SCALE * 1.76 / raw_h          # 1.76 m tall adult
P = (V - np.array([0, floor, 0])) * SCALE
height = P[body_vids, 1].max()
print('angler height %.3f m' % height)

# smooth vertex normals of the body
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
B_TORSO = bones_like('spine01', 'spine02', 'spine03', 'spine04', 'clavicle'); B_HIP = bones_like('spine05', 'root', 'pelvis')
B_LEG = bones_like('upperleg', 'lowerleg'); B_FOOT = bones_like('foot'); B_SHOULDER = bones_like('shoulder01')
L = lambda n: (joint(n) - [0, floor, 0]) * SCALE
LM = dict(neck=L('neck01____head'), head=L('head____head'), top=L('head____tail'), eye=L('eye.L____head'), chin=L('jaw____tail'),
          sh={s: L(f'upperarm01.{s}____head') for s in 'LR'}, el={s: L(f'lowerarm01.{s}____head') for s in 'LR'}, wr={s: L(f'wrist.{s}____head') for s in 'LR'},
          hip=L('spine05____head'), ankle=L('foot.L____head'), navel=L('spine04____head'))
def arm_t(p):  # 0 at the shoulder joint → 1 at the wrist
    s = 'L' if p[0] > 0 else 'R'; a, w = LM['sh'][s], LM['wr'][s]; return float(np.dot(p - a, w - a) / np.dot(w - a, w - a)), float(np.linalg.norm(w - a))
def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# Signed garment fields (metres, > 0 inside the garment). Smooth fields + alpha-cut textures = clean hems.
def g_shirt(i):
    p, d = P[i], dom[i]
    if d in B_HAND or d in B_LEG or d in B_FOOT or d < 0: return -1
    front = ss(0.0, 0.06, p[2] - LM['neck'][2]) * ss(0.07, 0.0, abs(p[0]))
    collar = LM['neck'][1] - 0.012 - 0.045 * front - p[1]
    if d in B_HEAD: return collar
    if d in B_ARM:
        t, al = arm_t(p); return min(collar + 0.2, (0.70 - t) * al)
    return min(collar, p[1] - (LM['hip'][1] + 0.02))
def g_trousers(i):
    p, d = P[i], dom[i]
    if d in B_HAND or d < 0: return -1
    if d in B_ARM or d in B_HEAD: return -0.05
    waist = LM['hip'][1] + 0.075 - 0.02 * ss(0.0, 0.1, p[2])
    return min(waist - p[1], p[1] - (LM['ankle'][1] + 0.004))
def g_vest(i):
    p, d = P[i], dom[i]
    if d in B_HAND or d in B_LEG or d in B_FOOT or (d in B_ARM and d not in B_SHOULDER) or d < 0: return -1
    if d in B_HEAD or d in B_SHOULDER: return -0.03 if d in B_HEAD else min(-0.002, pf_vest(P[i][None])[0])
    front = ss(0.0, 0.08, p[2]) * ss(0.09, 0.0, abs(p[0]))
    top = LM['neck'][1] - 0.04 - 0.11 * front
    s = 'L' if p[0] > 0 else 'R'; arm = np.linalg.norm((p - LM['sh'][s]) * [1, 0.85, 1.3]) - 0.105
    g = min(top - p[1], p[1] - (LM['hip'][1] + 0.06), arm)
    return min(g, -0.004) if d in B_ARM else g
def g_shoes(i):
    p, d = P[i], dom[i]
    if d not in B_FOOT and d not in B_LEG: return -1
    return (LM['ankle'][1] + 0.04) - p[1]
def vec_arm_t(p):
    out = np.zeros(len(p))
    for sd, sg in (('L', 1), ('R', -1)):
        a, w = LM['sh'][sd], LM['wr'][sd]; t = ((p - a) @ (w - a)) / np.dot(w - a, w - a); m = np.sign(p[:, 0]) == sg; out[m] = t[m]
    return out
def pf_shirt(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    front = ss(0.0, 0.06, z - LM['neck'][2]) * ss(0.07, 0.0, np.abs(x)); collar = LM['neck'][1] - 0.012 - 0.045 * front - y
    al = np.linalg.norm(LM['wr']['L'] - LM['sh']['L']); armness = ss(LM['sh']['L'][0] - 0.03, LM['sh']['L'][0] + 0.02, np.abs(x))
    sleeve = (0.70 - vec_arm_t(p)) * al
    return np.minimum(collar, np.where(armness > 0.5, sleeve, y - (LM['hip'][1] + 0.02)))
def pf_vest(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    front = ss(0.0, 0.08, z) * ss(0.09, 0.0, np.abs(x)); top = LM['neck'][1] - 0.04 - 0.11 * front
    arm = np.minimum(*[np.linalg.norm((p - LM['sh'][sd]) * [1, 0.85, 1.3], axis=1) for sd in 'LR']) - 0.105
    return np.minimum.reduce([top - y, y - (LM['hip'][1] + 0.06), arm, 0.17 - np.abs(x)])
def pf_trousers(p):
    y, z = p[:, 1], p[:, 2]; return np.minimum(LM['hip'][1] + 0.075 - 0.02 * ss(0.0, 0.1, z) - y, y - (LM['ankle'][1] + 0.004))
PF = {'shirt': pf_shirt, 'vest': pf_vest, 'trousers': pf_trousers}
GARMENTS = {  # name: (field, offset, smoothing iterations, alpha-cut)
    'shirt': (g_shirt, lambda i: 0.0065 if dom[i] in B_ARM else 0.0045, 2),
    'trousers': (g_trousers, lambda i: 0.024 if dom[i] in B_LEG else 0.012, 16),
    'vest': (g_vest, lambda i: 0.03, 10),
}
BODYSET = set(body_vids)
G = {n: np.array([f(i) if i in BODYSET else -1.0 for i in range(nv)]) for n, (f, _, _) in GARMENTS.items()}

adj = [set() for _ in range(nv)]
for vids, _, _ in body_faces:
    for k in range(len(vids)): adj[vids[k]].add(vids[(k + 1) % len(vids)]); adj[vids[(k + 1) % len(vids)]].add(vids[k])

def build_mesh(face_list, offset=None, smooth=0, field=None):
    used = sorted({v for f in face_list for v in f[0]}); base = {v: P[v].copy() for v in used}
    for _ in range(smooth):  # Laplacian smoothing of the garment surface (cloth hides anatomy detail)
        nb = {v: base[v] * 0.5 + 0.5 * np.mean([base.get(u, P[u]) for u in adj[v]], axis=0) for v in used}; base = nb
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
                if field is G.get('shoes') and field is not None: q[1] = max(q[1], 0.003)
                pos.append(q.tolist()); nrm.append(N[v].tolist()); uv.append([VT[t][0], VT[t][1]]); src.append(v)
                w = top4(acc[v]); si.append([i for i, _ in w]); sw.append([round(x, 5) for _, x in w])
            loop.append(key2idx[k])
        for k in range(1, len(loop) - 1): idx += [loop[0], loop[k], loop[k + 1]]
    return dict(pos=pos, nrm=nrm, uv=uv, skinIndex=si, skinWeight=sw, index=idx, src=src)

def faces_where(pred): return [f for f in body_faces if pred(f[0])]
meshes = {}
for name, (fn, off, sm) in GARMENTS.items():
    g = G[name]
    meshes[name] = build_mesh(faces_where(lambda ids: max(g[i] for i in ids) > -0.012 and min(g[i] for i in ids) > -0.2), off, sm, g)
G['shoes'] = np.array([g_shoes(i) if i in BODYSET else -1.0 for i in range(nv)])
covered = np.maximum.reduce([G['shirt'], G['trousers'], G['shoes']])
meshes['skin'] = build_mesh(faces_where(lambda ids: not all(covered[i] > 0.015 for i in ids)))
head_c = LM['head']; REG = {}

# ---------------------------------------------------------------- eyes (mhclo fitting to helper geometry)
def fit_mhclo(path):
    lines = [l.split() for l in open(path) if l.strip() and not l.startswith('#')]
    scales, refs, mode = {}, [], None
    for a in lines:
        if a[0] in ('x_scale', 'y_scale', 'z_scale'): scales[a[0][0]] = (int(a[1]), int(a[2]), float(a[3]))
        elif a[0] == 'verts': mode = 'v'; continue
        elif mode == 'v' and len(a) == 9 and a[0].lstrip('-').isdigit(): refs.append(a)
        elif mode == 'v' and len(a) == 1 and a[0].isdigit(): refs.append(a)
        elif mode == 'v' and len(a) > 1 and not a[0].lstrip('-').isdigit(): mode = None
    Vb = V * 1.0
    sc = [abs(Vb[scales[k][0]][i] - Vb[scales[k][1]][i]) / scales[k][2] for i, k in enumerate('xyz')]
    out = []
    for a in refs:
        if len(a) == 1: out.append(Vb[int(a[0])]); continue
        v = [int(x) for x in a[:3]]; w = [float(x) for x in a[3:6]]; o = np.array([float(x) for x in a[6:9]]) * sc
        out.append(w[0] * Vb[v[0]] + w[1] * Vb[v[1]] + w[2] * Vb[v[2]] + o)
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
assert len(fitted) == len(ev), (len(fitted), len(ev))
hb = bindex['head']
def eye_part(want_cornea):
    E = dict(pos=[], nrm=[], uv=[], skinIndex=[], skinWeight=[], index=[]); key = {}
    for vids, tids in ef:
        cu = np.mean([et[t][0] for t in tids]); cv = np.mean([et[t][1] for t in tids])
        if (cu > 0.85 and cv < 0.15) != want_cornea: continue
        loop = []
        for v, t in zip(vids, tids):
            k = (v, t)
            if k not in key:
                key[k] = len(E['pos']); E['pos'].append(fitted[v].tolist()); E['uv'].append(et[t].tolist()); E['nrm'].append([0, 0, 1]); E['skinIndex'].append([hb, 0, 0, 0]); E['skinWeight'].append([1, 0, 0, 0])
            loop.append(key[k])
        for k in range(1, len(loop) - 1): E['index'] += [loop[0], loop[k], loop[k + 1]]
    return E
meshes['eyes'] = eye_part(False); meshes['cornea'] = eye_part(True)

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
    for _ in range(dilate):  # bleed colours into UV gutters (no seams under mip-mapping)
        grown = rgb.filter(ImageFilter.MaxFilter(3)); rgb = Image.composite(rgb, grown, cov); cov = cov.filter(ImageFilter.MaxFilter(3))
    out = rgb.convert('RGBA'); out.putalpha(alpha); return out

def hash3(p, scale, seed=0):
    q = np.floor(p * scale); return (np.sin(q[:, 0] * 12.9898 + q[:, 1] * 78.233 + q[:, 2] * 37.719 + seed) * 43758.5453) % 1.0
def vnoise(p, scale, seed=0):  # smooth value noise (trilinear)
    q = p * scale; i = np.floor(q); f = q - i; f = f * f * (3 - 2 * f); out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = (np.sin((i[:, 0] + dx) * 12.9898 + (i[:, 1] + dy) * 78.233 + (i[:, 2] + dz) * 37.719 + seed) * 43758.5453) % 1.0
                out = out + h * np.where(dx, f[:, 0], 1 - f[:, 0]) * np.where(dy, f[:, 1], 1 - f[:, 1]) * np.where(dz, f[:, 2], 1 - f[:, 2])
    return out
def fbm(p, scale, seed=0): return 0.5 * vnoise(p, scale, seed) + 0.3 * vnoise(p, scale * 2.1, seed + 3) + 0.2 * vnoise(p, scale * 4.3, seed + 7)
SKIN = np.array([160, 106, 76]) / 255; BLUSH = np.array([170, 92, 74]) / 255; LIP = np.array([142, 80, 68]) / 255; HAIRC = np.array([30, 22, 18]) / 255
H = LM['head']; EYE_Y, CHIN_Y, TOP_Y = LM['eye'][1], LM['chin'][1], LM['top'][1]
def shade_skin(p, n, f):
    rel = p - [0, 0, 0]; x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    c = np.tile(SKIN, (len(p), 1)) * (0.93 + 0.12 * fbm(p, 40, 1))[:, None]
    head = y > LM['neck'][1] - 0.02
    face = head & (z > H[2] + 0.03)
    blush = (np.exp(-((ax - 0.045) ** 2 + (y - (EYE_Y - 0.04)) ** 2) / 0.0005) + np.exp(-(x ** 2 + (y - (EYE_Y - 0.035)) ** 2) / 0.00025)) * face
    c = c * (1 - 0.3 * blush[:, None]) + BLUSH * 0.3 * blush[:, None]
    mouth_y = CHIN_Y + 0.036
    lips = np.exp(-(x ** 2 / 0.00045 + (y - mouth_y) ** 2 / 0.00003)) * (z > LM['chin'][2] + 0.0)
    # short (buzz-cut) hair, sideburns, trimmed beard, moustache and brows — all smooth masks (no hard edges)
    fz = ss(H[2] + 0.005, H[2] + 0.055, z)                       # 0 back/sides → 1 face
    y_h = EYE_Y + 0.062 + 0.012 * ss(0.02, 0.05, ax)            # receding temples
    ear = np.exp(-((ax - 0.072) ** 2 / 0.0006 + (y - (EYE_Y - 0.012)) ** 2 / 0.0009 + (z - (H[2] - 0.005)) ** 2 / 0.0009))
    scalp = np.maximum(ss(y_h - 0.004, y_h + 0.01, y), (1 - fz) * ss(LM['neck'][1] + 0.035, LM['neck'][1] + 0.07, y) * (1 - np.clip(ear * 1.6, 0, 1)))
    sideburn = ss(0.058, 0.066, ax) * ss(EYE_Y - 0.045, EYE_Y - 0.03, y) * ss(EYE_Y + 0.03, EYE_Y + 0.012, y) * ss(H[2] - 0.0, H[2] + 0.012, z) * ss(H[2] + 0.05, H[2] + 0.035, z) * (1 - np.clip(ear * 2, 0, 1))
    beard_top = EYE_Y - 0.048 - 0.014 * ss(0.035, 0.0, ax)
    beard = ss(beard_top + 0.012, beard_top - 0.02, y) * ss(H[2] - 0.02, H[2] + 0.02, z) * ss(LM['neck'][1] - 0.02, LM['neck'][1] + 0.01, y + 0.05 * ss(0.0, 0.08, z - H[2]))
    mous = fz * np.exp(-(x ** 2 / 0.0008 + (y - (mouth_y + 0.014)) ** 2 / 0.00003))
    brow = fz * np.exp(-((ax - 0.032) ** 2 / 0.00028 + (y - (EYE_Y + 0.024 - 0.008 * ss(0.02, 0.05, ax))) ** 2 / 0.000018))
    head_m = ss(LM['neck'][1] - 0.03, LM['neck'][1] + 0.0, y)
    scalp, sideburn, beard = scalp * head_m, sideburn * head_m, beard * head_m
    strand = 0.75 + 0.25 * hash3(p, 2500, 5)
    dens = np.clip(np.maximum.reduce([scalp * 0.88, beard * 0.62, mous * 0.75, brow * 0.92]), 0, 1) * strand
    dens = dens * (1 - lips * 0.95)
    c = c * (1 - 0.8 * lips[:, None]) + LIP * 0.8 * lips[:, None]
    c = c * (1 - dens[:, None]) + HAIRC * dens[:, None]
    nails = (ax > 0.44) & (y < LM['wr']['L'][1] - 0.13) & (n[:, 1] > -0.2) & (fbm(p, 300) > 0.0) & False
    return np.concatenate([np.clip(c, 0, 1), np.ones((len(p), 1))], 1)
def fabric(colorA, colorB, scale, detail=None, cut=True):
    a = np.array(colorA) / 255; b = np.array(colorB) / 255
    def f(p, n, g):
        t = 0.55 * hash3(p, scale) + 0.45 * fbm(p, 60, 2)
        c = a * (1 - t[:, None] * 0.3) + b * (t[:, None] * 0.3)
        c *= (0.92 + 0.08 * fbm(p, 14, 9))[:, None]  # soft creases
        if detail is not None: c = detail(p, c, g)
        alpha = ss(-0.0015, 0.0015, g) if cut else np.ones(len(p))
        return np.concatenate([np.clip(c, 0, 1), alpha[:, None]], 1)
    return f
def shirt_detail(p, c, g):
    hem = (g < 0.008) & (g > 0); c[hem] *= 0.86; return c
def vest_detail(p, c, g):
    y, x, z = p[:, 1], p[:, 0], p[:, 2]; front = z > 0.02; hip = LM['hip'][1]
    for yy in (hip + 0.17, hip + 0.3): c[np.abs(y - yy) < 0.011] = np.array([206, 210, 212]) / 255
    strap = (np.abs(y - (hip + 0.11)) < 0.013); c[strap] = np.array([24, 26, 28]) / 255
    c[(np.abs(x) < 0.005) & front] = np.array([36, 36, 38]) / 255
    c[strap & front & (np.abs(x) < 0.03)] = np.array([62, 66, 70]) / 255
    c[(g < 0.006) & (g > 0)] *= 0.75  # piping
    return c
def trouser_detail(p, c, g):
    seam = np.abs(np.abs(p[:, 0]) - (np.abs(p[:, 0]) * 0 + 0.0)) < 0  # placeholder (no-op)
    c[(g < 0.008) & (g > 0)] *= 0.85; return c
def shoe_detail(p, c, g):
    c[p[:, 1] < 0.021] = np.array([232, 228, 218]) / 255; c[(p[:, 1] >= 0.021) & (p[:, 1] < 0.027)] = np.array([120, 90, 60]) / 255; return c
paint = {
    'skin': (shade_skin, None, 2048),
    'shirt': (fabric((178, 198, 212), (128, 150, 166), 1500, shirt_detail), 'shirt', 1024),
    'trousers': (fabric((126, 114, 86), (86, 76, 56), 1800, trouser_detail), 'trousers', 1024),
    'vest': (fabric((232, 96, 28), (176, 58, 16), 700, vest_detail), 'vest', 1024),
}
for name, (fn, field, size) in paint.items():
    img = raster(meshes[name], fn, size, G[field] if field else None, pfield=PF.get(field))
    img.save(os.path.join(OUT, name + '.png'), optimize=True); print('texture', name, img.size)

# eyes: MakeHuman brown iris texture; cornea faces split into their own glossy transparent mesh
Image.open(os.path.join(DATA, 'eyes/materials/brown_eye.png')).convert('RGB').save(os.path.join(OUT, 'eyes.png'))
bones_out = []
for n in order:
    par = bones_src[n]['parent']
    while par and not kept(par): par = bones_src[par]['parent']
    h = (joint(n + '____head') - [0, floor, 0]) * SCALE; t = (joint(n + '____tail') - [0, floor, 0]) * SCALE
    bones_out.append(dict(name=n.replace('.', '_'), parent=par.replace('.', '_') if par else None, head=h.tolist(), tail=t.tolist()))
for m in meshes.values(): m.pop('src', None)
feet = {}
for sd, sg in (('L', 1), ('R', -1)):
    fv = np.array([P[i] for i in body_vids if dom[i] in B_FOOT and np.sign(P[i][0]) == sg])
    feet[sd] = dict(min=fv.min(0).tolist(), max=fv.max(0).tolist(), ankle=L(f'foot.{sd}____head').tolist())
hv = np.array([P[i] for i in body_vids if dom[i] in B_HEAD and P[i][1] > LM['eye'][1] + 0.03])
cap = dict(center=((hv.min(0) + hv.max(0)) / 2).tolist(), half=((hv.max(0) - hv.min(0)) / 2).tolist(), rim=float(LM['eye'][1] + 0.045), top=float(hv[:, 1].max()))
json.dump(dict(feet=feet, cap=cap, bones=bones_out, meshes=meshes, height=height, source='MakeHuman hm08 base mesh, macro targets, default skeleton/weights, high-poly eyes (CC0 1.0)'), open(os.path.join(OUT, 'fisherman.json'), 'w'))
print('bones', len(bones_out), {k: len(v['index']) // 3 for k, v in meshes.items()})
