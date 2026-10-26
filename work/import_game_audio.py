"""Download and package game audio with source URLs, reviewed cuts and content hashes.
Raw downloads live in /tmp; ffmpeg makes small browser-compatible mono MP3s.
"""
from pathlib import Path
import concurrent.futures as cf,json,re,subprocess,hashlib,zipfile,io,sys,array,math,urllib.parse,threading
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'audio';CACHE=Path('/tmp/valorstrike-audio-source');CACHE.mkdir(exist_ok=True);DEST.mkdir(exist_ok=True)
LOCKS={};LOCK=threading.Lock()
def fetch(url):
 with LOCK: lock=LOCKS.setdefault(url,threading.Lock())
 with lock:return _fetch(url)
def _fetch(url):
 p=CACHE/hashlib.sha256(url.encode()).hexdigest()
 if not p.exists():subprocess.run(['curl','-fLsS','--retry','2','--max-time','90',url,'-o',str(p)+'.part'],check=True);Path(str(p)+'.part').rename(p)
 return p
API=json.loads(fetch('https://valorant-api.com/v1/weapons').read_text())['data'];CAT=json.loads((ROOT/'server/src/skins.json').read_text())
def norm(s):return re.sub('[^a-z0-9]','',s.lower())
def row(w,c=None):
 weapon=next(x for x in API if x['displayName']==('Melee' if w=='Knife' else w))
 if c:
  cname=next(x['name'] for x in CAT['collections'] if x['id']==c)
  return next(s for s in weapon['skins'] if norm(s['displayName']).startswith(norm(cname)) and not(c=='prime' and '//2.0' in s['displayName']))
 return next(s for s in weapon['skins'] if s['levels'][0]['streamedVideo'])
def previews():
 jobs={}
 for _,ws in CAT['categories']:
  for w in ws:
   if w=='Knife':continue
   jobs['standard/'+w]=row(w)['levels'][0]['streamedVideo']
 for c in ['prime','blastx']:
  col=next(x for x in CAT['collections'] if x['id']==c)
  for w in col['skins']:
   levels=row(w,c)['levels'];jobs[c+'/'+w]=levels[min(1,len(levels)-1)]['streamedVideo']
   if c=='prime' and w!='Knife':jobs[c+'/'+w+'/reload']=levels[2]['streamedVideo']
   if c=='blastx' and w!='Knife':jobs[c+'/'+w+'/equip']=levels[2]['streamedVideo']
 for c in ['blackmarket','mk-vii-liberty','silkleaf','task-force-809']:
  levels=row('Knife',c)['levels'];url=next((l['streamedVideo'] for l in reversed(levels) if l['streamedVideo']),None)
  if url:jobs[c+'/Knife']=url
 def get(j):
  k,u=j
  if not u:return k,None
  p=fetch(u);dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]));return k,{'url':u,'path':str(p),'duration':dur}
 with cf.ThreadPoolExecutor(max_workers=5) as pool:out=dict(pool.map(get,jobs.items()))
 (CACHE/'previews.json').write_text(json.dumps(out,indent=1));return out
FILES={}
def clip(key,path,source,start=0,duration=None,gain=1):
 job={'source':source,'start':start,'duration':duration,'gain':gain,'encoding':1};meta=CACHE/(hashlib.sha256(key.encode()).hexdigest()+'.json')
 if meta.exists():
  old=json.loads(meta.read_text())
  if old.get('job')==job and (ROOT/old['file']['url']).exists():FILES[key]=old['file'];return key
 tmp=CACHE/(hashlib.sha256(key.encode()).hexdigest()+'.mp3');cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(path)]
 if duration:cmd+=['-t',str(duration)]
 cmd+=['-vn','-ac','1','-ar','44100','-af',f'volume={gain},afade=t=in:d=0.003,alimiter=limit=0.9','-c:a','libmp3lame','-b:a','96k',str(tmp)];subprocess.run(cmd,check=True)
 b=tmp.read_bytes();sha=hashlib.sha256(b).hexdigest();rel=key.replace('/','-')+'.'+sha[:12]+'.mp3';(DEST/rel).write_bytes(b);dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(tmp)]));FILES[key]={'url':'audio/'+rel,'sha256':sha,'bytes':len(b),'duration':dur,'source':source,'cut':[start,duration]};meta.write_text(json.dumps({'job':job,'file':FILES[key]}));return key
PACKS={'impact':'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip','scifi':'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip','ui':'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip'}
def kenney():
 for name,url in PACKS.items():
  z=zipfile.ZipFile(fetch(url));(DEST/(name+'-LICENSE.txt')).write_bytes(z.read('License.txt'))
  for f in z.namelist():
   if not f.endswith('.ogg'):continue
   stem=Path(f).stem;target=CACHE/(name+'-'+stem+'.ogg');target.write_bytes(z.read(f));clip(name+'/'+stem,target,url)
