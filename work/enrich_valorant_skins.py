import json,re,hashlib,concurrent.futures
from import_valorant import fetch,OUT
def enrich(cat):
 api=json.loads(fetch('https://valorant-api.com/v1/weapons'))['data'];dest=OUT/'skins/icons';dest.mkdir(exist_ok=True)
 norm=lambda s:re.sub('[^a-z0-9]','',s.lower())
 jobs=[]
 for c in cat['collections'][1:]:
  for w,s in c['skins'].items():
   weapon=next(x for x in api if x['displayName']==('Melee' if w=='Knife' else w))
   matches=[x for x in weapon['skins'] if norm(x['displayName']).startswith(norm(c['name'])) and not (c['id']=='prime' and '//2.0' in x['displayName']) and not (c['id']=='prism' and ('II' in x['displayName']))]
   if not matches:print('UNMATCHED',c['name'],w);continue
   row=matches[0];s['n']=row['displayName'].strip()
   for a in s['assets']:
    chroma=next((x for x in row['chromas'] if re.search(r'\b'+re.escape(a['variant'])+r'\b',x['displayName'],re.I)),None) if a['variant']!='default' else row['chromas'][0]
    url=(chroma or {}).get('displayIcon') or (chroma or {}).get('fullRender') or row.get('displayIcon') or row['chromas'][0].get('fullRender')
    if url:jobs.append((a,url))
 def run(j):
  a,url=j;raw=fetch(url);name=hashlib.sha256(raw).hexdigest()[:16]+'.png';(dest/name).write_bytes(raw);a['icon']='models/valorant/skins/icons/'+name;a['iconSource']=url
 for w,s in cat['collections'][0]['skins'].items():
  weapon=next(x for x in api if x['displayName']==('Melee' if w=='Knife' else w))
  row=next((x for x in weapon['skins'] if x['uuid']==weapon['defaultSkinUuid']),None)
  if row:
   # the default skin's own displayIcon is Riot's grey "X" placeholder for every weapon released with the game (only Bandit,
   # Warden, Outlaw have a real one), so the chroma's full render (the factory-finish gun) comes first
   url=row['chromas'][0].get('fullRender') or row.get('displayIcon')
   if url:jobs.append((s,url))
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(run,jobs))
