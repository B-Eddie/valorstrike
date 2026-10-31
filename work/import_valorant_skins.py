"""Install authentic public Kingdom Archives weapon exports, textures, variants and matching FP clips.

Run with Pillow available. Uses the existing source cache; only the selected skin loads in game.
Rebuilds the collection from verified installed exports, never from invented skin palettes.
"""
from import_valorant import *
import html, time

DEST=OUT/'skins'; DEST.mkdir(exist_ok=True)
CATS=[["Sidearms",["Classic","Shorty","Frenzy","Ghost","Bandit","Sheriff"]],["SMGs",["Stinger","Spectre"]],["Shotguns",["Bucky","Judge"]],["Rifles",["Bulldog","Guardian","Warden","Phantom","Vandal"]],["Sniper Rifles",["Marshal","Outlaw","Operator"]],["Heavy",["Ares","Odin"]],["Melee",["Knife"]]]
NAMES={'prime':'Prime','blastx':'BlastX','blackmarket':'Black.Market','dotexe':'.EXE','ego':'Ego','galleria':'Galleria','kingdom':'Kingdom','sakura':'Sakura','smite':'Smite','yoonseul':'Yoonseul','aerosol':'Aerosol','wasteland':'Wasteland','wayfinder':'Wayfinder','rush':'Rush','task-force-809':'Task Force 809','prism':'Prism','varnish':'Varnish','mk-vii-liberty':'MK.VII Liberty','silkleaf':'SilkLeaf'}

