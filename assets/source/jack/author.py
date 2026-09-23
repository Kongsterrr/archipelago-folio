"""Original Jack V5 editable authoring scene.
Blender 4.5: blender --background --python assets/source/jack/author.py -- --input /tmp/archipelago-v5-source/jack.glb
The runtime mesh and seven clips are preserved. A hidden subdivision sculpt
collection is editable independently; no unbaked high-poly geometry ships.
"""
import bpy, math, json, sys, pathlib, argparse
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--render-dir');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
out=pathlib.Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(args.input).resolve()))
scene=bpy.context.scene
runtime=bpy.data.collections.new('RUNTIME — 22 joints / 7 clips');scene.collection.children.link(runtime)
meshes=[]
for o in list(scene.objects):
 if o.type=='MESH' and not o.name.startswith('Jack_'):
  o.hide_render=True;continue
 for c in list(o.users_collection):c.objects.unlink(o)
 runtime.objects.link(o)
 if o.type=='MESH':
  meshes.append(o)
  for p in o.data.polygons:p.use_smooth=True
  o['Source']='Original parametric sculpt, scripts/jack-character.mjs'
  o['Surface']='Tiled material UV_0; vertex color provides authored color'
sculpt=bpy.data.collections.new('SCULPT — optional high subdivision');scene.collection.children.link(sculpt)
for o in meshes:
 h=o.copy();h.data=o.data.copy();h.name=o.name+'_Sculpt';sculpt.objects.link(h)
 h.parent=None
 # Freeze rest geometry; sculpt collection is intentionally not an export layer.
 for m in list(h.modifiers):h.modifiers.remove(m)
 sub=h.modifiers.new('Sculpt detail resolution','SUBSURF');sub.levels=1;sub.render_levels=2
 h.hide_render=True;h.hide_set(True)
 h['Workflow']='Unhide, apply subdivision if desired, sculpt. Transfer to runtime cage and verify authored contacts before export.'
sculpt.hide_render=True
# Shared rig remains in neutral rest pose; 7 complete clips remain stashed.
for o in runtime.objects:
 if o.type=='ARMATURE':
  o.data.pose_position='REST'
  if o.animation_data:
   o.animation_data.action=None
   for track in o.animation_data.nla_tracks:track.mute=True
# Art direction setup is optional preview only, and not part of runtime export.
studio=bpy.data.collections.new('REVIEW — cameras and lights');scene.collection.children.link(studio)
def move_review(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 studio.objects.link(o)
for name,pos,power,size,color in [
 ('Warm soft key',(-3,4,5),480,4,(1,.87,.73)),
 ('Cool fill',(3,1,2.5),160,3,(.70,.84,1)),
 ('Hair rim',(1,-3,4),340,3,(1,.92,.80))]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color
 light.rotation_euler=(Vector((0,0,.65))-light.location).to_track_quat('-Z','Y').to_euler();move_review(light)
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='Review floor';move_review(ground)
mat=bpy.data.materials.new('Review matte ivory');mat.diffuse_color=(.78,.77,.72,1);ground.data.materials.append(mat)
world=bpy.data.worlds.new('Review warm daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.75,.79,.85,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.resolution_x=900;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(0,3,.68));camera=bpy.context.object;camera.name='Jack review camera';move_review(camera);camera.data.type='ORTHO';camera.data.ortho_scale=1.47;scene.camera=camera
camera.rotation_euler=(Vector((0,0,.62))-camera.location).to_track_quat('-Z','Y').to_euler()
scene['Asset_revision']='V5_sculpt_and_surface'
scene['Contract']='1.20m; 2.2 heads; 22 named bones; seven clips; six runtime materials'
scene['Export']='Use original generator for reproducible rig/contacts. This scene retains an editable cage and a high subdivision authoring collection.'
readme=bpy.data.texts.new('READ ME — original Jack V5');readme.write(__doc__+'\nRuntime UVs intentionally overlap between garment pieces for repeating PBR detail. Do not bake non-tiled AO into these UVs. Sculpt edits require transfer and validation before runtime export.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'jack-v5.blend'),compress=True)
if args.render_dir:
 rd=pathlib.Path(args.render_dir);rd.mkdir(parents=True,exist_ok=True)
 for name,pos in [('front',(0,3,.72)),('three-quarter',(-1.8,3,.85)),('side',(-3,.03,.77))]:
  camera.location=pos;camera.rotation_euler=(Vector((0,0,.61))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(rd/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'source':str(out/'jack-v5.blend'),'runtime_meshes':len(meshes),'actions':len(bpy.data.actions),'bones':sum(len(o.data.bones) for o in runtime.objects if o.type=='ARMATURE')}))
