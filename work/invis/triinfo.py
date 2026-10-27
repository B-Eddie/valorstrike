# Per WORLD triangle (server worlds/<key>/position.bin+index.bin, i.e. exactly what the motor collides with):
# material id (render triangle with identical vertices; -2 = no render triangle = collision-only) and the
# fraction of its surface the page draws see-through (alpha below the page material's alphaTest).
import json,sys,os,re,numpy as np
from PIL import Image
from census import th,CT,NC,ROOT
from classify import page_mat,FOLN,FOLX
key,W=sys.argv[1],sys.argv[2];TAG=os.environ.get('TAG','')
D=ROOT/'models/valorant/maps'/key;g=json.loads((D/'scene.gltf').read_text());ms=g['materials'];bufs={};cache={}
def acc(i):
    a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
    if v['buffer'] not in bufs:bufs[v['buffer']]=(D/g['buffers'][v['buffer']]['uri']).read_bytes()
    n=NC[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
    r=np.frombuffer(bufs[v['buffer']],CT[a['componentType']],a['count']*n,off);return r.reshape(-1,n) if n>1 else r
WP=np.fromfile(f'{W}/{key}/position.bin',np.float32).reshape(-1,3);WI=np.fromfile(f'{W}/{key}/index.bin',np.uint32).astype(np.int64)
wh=th(WP,WI);nt=len(wh);mat=np.full(nt,-2,np.int16);frac=np.zeros(nt,np.uint8)
o=np.argsort(wh);whs=wh[o]
Wb=[]
for a in np.linspace(0,1,5):
    for b in np.linspace(0,1-a,max(1,int(round((1-a)*4))+1)):Wb.append((1-a-b,a,b))
Wb=np.array(Wb);info={}
for node in g['nodes']:
    if node.get('mesh') is None:continue
    for pr in g['meshes'][node['mesh']]['primitives']:
        mi=pr['material'];P=acc(pr['attributes']['POSITION']);I=acc(pr['indices']).astype(np.int64).reshape(-1,3);h=th(P,I.ravel())
        k=np.clip(np.searchsorted(whs,h),0,nt-1);ok=whs[k]==h
        if not ok.any():continue
        wt=o[k[ok]];rt=np.nonzero(ok)[0];mat[wt]=mi
        kind,at,im=page_mat(ms[mi],D,g,cache);info[mi]=dict(name=ms[mi]['name'],kind=kind,at=at,plant=bool(FOLN.search(ms[mi]['name']) and not FOLX.search(ms[mi]['name'])))
        if at>0 and im is not None:
            UV=acc(pr['attributes']['TEXCOORD_0']);H,Wd=im.shape;vis=np.zeros(len(rt))
            for w in Wb:
                uv=UV[I[rt,0]]*w[0]+UV[I[rt,1]]*w[1]+UV[I[rt,2]]*w[2]
                x=np.clip((np.mod(uv[:,0],1)*Wd).astype(int),0,Wd-1);y=np.clip((np.mod(uv[:,1],1)*H).astype(int),0,H-1);vis+=im[y,x]/255.>=at
            frac[wt]=np.round((1-vis/len(Wb))*100).astype(np.uint8)
mat.tofile(f'mat_{key}{TAG}.bin');frac.tofile(f'frac_{key}{TAG}.bin');json.dump(info,open(f'mats_{key}{TAG}.json','w'))
print(key,TAG,'tris',nt,'collision-only',int((mat==-2).sum()),'see-through>=50%',int((frac>=50).sum()))
