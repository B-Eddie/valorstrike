from import_valorant import *
def run(slug):
 s=fetch('modelviewer/jett-fp?held='+slug).decode();out={}
 for key in ['WEAPONS_ANIMS_JSON','MODEL_HELD_JSON']:
  r=re.search(r'const '+key+r" = JSON.parse\('(.*?)'\);",s)
  if r:out[key]=json.loads(json.loads('"'+r.group(1).replace('"','\\"')+'"'))
 for d in out.values():
  for a in d.get('Animations',[]):
   if a.get('Type')=='External':
    dest=OUT/'animations'/(a['File']+'.glb');dest.parent.mkdir(exist_ok=True)
    if not dest.exists():dest.write_bytes(fetch(a['Path']+a['File']+'.glb'))
 (OUT/'animations'/(slug+'.json')).write_text(json.dumps(out,indent=2));return slug
if __name__=='__main__':
 slugs=['classic','shorty','frenzy','ghost','sheriff','stinger','spectre','bucky','judge','bulldog','guardian','phantom','vandal','marshal','outlaw','operator','ares','odin','melee']
 with cf.ThreadPoolExecutor(max_workers=6) as ex:
  for s in ex.map(run,slugs):print(s,flush=True)
