"""Blender: export the original map geometry with a rigid metre-preserving transform.
Merges draw batches by material; bakes walkable navigation from source triangles, never invents lanes.
"""
import bpy,sys,json,math,re,hashlib,collections,time
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:];key=args[0];ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'models/valorant/maps'/key;META=json.loads((OUT/'source.json').read_text());T=META['transform'];ca,sa=math.cos(T['angle']),math.sin(T['angle']);
# Blender source: X=game X, Y=-game Y, Z=up. Rotate the export into the API world axes.
R=np.array([[-sa,-ca,0],[0,0,1],[-ca,sa,0]],dtype=np.float32);offset=np.array([-ca*T['cx']-sa*T['cz'],T['yOffset'],sa*T['cx']-ca*T['cz']],dtype=np.float32)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'work/map-source'/(key+'.blend')),load_ui=False)
print('OPEN',key,flush=True);g={'asset':{'version':'2.0','generator':'ValorStrike original map export'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]};buffers=[];blob=bytearray();MAXBUF=19*1024*1024

def view(data,target=None):
 global blob
 if len(blob)+len(data)>MAXBUF and blob:buffers.append(blob);blob=bytearray()
 pad=(-len(blob))%4;blob.extend(b'\0'*pad);v={'buffer':len(buffers),'byteOffset':len(blob),'byteLength':len(data)}
 if target:v['target']=target
 i=len(g['bufferViews']);g['bufferViews'].append(v);blob.extend(data);return i

def accessor(a,kind,component=5126,limits=False):
 a=np.ascontiguousarray(a);a=a.astype({5126:np.float32,5125:np.uint32,5123:np.uint16}[component]);v=view(a.tobytes(),34963 if kind=='SCALAR' else 34962);ac={'bufferView':v,'componentType':component,'count':len(a),'type':kind}
 if limits:ac['min']=a.min(axis=0).tolist();ac['max']=a.max(axis=0).tolist()
 i=len(g['accessors']);g['accessors'].append(ac);return i

texmap={};matmap={};batches=collections.defaultdict(list);collision=[];objects=0

def image_node(mat):
 if not mat or not mat.node_tree:return None
 for n in mat.node_tree.nodes:
  if n.type=='GROUP':
   for label in ['Diffuse','Diffuse A','DiffuseA','Albedo','Base Color','Diffuse1','Texture']:
    sock=n.inputs.get(label)
    if sock and sock.is_linked:
     stack=[l.from_node for l in sock.links];seen=set()
     while stack:
      u=stack.pop()
      if u in seen:continue
      seen.add(u)
      if u.type=='TEX_IMAGE' and u.image:return u.image
      stack.extend(l.from_node for i in u.inputs for l in i.links)
 return next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and re.search(r'(_DF|Diffuse|Albedo)',n.image.name,re.I) and not re.match(r'Albedo_DF|Diffuse\.png',n.image.name)),None)

