from pathlib import Path
import re
root=Path(__file__).resolve().parents[1];p=root/'index.html';s=p.read_text()
a='// ---- VALORANT ASSET INTEGRATION ----';b='// ---- END VALORANT ASSET INTEGRATION ----'
if a in s:s=s[:s.index(a)]+s[s.index(b)+len(b):]
block=(root/'work/valorant_runtime.js').read_text();
na='// ---- ORIGINAL VALORANT MAPS ----';nb='// ---- END ORIGINAL VALORANT MAPS ----'
if na in s:s=s[:s.index(na)]+s[s.index(nb)+len(nb):]
fa='// ---- VALORANT FEEL ----';fb='// ---- END VALORANT FEEL ----'
if fa in s:s=s[:s.index(fa)]+s[s.index(fb)+len(fb):]
block+='\n'+(root/'work/native_maps_runtime.js').read_text()+'\n'+(root/'work/feel_runtime.js').read_text();ra='// Repair pass: bone-following damage volumes and joint-constrained corpse physics.';rb='// ---- END REPAIR PASS ----'
if ra in s:s=s[:s.index(ra)]+s[s.index(rb)+len(rb):]
block+='\n'+(root/'work/repair_runtime.js').read_text();sa='// ---- TRUSTED ONLINE SERVER ----';sb='// ---- END TRUSTED ONLINE SERVER ----'
if sa in s:s=s[:s.index(sa)]+s[s.index(sb)+len(sb):]
block+='\n'+(root/'work/server_runtime.js').read_text();ga='// ---- WEAPON GRIP ----';gb='// ---- END WEAPON GRIP ----'
if ga in s:s=s[:s.index(ga)]+s[s.index(gb)+len(gb):]
block+='\n'+(root/'work/grip_runtime.js').read_text().rstrip('\n');ta='// ---- FOOT PLANTING ----';tb='// ---- END FOOT PLANTING ----'
if ta in s:s=s[:s.index(ta)]+s[s.index(tb)+len(tb):]
block+='\n'+(root/'work/feet_runtime.js').read_text().rstrip('\n');ha='// ---- LOCALIZED HIT FEEDBACK ----';hb='// ---- END LOCALIZED HIT FEEDBACK ----'
if ha in s:s=s[:s.index(ha)]+s[s.index(hb)+len(hb):]
block+='\n'+(root/'work/hit_feedback_runtime.js').read_text().rstrip('\n');qa='// ---- ABILITY EQUIP ----';qb='// ---- END ABILITY EQUIP ----'
if qa in s:s=s[:s.index(qa)]+s[s.index(qb)+len(qb):]
# Sova bolt flight + Jett Cloudburst flight: the shared vendor/sova-bolt.cjs and vendor/cloudburst.cjs (UMD, set window.SovaBolt / window.Cloudburst; the server imports the same files) head the block.
block+='\n'+(root/'work/ability_equip_runtime.js').read_text().rstrip('\n').replace(qa,qa+'\n'+(root/'vendor/sova-bolt.cjs').read_text().rstrip('\n')+'\n'+(root/'vendor/cloudburst.cjs').read_text().rstrip('\n'),1);va='// ---- BOT VARIETY ----';vb='// ---- END BOT VARIETY ----'
if va in s:s=s[:s.index(va)]+s[s.index(vb)+len(vb):]
# Bot variety: the shared vendor/bot-routes.cjs (UMD, sets window.BotRoutes) is inlined at the head of the block.
fa2='// ---- ABILITY FIRST PERSON ----';fb2='// ---- END ABILITY FIRST PERSON ----'
if fa2 in s:s=s[:s.index(fa2)]+s[s.index(fb2)+len(fb2):]
block+='\n'+(root/'work/ability_fp_runtime.js').read_text().rstrip('\n')
block+='\n'+(root/'work/bot_variety_runtime.js').read_text().rstrip('\n').replace(va,va+'\n'+(root/'vendor/bot-routes.cjs').read_text().rstrip('\n'),1);da='// ---- DEBUG HOOKS ----';db='// ---- END DEBUG HOOKS ----'
if da in s:s=s[:s.index(da)]+s[s.index(db)+len(db):]
block+='\n'+(root/'work/debug_runtime.js').read_text().rstrip('\n');ka='// ---- WEAPON SKINS ----';kb='// ---- END WEAPON SKINS ----'
if ka in s:s=s[:s.index(ka)]+s[s.index(kb)+len(kb):]
block+='\n'+(root/'work/skins_runtime.js').read_text().rstrip('\n').replace('/*SKINS_JSON*/null',(root/'server/src/skins.json').read_text().strip());
aa='// ---- DOWNLOADED GAME AUDIO ----';ab='// ---- END DOWNLOADED GAME AUDIO ----'
if aa in s:s=s[:s.index(aa)]+s[s.index(ab)+len(ab):]
block+='\n'+(root/'work/audio_runtime.js').read_text().rstrip('\n').replace('/*GAME_AUDIO_JSON*/null',__import__('json').dumps(__import__('json').loads((root/'audio/manifest.json').read_text()),separators=(',',':')))
za='// ---- SKIN FINISHERS ----';zb='// ---- END SKIN FINISHERS ----'
if za in s:s=s[:s.index(za)]+s[s.index(zb)+len(zb):]
block+='\n'+(root/'work/finishers_runtime.js').read_text().rstrip('\n');mark='xReady = true; // every mode is initialised; lobby launches may now start them';s=s.replace(mark,block+'\n'+mark)
if '<script src="models/valorant/manifest.js"></script>' not in s:s=s.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>','<script src="models/valorant/manifest.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>')
# Find the actual three script tag, which may use an onerror handler.
if '<script src="models/valorant/manifest.js"></script>' not in s:s=s.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js"></script>','<script src="models/valorant/manifest.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js"></script>')
start=s.index('  F: { Classic:',s.index('var XGM ='));end=s.index('\nfunction xGmFiles',start)
weapons='Classic Shorty Frenzy Ghost Sheriff Stinger Spectre Bucky Judge Bulldog Guardian Phantom Vandal Marshal Outlaw Operator Ares Odin Knife'.split()
s=s[:start]+'  F: { '+', '.join(w+': "valorant/'+('melee' if w=='Knife' else w.lower())+'"' for w in weapons)+' },\n  V: {} };'+s[end:]
s=s.replace('XGM.src[k] = g && g.scene; done();','XV.guns[k] = g; XGM.src[k] = g && xvStatic(g, XV.config[k.split("/").pop()]); done();')
s=s.replace('else rot.rotation.y = Math.PI / 2; // source guns point +X with +Y up; the knife blade points +Y','else rot.rotation.y = -Math.PI / 2; // native Valorant weapons point -X')
s=s.replace('if (w === "Knife") rot.rotation.set(-Math.PI / 2, 0, Math.PI / 2, "ZXY");','if (w === "Knife") rot.rotation.set(0, -Math.PI / 2, 0);')
s=s.replace('"models/decor/" + name + ".glb"','"models/valorant/environment/" + name + ".glb"')
s=re.sub(r'<p class="x-foot">.*?</p>','<p class="x-foot">Fan project. Not affiliated with or endorsed by Riot Games. VALORANT models, textures and native animations © Riot Games, sourced via Kingdom Archives. Original map scenes from the community Blender ports by Cracker646. Movement animations retargeted from Quaternius (CC0). See models/valorant/SOURCES.md.</p>',s,count=1)
if '<script src="vendor/three-mesh-bvh.umd.js"></script>' not in s:s=s.replace('<script src="models/valorant/manifest.js"></script>','<script src="models/valorant/manifest.js"></script>\n<script src="vendor/three-mesh-bvh.umd.js"></script>')
# Bot sight and fire origins must follow native map elevation.
for owner in ['a','b','o']:
 s=s.replace(owner+'.g.position.x, 1.5, '+owner+'.g.position.z',owner+'.g.position.x, '+owner+'.g.position.y + 1.5, '+owner+'.g.position.z')
