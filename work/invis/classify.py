# For every kept collision triangle, decide how the PAGE renders it (replicating nmPrepareScene: terrain / decal / foliage
# cut-out / glTF MASK) and what fraction of its surface is see-through (alpha under the material's alphaTest).
import json,sys,re,numpy as np
from PIL import Image
from census import load,ROOT
TERR=re.compile(r'Floor|Ground|(?:Stone|Brick|Dirt|Gravel|Tile|Grass|Jam|Stairs).*Grass|Grass.*Stone|Blendable.*Gravel',re.I)
FOLN=re.compile(r'Plant(?!er)|Vines|Foliage|Leaf|Leaves|Fern|Shrub|Creeper|Bush|MossOvergrowth|Flower|Ivy|Canopy|TreeCard|Conifer|Arborvitae|Palm|Bonsai|Bananna|Agave|Cabbage|Jasmine|Philodendron|MorningGlory|Cables',re.I)
FOLX=re.compile(r'Blend|Trunk|Bark|Planter|Wall|Floor|Stone|Rock|Tile|Brick|Plaster|Mural|Decal|Floater|Light|Lamp|Glass|Sack|Graffiti|Vista_2_M1',re.I)
def stats(im):
    a=np.asarray(im.convert('RGBA').resize((16,16),Image.BILINEAR)).astype(int);al=a[...,3];cov=al>32
    white=((a[...,:3].min(-1)>220)&cov).sum()/max(1,cov.sum());return dict(minAlpha=int(al.min()),white=float(white),cut=float((al<128).mean()))
def page_mat(m,D,g,cache):
    name=m['name'];terrain=bool(TERR.search(name)) and not re.search('Cards|Decal|Floater',name,re.I)
    at=0 if terrain else (m.get('alphaCutoff',.5) if m.get('alphaMode')=='MASK' else 0)
    tex=m.get('pbrMetallicRoughness',{}).get('baseColorTexture');im=None;st=None
    if tex is not None:
        uri=g['images'][g['textures'][tex['index']]['source']]['uri']
        if uri not in cache:
            img=Image.open(D/uri);cache[uri]=(np.asarray(img.convert('RGBA'))[...,3],stats(img),img.mode)
        im,st,mode=cache[uri]
    kind='opaque'
    if at>0:kind='mask'
    if re.search('Decal|Floater',name,re.I) and st and st['minAlpha']<250:
        kind='decal';at=.02
    elif at==0 and st and st['cut']>=.02 and FOLN.search(name) and not FOLX.search(name):kind='cutout';at=.45
    return kind,at,im
def run(key):
    import os;D=ROOT/'models/valorant/maps'/key;g,CP,T,cm,ex=load(key)
    if os.environ.get('NOEX'):ex[:]=False
    SUF=os.environ.get('TAG','');ms=g['materials'];cache={};pm={}
    # need UVs: rebuild render tri lookup only for alpha-tested materials
    from census import th,CT,NC
    bufs={}
    def acc(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
        if v['buffer'] not in bufs:bufs[v['buffer']]=(D/g['buffers'][v['buffer']]['uri']).read_bytes()
        n=NC[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
        r=np.frombuffer(bufs[v['buffer']],CT[a['componentType']],a['count']*n,off);return r.reshape(-1,n) if n>1 else r
    keep=~ex;out=[]
    for node in g['nodes']:
        if node.get('mesh') is None:continue
        for pr in g['meshes'][node['mesh']]['primitives']:
            mi=pr['material'];sel=np.nonzero(keep&(cm==mi))[0]
            if not len(sel):continue
            kind,at,im=page_mat(ms[mi],D,g,cache)
            if at<=0 or im is None:continue
            P=acc(pr['attributes']['POSITION']);I=acc(pr['indices']).astype(np.int64).reshape(-1,3);UV=acc(pr['attributes']['TEXCOORD_0'])
            h=th(P,I.ravel());o=np.argsort(h);hs=h[o]
            ch=th(CP,T[sel].ravel());k=np.clip(np.searchsorted(hs,ch),0,len(hs)-1);ok=hs[k]==ch;rt=o[k[ok]];ct=sel[ok]
            H,W=im.shape;W8=[]
            for a in np.linspace(0,1,5):
                for b in np.linspace(0,1-a,max(1,int(round((1-a)*4))+1)):W8.append((1-a-b,a,b))
            W8=np.array(W8);vis=np.zeros(len(rt))
            for w in W8:
                uv=UV[I[rt,0]]*w[0]+UV[I[rt,1]]*w[1]+UV[I[rt,2]]*w[2]
                x=np.clip((np.mod(uv[:,0],1)*W).astype(int),0,W-1);y=np.clip((np.mod(uv[:,1],1)*H).astype(int),0,H-1)
                vis+=im[y,x]/255.>=at
            frac=1-vis/len(W8)
            for t,f in zip(ct,frac):
                if f>=.5:
                    v=CP[T[t]];out.append([ms[mi]['name'],kind,round(float(f),2),[round(float(c),3) for c in v.ravel()]])
    import struct
    pf=D/'collision-patch.bin'
    if pf.exists():
        pb=pf.read_bytes();pv,pi=struct.unpack_from('<II',pb);PP=np.frombuffer(pb,np.float32,pv*3,8).reshape(-1,3);PI=np.frombuffer(pb,np.uint32,pi,8+pv*12).reshape(-1,3)
        for t in PI:out.append(['collision-patch','patch',1.0,[round(float(c),3) for c in PP[t].ravel()]])
    json.dump(out,open(f'see_{key}{SUF}.json','w'));
    from collections import Counter
    c=Counter((o[0],o[1]) for o in out);print(key,len(out));[print('  ',n,k,cnt) for (n,k),cnt in c.most_common(25)]
if __name__=="__main__":
    for k in sys.argv[1:]:run(k)
