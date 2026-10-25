"""Export athlete mocap clips (Rocketbox, MIT) retargeted to Sports_Male_04 skeleton."""
import os, bpy, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rtlib
from mathutils import Vector
spec = json.load(open(sys.argv[-2])); OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
T, meshes = rtlib.import_avatar(rtlib.R + 'Avatars/Professions/Sports_Male_04/Export/Sports_Male_04.fbx', keep_mesh=False)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
T.animation_data_clear(); T.animation_data_create()
T.name = 'Rig'; T.data.name = 'Rig'
order = rtlib.bone_order(T, lambda b: not any(k in b.name for k in rtlib.FACE))
info = {}
for clip in spec:
    C, rng, cleanup = rtlib.import_clip(clip['file'])
    U = None
    if clip.get('upper'):
        U, urng, ucleanup = rtlib.import_clip(clip['upper'])
    act = bpy.data.actions.new(clip['name']); T.animation_data.action = act
    start = clip.get('start', rng[0]); end = min(clip.get('end', rng[1]), rng[1]); step = clip.get('step', 1)
    frames = list(range(start, end + 1, step)); prev = {}
    root0 = None; travel = 0
    for k, f in enumerate(frames):
        rot, root = rtlib.sample(C, f)
        if U is not None:
            urot, _ = rtlib.sample(U, clip.get('ustart', 1) + (f - start))
            rot = rtlib.composite(T, rot, urot)
        if root0 is None: root0 = root.copy()
        if clip.get('inplace'):
            travel = (Vector((root.x, root.y)) - Vector((root0.x, root0.y))).length
            root = Vector((root0.x, root0.y, root.z))
        rtlib.apply(T, order, rot, root, prev)
        T.pose.bones['Bip01 Pelvis'].keyframe_insert('location', frame=k + 1)
        for b in order: T.pose.bones[b.name].keyframe_insert('rotation_quaternion', frame=k + 1)
    dur = (len(frames) - 1) * step / 30
    info[clip['name']] = {'frames': len(frames), 'duration': round(dur, 3), 'speed': round(travel / dur, 3) if clip.get('inplace') and dur else 0}
    act.use_fake_user = True
    tr = T.animation_data.nla_tracks.new(); tr.name = clip['name']; tr.strips.new(clip['name'], 1, act)
    T.animation_data.action = None
    cleanup()
    if U is not None: ucleanup()
    print('clip', clip['name'], info[clip['name']])
for pb in T.pose.bones: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.scene.render.fps = int(round(30 / spec[0].get('step', 1)))
bpy.ops.object.select_all(action='DESELECT'); T.select_set(True); bpy.context.view_layer.objects.active = T
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_skins=True, export_force_sampling=True,
                          export_optimize_animation_size=True, export_yup=True, export_materials='NONE')
json.dump(info, open(OUT.replace('.glb', '.json'), 'w'), indent=1)
print('exported', OUT)