for name in ['p','q']:
 for h in ['1.5','1.6','1.7','1.75']:
  s=s.replace('.set('+name+'.x, '+h+', '+name+'.z)', '.set('+name+'.x, ('+name+'.y || 0) + '+h+', '+name+'.z)')
s=s.replace('const inSite = (p) => Object.keys(SITES).find((k) => Math.abs(p.x - SITES[k][0]) < 7 && Math.abs(p.z - SITES[k][1]) < 6);', 'const inSite = (p) => { const C=typeof nmActive === \"function\" && nmActive(); if(C && C.plants) return nmPlant(C,p.x,p.z); return Object.keys(SITES).find((k) => Math.abs(p.x - SITES[k][0]) < 7 && Math.abs(p.z - SITES[k][1]) < 6); };')
for name in ['p','q']:
 for h in ['1.5','1.6','1.7','1.75']:
  s=s.replace('.set('+name+'.x, '+name+'.y + '+h+', '+name+'.z)', '.set('+name+'.x, ('+name+'.y || 0) + '+h+', '+name+'.z)')
for src in ['models/valorant/weapon-calibration.js','vendor/valorant-feel.js','models/valorant/agents/manifest.js','vendor/hit-impact.js']:
 if '<script src="'+src+'"></script>' not in s:s=s.replace('<script src="models/valorant/manifest.js"></script>', '<script src="models/valorant/manifest.js"></script>\n<script src="'+src+'"></script>')
s=re.sub(r'\n{3,}(?=// ---- VALORANT ASSET INTEGRATION ----)', '\n\n', s)
# Preserve elevation when handing the visible rig and weapon to corpse animation.
s=s.replace('c.m.position.set(p.x, 0, p.z)', 'c.m.position.set(p.x, p.y, p.z)')
s=s.replace('gn.position.set(p.x + Math.sin(ry + 1.2) * 0.7, 0.05, p.z + Math.cos(ry + 1.2) * 0.7)', 'gn.position.set(p.x + Math.sin(ry + 1.2) * 0.7, p.y + 0.05, p.z + Math.cos(ry + 1.2) * 0.7)')
p.write_text(s)
