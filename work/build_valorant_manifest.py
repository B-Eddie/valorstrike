from import_valorant import *
manifest={}
for p in OUT.glob('*.json'):
 if not p.name.endswith('-locomotion.json'):manifest[p.stem]=json.loads(p.read_text())
for p in (OUT/'animations').glob('*.json'):manifest.setdefault('weaponAnimations',{})[p.stem]=json.loads(p.read_text())
(OUT/'manifest.js').write_text('window.VALORANT_ASSETS = '+json.dumps(manifest,separators=(',',':'))+';\n')
