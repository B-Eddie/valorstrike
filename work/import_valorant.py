"""Download public Kingdom Archives models; embed diffuse textures for local GLTFLoader use."""
import concurrent.futures as cf, hashlib, io, json, pathlib, re, struct, subprocess
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'models/valorant'; CACHE=ROOT/'work/valorant-source'; CACHE.mkdir(exist_ok=True); OUT.mkdir(exist_ok=True)
BASE='https://kingdomarchives.com/'
import threading
_LOCKS = {}
_LOCK = threading.Lock()
def fetch(path):
 url=path if path.startswith('http') else BASE+path.replace('../','')
 p=CACHE/hashlib.sha256(url.encode()).hexdigest()
 with _LOCK: lock = _LOCKS.setdefault(str(p), threading.Lock())
 with lock:
  if not p.exists():
   subprocess.run(['curl','--fail','--retry','2','-Ls','--max-time','90','-e',BASE+'modelviewer/jett',url,'-o',str(p)+'.part'],check=True)
   pathlib.Path(str(p)+'.part').rename(p)
 return p.read_bytes()
def descriptor(slug):
 s=fetch('modelviewer/'+slug).decode();r=re.search(r"const MODEL_JSON = JSON.parse\('(.*?)'\);",s)
 if not r: raise ValueError('No model descriptor: '+slug)
 return json.loads(json.loads('"'+r.group(1).replace('"','\\"')+'"'))
def unpack(b):
 n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);return g,bytearray(b[28+n:])
def pack(g,blob):
 blob+=b'\x00'*((-len(blob))%4);g['buffers']=[{'byteLength':len(blob)}];s=json.dumps(g,separators=(',',':')).encode();s+=b' '*((-len(s))%4)
 return struct.pack('<III',0x46546c67,2,28+len(s)+len(blob))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(blob),0x004e4942)+blob
def build(slug):
 p=OUT/(slug+'.glb')
 if p.exists(): return slug+' cached'
 d=descriptor(slug);b=fetch(d['Model']['Path']+d['Model']['Name']);g,blob=unpack(b)
 # Archive separates texture maps from geometry. Store diffuse locally inside GLB, no runtime hotlinks.
 mats={m['Name']:m for m in d.get('Materials',[])}
 for m in g.get('materials',[]):
  md=mats.get(m.get('name'),{});pbr=m.setdefault('pbrMetallicRoughness',{});pbr.update(metallicFactor=0,roughnessFactor=.8,baseColorFactor=[1,1,1,1])
  if md.get('DF'):
   im=Image.open(io.BytesIO(fetch(md['DF'])));im.thumbnail((1024,1024));buf=io.BytesIO();im.save(buf,format='PNG');data=buf.getvalue();blob+=b'\0'*((-len(blob))%4);vi=len(g.setdefault('bufferViews',[]));g['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob+=data
   ii=len(g.setdefault('images',[]));g['images'].append({'bufferView':vi,'mimeType':'image/png'});ti=len(g.setdefault('textures',[]));g['textures'].append({'source':ii});pbr['baseColorTexture']={'index':ti}
  if md.get('Type')=='Tritium':m['emissiveFactor']=[.2,.8,.6]
  m['doubleSided']=True
 p.write_bytes(pack(g,blob));(OUT/(slug+'.json')).write_text(json.dumps(d,indent=2))
 return slug+' '+str(p.stat().st_size)
if __name__=='__main__':
 import sys
 slugs=sys.argv[1:] or ['jett','phoenix','sova','sage','reyna','raze','killjoy','omen','skye','chamber','breach','cypher','classic','shorty','frenzy','ghost','bandit','sheriff','stinger','spectre','bucky','judge','bulldog','guardian','warden','phantom','vandal','marshal','outlaw','operator','ares','odin','melee']
 with cf.ThreadPoolExecutor(max_workers=6) as ex:
  jobs={ex.submit(build,s):s for s in slugs}
  for f in cf.as_completed(jobs):
   try:print(f.result(),flush=True)
   except Exception as e:print('FAIL',jobs[f],repr(e),flush=True)
