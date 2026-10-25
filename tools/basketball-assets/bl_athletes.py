"""Build basketball athlete GLBs from Microsoft Rocketbox (MIT) avatars.

Variant 'a': Sports_Male_04 as-is (tank top / shorts / trainers).
Variants 'b','c': Sports_Male_04 body with the head of Sports_Male_02 / _03 grafted
on the neck seam (seam vertices snapped + smooth falloff, then welded).
Textures are written separately by kits.py so kits/numbers can vary per player.
"""
import os, bpy, bmesh, sys, math
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = os.path.join(os.environ.get('ROCKETBOX', 'Microsoft-Rocketbox'), 'Assets/Avatars/Professions/')
OUT = sys.argv[-1]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def imp(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=f'{ROOT}{name}/Export/{name}.fbx')
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    mesh = [o for o in new if o.type == 'MESH'][0]
    for o in new:
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    return arm, mesh


def tag_seam(obj):
    m = obj.data
    hv = set(); bv = set()
    for p in m.polygons:
        (bv if 'body' in m.materials[p.material_index].name else hv).update(p.vertices)
    g = obj.vertex_groups.new(name='__seam')
    g.add(sorted(hv & bv), 1.0, 'REPLACE')


def seam_verts(obj):
    gi = obj.vertex_groups['__seam'].index
    return [v.index for v in obj.data.vertices if any(g.group == gi for g in v.groups)]


def delete_faces(obj, keep):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    kill = [f for f in bm.faces if not keep(obj.data.materials[f.material_index].name)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(obj.data); bm.free()


def border_verts(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    idx = sorted({v.index for e in bm.edges if e.is_boundary for v in e.verts})
    bm.free(); return idx


def graft(base_arm, base, donor_name):
    d_arm, donor = imp(donor_name)
    tag_seam(donor); tag_seam(base)
    delete_faces(donor, lambda n: 'body' not in n)  # keep head (+ hair opacity)
    delete_faces(base, lambda n: 'head' not in n)   # keep body only
    bb = seam_verts(base); db = seam_verts(donor)
    bco = [base.data.vertices[i].co.copy() for i in bb]
    kd = KDTree(len(bco))
    for i, c in enumerate(bco): kd.insert(c, i)
    kd.balance()
    # displacement for each donor seam vertex to its nearest base seam vertex
    disp = {}
    used = set()
    for i in db:
        c = donor.data.vertices[i].co
        (co, j, dist) = kd.find(c)
        disp[i] = co - c
        used.add(j)
    print('graft', donor_name, 'base seam', len(bb), 'donor seam', len(db), 'matched', len(used),
          'max move cm', max(v.length for v in disp.values()))
    seam_pts = [(donor.data.vertices[i].co.copy(), disp[i]) for i in db]
    # smooth falloff (6 cm, mesh units are cm) so the neck does not crease
    R = 6.0
    for v in donor.data.vertices:
        if v.index in disp:
            v.co += disp[v.index]; continue
        wsum = 0; acc = Vector((0, 0, 0)); nearest = 1e9
        for p, dv in seam_pts:
            dd = (v.co - p).length
            nearest = min(nearest, dd)
            w = 1 / (dd * dd + 1e-4)
            wsum += w; acc += dv * w
        if nearest < R:
            f = 1 - nearest / R
            f = f * f * (3 - 2 * f)
            v.co += acc / wsum * f
    # re-parent donor to the base armature, then join
    donor.parent = base_arm
    for m in donor.modifiers:
        if m.type == 'ARMATURE': m.object = base_arm
    bpy.ops.object.select_all(action='DESELECT')
    donor.select_set(True); base.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    bm = bmesh.new(); bm.from_mesh(base.data)
    dl = bm.verts.layers.deform.active
    gi = base.vertex_groups['__seam'].index
    seam = [v for v in bm.verts if gi in v[dl]]
    bmesh.ops.remove_doubles(bm, verts=seam, dist=0.05)
    bm.to_mesh(base.data); bm.free()
    bpy.data.objects.remove(d_arm)
    print('after weld seam verts', len(seam_verts(base)))
    base.vertex_groups.remove(base.vertex_groups['__seam'])


def strip_nonessential(arm):
    # keep finger + facial bones (used for grip / blinking); nothing to strip here
    pass


def export(path, arm, mesh):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True); mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    arm.name = 'Rig'; arm.data.name = 'Rig'
    print('rig scale', tuple(arm.scale), 'mesh', tuple(mesh.matrix_world.to_scale()), 'pelvis', arm.data.bones['Bip01 Pelvis'].head_local)
    # remove the imported 2-frame bind "actions" so the GLB carries no junk clip
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    arm.animation_data_clear()
    # weight cleanup: max 4 influences, normalised (glTF requirement)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.material_slot_remove_unused()
    for m in mesh.data.materials:
        m.name = m.name.split('_')[-1] if m.name.split('_')[-1] in ('body', 'head', 'opacity') else m.name
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_animations=False, export_skins=True, export_morph=False,
                              export_materials='EXPORT', export_image_format='NONE',
                              export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
                              export_tangents=False, export_vertex_color='NONE')


for variant, donor in [('a', None), ('b', 'Sports_Male_02'), ('c', 'Sports_Male_03')]:
    reset()
    arm, mesh = imp('Sports_Male_04')
    if donor:
        graft(arm, mesh, donor)
    mats = [m.name for m in mesh.data.materials]
    print(variant, 'verts', len(mesh.data.vertices), 'tris', sum(len(p.vertices) - 2 for p in mesh.data.polygons), mats)
    export(f'{OUT}/athlete_{variant}.glb', arm, mesh)
