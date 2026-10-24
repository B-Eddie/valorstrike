"""Build compact reusable environment GLBs from the public Ascent port."""
from import_valorant import *
import urllib.parse,copy
REPO='https://raw.githubusercontent.com/Shreshth1x/ValorantBrowser/main/public/model/'
def raw(path):return fetch(REPO+urllib.parse.quote(path))
g=json.loads(raw('ascent.gltf'));sh=json.loads(raw('material-shaders.json'));bins=[]
for b in g['buffers']:bins.append(raw(b['uri']))
# Reuse authentic map props at the existing map placements. Names on the left are legacy placement IDs.
PARTS={'Barrel':[306], 'Crate':[132], 'Bags':[193], 'Bench_1':[185], 'Cart':[931], 'MarketStand_1':[637,187], 'Plant_3':[285], 'Plant_5':[633], 'Bush_1':[165,166], 'BushBerries_1':[247,248], 'Cactus_2':[285], 'CactusFlowers_5':[287], 'Rock_4':[164], 'Rock_Moss_2':[1004], 'CommonTree_1':[154,157], 'CommonTree_3':[154,157], 'PalmTree_1':[154,174], 'PalmTree_3':[154,174], 'PineTree_2':[418,411,412,413,414,415,416,417], 'Willow_3':[154,157], 'Trashcan':[430], 'AC':[99], 'AC_Stacked':[58], 'Light_Street_1':[307], 'Streetlight_Single':[308], 'cover':[907], 'wall':[752]}
OUTD=OUT/'environment';OUTD.mkdir(exist_ok=True)
def build_prop(item):
 name,mis=item;out={'asset':{'version':'2.0','generator':'ValorStrike Ascent prop importer'},'scene':0,'scenes':[{'nodes':list(range(len(mis)))}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]};blob=bytearray();acmap={};matmap={}
 def view(data):
  blob.extend(b'\0'*((-len(blob))%4));idx=len(out['bufferViews']);out['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data);return idx
 def acc(ai):
  if ai in acmap:return acmap[ai]
  a=copy.deepcopy(g['accessors'][ai]);v=g['bufferViews'][a['bufferView']];data=bins[v.get('buffer',0)][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];vi=view(data)
  if 'byteStride' in v:out['bufferViews'][vi]['byteStride']=v['byteStride']
  a['bufferView']=vi;idx=len(out['accessors']);out['accessors'].append(a);acmap[ai]=idx;return idx
 def mat(mi):
  if mi in matmap:return matmap[mi]
  m=copy.deepcopy(g['materials'][mi]);s=sh['materials'].get(m['name'],{});p=s.get('params',{});ims=s.get('images',{});tint=p.get('DiffuseColor',[1,1,1,1]);tint=[min(1,max(0,float(v))) for v in tint[:4]];pbr=m['pbrMetallicRoughness'];pbr['baseColorFactor']=tint
  path=ims.get('Diffuse')
  if path:
   # Source images table maps logical texture names to their actual source paths.
   entry=sh['images'].get(path);src=entry.get('uri',entry.get('path')) if isinstance(entry,dict) else entry
   if not src:src='source-textures/'+path
   if not src.startswith(('source-textures/','optimized-textures/')):src='source-textures/'+src
   try:
    im=Image.open(io.BytesIO(raw(src)));im.thumbnail((512,512));buf=io.BytesIO();im.save(buf,format='PNG');ii=len(out['images']);out['images'].append({'bufferView':view(buf.getvalue()),'mimeType':'image/png'});ti=len(out['textures']);out['textures'].append({'source':ii,'sampler':0});pbr['baseColorTexture']={'index':ti}
    if 'Foliage' in m['name'] or 'Leaves' in m['name'] or 'Canopy' in m['name'] or 'Grass' in m['name']:m['alphaMode']='MASK';m['alphaCutoff']=.4
   except Exception as e:print('TEXTURE FAIL',path,str(e)[:120],flush=True)
  m['doubleSided']=True;idx=len(out['materials']);out['materials'].append(m);matmap[mi]=idx;return idx
 for idx,mi in enumerate(mis):
  mesh=copy.deepcopy(g['meshes'][mi]);out['nodes'].append({'name':mesh['name'],'mesh':idx})
  for pr in mesh['primitives']:
   pr['attributes']={k:acc(v) for k,v in pr['attributes'].items()};pr['indices']=acc(pr['indices']);pr['material']=mat(pr['material'])
  out['meshes'].append(mesh)
 (OUTD/(name+'.glb')).write_bytes(pack(out,blob));return name
if __name__=='__main__':
 print('image sample',list(sh['images'].items())[:1],flush=True)
 with cf.ThreadPoolExecutor(max_workers=6) as ex:
  for name in ex.map(build_prop,PARTS.items()):print(name,flush=True)