def embedded(g,blob,data,kind):
 blob+=b'\0'*((-len(blob))%4);v=len(g.setdefault('bufferViews',[]));g['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob+=data
 i=len(g.setdefault('images',[]));g['images'].append({'bufferView':v,'mimeType':kind});t=len(g.setdefault('textures',[]));g['textures'].append({'source':i});return t

def texture(g,blob,path,color=False):
 im=Image.open(io.BytesIO(fetch(path)));im.thumbnail((1024,1024));buf=io.BytesIO()
 if color and 'A' not in im.mode:im.convert('RGB').save(buf,format='JPEG',quality=92);kind='image/jpeg'
 else:im.save(buf,format='PNG',optimize=True);kind='image/png'
 return embedded(g,blob,buf.getvalue(),kind)

def config(slug):
 s=fetch('modelviewer/jett-fp?held='+slug).decode();out={}
 for key in ['WEAPONS_ANIMS_JSON','MODEL_HELD_JSON']:
  r=re.search(r'const '+key+r" = JSON.parse\('(.*?)'\);",s)
  if not r:raise ValueError('Missing native FP descriptor '+slug+' '+key)
  out[key]=json.loads(json.loads('"'+r.group(1).replace('"','\\"')+'"'))
 for d in out.values():
  for a in d.get('Animations',[]):
   if a.get('Type')=='External':
    p=OUT/'animations'/(a['File']+'.glb')
    if not p.exists():p.write_bytes(fetch(a['Path']+a['File']+'.glb'))
 return out

def install(job):
 w,slug=job;d=descriptor(slug);cid=slug.rsplit('-',1)[0]
 if cid.endswith('-melee'):cid=cid[:-6]
 if slug=='smite-melee-2':return None # duplicate melee export, not a distinct collection
 if cid not in NAMES:raise ValueError('Unmapped archive collection '+slug)
 fp=config(slug);raw=fetch(d['Model']['Path']+d['Model']['Name']);original,source=unpack(raw)
 variants=d.get('Variants') or [{'Name':'default','Materials':[]}];meta={'descriptor':d,'fp':fp}
 meta_text=json.dumps(meta,separators=(',',':'));mh=hashlib.sha256(meta_text.encode()).hexdigest()[:12];meta_path=slug+'.'+mh+'.json';(DEST/meta_path).write_text(meta_text)
 result={'n':NAMES[cid]+' '+('Melee' if w=='Knife' else w),'ch':[],'assets':[]}
 materials={m['Name']:m for m in d.get('Materials',[])}
 for variant in variants:
  if not re.fullmatch(r'[a-zA-Z0-9_-]+',variant['Name']):raise ValueError('Invalid variant name')
  g=json.loads(json.dumps(original));blob=bytearray(source);replace={m['MaterialToReplace']:m['Replacement'] for m in variant.get('Materials',[])}
  images={}
  for m in g.get('materials',[]):
   md=materials.get(replace.get(m.get('name'),m.get('name')),{});pbr=m.setdefault('pbrMetallicRoughness',{});pbr.update(baseColorFactor=[1,1,1,1],metallicFactor=float(md.get('Metallic',0)),roughnessFactor=max(.12,float(md.get('Roughness',.65))))
   for field,target,color in [('DF','baseColorTexture',True),('NM','normalTexture',False),('EM','emissiveTexture',True)]:
    if not md.get(field):continue
    url=md[field]
    if url not in images:images[url]=texture(g,blob,url,color)
    dest=pbr if field=='DF' else m;dest[target]={'index':images[url]}
   if md.get('ORM') and not md.get('IgnoreORM'):
    url=md['ORM']
    if url not in images:images[url]=texture(g,blob,url,False)
    pbr['metallicRoughnessTexture']={'index':images[url]};m['occlusionTexture']={'index':images[url]}
   if md.get('Alpha') and md.get('DF'):
    im=Image.open(io.BytesIO(fetch(md['DF']))).convert('RGBA');alpha=Image.open(io.BytesIO(fetch(md['Alpha']))).convert('L');alpha=alpha.resize(im.size);im.putalpha(alpha);im.thumbnail((1024,1024));buf=io.BytesIO();im.save(buf,format='PNG',optimize=True)
    pbr['baseColorTexture']={'index':embedded(g,blob,buf.getvalue(),'image/png')};m['alphaMode']='BLEND'
   if md.get('Type')=='Disabled':pbr['baseColorFactor']=[0,0,0,0];m['alphaMode']='BLEND'
   if md.get('Type')=='Tritium':
    col=md.get('Color',{});pbr['baseColorFactor']=[float(col.get(k,1)) for k in ['R','G','B']]+[1]
   if md.get('NormalScale') and 'normalTexture' in m:m['normalTexture']['scale']=float(md['NormalScale'].get('X',1))
   em=md.get('Emissive',{}).get('Color',{});m['emissiveFactor']=[min(1,float(em.get(k,0))) for k in ['R','G','B']]
   if md.get('Type','').startswith('Glass'):
    col=md.get('Color',{});pbr['baseColorFactor']=[float(col.get(k,1)) for k in ['R','G','B']]+[float(md.get('Opacity',.65))];m['alphaMode']='BLEND'
   m['doubleSided']=True
  data=pack(g,blob);digest=hashlib.sha256(data).hexdigest();name=slug+'-'+variant['Name']+'.'+digest[:12];(DEST/(name+'.glb')).write_bytes(data)
  result['ch'].append('Base' if variant['Name']=='default' else variant['Name'].replace('-',' ').title())
  result['assets'].append({'model':'skins/'+name,'config':'models/valorant/skins/'+meta_path,'sha256':digest,'bytes':len(data),'source':'https://kingdomarchives.com/modelviewer/'+slug,'variant':variant['Name']})
 print('INSTALLED',w,slug,len(variants),'variants',flush=True)
 return cid,w,result

def main():
 jobs=[]
 for _,weapons in CATS:
  for w in weapons:
   slug='melee' if w=='Knife' else w.lower();s=fetch('modelviewer/'+slug).decode();a=s.index('id="skin-selector"');b=s.index('id="variant-selector"')
   for skin in re.findall(r'href="../modelviewer/([^\"]+)"',s[a:b]):
    if skin!=slug and not skin.startswith('ego-'):jobs.append((w,skin)) # Ego requires an unported custom source shader
 cols={};errors=[]
 with cf.ThreadPoolExecutor(max_workers=4) as pool:
  pending={pool.submit(install,j):j for j in jobs}
  for f in cf.as_completed(pending):
   try:
    item=f.result()
    if item:
     cid,w,skin=item
     cols.setdefault(cid,dict(id=cid,name=NAMES[cid],tier='Premium' if cid in ['prime','blastx'] else 'Select',desc='Original VALORANT model and textures.',pal={},cc={},k=0,skins={}))["skins"][w]=skin
   except Exception as e:errors.append([pending[f],repr(e)]);print('FAILED',pending[f],repr(e),flush=True)
 standard=dict(id='standard',name='Standard',tier='Standard',desc='The original factory finish.',pal={},cc={},k=0,skins={w:dict(n=w,ch=['Base']) for _,ws in CATS for w in ws})
 for c in cols.values():c['skins']={w:c['skins'][w] for _,ws in CATS for w in ws if w in c['skins']}
 catalog=dict(v=3,note='Original Riot Games weapon models, textures and native animation exports downloaded from Kingdom Archives. Local, on-demand assets; every listed nonstandard variant has an installed GLB. Fan project, not endorsed by Riot Games.',categories=CATS,collections=[standard]+[cols[k] for k in sorted(cols)])
 from enrich_valorant_skins import enrich
 enrich(catalog)
 (ROOT/'server/src/skins.json').write_text(json.dumps(catalog,indent=1,ensure_ascii=False)+'\n')
 (DEST/'sources.json').write_text(json.dumps({'retrieved':'2026-10-25','source':'https://kingdomarchives.com/models','errors':errors,'excluded':{'ego':'Requires an unported custom EgoPBR/text projection shader; no inaccurate substitute is offered.'},'models':sum(len(c['skins']) for c in cols.values()),'variants':sum(len(s['ch']) for c in cols.values() for s in c['skins'].values())},indent=2)+'\n')
 print('DONE',len(cols),'collections',sum(len(c['skins']) for c in cols.values()),'skins',len(errors),'errors',flush=True)
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
