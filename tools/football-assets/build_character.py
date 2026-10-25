#!/usr/bin/env python3
"""Stage 2: kit regions + cloth offsets + AO + UVs + painted skin + eyes + scalp + LOD, exported as JSON + BIN for the browser.

usage: build_character.py <makehuman-clone-dir> <out-dir> [build ...]
"""
import json, os, sys, math, struct, shutil
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from mh_common import *
import build_body as BB

ROLE = {'skin': 0, 'jersey': 1, 'shorts': 2, 'socks': 3, 'boots': 4, 'glove': 5}


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def adjacency(n, tri):
    nb = [set() for _ in range(n)]
    for a, b, c in tri:
        nb[a].update((b, c)); nb[b].update((a, c)); nb[c].update((a, b))
    return [np.array(sorted(s), dtype=np.int64) for s in nb]


def laplacian(vals, nb, mask=None, iters=1, lam=0.5):
    v = vals.copy()
    for _ in range(iters):
        avg = np.stack([v[n].mean(axis=0) if len(n) else v[i] for i, n in enumerate(nb)])
        if mask is None:
            v = v + lam * (avg - v)
        else:
            v[mask] = v[mask] + lam * (avg[mask] - v[mask])
    return v


def build_one(name, mh_dir, out_dir):
    B = BB.build(name, mh_dir)
    pos = B['pos']; W = B['weights']; H = B['heads']; vt = B['vt']
    n = len(pos)
    bone_names = [b for b, _ in BB.GAME_BONES]
    dom = W.argmax(axis=1)
    domname = np.array([bone_names[i] for i in dom])
    tri_raw = tri_faces(B['faces'], 'body')
    tri_v = np.array([t[0] for t in tri_raw], dtype=np.int64)
    tri_t = np.array([t[1] for t in tri_raw], dtype=np.int64)
    y = pos[:, 1]; x = pos[:, 0]; z = pos[:, 2]
    stature = B['cfg']['stature']

    # ---------- landmarks
    ankle_y = H['footL'][1]; knee_y = H['shinL'][1]; hip_y = H['hips'][1]
    waist_y = hip_y + 0.10
    jersey_hem = waist_y - 0.07
    shorts_hem = knee_y + 0.14
    sock_top = knee_y + 0.03
    boot_top = ankle_y + 0.035
    sleeve_end = H['upperarmL'][1] - 0.44 * (H['upperarmL'][1] - H['lowerarmL'][1])
    neck_base = H['neck'][1]
    collar_y = neck_base - 0.018

    is_ = lambda *names: np.isin(domname, names)
    arm_up = is_('upperarmL', 'upperarmR')
    shoulder = is_('clavicleL', 'clavicleR')
    torso = is_('spine1', 'spine2', 'spine3')
    hips = is_('hips')
    legs_up = is_('thighL', 'thighR')
    shins = is_('shinL', 'shinR')
    feet = is_('footL', 'footR', 'toesL', 'toesR')
    hands = is_('handL', 'handR', 'fingersL', 'fingersR', 'thumbL', 'thumbR')
    neckhead = is_('neck', 'head')

    # ---- garment pieces: generous vertex membership; hems/collar are cut precisely by texture alpha
    piece_mask = {}
    piece_mask['jersey'] = ((torso | shoulder | (hips & (y > jersey_hem - 0.05)) | (arm_up & (y > sleeve_end - 0.05)) | (neckhead & (y < neck_base + 0.05) & (y > hip_y))) & ~hands)
    piece_mask['shorts'] = ((hips | (torso & (y < jersey_hem + 0.09)) | (legs_up & (y > shorts_hem - 0.05))) & (y < waist_y + 0.02))
    piece_mask['socks'] = ((shins | legs_up | feet) & (y < sock_top + 0.05) & (y > boot_top - 0.04))
    piece_mask['boots'] = (feet | (shins & (y < boot_top + 0.01)))
    piece_mask['glove'] = hands if name == 'keeper' else np.zeros(n, bool)

    nb = adjacency(n, tri_v)
    normals0 = vertex_normals(pos, tri_v)

    def drape(mask, off_fn, smooth_iters, smooth_lam, min_frac=0.5):
        off = np.zeros(n); off[mask] = off_fn(mask)
        off = laplacian(off[:, None], nb, None, 2, 0.5)[:, 0]
        off[~mask] = 0
        base = laplacian(pos, nb, mask, smooth_iters, smooth_lam) if smooth_iters else pos
        p2 = np.where(mask[:, None], base, pos)
        n2 = vertex_normals(p2, tri_v)
        cloth = p2 + n2 * off[:, None]
        d = np.einsum('ij,ij->i', cloth - pos, normals0)
        need = (d < off * min_frac) & mask
        cloth[need] = pos[need] + normals0[need] * (off[need] * min_frac)[:, None]
        return np.where(mask[:, None], cloth, pos)

    tj = lambda m: 0.011 + np.where(arm_up[m], 0.003, 0.0) + 0.009 * smoothstep(waist_y + 0.12, jersey_hem - 0.02, y[m])
    pos_piece = {}
    pos_piece['jersey'] = drape(piece_mask['jersey'], tj, 4, 0.55)
    pos_piece['shorts'] = drape(piece_mask['shorts'], lambda m: 0.010 + 0.022 * smoothstep(waist_y, shorts_hem, y[m]) * (legs_up[m] * 1.0 + 0.25), 4, 0.55)
    pos_piece['socks'] = drape(piece_mask['socks'], lambda m: np.full(m.sum(), 0.0045), 0, 0)
    pos_piece['boots'] = drape(piece_mask['boots'], lambda m: np.full(m.sum(), 0.008), 0, 0)
    pos_piece['glove'] = drape(piece_mask['glove'], lambda m: np.full(m.sum(), 0.006), 1, 0.3) if name == 'keeper' else pos
    nrm_piece = {k: vertex_normals(v, tri_v) for k, v in pos_piece.items()}
    nrm = normals0

    # ---------- baked AO (cheap curvature-based cavity term) -> vertex colour
    sm = laplacian(pos, nb, None, 4, 0.6)
    cav = np.einsum('ij,ij->i', sm - pos, normals0)
    ao = np.clip(1 - 20 * np.maximum(cav, 0), 0.55, 1.0)

    def cyl_uv(p, dn):
        """cylindrical coords about the limb/torso axis of the dominant bone: u=0.5 faces forward."""
        cx = np.zeros(len(p)); cz = np.full(len(p), -0.03)
        for S in ('L', 'R'):
            m = np.isin(dn, ('upperarm' + S, 'clavicle' + S))
            if m.any():
                sh, el = H['upperarm' + S], H['lowerarm' + S]
                t = np.clip((sh[1] - p[m, 1]) / (sh[1] - el[1]), 0, 1.2)
                cx[m] = sh[0] + (el[0] - sh[0]) * t; cz[m] = sh[2] + (el[2] - sh[2]) * t
            m = np.isin(dn, ('thigh' + S, 'shin' + S, 'foot' + S, 'toes' + S))
            if m.any():
                hp, kn = H['thigh' + S], H['shin' + S]
                t = np.clip((hp[1] - p[m, 1]) / (hp[1] - kn[1]), 0, 1.6)
                cx[m] = hp[0] + (kn[0] - hp[0]) * t; cz[m] = hp[2] + (kn[2] - hp[2]) * t
        u = np.arctan2(p[:, 0] - cx, p[:, 2] - cz) / (2 * math.pi) + 0.5
        return u, p[:, 1] / stature
    ku, kv = cyl_uv(pos, domname)

    # ---------- faces per piece (a face belongs to a piece when all of its vertices do)
    def piece_faces(mask):
        return np.where(mask[tri_v].all(axis=1))[0]
    pf = {k: piece_faces(m) for k, m in piece_mask.items()}
    # sleeve faces = majority upper-arm dominated faces of the jersey piece
    sleeve = np.array([arm_up[tri_v[f]].sum() >= 2 for f in pf['jersey']]) if len(pf['jersey']) else np.array([], bool)
    jersey_body = pf['jersey'][~sleeve]; jersey_sleeve = pf['jersey'][sleeve]

    # ---------- skin visibility: drop triangles that are completely covered by cloth (keeps a safety margin around hems)
    cov = np.zeros(n, bool)
    cov |= (torso | shoulder) & (y > jersey_hem + 0.04) & (y < collar_y - 0.04)
    cov |= arm_up & (y > sleeve_end + 0.04) & (y < collar_y - 0.02)
    cov |= (hips | legs_up) & (y > shorts_hem + 0.04) & (y < jersey_hem - 0.04)
    cov |= hips & (y <= jersey_hem - 0.04)
    cov |= shins & (y > boot_top + 0.04) & (y < sock_top - 0.04)
    cov |= feet & (y < boot_top - 0.02)
    skin_faces = np.where(~cov[tri_v].all(axis=1))[0]
    glove_f = np.array([f for f in skin_faces if hands[tri_v[f]].sum() >= 2], dtype=np.int64)
    skin_plain = np.array([f for f in skin_faces if hands[tri_v[f]].sum() < 2], dtype=np.int64)

    # ---------- build unique-vertex meshes (positions per piece, uv per mode)
    def to_mesh(parts, uv_mode):
        """parts: list of (face_ids, position_array, normal_array)"""
        keymap, verts_out, idx_out, ranges = {}, [], [], []
        for pi, (face_ids, P, Nm) in enumerate(parts):
            start = len(idx_out)
            for f in face_ids:
                vs = tri_v[f]
                if uv_mode == 'atlas':
                    uvs = [(vt[t][0], vt[t][1]) for t in tri_t[f]]
                else:
                    us = [ku[v] for v in vs]
                    if max(us) - min(us) > 0.5:
                        us = [u + 1 if u < 0.5 else u for u in us]
                    uvs = [(us[k], kv[vs[k]]) for k in range(3)]
                for k in range(3):
                    key = (pi, int(vs[k]), round(uvs[k][0], 5), round(uvs[k][1], 5))
                    if key not in keymap:
                        keymap[key] = len(verts_out)
                        verts_out.append((vs[k], uvs[k], pi))
                    idx_out.append(keymap[key])
            ranges.append((start, len(idx_out) - start))
        return verts_out, idx_out, ranges

    def pack(verts_out, idx_out, groups, plist):
        vi = np.array([v[0] for v in verts_out], dtype=np.int64)
        pid = np.array([v[2] for v in verts_out], dtype=np.int64)
        uv = np.array([v[1] for v in verts_out], dtype=np.float32)
        P = np.zeros((len(vi), 3)); Nm = np.zeros((len(vi), 3))
        for k, (_, PP, NN) in enumerate(plist):
            m = pid == k; P[m] = PP[vi[m]]; Nm[m] = NN[vi[m]]
        w = W[vi]
        top = np.argsort(-w, axis=1)[:, :4]
        sw = np.take_along_axis(w, top, 1)
        sw = sw / np.maximum(sw.sum(axis=1, keepdims=True), 1e-9)
        return dict(position=P.astype(np.float32), normal=Nm.astype(np.float32), uv=uv.astype(np.float32),
                    skinIndex=top.astype(np.uint8), skinWeight=np.round(sw * 255).astype(np.uint8), color=ao[vi].astype(np.float32),
                    index=np.array(idx_out, dtype=np.uint16 if len(vi) < 65535 else np.uint32), groups=groups)

    # skin: [plain skin (orig positions), keeper gloves (glove positions)]
    plist = [(skin_plain, pos, normals0), (glove_f, pos_piece['glove'], nrm_piece['glove'])]
    sv, si, rg = to_mesh(plist, 'atlas')
    skin_mesh = pack(sv, si, [(rg[0][0], rg[0][1], 0), (rg[1][0], rg[1][1], 1)], plist)
    # kit: jersey body, sleeves, shorts, socks, boots  (material order matches fb-kit)
    plist = [(jersey_body, pos_piece['jersey'], nrm_piece['jersey']), (jersey_sleeve, pos_piece['jersey'], nrm_piece['jersey']),
             (piece_faces(piece_mask['shorts']), pos_piece['shorts'], nrm_piece['shorts']),
             (piece_faces(piece_mask['socks']), pos_piece['socks'], nrm_piece['socks']),
             (piece_faces(piece_mask['boots']), pos_piece['boots'], nrm_piece['boots'])]
    kv_, ki, rg = to_mesh(plist, 'cyl')
    kit_mesh = pack(kv_, ki, [(rg[i][0], rg[i][1], i) for i in range(5)], plist)
    pos2 = pos_piece['jersey']   # reference positions for decals

    # per-face role (for the LOD) from the strict classification
    face_label = np.zeros(len(tri_v), dtype=np.int8)
    for role, f in ((1, jersey_body), (1, jersey_sleeve), (2, piece_faces(piece_mask['shorts'])), (3, piece_faces(piece_mask['socks'])), (4, piece_faces(piece_mask['boots']))):
        pass
    lab = np.zeros(n, dtype=np.int8)
    lab[(torso | shoulder | (hips & (y > jersey_hem)) | (arm_up & (y > sleeve_end)) | (neckhead & (y < collar_y) & (y > hip_y)))] = 1
    lab[(hips & (y <= jersey_hem)) | (legs_up & (y > shorts_hem))] = 2
    lab[(shins | legs_up | feet) & (y < sock_top) & (y >= boot_top)] = 3
    lab[feet | (shins & (y < boot_top))] = 4
    lab[hands] = 5 if name == 'keeper' else 0
    face_label = np.array([np.bincount(lab[t], minlength=6).argmax() for t in tri_v])
    pos2 = np.where((lab != 0)[:, None], np.where(piece_mask['jersey'][:, None], pos_piece['jersey'], np.where(piece_mask['shorts'][:, None], pos_piece['shorts'], np.where(piece_mask['socks'][:, None], pos_piece['socks'], pos_piece['boots']))), pos)
    nrm2 = vertex_normals(pos2, tri_v)
    pos_lod, nrm_lod = pos2, nrm2

    # ---------- LOD1: decimate the whole welded body, solid colours by role (no textures)
    import fast_simplification
    tris = tri_v
    used = np.unique(tris)
    remap = -np.ones(n, dtype=np.int64); remap[used] = np.arange(len(used))
    P = pos_lod[used]; F = remap[tris]
    Pd, Fd = fast_simplification.simplify(P.astype(np.float32), F.astype(np.int32), target_reduction=0.78, agg=5)
    tree = cKDTree(P)
    _, nn = tree.query(Pd)
    src = used[nn]
    Wd = W[src]
    top = np.argsort(-Wd, axis=1)[:, :4]; sw = np.take_along_axis(Wd, top, 1); sw = sw / np.maximum(sw.sum(1, keepdims=True), 1e-9)
    cent = Pd[Fd].mean(axis=1)
    ftree = cKDTree(pos_lod[tri_v].mean(axis=1))
    _, fnn = ftree.query(cent)
    lod_label = face_label[fnn]
    order = np.argsort(lod_label, kind='stable')
    Fd = Fd[order]; lod_label = lod_label[order]
    lod_groups, start = [], 0
    for role in range(6):
        c = int((lod_label == role).sum())
        if c: lod_groups.append((start * 3, c * 3, role)); start += c
    Nd = vertex_normals(Pd.astype(np.float64), Fd.astype(np.int64))
    lod_mesh = dict(position=Pd.astype(np.float32), normal=Nd.astype(np.float32), skinIndex=top.astype(np.uint8),
                    skinWeight=np.round(sw * 255).astype(np.uint8), color=ao[src].astype(np.float32),
                    index=Fd.astype(np.uint16).reshape(-1), groups=lod_groups)

    # ---------- head landmarks, eyes, scalp patch
    head_m = is_('head', 'neck') | (y > H['head'][1] - 0.02)
    hv = np.where(head_m & (y > H['head'][1]))[0]
    top_y = pos[:, 1].max()
    eye = B['eye']
    eye_y = float((eye['L'][1] + eye['R'][1]) / 2)
    nose_i = hv[np.argmax(pos[hv, 2])]
    nose = pos[nose_i]
    chin_i = hv[np.argmin(np.where(pos[hv, 2] > eye['L'][2] - 0.02, pos[hv, 1], 9))]
    allv = B['verts_all']
    tv = lambda g: np.unique([i for gg, f in B['faces'] if gg == g for (i, _) in f])
    teeth = allv[np.concatenate([tv('helper-upper-teeth'), tv('helper-lower-teeth')])]
    mouth = teeth.mean(axis=0)
    cx_head = 0.0; cz_head = float(pos[hv, 2].mean())
    # scalp: vertices above a hairline surface
    sp = pos
    tfront = smoothstep(cz_head - 0.03, cz_head + 0.075, sp[:, 2])
    hairline = (eye_y - 0.040) * (1 - tfront) + (eye_y + 0.066) * tfront
    ax = np.abs(sp[:, 0])
    hairline = hairline + 0.036 * smoothstep(0.050, 0.078, ax) * (1 - 0.5 * tfront)   # raise above the ears -> short back & sides
    scalp = (y > hairline) & (y > H['head'][1] - 0.01) & (ax < 0.112)
    scalp_faces = [f for f in range(len(tri_v)) if scalp[tri_v[f]].all()]
    sk_ids = scalp_faces
    sv_, si_, _ = to_mesh([(np.array(sk_ids, dtype=np.int64), pos, normals0)], 'atlas')
    vi = np.array([v[0] for v in sv_], dtype=np.int64)
    scalp_mesh = dict(position=(pos[vi] - H['head']).astype(np.float32), normal=normals0[vi].astype(np.float32),
                      uv=np.array([v[1] for v in sv_], dtype=np.float32), index=np.array(si_, dtype=np.uint16))

    # eyes: fit the CC0 proxy to the final head
    data = B['data']
    cl = open(os.path.join(data, 'eyes/high-poly/high-poly.mhclo'), encoding='utf8').read().splitlines()
    sc = {}; rows = []; inv = False
    for ln in cl:
        p = ln.split()
        if not p or ln.startswith('#'): continue
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): sc[p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
        elif p[0] == 'verts': inv = True
        elif p[0] in ('delete_verts', 'weights', 'obj_file', 'material', 'z_depth', 'name', 'tag', 'uuid', 'basemesh', 'license', 'author', 'description'): inv = False if p[0] != 'verts' else inv
        elif inv and len(p) == 9: rows.append([float(q) for q in p])
    rows = np.array(rows)
    A = allv  # normalised (m) full vertex array incl. helpers
    scale3 = np.array([abs(A[sc[a][0]][i] - A[sc[a][1]][i]) / (sc[a][2] * UNIT * B['scale']) for i, a in enumerate('xyz')])
    # ^ ratio of current to default scale, using MakeHuman's definition (distance / d) in matching units
    ev, et, efaces = parse_obj(os.path.join(data, 'eyes/high-poly/high-poly.obj'))
    idx3 = rows[:, :3].astype(int); w3 = rows[:, 3:6]; off3 = rows[:, 6:9]
    eye_pos = (A[idx3[:, 0]] * w3[:, 0:1] + A[idx3[:, 1]] * w3[:, 1:2] + A[idx3[:, 2]] * w3[:, 2:3]) + off3 * UNIT * B['scale'] * scale3
    # per-eye split by x
    etris = tri_faces(efaces)
    ev_idx = np.array([t[0] for t in etris]); et_idx = np.array([t[1] for t in etris])
    # unique (v,uv)
    keymap, everts, eidx = {}, [], []
    for fi in range(len(ev_idx)):
        for k in range(3):
            key = (int(ev_idx[fi][k]), int(et_idx[fi][k]))
            if key not in keymap: keymap[key] = len(everts); everts.append(key)
            eidx.append(keymap[key])
    ep = np.array([eye_pos[a] for a, _ in everts]); euv = np.array([et[b] for _, b in everts])
    # recompute normals
    en = vertex_normals(eye_pos, ev_idx.astype(np.int64))
    eye_mesh = dict(position=(ep - H['head']).astype(np.float32), normal=en[[a for a, _ in everts]].astype(np.float32), uv=euv.astype(np.float32), index=np.array(eidx, dtype=np.uint16))
    # which eye (x sign) for each vertex -> centre per eye
    eye_c = {S: (eye_pos[ev_idx.reshape(-1)[:0]].mean(axis=0) if False else None) for S in ('L', 'R')}
    left = ep[:, 0] > 0
    eye_centers = {'L': (ep[left].mean(axis=0) - H['head']).tolist(), 'R': (ep[~left].mean(axis=0) - H['head']).tolist()}

    # ---------- decals: back-number patch & chest crest patch (jersey triangles in a region)
    def decal(zsign, y0, y1, hw):
        fs = []
        for f in np.where(face_label == ROLE['jersey'])[0]:
            c = pos_piece['jersey'][tri_v[f]].mean(axis=0)
            if zsign * (c[2] + 0.03) > 0.02 and y0 < c[1] < y1 and abs(c[0]) < hw and nrm_piece['jersey'][tri_v[f]].mean(axis=0)[2] * zsign > 0.25:
                fs.append(f)
        keymap2, vo, io = {}, [], []
        for f in fs:
            for k in range(3):
                v = tri_v[f][k]
                if v not in keymap2: keymap2[v] = len(vo); vo.append(v)
                io.append(keymap2[v])
        vi = np.array(vo, dtype=np.int64)
        u = (pos_piece['jersey'][vi, 0] / (2 * hw) * zsign) + 0.5  # viewer's right is +x at the front and -x at the back
        vv = (pos_piece['jersey'][vi, 1] - y0) / (y1 - y0)
        w = W[vi]; top = np.argsort(-w, axis=1)[:, :4]; sw = np.take_along_axis(w, top, 1); sw = sw / np.maximum(sw.sum(1, keepdims=True), 1e-9)
        return dict(position=(pos_piece['jersey'][vi] + nrm_piece['jersey'][vi] * 0.0016).astype(np.float32), normal=nrm_piece['jersey'][vi].astype(np.float32),
                    uv=np.stack([u, vv], 1).astype(np.float32), skinIndex=top.astype(np.uint8), skinWeight=np.round(sw * 255).astype(np.uint8),
                    index=np.array(io, dtype=np.uint16))
    sy = H['spine3'][1]
    back_num = decal(-1, sy - 0.31, sy + 0.02, 0.17)
    back_name = decal(-1, sy + 0.02, sy + 0.15, 0.17)
    chest = decal(1, sy - 0.10, sy + 0.03, 0.09)   # right-chest crest zone (mirrored by uv at runtime)

    # ---------- skin texture painted from 3D position
    paint_skin(name, B, pos, normals0, tri_v, tri_t, vt, ao, eye, eye_y, nose, mouth, out_dir, domname)

    meshes = dict(skin=skin_mesh, kit=kit_mesh, lod=lod_mesh, scalp=scalp_mesh, eyes=eye_mesh, backNumber=back_num, backName=back_name, chest=chest)
    manifest = export(name, B, bone_names, meshes, out_dir, dict(
        eyeY=eye_y, nose=(nose - 0).tolist(), mouth=mouth.tolist(), chin=pos2[chin_i].tolist(), top=float(top_y),
        eyeCenters=eye_centers, ankleY=float(ankle_y), kneeY=float(knee_y), waistY=float(waist_y), headJoint=H['head'].tolist(),
        collarY=float(neck_base + 0.012), sleeveEnd=float(sleeve_end), jerseyHem=float(jersey_hem), shortsHem=float(shorts_hem), sockTop=float(sock_top), bootTop=float(boot_top)))
    return manifest


def paint_skin(name, B, pos, nrm, tri_v, tri_t, vt, ao, eye, eye_y, nose, mouth, out_dir, domname, size=1024):
    rng = np.random.default_rng(7)
    P = np.zeros((size, size, 3)); Nn = np.zeros((size, size, 3)); A = np.zeros((size, size)); M = np.zeros((size, size), bool)
    skin_tris = [i for i in range(len(tri_v))]
    for fi in skin_tris:
        uv = vt[tri_t[fi]]
        px = uv[:, 0] * (size - 1); py = (1 - uv[:, 1]) * (size - 1)
        x0, x1 = int(np.floor(px.min())), int(np.ceil(px.max())); y0, y1 = int(np.floor(py.min())), int(np.ceil(py.max()))
        if x1 < 0 or y1 < 0 or x0 >= size or y0 >= size: continue
        xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1, size - 1) + 1), np.arange(max(y0, 0), min(y1, size - 1) + 1))
        d = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
        if abs(d) < 1e-9: continue
        l0 = ((py[1] - py[2]) * (xs - px[2]) + (px[2] - px[1]) * (ys - py[2])) / d
        l1 = ((py[2] - py[0]) * (xs - px[2]) + (px[0] - px[2]) * (ys - py[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not m.any(): continue
        vs = tri_v[fi]
        pp = l0[..., None] * pos[vs[0]] + l1[..., None] * pos[vs[1]] + l2[..., None] * pos[vs[2]]
        nn = l0[..., None] * nrm[vs[0]] + l1[..., None] * nrm[vs[1]] + l2[..., None] * nrm[vs[2]]
        aa = l0 * ao[vs[0]] + l1 * ao[vs[1]] + l2 * ao[vs[2]]
        P[ys[m], xs[m]] = pp[m]; Nn[ys[m], xs[m]] = nn[m]; A[ys[m], xs[m]] = aa[m]; M[ys[m], xs[m]] = True
    px_, py_, pz_ = P[..., 0], P[..., 1], P[..., 2]
    # base albedo: slightly warm neutral grey; the in-game skin tone tints it by multiplication
    base = np.stack([np.full((size, size), 0.93), np.full((size, size), 0.88), np.full((size, size), 0.85)], -1)
    # low-frequency mottling + fine grain
    def noise(scale):
        g = rng.random((size // scale + 2, size // scale + 2))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
        return np.asarray(im, dtype=np.float64) / 255
    mott = (noise(64) - 0.5) * 0.06 + (noise(8) - 0.5) * 0.05 + (noise(2) - 0.5) * 0.03
    base = base + mott[..., None]
    # ruddy cheeks / nose / knees / elbows (colour in red channel only -> reads as blood flow after tinting)
    face = M & (pz_ > eye['L'][2] - 0.03) & (py_ > eye_y - 0.11) & (py_ < eye_y + 0.04) & (np.abs(px_) < 0.085) & (Nn[..., 2] > 0.2)
    for sx in (-1, 1):
        d = np.sqrt((px_ - sx * 0.05) ** 2 + (py_ - (eye_y - 0.045)) ** 2)
        base[..., 1] -= 0.05 * np.exp(-(d / 0.03) ** 2) * face; base[..., 2] -= 0.04 * np.exp(-(d / 0.03) ** 2) * face
    # eyebrows
    for sx in (-1, 1):
        ex = sx * 0.036
        dx = px_ - ex; arch = 0.0055 * (1 - (np.clip(dx / 0.026, -1, 1)) ** 2)
        dy = py_ - (eye_y + 0.0205 + arch + 0.004 * (dx * sx) / 0.026)
        soft = np.exp(-(dy / 0.0042) ** 2) * (np.abs(dx) < 0.026) * (pz_ > eye['L'][2] - 0.025) * (Nn[..., 2] > 0.1)
        base[..., :] *= (1 - 0.72 * soft[..., None])
    # lips
    my = mouth[1]
    lipw = 0.027
    dxl = px_ / lipw
    lipy = my + 0.004
    dyl = (py_ - lipy) / (0.0095 * (1 - 0.35 * dxl ** 2).clip(0.2, 1))
    lips = (np.abs(dxl) < 1) & (np.abs(dyl) < 1) & (pz_ > mouth[2] - 0.02) & (Nn[..., 2] > 0.2)
    lipsoft = np.clip(1 - dyl ** 2, 0, 1) * np.clip(1 - dxl ** 2, 0, 1) * (pz_ > mouth[2] - 0.02) * (Nn[..., 2] > 0.2)
    base[..., 1] -= 0.16 * lipsoft; base[..., 2] -= 0.12 * lipsoft; base[..., 0] -= 0.02 * lipsoft
    # the mouth line
    line = np.exp(-((py_ - (my + 0.0005)) / 0.0011) ** 2) * (np.abs(px_) < 0.026) * (pz_ > mouth[2] - 0.02) * (Nn[..., 2] > 0.2)
    base *= (1 - 0.35 * line[..., None])
    # nostrils
    for sx in (-1, 1):
        d = np.sqrt((px_ - sx * 0.0105) ** 2 + (py_ - (nose[1] - 0.012)) ** 2 + (pz_ - (nose[2] - 0.012)) ** 2)
        base *= (1 - 0.55 * np.exp(-(d / 0.0045) ** 2)[..., None])
    # ear shading
    ear = M & (np.abs(px_) > 0.068) & (py_ > eye_y - 0.075) & (py_ < eye_y + 0.045) & (pz_ < eye['L'][2] + 0.02) & (pz_ > eye['L'][2] - 0.1)
    base[..., 1] -= 0.04 * ear; base[..., 2] -= 0.035 * ear
    # AO
    base *= A[..., None] ** 0.8
    base = np.clip(base, 0, 1)
    img = (base * 255).astype(np.uint8)
    # dilate to avoid UV-seam bleeding
    from scipy.ndimage import distance_transform_edt
    inv = ~M
    idx = distance_transform_edt(inv, return_distances=False, return_indices=True)
    img = img[idx[0], idx[1]]
    os.makedirs(os.path.join(out_dir, 'textures'), exist_ok=True)
    Image.fromarray(img).save(os.path.join(out_dir, 'textures', f'skin_{name}_clean.jpg'), quality=88)
    # stubble / beard variant
    beard = M & (py_ > eye_y - 0.20) & (pz_ > eye['L'][2] - 0.03) & (py_ < eye_y - 0.065) & (np.abs(px_) < 0.082) & (Nn[..., 2] > -0.1) & ~(lipsoft > 0.05)
    beard |= M & (py_ > eye_y - 0.20) & (py_ < mouth[1] + 0.012) & (py_ > mouth[1] - 0.075) & (np.abs(px_) < 0.082) & (pz_ > mouth[2] - 0.05)
    grain = (noise(1) > 0.38).astype(float)
    dens = np.clip(0.55 + 0.35 * (noise(16) - 0.5), 0, 1)
    sm = np.asarray(Image.fromarray((beard * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(5)), dtype=np.float64) / 255
    dark = 0.35 * sm * grain * dens + 0.10 * sm
    img2 = (np.clip(base * (1 - dark[..., None]), 0, 1) * 255).astype(np.uint8)
    img2 = img2[idx[0], idx[1]]
    Image.fromarray(img2).save(os.path.join(out_dir, 'textures', f'skin_{name}_stubble.jpg'), quality=88)


def export(name, B, bone_names, meshes, out_dir, extra):
    blob = bytearray()
    def add(arr):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(arr.tobytes()); return off
    man = {'version': 1, 'name': name, 'stature': B['cfg']['stature'], 'meshes': {}, 'landmarks': extra}
    H = B['heads']; parents = dict(BB.GAME_BONES)
    man['bones'] = [dict(name=b, parent=(bone_names.index(parents[b]) if parents[b] else -1), pos=[round(float(v), 5) for v in H[b]]) for b in bone_names]
    man['tails'] = {k: [round(float(v), 5) for v in t] for k, t in B['tails'].items()}
    for mname, m in meshes.items():
        e = {'count': int(len(m['position'])), 'attributes': {}}
        for k, a in m.items():
            if k in ('groups', 'srcVertex'): continue
            if k == 'position': e['attributes'][k] = dict(offset=add(a.astype(np.float32)), type='f32', size=3)
            elif k == 'normal':
                q = np.clip(np.round(a * 127), -127, 127).astype(np.int8); e['attributes'][k] = dict(offset=add(q), type='i8n', size=3); pad = (-len(q.tobytes())) % 4
            elif k == 'uv': e['attributes'][k] = dict(offset=add(a.astype(np.float32)), type='f32', size=2)
            elif k == 'skinIndex': e['attributes'][k] = dict(offset=add(a.astype(np.uint8)), type='u8', size=4)
            elif k == 'skinWeight': e['attributes'][k] = dict(offset=add(a.astype(np.uint8)), type='u8n', size=4)
            elif k == 'color': e['attributes'][k] = dict(offset=add(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)), type='u8n', size=1)
            elif k == 'index':
                e['index'] = dict(offset=add(a), type='u16' if a.dtype == np.uint16 else 'u32', count=int(len(a)))
        if 'groups' in m: e['groups'] = [list(map(int, g)) for g in m['groups']]
        man['meshes'][mname] = e
    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, f'{name}.bin'), 'wb').write(bytes(blob))
    json.dump(man, open(os.path.join(out_dir, f'{name}.json'), 'w'), separators=(',', ':'))
    print(name, 'exported', len(blob) // 1024, 'KB;', {k: v['count'] for k, v in man['meshes'].items()})
    return man


if __name__ == '__main__':
    mh, out = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(BB.BUILDS)
    for n in names:
        build_one(n, mh, out)
    # eye texture (CC0) copied verbatim
    src = os.path.join(mh, 'makehuman/data/eyes/materials/brown_eye.png')
    os.makedirs(os.path.join(out, 'textures'), exist_ok=True)
    Image.open(src).convert('RGBA').resize((512, 512), Image.LANCZOS).save(os.path.join(out, 'textures', 'eye_brown.png'))
