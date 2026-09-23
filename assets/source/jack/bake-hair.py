"""Reproducible selected-to-active Cycles bake for the original Jack hair.
Run after author.py: blender --background assets/source/jack/jack-v5.blend --python assets/source/jack/bake-hair.py
Runtime keeps UV0 for strand fallback; this OpenGL normal uses UV1.
"""
import bpy, pathlib, math, json
from array import array
out=pathlib.Path(__file__).resolve().parent
scene=bpy.context.scene
low=bpy.data.objects['Jack_SweptHair'];high=bpy.data.objects['Jack_SweptHair_Sculpt']
# UV1 has one cell per authored hair patch; keep it as the active bake chart.
low.data.uv_layers.active_index=1
image=bpy.data.images.new('Jack_V5_baked_hair_normal',width=1024,height=1024,alpha=False)
image.colorspace_settings.name='Non-Color';image.generated_color=(.5,.5,1,1)
mat=low.data.materials[0];mat.use_nodes=True
for socket in [n.inputs.get('Normal') for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED']:
 if socket:
  for link in list(socket.links):mat.node_tree.links.remove(link)
high.data.materials.clear();high.data.materials.append(mat.copy())
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.name='V5 baked normal UV1';node.image=image;mat.node_tree.nodes.active=node
# The editable high mesh is actually evaluated at 4x surface resolution before
# carving fine flow-aligned strands; bake the resulting sculpt into the cage.
for m in list(high.modifiers):high.modifiers.remove(m)
sub=high.modifiers.new('High sculpt resolution','SUBSURF');sub.levels=2;sub.render_levels=2;sub.subdivision_type='SIMPLE'
height=bpy.data.images.new('Original flow-aligned hair relief',width=512,height=512,alpha=False)
pixels=array('f')
for y in range(512):
 v=y/511;fade=math.sin(math.pi*v)**.6
 for x in range(512):
  u=x/511;flow=u+.018*math.sin(v*math.pi*1.7);groove=max(0,math.cos(flow*math.pi*42))**6
  value=.5-.40*groove*fade
  pixels.extend((value,value,value,1))
height.pixels.foreach_set(pixels);height.pack()
tex=bpy.data.textures.new('V5 original strand relief',type='IMAGE');tex.image=height
mod=high.modifiers.new('Sculpted strand microrelief','DISPLACE');mod.texture=tex;mod.texture_coords='UV';mod.uv_layer=high.data.uv_layers[0].name;mod.strength=.0012;mod.mid_level=.5
for c in high.users_collection:c.hide_render=False
high.hide_render=False;high.hide_set(False)
scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.0018;scene.render.bake.max_ray_distance=.0035;scene.render.bake.margin=5;scene.render.bake.use_clear=True
scene.render.bake.normal_space='TANGENT';scene.render.bake.normal_r='POS_X';scene.render.bake.normal_g='POS_Y';scene.render.bake.normal_b='POS_Z'
bpy.ops.object.select_all(action='DESELECT');high.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low
bpy.ops.object.bake(type='NORMAL')
# Cell zero is reserved for brows: retain a neutral tangent normal there.
p=list(image.pixels)
# Very oblique rays at overlapping roots can hit an adjacent lock. The authored
# microrelief never requires a >37 degree normal change; neutralize these invalid
# cage samples instead of shipping colored projection seams.
rejected=0
for k in range(0,len(p),4):
 if p[k+2]<.90 or abs(p[k]-.5)>.32 or abs(p[k+1]-.5)>.32:
  p[k:k+4]=[.5,.5,1,1];rejected+=1
for y in range(0,342):
 for x in range(0,257):
  k=(y*1024+x)*4;p[k:k+4]=[.5,.5,1,1]
image.pixels.foreach_set(p);image.filepath_raw=str(out/'jack-hair-normal.png');image.file_format='PNG';image.save();image.pack()
uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map=low.data.uv_layers[1].name
normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55;normal.uv_map=uv.uv_map
mat.node_tree.links.new(uv.outputs['UV'],node.inputs['Vector']);mat.node_tree.links.new(node.outputs['Color'],normal.inputs['Color'])
for bsdf in mat.node_tree.nodes:
 if bsdf.type=='BSDF_PRINCIPLED':mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
high.hide_render=True;high.hide_set(True)
for c in high.users_collection:c.hide_render=True
scene['Hair_bake']='Cycles high-subdivision + geometric strand-relief to runtime cage; tangent OpenGL normal, UV1, 1024px'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'jack-v5.blend'),compress=True)
report={'method':'Cycles selected-to-active NORMAL','source':'Hidden editable high subdivision + UV-flow geometric strand relief','width':1024,'height':1024,'channel':1,'normalConvention':'OpenGL +X +Y +Z','cageExtrusion':.0018,'maxRayDistance':.0035,'marginPixels':5,'material':'Jack_SweptHair','runtimeUV':'TEXCOORD_1','png':'jack-hair-normal.png','rejectedObliqueCageSamples':rejected}
(out/'bake-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
