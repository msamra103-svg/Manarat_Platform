"""Crowd bake: Rocketbox adults/children (MIT) -> instanced GPU-skinned spectators.

Per group (adult / child) one canonical skeleton. Each avatar mesh is decimated,
its weights folded onto a reduced bone set, then *conformed* to the canonical
bind pose (linear-blend skinning with canonical_bind * avatar_bind^-1), so all
avatars of a group share one baked animation texture.
Outputs (Y-up, metres):
  crowd.json, crowd_anim.bin (int16 3x4 skin matrices per bone per frame),
  crowd_<id>.bin (geometry) + crowd_<id>.jpg (256-px cells atlas)
"""
import bpy, bmesh, sys, json, os, math, struct
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rtlib
from mathutils import Matrix, Vector
from PIL import Image

OUT = sys.argv[-1]; os.makedirs(OUT, exist_ok=True)
AV = rtlib.R + 'Avatars/'
S = 'all_animations_max_motextr_static/'
FPS = 12
KEEP = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
        'L Clavicle', 'L UpperArm', 'L Forearm', 'L Hand', 'R Clavicle', 'R UpperArm', 'R Forearm', 'R Hand',
        'L Thigh', 'L Calf', 'L Foot', 'R Thigh', 'R Calf', 'R Foot']
KEEP = ['Bip01 ' + k for k in KEEP]
GROUPS = {
    'adult': {'canon': 'Adults/Male_Adult_17',
              'avatars': ['Adults/Male_Adult_15', 'Adults/Male_Adult_19', 'Adults/Male_Adult_21', 'Adults/Male_Adult_17',
                          'Adults/Male_Adult_20', 'Adults/Male_Adult_01', 'Adults/Male_Adult_06', 'Adults/Male_Adult_10', 'Adults/Male_Adult_04']},
    'child': {'canon': 'Children/Male_Child_01', 'avatars': ['Children/Male_Child_01', 'Children/Male_Child_02']},
}
# name, lower/main clip, start, end, upper clip (optional), upper start, loop, lock horizontal root
CLIPS = [
    ('sit_idle', S + 'm_sit_chair_breathe_01.max.fbx', 1, 240, None, 1, True, True),
    ('sit_look', S + 'm_sit_chair_idle_look_around.max.fbx', 1, 261, None, 1, True, True),
    ('sit_lean', S + 'm_sit_chair_idle_nervous_01.max.fbx', 30, 170, None, 1, True, True),
    ('sit_clap', S + 'm_sit_chair_breathe_01.max.fbx', 1, 200, S + 'm_claphands_01.max.fbx', 12, True, True),
    ('sit_cheer', S + 'm_sit_chair_breathe_01.max.fbx', 1, 150, S + 'm_cheer_04.max.fbx', 15, False, True),
    ('stand_up', 'all_animations_max_motextr_xyz/m_sit_stand_up_chair_01.max.fbx', 1, 70, None, 1, False, True),
    ('stand_cheer', 'all_animations_max_motextr_xy/m_cheer_02.max.fbx', 1, 240, None, 1, True, True),
    ('stand_clap', S + 'm_claphands_02.max.fbx', 1, 200, None, 1, True, True),
    ('sit_down', 'all_animations_max_motextr_xyz/m_sit_down_chair_01.max.fbx', 1, 88, None, 1, False, True),
    ('sit_shrug', S + 'm_sit_chair_gestic_shrug_01.max.fbx', 1, 91, None, 1, False, True),
    ('sit_face', S + 'm_sit_chair_idle_touch_face.max.fbx', 1, 150, None, 1, False, True),
]
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))  # Blender Z-up -> three Y-up
Ci = C.inverted()


def fbx_of(path):
    name = path.split('/')[-1]
    return f'{AV}{path}/Export/{name}.fbx'


def bind_world(arm):
    return {b.name: b.matrix_local.copy() for b in arm.data.bones}


meta = {'fps': FPS, 'bones': [k.replace('Bip01 ', '') for k in KEEP], 'groups': {}, 'clips': {}, 'avatars': {}}
anim_rows = []  # each row: len(KEEP)*12 floats
row_cursor = 0

