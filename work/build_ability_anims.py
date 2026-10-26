# Builds models/valorant/animations/FP_Abilities.glb: the authored first-person ABILITY clips that other agents borrow
# (Valorant's FP rigs share one skeleton, 102 common bones, so a clip binds to any agent's arms by bone name, exactly as
# the shared weapon clips in animations/FP_<Weapon>.glb do). Only the animation data + the bone hierarchy are kept
# (no mesh / skin / textures). Sources: the agents' own *-fp.glb (Killjoy grenade, Skye Guiding Light + Trailblazer cast, Cypher Trapwire,
# Sova Owl Drone, Raze underhand). Usage: python3 work/build_ability_anims.py
import json,struct,pathlib
R=pathlib.Path(__file__).resolve().parents[1]/'models/valorant'
TAKE={'killjoy':['FP_Killjoy_S0_4_Grenade_Equip','FP_Killjoy_S0_4_Swarm_Idle','FP_Core_Grenade_OverhandThrow','FP_Killjoy_S0_4_Swarm_UnderhandThrow'],
 'raze':['FP_Core_Grenade_UnderhandThrow'],
 'skye':['FP_Guide_S0_E_Hawk_Equip','FP_Guide_S0_E_Hawk_EquipIdle','FP_Guide_S0_E_Hawk_Cast','FP_Guide_S0_Q_Wolf_Equip','FP_Guide_S0_Q_Wolf_Idle','FP_Guide_S0_Q_Wolf_Cast'],
 'cypher':['FP_Gumshoe_S0_E_Equip','FP_Gumshoe_S0_E_Loop','FP_Gumshoe_S0_E_Fire'],
 'sova':['FP_Hunter_S0_E_Equip','FP_Hunter_S0_E_IdleAdd','FP_Hunter_S0_E_Deploy']}
def load(f):
  b=open(f,'rb').read();n=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+n]);m=struct.unpack('<I',b[20+n:24+n])[0];return j,b[28+n:28+n+m]
COMMON=None;src={}
for ag in TAKE:
  j,bin_=load(R/(ag+'-fp.glb'));src[ag]=(j,bin_);names={n.get('name') for n in j['nodes']};COMMON=names if COMMON is None else COMMON&names
# skeleton: Killjoy's node tree restricted to the common bones (every clip below targets bones by name)
kj,_=src['killjoy'];keep=[i for i,n in enumerate(kj['nodes']) if n.get('name') in COMMON];idx={o:i for i,o in enumerate(keep)}
nodes=[]
for o in keep:
  n=kj['nodes'][o];q={k:v for k,v in n.items() if k in('name','translation','rotation','scale')};ch=[idx[c] for c in n.get('children',[]) if c in idx]
  if ch:q['children']=ch
  nodes.append(q)
roots=[idx[o] for o in keep if not any(o in kj['nodes'][p].get('children',[]) for p in keep)]
out={'asset':{'version':'2.0','generator':'valorstrike build_ability_anims.py'},'scene':0,'scenes':[{'name':'Scene','nodes':roots}],'nodes':nodes,'animations':[],'accessors':[],'bufferViews':[],'buffers':[]}
blob=bytearray();byname={n['name']:i for i,n in enumerate(nodes)};seen=set()
def acc(j,bin_,a):
  A=j['accessors'][a];bv=j['bufferViews'][A['bufferView']];comp={5126:4}[A['componentType']];ncomp={'SCALAR':1,'VEC3':3,'VEC4':4}[A['type']]
  st=bv.get('byteStride',comp*ncomp);off=bv.get('byteOffset',0)+A.get('byteOffset',0);raw=b''.join(bin_[off+i*st:off+i*st+comp*ncomp] for i in range(A['count']))
  while len(blob)%4:blob.append(0)
  out['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw)});blob.extend(raw)
  B={k:v for k,v in A.items() if k in('componentType','count','type','min','max')};B['bufferView']=len(out['bufferViews'])-1;out['accessors'].append(B);return len(out['accessors'])-1
for ag,clips in TAKE.items():
  j,bin_=src[ag]
  for a in j['animations']:
    if a['name'] not in clips or a['name'] in seen:continue
    seen.add(a['name']);S=[];C=[];m={}
    for c in a['channels']:
      nm=j['nodes'][c['target']['node']].get('name')
      if nm not in byname:continue
      s=a['samplers'][c['sampler']];key=(s['input'],s['output'])
      if key not in m:
        ii=m.get(('i',s['input']));
        if ii is None:ii=m[('i',s['input'])]=acc(j,bin_,s['input'])
        S.append({'input':ii,'output':acc(j,bin_,s['output']),'interpolation':s.get('interpolation','LINEAR')});m[key]=len(S)-1
      C.append({'sampler':m[key],'target':{'node':byname[nm],'path':c['target']['path']}})
    out['animations'].append({'name':a['name'],'samplers':S,'channels':C})
missing=[c for v in TAKE.values() for c in v if c not in seen];assert not missing,missing
while len(blob)%4:blob.append(0)
out['buffers']=[{'byteLength':len(blob)}];js=json.dumps(out,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
g=struct.pack('<III',0x46546C67,2,28+len(js)+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
(R/'animations/FP_Abilities.glb').write_bytes(g);print(len(g),'bytes',len(out['animations']),'clips',len(nodes),'bones')
