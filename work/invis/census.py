import json,sys,struct,numpy as np
from pathlib import Path
sys.path.insert(0,'..')
ROOT=Path('/workspace/work/vs-lane-invis')
CT={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32};NC={'SCALAR':1,'VEC2':2,'VEC3':3}
def th(P,I):
    q=np.round(P.astype(np.float64)*1000).astype(np.int64);vh=(q[:,0]*73856093)^(q[:,1]*19349663)^(q[:,2]*83492791)
    t=np.sort(vh[I.reshape(-1,3)],axis=1);return (t[:,0]*1000003)^(t[:,1]*998244353)^(t[:,2]*1234567891)
def load(key):
    D=ROOT/'models/valorant/maps'/key;g=json.loads((D/'scene.gltf').read_text());bufs={}
    def acc(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
        if v['buffer'] not in bufs:bufs[v['buffer']]=(D/g['buffers'][v['buffer']]['uri']).read_bytes()
        n=NC[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
        r=np.frombuffer(bufs[v['buffer']],CT[a['componentType']],a['count']*n,off);return r.reshape(-1,n) if n>1 else r
    H=[];M=[]
    for node in g['nodes']:
        if node.get('mesh') is None:continue
        for pr in g['meshes'][node['mesh']]['primitives']:
            P=acc(pr['attributes']['POSITION']);I=acc(pr['indices']).astype(np.int64);h=th(P,I);H.append(h);M.append(np.full(len(h),pr['material'],np.int32))
    H=np.concatenate(H);M=np.concatenate(M);o=np.argsort(H,kind='stable');H=H[o];M=M[o]
    b=(D/'collision.bin').read_bytes();nv,ni=struct.unpack_from('<II',b);CP=np.frombuffer(b,np.float32,nv*3,8).reshape(-1,3);CI=np.frombuffer(b,np.uint32,ni,8+nv*12).astype(np.int64)
    ch=th(CP,CI);k=np.clip(np.searchsorted(H,ch),0,len(H)-1);hit=H[k]==ch;cm=np.where(hit,M[k],-1)
    ex=np.zeros(len(ch),bool);eb=(D/'collision-exclude.bin').read_bytes();n=struct.unpack_from('<I',eb)[0]
    for r in range(n):s,l=struct.unpack_from('<II',eb,4+r*8);ex[s:s+l]=True
    return g,CP,CI.reshape(-1,3),cm,ex
if __name__=='__main__':
    key=sys.argv[1];g,CP,T,cm,ex=load(key);ms=g['materials']
    print(key,'tris',len(cm),'unmatched',int((cm<0).sum()),'excluded',int(ex.sum()))
    keep=~ex;u,c=np.unique(cm[keep],return_counts=True)
    for mi,cc in sorted(zip(u,c),key=lambda x:-x[1]):
        nm=ms[mi]['name'] if mi>=0 else 'UNMATCHED';a=ms[mi].get('alphaMode','') if mi>=0 else ''
        print(f'{cc:8d} {a:5s} {nm}')