# Reload intervals reviewed against contact sheets from the actual Riot previews.
RELOAD={'Classic':(9.7,1.8),'Shorty':(14.8,1.75),'Frenzy':(7.05,1.6),'Ghost':(9.2,1.8),'Sheriff':(7.5,2),'Stinger':(9.5,2),'Spectre':(15,2.25),'Bucky':(5.5,2.5),'Judge':(13,2.2),'Bulldog':(14.1,2.2),'Guardian':(9.3,2),'Phantom':(15.5,2.2),'Vandal':(10.1,2.5),'Marshal':(10.8,2),'Outlaw':(12.3,2.9),'Operator':(14,3),'Ares':(15.1,2.5),'Odin':(17.9,3.8)}
PRIME_RELOAD={'Classic':(1.35,1.75),'Spectre':(1.35,2.25),'Guardian':(1.35,2.5),'Vandal':(1.35,2.5)}
BLAST={'Frenzy':{'fire':(4.8,.3),'reload':(1.2,1.5),'equip':(.7,1),'inspect':(2.7,2.2)},'Spectre':{'fire':(5.9,.18),'reload':(2.5,2.25),'equip':(.6,1.3),'inspect':(3.6,2.2)},'Phantom':{'fire':(6.0,.2),'reload':(3.15,2.5),'equip':(.65,1.3),'inspect':(.4,2.2)},'Odin':{'fire':(10.8,.2),'reload':(4.2,5),'equip':(.7,1.4),'inspect':(.8,2.2)}}
ABILITY={'dash':'Tailwind','updraft':'Updraft','bsDraw':'Blade_Storm','bsThrow':'Blade_Storm','bow':'Recon_Bolt','shock':'Shock_Bolt','recon':'Recon_Bolt','drone':'Owl_Drone','turret':'Turret','tShot':'Turret','alarm':'Alarmbot','nanoSet':'Nanoswarm','nano':'Nanoswarm','lockdown':'Lockdown','omenStep':'Shrouded_Step','paranoia':'Paranoia','shadows':'From_the_Shadows','blaze':'Blaze','rewind':'Run_it_Back','rewindBack':'Run_it_Back','leer':'Leer','devour':'Devour','dismiss':'Dismiss','empress':'Empress','slow':'Slow_Orb','choir':'Resurrection'}
def first_shot(p):
 raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(p),'-vn','-ac','1','-ar','22050','-f','s16le','-']);x=array.array('h',raw);n=110;env=[math.sqrt(sum(float(v)*v for v in x[i:i+n])/n) for i in range(0,len(x)-n,n)];peak=max(env,default=0)
 if peak<1:raise ValueError('Silent preview')
 i=next(i for i,v in enumerate(env) if v>peak*.58)
 # Trace the attack back to its onset, retaining quiet gun transients before the loudest frame.
 j=i
 while j>0 and i-j<18 and env[j-1]>peak*.025:j-=1
 return max(0,j*n/22050-.008)
def wiki_api(args):return json.loads(fetch('https://wiki.playvalorant.com/en-us/api.php?'+urllib.parse.urlencode(dict(action='query',format='json',**args))).read_text())
def extras():
 for c,title in [('prime','Prime'),('blastx','BlastX')]:
  for i in range(1,6):
   u=f'https://wiki.playvalorant.com/en-us/images/{title}_Kill_{i}.mp3';clip(c+'/kill'+str(i),fetch(u),u)
  u=f'https://wiki.playvalorant.com/en-us/images/{title}_Finisher_Showcase.mp4';clip(c+'/finisher',fetch(u),u)
  u=f'https://wiki.playvalorant.com/en-us/images/{title}_Kill_Banner.png';raw=fetch(u).read_bytes();(DEST/(c+'-kill-banner.png')).write_bytes(raw)
 for key,u,dur in [('wind','https://opengameart.org/sites/default/files/wind%20woosh%20loop.ogg',8),('water','https://opengameart.org/sites/default/files/atmosbasement.mp3_.flac',4)]:clip('ambient/'+key,fetch(u),u,0,dur)
 announcer=wiki_api(dict(list='categorymembers',cmtitle='Category:Announcer',cmlimit=500))['query']['categorymembers']
 for a in announcer:
  if a['title'].endswith('.mp3'):
   name=a['title'][5:];u='https://wiki.playvalorant.com/en-us/images/'+urllib.parse.quote(name.replace(' ','_'));clip('voice/'+name[:-4],fetch(u),u)
 for ag in ['Jett','Phoenix','Sova','Sage','Reyna','Raze','Killjoy','Omen','Skye','Chamber','Breach','Cypher']:
  d=wiki_api(dict(list='allimages',aiprefix=ag+'Death',ailimit=10))['query']['allimages']
  for i,a in enumerate(d[:3]):clip('death/'+ag+str(i),fetch(a['url']),a['url'])
 abilities={}
 # Actual short ability demonstrations. Recorded non-Riot CC0 effects fill events without a public showcase.
 for key,title in ABILITY.items():
  d=wiki_api(dict(list='allimages',aiprefix=title,ailimit=50))['query']['allimages'];a=next((a for a in d if a['name'].endswith('Showcase.mp4')),None)
  if not a:continue
  p=fetch(a['url'])
  try:start=first_shot(p)
  except (ValueError,subprocess.CalledProcessError):print('Silent ability showcase, using recorded effect:',key,flush=True);continue
  abilities[key]=clip('ability/'+key,p,a['url'],start,2.0)
 return abilities

