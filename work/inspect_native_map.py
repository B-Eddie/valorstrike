import bpy,sys,json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=args[0],load_ui=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH'];print('MESHES',len(meshes),'MATS',len(bpy.data.materials),'IMAGES',len(bpy.data.images));
for o in meshes[:8]:print('OBJECT',o.name,list(o.location),[list(o.matrix_world@Vector(c)) for c in o.bound_box][:2])
for m in list(bpy.data.materials)[:3]:
 print('MAT',m.name)
 if m.node_tree:
  for n in m.node_tree.nodes:
   print(' NODE',n.name,n.type,('IMAGE '+n.image.name) if n.type=='TEX_IMAGE' and n.image else '',[(i.name,str(i.default_value)[:80]) for i in n.inputs if hasattr(i,'default_value')][:12])