def material(mat):
 name=mat.name if mat else 'Unassigned'
 if name in matmap:return matmap[name]
 m={'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1}};pbr=m['pbrMetallicRoughness'];params={}
 if mat and mat.node_tree:
  group=next((n for n in mat.node_tree.nodes if n.type=='GROUP'),None)
  if group:
   for label in ['DiffuseColor','Tint','Color','BLENDMODE','Use Vertex Alpha','Use Alpha As Emissive']:
    sock=group.inputs.get(label)
    if sock and hasattr(sock,'default_value'):
     try:params[label]=list(sock.default_value)
     except:params[label]=sock.default_value
  color=params.get('DiffuseColor',params.get('Color',[1,1,1,1]));tint=params.get('Tint',[1,1,1,1]);pbr['baseColorFactor']=[max(0,min(1,float(color[i])*float(tint[i]))) for i in range(3)]+[1]
 im=image_node(mat)
 if im:
  if im.name not in texmap:
   # Scale source diffuse textures only; normal/MRA maps are unnecessary for this renderer.
   if max(im.size)>512:im.scale(max(1,round(im.size[0]*512/max(im.size))),max(1,round(im.size[1]*512/max(im.size))))
   nm=hashlib.sha256(im.name.encode()).hexdigest()[:16]+'.png';im.filepath_raw=str(OUT/'textures'/nm);im.file_format='PNG';im.save();ii=len(g['images']);g['images'].append({'uri':'textures/'+nm});ti=len(g['textures']);g['textures'].append({'source':ii,'sampler':0});texmap[im.name]=ti
  pbr['baseColorTexture']={'index':texmap[im.name]}
  if re.search('Foliage|Leaves|Canopy|Grass|Ivy',name,re.I):m['alphaMode']='MASK';m['alphaCutoff']=.45
 i=len(g['materials']);matmap[name]=i;g['materials'].append(m);return i

(OUT/'textures').mkdir(exist_ok=True)
for o in bpy.data.objects:
 if o.type!='MESH' or o.hide_render or not o.data.polygons:continue
 mesh=o.data;mesh.calc_loop_triangles();nv=len(mesh.vertices);nl=len(mesh.loops);nt=len(mesh.loop_triangles)
 pos=np.empty(nv*3,np.float32);mesh.vertices.foreach_get('co',pos);pos=pos.reshape(-1,3);mw=np.array(o.matrix_world,dtype=np.float32);A=R@mw[:3,:3];tr=R@mw[:3,3]+offset;pos=pos@A.T+tr
 loops=np.empty(nt*3,np.int32);mesh.loop_triangles.foreach_get('loops',loops);loops=loops.reshape(-1,3)
 vi=np.empty(nl,np.int32);mesh.loops.foreach_get('vertex_index',vi);vids=vi[loops];tri=pos[vids]
 if not re.search(r'Foliage|Grass|Leaves|Canopy|Ivy|VFX|Decal|Floater|Light|Shadow|Wires|Sky|Cloud|Fog|Vista|Backdrop|FX_|Water',o.name,re.I):collision.append(tri.reshape(-1,3).copy())
 normals=np.empty(nl*3,np.float32)
 try:mesh.corner_normals.foreach_get('vector',normals)
 except:mesh.loops.foreach_get('normal',normals)
 normals=normals.reshape(-1,3)@np.linalg.inv(A);normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
 uv=np.zeros((nl,2),np.float32)
 if mesh.uv_layers.active:mesh.uv_layers.active.data.foreach_get('uv',uv.ravel())
 materials=np.empty(nt,np.int32);mesh.loop_triangles.foreach_get('material_index',materials)
 for mi in np.unique(materials):
  mat=o.material_slots[int(mi)].material if mi<len(o.material_slots) else None;idx=material(mat);sel=materials==mi;ls=loops[sel].ravel();data=np.concatenate([pos[vi[ls]],normals[ls],uv[ls]],axis=1);batches[idx].append(data)
 objects+=1
 if objects%1000==0:print('GEOMETRY',key,objects,flush=True)
print('MERGE',key,objects,len(batches),flush=True)
for mi,blocks in batches.items():
 a=np.concatenate(blocks);a=np.round(a,5);u,ix=np.unique(a,axis=0,return_inverse=True);pr={'attributes':{'POSITION':accessor(u[:,:3],'VEC3',limits=True),'NORMAL':accessor(u[:,3:6],'VEC3'),'TEXCOORD_0':accessor(u[:,6:8],'VEC2')},'indices':accessor(ix,'SCALAR',5125),'material':mi};ni=len(g['nodes']);g['nodes'].append({'mesh':len(g['meshes']),'name':g['materials'][mi]['name']});g['meshes'].append({'primitives':[pr]});g['scenes'][0]['nodes'].append(ni)
 # Release each merged batch as soon as it is emitted.
 blocks.clear()
if blob:buffers.append(blob)
for i,b in enumerate(buffers):
 name='geometry-%02d.bin'%i;(OUT/name).write_bytes(b);g['buffers'].append({'uri':name,'byteLength':len(b)})
(OUT/'scene.gltf').write_text(json.dumps(g,separators=(',',':')));del buffers,blob,batches
print('COLLISION',key,flush=True)
coll=np.concatenate(collision);del collision;verts,indices=np.unique(np.round(coll,5),axis=0,return_inverse=True);del coll;faces=indices.reshape(-1,3)
# Independent packed collision data: float32 vertices followed by uint32 triangle indices.
header=np.array([len(verts),len(indices)],dtype='<u4').tobytes();(OUT/'collision.bin').write_bytes(header+verts.astype('<f4').tobytes()+indices.astype('<u4').tobytes())
print('NAVIGATION',key,len(verts),len(faces),flush=True)
bvh=BVHTree.FromPolygons(verts.tolist(),faces.tolist(),all_triangles=True,epsilon=.00001);del faces,indices
# The official floor footprint restricts navigation to playable map space rather than decorative vista roofs.
im=bpy.data.images.load(str(OUT/'minimap.png'),check_existing=False);pixels=np.empty(im.size[0]*im.size[1]*4,np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4);proj=META['apiProjection'];W,H=im.size

def on_map(x,z):
 sx=ca*x-sa*z+T['cx'];sz=sa*x+ca*z+T['cz'];gameY=sx*100;gameX=-sz*100;u=gameY*proj['xMultiplier']+proj['xScalarToAdd'];v=gameX*proj['yMultiplier']+proj['yScalarToAdd'];ix=int(u*W);iz=int((1-v)*H)
 return 0<=ix<W and 0<=iz<H and pixels[iz,ix,3]>.1

step=.75;x0=math.floor(verts[:,0].min());x1=math.ceil(verts[:,0].max());z0=math.floor(verts[:,2].min());z1=math.ceil(verts[:,2].max());del verts
lo=min(c['position'][1] for c in META['callouts'])-2;hi=max(c['position'][1] for c in META['callouts'])+3;nodes=[];cells=collections.defaultdict(list);up=Vector((0,1,0));down=-up;directions=[Vector((math.cos(a*math.pi/4),0,math.sin(a*math.pi/4))) for a in range(8)]
for ix in range(math.ceil((x1-x0)/step)+1):
 x=x0+ix*step
 for iz in range(math.ceil((z1-z0)/step)+1):
  z=z0+iz*step
  if not on_map(x,z):continue
  origin=Vector((x,hi,z));last=hi+1
  for attempt in range(12):
   p,n,face,d=bvh.ray_cast(origin,down,hi-lo+1)
   if p is None or p.y<lo:break
   y=p.y;origin=Vector((x,y-.04,z))
   if last-y<.08:continue
   last=y
   if n.y<.45:continue
   roof=bvh.ray_cast(Vector((x,y+.12,z)),up,1.7)[0]
   if roof is not None:continue
   # Head/body clearance on both sides of thin walls.
   if any(bvh.ray_cast(Vector((x,y+h,z)),direction,.36)[0] is not None for h in [.65,1.4] for direction in directions):continue
   idx=len(nodes);nodes.append([round(x,4),round(y+.015,4),round(z,4)]);cells[(ix,iz)].append(idx)
 if ix%30==0:print('NAV',key,ix,len(nodes),flush=True)
adj=[[] for _ in nodes]
for (ix,iz),ids in cells.items():
 for a in ids:
  for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
   for b in cells.get((ix+dx,iz+dz),[]):
    dh=nodes[b][1]-nodes[a][1]
    if dh>.8 or dh<-2:continue
    pa=Vector(nodes[a])+Vector((0,.85,0));pb=Vector(nodes[b])+Vector((0,.85,0));delta=pb-pa;dist=delta.length
    if bvh.ray_cast(pa,delta.normalized(),dist)[0] is not None:continue
    adj[a].append(b)

def near(p):
 return min(range(len(nodes)),key=lambda i:(nodes[i][0]-p[0])**2+(nodes[i][2]-p[2])**2+4*(nodes[i][1]-p[1])**2)
starts=[near(META['attacker']),near(META['defender'])];targets={k:near(p) for k,p in META['sites'].items()};seen=set([starts[0]]);q=[starts[0]]
while q:
 a=q.pop()
 for b in adj[a]:
  if b not in seen:seen.add(b);q.append(b)
# API callouts may float above roofs/boxes. Select the nearest reachable floor under the site's X/Z footprint.
for k,p in META['sites'].items():
 targets[k]=min(seen,key=lambda i:(nodes[i][0]-p[0])**2+(nodes[i][2]-p[2])**2+.01*(nodes[i][1]-p[1])**2)
check={'attackerToDefender':starts[1] in seen,'attackerToSites':{k:math.hypot(nodes[i][0]-META['sites'][k][0],nodes[i][2]-META['sites'][k][2])<5 for k,i in targets.items()},'nodes':len(nodes),'reachable':len(seen)}
META['sourceAnchors']={k:META[k] for k in ['attacker','defender','sites']};META['attacker']=nodes[starts[0]];META['defender']=nodes[starts[1]];META['sites']={k:nodes[i] for k,i in targets.items()};META['navigationValidation']=check;META['objects']=objects;META['triangles']=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']);META['bounds']={'x1':x0,'x2':x1,'z1':z0,'z2':z1}
(OUT/'map.json').write_text(json.dumps(META,separators=(',',':')));(OUT/'navigation.json').write_text(json.dumps({'step':step,'nodes':nodes,'adj':adj,'spawnNodes':starts,'siteNodes':targets,'validation':check},separators=(',',':')));print('DONE',key,json.dumps(check),flush=True)
