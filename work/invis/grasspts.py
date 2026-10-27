# render-only grass / foliage card positions (materials never in collision): 0.5 m grid cells holding any of their triangles
import json,sys,re,numpy as np
from census import CT,NC,ROOT
key=sys.argv[1];D=ROOT/'models/valorant/maps'/key;g=json.loads((D/'scene.gltf').read_text());bufs={}
def acc(i):
    a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
    if v['buffer'] not in bufs:bufs[v['buffer']]=(D/g['buffers'][v['buffer']]['uri']).read_bytes()
    n=NC[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
    r=np.frombuffer(bufs[v['buffer']],CT[a['componentType']],a['count']*n,off);return r.reshape(-1,n) if n>1 else r
RE=re.compile(r'Grass(?!.*(Stone|Floor|Blend|Brick|Gravel))|Foliage|Plant(?!er)|Vegetation|Ivy|Fern|Shrub|Bush|Cabbage|MorningGlory|Agave|Flower',re.I)
cells={};per={}
for node in g['nodes']:
    if node.get('mesh') is None:continue
    for pr in g['meshes'][node['mesh']]['primitives']:
        nm=g['materials'][pr['material']]['name']
        if not RE.search(nm) or re.search('Floor|Stone|Blend|Brick|Gravel|Planter|Tile',nm):continue
        P=acc(pr['attributes']['POSITION']);I=acc(pr['indices']).astype(np.int64).reshape(-1,3);c=P[I].mean(1)
        k=np.unique(np.floor(c/.5).astype(np.int64),axis=0);per[nm]=len(k)
        for a in k:cells.setdefault(tuple(int(v) for v in a),nm)
json.dump([[k[0],k[1],k[2],v] for k,v in cells.items()],open(f'grass_{key}.json','w'))
print(key,len(cells),sorted(per.items(),key=lambda x:-x[1])[:15])
