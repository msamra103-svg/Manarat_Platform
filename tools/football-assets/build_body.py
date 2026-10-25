"""Stage 1: macro-blend the CC0 MakeHuman base into a male athletic body, build the reduced game rig, and re-pose to a neutral arms-down bind pose."""
import json, os, sys, math
import numpy as np
from mh_common import *

BUILDS = {
    # name: macro parameters (MakeHuman slider semantics) + target stature in metres
    'runner':   dict(gender=1.0, muscle=0.58, weight=0.36, height=0.66, proportions=0.85, ethnic={'african': .15, 'asian': .10, 'caucasian': .75}, stature=1.80,
                     mods={'torso/torso-vshape-incr': .35, 'torso/torso-muscle-pectoral-incr': .15}),
    'athlete':  dict(gender=1.0, muscle=0.70, weight=0.46, height=0.58, proportions=0.85, ethnic={'african': .30, 'asian': .05, 'caucasian': .65}, stature=1.78,
                     mods={'torso/torso-vshape-incr': .55, 'torso/torso-muscle-pectoral-incr': .35, 'torso/torso-muscle-dorsi-incr': .30}),
    'keeper':   dict(gender=1.0, muscle=0.72, weight=0.58, height=0.80, proportions=0.80, ethnic={'african': .20, 'asian': .05, 'caucasian': .75}, stature=1.90,
                     mods={'torso/torso-vshape-incr': .50, 'torso/torso-muscle-pectoral-incr': .30, 'torso/torso-muscle-dorsi-incr': .30}),
}
# per-limb muscle modifiers (applied for both sides)
LIMB_MODS = {'armslegs/{s}-upperarm-muscle-incr': .35, 'armslegs/{s}-lowerarm-muscle-incr': .30, 'armslegs/{s}-upperleg-muscle-incr': .40, 'armslegs/{s}-lowerleg-muscle-incr': .35}

GAME_BONES = [  # name, parent
    ('hips', None), ('spine1', 'hips'), ('spine2', 'spine1'), ('spine3', 'spine2'), ('neck', 'spine3'), ('head', 'neck'),
    ('clavicleL', 'spine3'), ('upperarmL', 'clavicleL'), ('lowerarmL', 'upperarmL'), ('handL', 'lowerarmL'), ('fingersL', 'handL'), ('thumbL', 'handL'),
    ('clavicleR', 'spine3'), ('upperarmR', 'clavicleR'), ('lowerarmR', 'upperarmR'), ('handR', 'lowerarmR'), ('fingersR', 'handR'), ('thumbR', 'handR'),
    ('thighL', 'hips'), ('shinL', 'thighL'), ('footL', 'shinL'), ('toesL', 'footL'),
    ('thighR', 'hips'), ('shinR', 'thighR'), ('footR', 'shinR'), ('toesR', 'footR'),
]
def mh_to_game(name):
    side = 'L' if name.endswith('.L') else 'R' if name.endswith('.R') else ''
    b = name[:-2] if side else name
    if b in ('root',) or b.startswith('pelvis'): return 'hips'
    if b in ('spine05', 'spine04'): return 'spine1'
    if b in ('spine03', 'spine02') or b.startswith('breast'): return 'spine2'
    if b == 'spine01': return 'spine3'
    if b.startswith('neck'): return 'neck'
    if b == 'head': return 'head'
    if b in ('clavicle', 'shoulder01'): return 'clavicle' + side
    if b.startswith('upperarm'): return 'upperarm' + side
    if b.startswith('lowerarm'): return 'lowerarm' + side
    if b == 'wrist' or b.startswith('metacarpal'): return 'hand' + side
    if b.startswith('finger1'): return 'thumb' + side
    if b.startswith('finger'): return 'fingers' + side
    if b.startswith('upperleg'): return 'thigh' + side
    if b.startswith('lowerleg'): return 'shin' + side
    if b == 'foot': return 'foot' + side
    if b.startswith('toe'): return 'toes' + side
    return None  # resolved through the MakeHuman parent chain


def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b)); s = np.linalg.norm(v)
    if s < 1e-9:
        return np.eye(3)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k * ((1 - c) / (s * s))


