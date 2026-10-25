"""Shared Rocketbox retargeting helpers (Blender bpy).

All Rocketbox avatars/clips use the 3ds Max Biped 'Bip01' skeleton but with
different rest poses. We retarget by copying armature-space bone ROTATIONS
from the clip skeleton; bone offsets stay those of the target, so each avatar
keeps its own proportions. Only the root (pelvis) carries translation.
"""
import os, bpy
from mathutils import Matrix, Quaternion, Vector

R = os.path.join(os.environ.get('ROCKETBOX', 'Microsoft-Rocketbox'), 'Assets/')
FACE = ('Eye', 'Jaw', 'Lip', 'Tongue', 'Mouth', 'Masseter', 'Caninus', 'Upperlip', 'Cheek',
        'Eyebrow', 'MNose', 'Blink')
UPPER_ROOTS = ('Bip01 Spine2',)  # composite: this bone and its descendants come from the upper clip


def import_avatar(path, keep_mesh=True):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    meshes = [o for o in new if o.type == 'MESH']
    for o in new:
        if o.type == 'EMPTY' or (o.type == 'MESH' and not keep_mesh):
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    if keep_mesh:
        for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    # children use a 'Bip02' biped: normalise names to 'Bip01'
    for b in arm.data.bones:
        if b.name.startswith('Bip02'): b.name = 'Bip01' + b.name[5:]
    for m in (meshes if keep_mesh else []):
        for g in m.vertex_groups:
            if g.name.startswith('Bip02'): g.name = 'Bip01' + g.name[5:]
    return arm, (meshes if keep_mesh else [])


def import_clip(file):
    before = set(bpy.data.objects); before_act = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=R + 'Animations/' + file)
    new = [o for o in bpy.data.objects if o not in before]
    C = [o for o in new if o.type == 'ARMATURE'][0]
    rng = C.animation_data.action.frame_range
    imported = [a for a in bpy.data.actions if a not in before_act]
    def cleanup():
        for o in new:
            if o.name in bpy.data.objects: bpy.data.objects.remove(o)
        for a in imported:
            if a.name in bpy.data.actions: bpy.data.actions.remove(a)
    return C, (int(rng[0]), int(rng[1])), cleanup


def bone_order(T, include=lambda b: True):
    order = []
    def walk(b):
        if include(b): order.append(b)
        for c in b.children: walk(c)
    for b in T.data.bones:
        if b.parent is None: walk(b)
    return order


def is_upper(bone):
    b = bone
    while b is not None:
        if b.name in UPPER_ROOTS: return True
        b = b.parent
    return False


def sample(C, frame):
    """armature(world)-space rotations + root translation of clip C at frame."""
    bpy.context.scene.frame_set(frame)
    CW = C.matrix_world; cq = CW.to_quaternion()
    rot = {pb.name: (cq @ pb.matrix.to_quaternion()).normalized() for pb in C.pose.bones}
    root = (CW @ C.pose.bones['Bip01 Pelvis'].matrix).to_translation()
    return rot, root


def apply(T, order, rot, root, prev=None):
    """write a sampled pose to target armature T (pose-bone basis values)."""
    for b in order:
        pb = T.pose.bones[b.name]
        if b.parent is None:
            wm = Matrix.LocRotScale(root, rot[b.name], None)
            m = b.matrix_local.inverted() @ wm
            pb.location = m.to_translation(); q = m.to_quaternion()
        else:
            rest_rel = b.parent.matrix_local.inverted() @ b.matrix_local
            q = rest_rel.to_quaternion().inverted() @ rot[b.parent.name].inverted() @ rot[b.name]
        if prev is not None:
            if b.name in prev and prev[b.name].dot(q) < 0: q = -q
            prev[b.name] = q.copy()
        pb.rotation_quaternion = q


def composite(T, lower_rot, upper_rot):
    upper = {b.name for b in T.data.bones if is_upper(b)}
    return {k: (upper_rot[k] if k in upper and k in upper_rot else v) for k, v in lower_rot.items()}