ABILITY_FALLBACK={'dash':'scifi/thrusterFire_000','updraft':'scifi/thrusterFire_001','bsDraw':'scifi/laserRetro_002','bsThrow':'scifi/laserSmall_001','bow':'impact/impactWood_light_000','shock':'scifi/laserLarge_000','recon':'scifi/computerNoise_002','drone':'scifi/engineCircular_000','turret':'scifi/laserRetro_000','tShot':'scifi/laserSmall_002','alarm':'scifi/computerNoise_000','nanoSet':'ui/switch_003','nano':'scifi/forceField_002','lockdown':'scifi/spaceEngineLow_000','omenStep':'scifi/forceField_003','paranoia':'scifi/forceField_004','shadows':'scifi/spaceEngineSmall_000','blaze':'scifi/thrusterFire_003','rewind':'scifi/spaceEngine_000','rewindBack':'scifi/forceField_000','leer':'scifi/slime_000','devour':'scifi/forceField_001','dismiss':'scifi/forceField_003','empress':'scifi/spaceEngineLow_001','slow':'impact/impactGlass_medium_000','choir':'ui/confirmation_004'}
def build():
 data=json.loads((CACHE/'previews.json').read_text()) if (CACHE/'previews.json').exists() else previews();weapons={};skins={}
 for w,(at,dur) in RELOAD.items():
  key='standard/'+w;v=data[key];p=Path(v['path']);fire=first_shot(p);weapons[w]={'fire':clip(key+'/fire',p,v['url'],fire,.32 if w not in ['Marshal','Operator'] else .65),'reload':clip(key+'/reload',p,v['url'],at,min(dur,v['duration']-at)),'equip':clip(key+'/equip',p,v['url'],.1,.55) if w!='Judge' else 'impact/impactMetal_light_001'}
 v=row('Knife','prime')['levels'][0]['streamedVideo'];p=fetch(v);weapons['Knife']={k:clip('standard/Knife/'+k,p,v,*cut) for k,cut in {'knife':(first_shot(p),.4),'equip':(.05,.7),'inspect':(5.0,2.2)}.items()}
 for c in ['prime','blastx']:
  skins[c]={}
  for w in next(x for x in CAT['collections'] if x['id']==c)['skins']:
   key=c+'/'+w;v=data[key];p=Path(v['path'])
   if w=='Knife':
    times={'prime':{'knife':(2.6,.45),'equip':(.05,.8),'inspect':(5.0,3)},'blastx':{'knife':(.9,.5),'equip':(.15,.8),'inspect':(4.2,3)}}[c]
   elif c=='prime':times={'fire':(first_shot(p),.32)}
   else:times={k:v for k,v in BLAST[w].items() if k!='equip'}
   skins[c][w]={k:clip(key+'/'+k,p,v['url'],*cut) for k,cut in times.items()}
   if c=='prime' and w!='Knife':
    v=data[key+'/reload'];skins[c][w]['reload']=clip(key+'/reload',v['path'],v['url'],*PRIME_RELOAD[w])
   if c=='blastx' and w!='Knife':
    v=data[key+'/equip'];skins[c][w]['equip']=clip(key+'/equip',v['path'],v['url'],*BLAST[w]['equip'])
 if data.get('blackmarket/Knife'):
  v=data['blackmarket/Knife'];skins['blackmarket']={'Knife':{k:clip('blackmarket/Knife/'+k,v['path'],v['url'],*cut) for k,cut in {'knife':(18.3,.55),'equip':(2.0,1),'inspect':(7.4,3.2)}.items()}}
 kenney();abilities=extras()
 for key,title in ABILITY.items():abilities.setdefault(key,ABILITY_FALLBACK[key])
 manifest={'v':1,'files':FILES,'weapons':weapons,'skins':skins,'abilities':abilities,'sources':{'Riot':'Original game audio extracted from publicly downloadable Riot skin previews and VALORANT Wiki media. © Riot Games.','Kenney':'Recorded CC0 impact, sci-fi and interface assets; license files alongside the audio.','OpenGameArt':'CC0 wind by SketchMan3 / JaggedStone and dripping water by Independent.nu / qubodup. Source pages: https://opengameart.org/content/wind-whoosh-loop and https://opengameart.org/content/dripping-water-loop.'}}
 (DEST/'manifest.json').write_text(json.dumps(manifest,indent=1)+'\n');print('Installed',len(FILES),'audio clips',sum(v['bytes'] for v in FILES.values()),'bytes',flush=True)
if __name__=='__main__':
 if '--fetch' in sys.argv:
  d=previews();print(json.dumps({k:round(v['duration'],2) for k,v in d.items() if v},indent=1))
 else:build()