def build(name, mh_dir):
    cfg = BUILDS[name]
    data = os.path.join(mh_dir, 'makehuman', 'data')
    verts, vt, faces = parse_obj(os.path.join(data, '3dobjs', 'base.obj'))
    targets = macro_targets(cfg['gender'], cfg['muscle'], cfg['weight'], cfg['height'], cfg['proportions'], cfg['ethnic'])
    for rel, w in cfg['mods'].items():
        targets.append((rel + '.target', w))
    for tpl, w in LIMB_MODS.items():
        for s in ('l', 'r'):
            targets.append((tpl.format(s=s) + '.target', w))
    verts = apply_targets(verts, data, targets) * UNIT

    sk = json.load(open(os.path.join(data, 'rigs', 'default.mhskel')))
    joints = {k: verts[v].mean(axis=0) for k, v in sk['joints'].items()}
    mhb = sk['bones']
    # resolve every MakeHuman bone to a game bone through its ancestors
    resolved = {}
    def res(n):
        if n in resolved: return resolved[n]
        g = mh_to_game(n)
        if g is None:
            p = mhb[n]['parent']
            g = res(p) if p else 'hips'
        resolved[n] = g
        return g
    for n in mhb: res(n)

    wts = json.load(open(os.path.join(data, 'rigs', 'default_weights.mhw')))['weights']
    nbody = 13380
    W = {b: np.zeros(nbody) for b, _ in GAME_BONES}
    for mhname, lst in wts.items():
        g = resolved[mhname]
        for vi, w in lst:
            if vi < nbody: W[g][vi] += w
    Wm = np.stack([W[b] for b, _ in GAME_BONES], axis=1)
    s = Wm.sum(axis=1, keepdims=True); s[s == 0] = 1; Wm = Wm / s

    # game-bone joint positions (heads)
    J = lambda n: joints[n]
    mean = lambda *ns: np.mean([joints[n] for n in ns], axis=0)
    heads = {'hips': J('root____head'), 'spine1': J('spine05____head'), 'spine2': J('spine03____head'), 'spine3': J('spine01____head'),
             'neck': J('neck01____head'), 'head': J('head____head')}
    for S in ('L', 'R'):
        heads['clavicle' + S] = J(f'clavicle.{S}____head')
        heads['upperarm' + S] = J(f'upperarm01.{S}____head')
        heads['lowerarm' + S] = J(f'lowerarm01.{S}____head')
        heads['hand' + S] = J(f'wrist.{S}____head')
        heads['fingers' + S] = mean(*[f'finger{i}-1.{S}____head' for i in (2, 3, 4, 5)])
        heads['thumb' + S] = J(f'finger1-1.{S}____head')
        heads['thigh' + S] = J(f'upperleg01.{S}____head')
        heads['shin' + S] = J(f'lowerleg01.{S}____head')
        heads['foot' + S] = J(f'foot.{S}____head')
        heads['toes' + S] = mean(*[f'toe{i}-1.{S}____head' for i in (1, 2, 3, 4, 5)])
    tails = {}
    for S in ('L', 'R'):
        tails['hand' + S] = J(f'metacarpal3.{S}____tail') if f'metacarpal3.{S}____tail' in joints else heads['fingers' + S]
        tails['toes' + S] = mean(*[f'toe{i}-3.{S}____tail' for i in (2, 3, 4, 5) if f'toe{i}-3.{S}____tail' in joints] or [f'toe2-2.{S}____tail'])

    pos = verts[:nbody].copy()
    # ---- re-pose: bring the A-pose arms down along the body (rigid rotation about the shoulder, blended by the skin weights)
    bidx = {b: i for i, (b, _) in enumerate(GAME_BONES)}
    def rotate_chain(chain, S, pivot_key, target_dir, from_key, to_key):
        """Rigidly rotate a bone chain about a pivot joint so that (from->to) points along target_dir; skin blended by weights."""
        nonlocal pos, newheads
        pv = newheads[pivot_key + S]
        cur = newheads[to_key + S] - newheads[from_key + S]
        R = rot_between(cur, target_dir)
        wchain = sum(Wm[:, bidx[c + S]] for c in chain)
        rotated = (pos - pv) @ R.T + pv
        pos = pos + (rotated - pos) * wchain[:, None]
        for c in chain:
            newheads[c + S] = (newheads[c + S] - pv) @ R.T + pv
            if c + S in tails:
                tails[c + S] = (tails[c + S] - pv) @ R.T + pv
    newheads = dict(heads)
    for S in ('L', 'R'):
        sgn = 1.0 if heads['upperarm' + S][0] > 0 else -1.0
        # stage 1: whole arm hangs beside the torso
        rotate_chain(['upperarm', 'lowerarm', 'hand', 'fingers', 'thumb'], S, 'upperarm', np.array([0.07 * sgn, -1.0, -0.02]), 'upperarm', 'lowerarm')
        # stage 2: forearm with a relaxed elbow bend
        rotate_chain(['lowerarm', 'hand', 'fingers', 'thumb'], S, 'lowerarm', np.array([0.02 * sgn, -1.0, 0.20]), 'lowerarm', 'hand')
    heads = newheads

    # normalise to target stature, feet on the ground at x=0 / z=0
    ymin = pos[:, 1].min(); top = pos[:, 1].max()
    scale = cfg['stature'] / (top - ymin)
    shift = np.array([0.0, ymin, 0.0])
    def norm(p): return (p - shift) * scale
    pos = norm(pos)
    for k in heads: heads[k] = norm(heads[k])
    for k in tails: tails[k] = norm(tails[k])
    eye = {S: norm(joints[f'eye.{S}____head']) for S in ('L', 'R')}
    return dict(name=name, cfg=cfg, pos=pos, vt=vt, faces=faces, weights=Wm, heads=heads, tails=tails, eye=eye, scale=scale, shift=shift,
                verts_all=norm(verts), data=data, mhb=mhb, joints={k: norm(v) for k, v in joints.items()}, sk=sk)


def silhouette(pos, path, size=700):
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (size * 2, size), 'white'); d = ImageDraw.Draw(img)
    H = pos[:, 1].max(); sc = (size - 40) / H
    for (u, off) in ((0, 0), (2, size)):
        for p in pos:
            x = off + size / 2 + (p[0] if u == 0 else p[2]) * sc
            y = size - 20 - p[1] * sc
            d.point((x, y), fill=(0, 0, 0))
    img.save(path)


if __name__ == '__main__':
    mh = sys.argv[1]
    for n in sys.argv[2:] or BUILDS:
        b = build(n, mh)
        print(n, 'height', round(b['pos'][:, 1].max(), 3), 'verts', len(b['pos']), 'scale', round(b['scale'], 4))
        for k in ('hips', 'spine3', 'head', 'upperarmL', 'handL', 'thighL', 'shinL', 'footL', 'toesL'):
            print('  ', k, np.round(b['heads'][k], 3))
        silhouette(b['pos'], f'/home/claude/work/dbg/sil_{n}.png')