for gname, g in GROUPS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    T, _ = rtlib.import_avatar(fbx_of(g['canon']), keep_mesh=False)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    T.animation_data_clear()
    order = rtlib.bone_order(T, lambda b: not any(k in b.name for k in rtlib.FACE))
    Bc = bind_world(T)
    Bc_inv = {k: Bc[k].inverted() for k in KEEP}
    pel_rest = T.data.bones['Bip01 Pelvis'].head_local.copy()
    meta['groups'][gname] = {'canon': g['canon'], 'pelvisRest': [pel_rest.x, pel_rest.z, -pel_rest.y]}
    for (cname, cfile, s, e, upper, us, loop, lock) in CLIPS:
        Cl, rng, cleanup = rtlib.import_clip(cfile)
        U = None
        if upper: U, urng, ucleanup = rtlib.import_clip(upper)
        e = min(e, rng[1])
        step = 30 / FPS
        frames = [s + i * step for i in range(int((e - s) / step) + 1)]
        start_row = row_cursor; root0 = None; pelvis_samples = []
        for f in frames:
            rot, root = rtlib.sample(Cl, int(round(f)))
            if U is not None:
                urot, _ = rtlib.sample(U, int(round(us + (f - s))))
                rot = rtlib.composite(T, rot, urot)
            if root0 is None: root0 = root.copy()
            if lock: root = Vector((root0.x, root0.y, root.z))
            root = root * (pel_rest.z / 0.8952)
            rtlib.apply(T, order, rot, root)
            bpy.context.view_layer.update()
            row = []
            for k in KEEP:
                Sm = C @ (T.pose.bones[k].matrix @ Bc_inv[k]) @ Ci
                for r in range(3):
                    row += [Sm[r][0], Sm[r][1], Sm[r][2], Sm[r][3]]
            anim_rows.append(row); row_cursor += 1
            pm = C @ T.pose.bones['Bip01 Pelvis'].matrix
            pelvis_samples.append([pm[0][3], pm[1][3], pm[2][3]])
        cleanup()
        if U is not None: ucleanup()
        meta['clips'].setdefault(cname, {})[gname] = {'row': start_row, 'count': len(frames), 'loop': loop}
        ps = np.array(pelvis_samples)
        meta['clips'][cname][gname]['pelvis'] = [round(float(x), 3) for x in ps.mean(0)]
        print('clip', gname, cname, len(frames), 'pelvis mean', ps.mean(0).round(3))
    # ---- avatars of this group ----
    for apath in g['avatars']:
        aid = apath.split('/')[-1].replace('Male_Adult_', 'a').replace('Male_Child_', 'c')
        before = set(bpy.data.objects)
        A, meshes = rtlib.import_avatar(fbx_of(apath), keep_mesh=True)
        mesh = meshes[0]
        Ba = bind_world(A)
        # drop hair-card (opacity) faces; crowd renders opaque
        bm = bmesh.new(); bm.from_mesh(mesh.data)
        kill = [f for f in bm.faces if 'opacity' in mesh.data.materials[f.material_index].name]
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(mesh.data); bm.free()
        # fold weights onto KEEP bones (nearest kept ancestor)
        def kept_ancestor(bn):
            b = A.data.bones.get(bn)
            while b is not None and b.name not in KEEP: b = b.parent
            return b.name if b else 'Bip01 Pelvis'
        vg = mesh.vertex_groups
        names = [x.name for x in vg]
        for k in KEEP:
            if k not in vg: vg.new(name=k)
        idx_of = {x.name: x.index for x in vg}
        for v in mesh.data.vertices:
            acc = {}
            for ge in v.groups:
                n = vg[ge.group].name
                if n.startswith('Bip01'): tgt = kept_ancestor(n)
                else: continue
                acc[tgt] = acc.get(tgt, 0) + ge.weight
            for ge in list(v.groups):
                vg[ge.group].remove([v.index])
            top = sorted(acc.items(), key=lambda x: -x[1])[:2]
            tot = sum(w for _, w in top) or 1
            for n, w in top: vg[n].add([v.index], w / tot, 'REPLACE')
        # decimate
        bpy.context.view_layer.objects.active = mesh
        tris0 = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
        target = 1300 if gname == 'adult' else 1100
        mod = mesh.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1, target / tris0); mod.use_collapse_triangulate = True
        # move decimate before the armature modifier and apply it
        while mesh.modifiers.find('dec') > 0: bpy.ops.object.modifier_move_up(modifier='dec')
        bpy.ops.object.modifier_apply(modifier='dec')
        me = mesh.data
        me.calc_loop_triangles()
        # per-loop export (split by uv/material): build unique vertices
        uvl = me.uv_layers.active.data
        mats = [m.name for m in me.materials]
        def cell_of(mi):
            n = mats[mi]
            return 0 if 'body' in n else 1 if 'head' in n else 2
        keyed = {}; pos = []; nor = []; uv = []; ji = []; jw = []; idx = []
        # conform matrices
        Mconf = {k: Bc[k] @ Ba[k].inverted() for k in KEEP}
        gi = {vg[k].index: k for k in KEEP}
        vcache = {}
        for lt in me.loop_triangles:
            cell = cell_of(lt.material_index)
            for li, vi in zip(lt.loops, lt.vertices):
                u, w_ = uvl[li].uv
                key = (vi, round(u, 5), round(w_, 5), cell)
                if key not in keyed:
                    if vi not in vcache:
                        v = me.vertices[vi]
                        ws = [(gi[ge.group], ge.weight) for ge in v.groups if ge.group in gi and ge.weight > 0]
                        ws = sorted(ws, key=lambda x: -x[1])[:2]
                        if not ws: ws = [('Bip01 Pelvis', 1.0)]
                        tot = sum(x[1] for x in ws)
                        ws = [(n, w / tot) for n, w in ws]
                        P = Vector((0, 0, 0)); N = Vector((0, 0, 0))
                        for n, w in ws:
                            P += (Mconf[n] @ v.co) * w
                            N += (Mconf[n].to_3x3() @ v.normal) * w
                        P = C.to_3x3() @ P; N = (C.to_3x3() @ N).normalized()
                        vcache[vi] = (P, N, ws)
                    P, N, ws = vcache[vi]
                    keyed[key] = len(pos)
                    pos.append((P.x, P.y, P.z)); nor.append((N.x, N.y, N.z))
                    # atlas: 2x2 cells, cell 0 body TL, 1 head TR, 2 extra BL ; v flipped for three (flipY=false)
                    cu = (cell % 2) * 0.5; cv = (cell // 2) * 0.5
                    uu = min(max(u - math.floor(u) if u > 1 or u < 0 else u, 0.002), 0.998)
                    vv = min(max(w_ - math.floor(w_) if w_ > 1 or w_ < 0 else w_, 0.002), 0.998)
                    uv.append((cu + uu * 0.5, cv + (1 - vv) * 0.5))
                    j = [KEEP.index(n) for n, _ in ws] + [0] * (2 - len(ws))
                    w = [x for _, x in ws] + [0] * (2 - len(ws))
                    ji.append(j); jw.append(w)
                idx.append(keyed[key])
        pos = np.array(pos, np.float32); nor = np.array(nor, np.float32)
        uv = np.array(uv, np.float32); ji = np.array(ji, np.uint8); jw = np.array(jw, np.float32)
        idx = np.array(idx, np.uint16 if len(pos) < 65535 else np.uint32)
        # pack: header + pos f32 + normal i8x4 + uv u16x2 + joints u8x2 + weight u8 (w0) + idx
        nrm8 = np.clip(np.round(nor * 127), -127, 127).astype(np.int8)
        nrm8 = np.concatenate([nrm8, np.zeros((len(nrm8), 1), np.int8)], 1)
        uv16 = np.clip(np.round(uv * 65535), 0, 65535).astype(np.uint16)
        w8 = np.clip(np.round(jw[:, 0] * 255), 0, 255).astype(np.uint8)
        with open(f'{OUT}/crowd_{aid}.bin', 'wb') as fh:
            fh.write(struct.pack('<4I', len(pos), len(idx), 0, 0))
            fh.write(pos.tobytes()); fh.write(nrm8.tobytes()); fh.write(uv16.tobytes()); fh.write(ji.tobytes()); fh.write(w8.tobytes())
            pad = (4 - fh.tell() % 4) % 4; fh.write(b'\0' * pad)
            fh.write(idx.tobytes())
        # atlas from textures (cells: body, head, extra e.g. keffiyeh)
        texdir = f'{AV}{apath}/Textures/'
        files = os.listdir(texdir)
        def pick(word):
            for f in files:
                if f.endswith(f'_{word}_color.tga'): return texdir + f
            return None
        atlas = Image.new('RGB', (512, 512), (90, 90, 90))
        extra = [n for n in mats if not any(w in n for w in ('body', 'head', 'opacity'))]
        for cell, word in [(0, 'body'), (1, 'head'), (2, extra[0].split('_')[-1] if extra else None)]:
            if not word: continue
            p = pick(word)
            if p: atlas.paste(Image.open(p).convert('RGB').resize((256, 256), Image.LANCZOS), ((cell % 2) * 256, (cell // 2) * 256))
        atlas.save(f'{OUT}/crowd_{aid}.jpg', quality=82, optimize=True)
        height = float(pos[:, 1].max())
        meta['avatars'][aid] = {'group': gname, 'source': apath, 'vertices': int(len(pos)), 'indices': int(len(idx)), 'height': round(height, 3), 'index32': bool(idx.dtype == np.uint32)}
        print('avatar', aid, gname, 'tris', len(idx) // 3, 'verts', len(pos), 'h', round(height, 2), 'extra', extra)
        for o in list(bpy.data.objects):
            if o not in before: bpy.data.objects.remove(o)

rows = np.array(anim_rows, np.float32)  # [frames, bones*12]
# quantise: rotation/scale part in [-2,2] -> /2*32767 ; translation in [-4,4] -> /4*32767
nb = len(KEEP)
q = np.zeros_like(rows, dtype=np.int16)
rv = rows.reshape(len(rows), nb, 3, 4)
scale = np.array([2, 2, 2, 4], np.float32)
qv = np.clip(np.round(rv / scale * 32767), -32767, 32767).astype(np.int16)
with open(f'{OUT}/crowd_anim.bin', 'wb') as fh:
    fh.write(struct.pack('<4I', len(rows), nb, 0, 0)); fh.write(qv.tobytes())
meta['frames'] = int(len(rows)); meta['quant'] = [2, 2, 2, 4]
json.dump(meta, open(f'{OUT}/crowd.json', 'w'), indent=1)
print('rows', len(rows), 'bones', nb, 'max abs', np.abs(rv[..., :3]).max(), np.abs(rv[..., 3]).max())
