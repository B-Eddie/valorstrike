// vs-lane-mapdouble (user, LIVE b47807b: "all the maps are messed up now, it looks like there's a map on the map because
// there are walls, but they have no collision and looks like another map is inside this map"): while a match runs on an
// original (native) map, nothing of a legacy procedural map (FMAP[k].g / MAPS[k].g that is not the native root) may be drawn,
// and exactly one native-* root may be in the scene. Real page in the fake DOM (work/page_harness.cjs native:true: real
// nmEnsure on the repo's map files, collision from server/public/worlds) with a stand-in render scene (one marked mesh).
// Plays back-to-back matches across modes / maps from the lobby's own buttons and samples the scene while each runs.
//   node work/qa_map_double.cjs        [VERBOSE=1]
const path=require('path');const {boot,mulberry}=require('./page_harness.cjs');
const H=boot({real3:true,seed:3,native:true}),xe=H.xe,rnd=mulberry(17);
xe(`nmLoadScene=function(){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());m.name='nm-render';m.userData.nmRender=1;g.add(m);return Promise.resolve({scene:g,animations:[]});};true`);
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const errs0=H.errors.length;
// scene sample: legacy map groups drawn, native roots, the active native root drawn
const SAMPLE=`(()=>{const C=NM.current,vis=o=>{for(let p=o;p;p=p.parent){if(!p.visible)return false;if(p===scene)return true;}return false;};
 const groups=new Map();for(const k in FMAP)if(FMAP[k]&&FMAP[k].g)groups.set(FMAP[k].g,'FMAP.'+k);for(const k in MAPS)if(MAPS[k]&&MAPS[k].g&&!groups.has(MAPS[k].g))groups.set(MAPS[k].g,'MAPS.'+k);
 const stray=[];for(const [g,n] of groups){if(C&&g===C.M.g)continue;if(g.userData&&g.userData.nativeMap)continue;let k=0;g.traverse(o=>{if(o.isMesh&&vis(o))k++;});if(k)stray.push(n+':'+k);}
 const roots=scene.children.filter(c=>c.userData&&c.userData.nativeMap).map(c=>c.name+(c.visible?'':'(hidden)'));
 let nmDrawn=0;if(C)C.M.g.traverse(o=>{if(o.userData&&o.userData.nmRender&&vis(o))nmDrawn++;});
 return JSON.stringify({mode,map:FV.map,cur:C?C.key:null,stray,roots,nmDrawn,solidsNative:!!(C&&solids===C.M.solids)});})()`;
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const res=()=>xe('(typeof xResUp==="function"&&xResUp())')||H.shown('result');
const toLobby=async()=>{if(res())H.$('lobbyBtn').click();else if(xe('running')){H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();}await adv(2500);};
const PLAN=(process.env.PLAN||'retake:goBtn:-,dm:dmBtn:ascent,retake:goBtn:-,five:pm5v5:bind,dm:dmBtn:bind,tdm:tdmBtn:haven,esc:escBtn:split,sr:srBtn:lotus,retake:goBtn:-,five:pm5v5:ascent,duel:duelBtn:-,dm:dmBtn:breeze').split(',').map(s=>s.split(':'));
const fails=[];
(async()=>{let n=0;
 for(const [name,btn,map] of PLAN){n++;H.setPhase(`match ${n} ${name} ${map}`);
  if(map!=='-')xe(`FV.pick=${JSON.stringify(map)};window.xQPick=${JSON.stringify(map)};try{window.xQSetMap&&window.xQSetMap(FV.pick)}catch(e){}true`);
  H.$(btn).click();await adv(50);if(!(await through())){fails.push(`match ${n} ${name} ${map}: did not start`);await toLobby();continue;}
  for(let t=0;t<4;t++){await adv(700);const s=JSON.parse(xe(SAMPLE));if(process.env.VERBOSE&&t===0)console.log(n,name,map,JSON.stringify(s));
   const native=['dm','five','retake'].includes(xe('mode'))&&s.cur;
   if(native){if(s.stray.length)fails.push(`match ${n} ${name} ${map} t${t}: legacy map drawn over the native ${s.cur} (${s.stray.join(', ')}) mode ${s.mode}`);
    if(s.roots.length!==1)fails.push(`match ${n} ${name} ${map} t${t}: ${s.roots.length} native roots in the scene (${s.roots.join(', ')})`);
    if(!s.nmDrawn)fails.push(`match ${n} ${name} ${map} t${t}: native ${s.cur} not drawn`);}}
  await toLobby();}
 // races: a map load cancelled / replaced part-way (Cancel on the loading overlay, then another map), and a reselect of the
 // same / another map from the lobby while the first is still loading
 if(!process.env.NORACE)for(const d of (process.env.DELAYS||'0,100,300,600,1000,1600,2400').split(',').map(Number)){for(const how of ['cancel','reselect']){n++;const A=['ascent','haven','lotus'][n%3],B=['bind','split','breeze'][n%3];H.setPhase(`race ${how} ${d}ms ${A}->${B}`);
   xe(`FV.pick='${A}';window.xQPick='${A}';try{window.xQSetMap&&window.xQSetMap(FV.pick)}catch(e){}true`);H.$('dmBtn').click();await adv(d);const pend=xe('NM.pending?NM.pending.key:null');
   if(how==='cancel'){xe(`(()=>{const e=document.getElementById('nativeMapLoading');const c=e&&e.querySelector('[data-cancel]');if(c&&e.style.display!=='none')c.click();return 1})()`);await adv(200);if(xe('running'))await toLobby();}
   else{if(xe('running'))await toLobby();}
   xe(`FV.pick='${B}';window.xQPick='${B}';try{window.xQSetMap&&window.xQSetMap(FV.pick)}catch(e){}true`);H.$('dmBtn').click();await adv(50);
   if(!(await through())){fails.push(`race ${how} ${d}ms ${A}->${B}: did not start`);await toLobby();continue;}
   for(let t=0;t<4;t++){await adv(700);const s=JSON.parse(xe(SAMPLE));if(process.env.VERBOSE&&t===0)console.log('race',how,d,A,B,'pending@d',pend,JSON.stringify(s));
    if(s.stray.length)fails.push(`race ${how} ${d}ms ${A}->${B} t${t}: legacy map drawn (${s.stray.join(', ')}) native ${s.cur} map ${s.map}`);
    if(s.roots.length!==1)fails.push(`race ${how} ${d}ms ${A}->${B} t${t}: ${s.roots.length} native roots (${s.roots.join(', ')})`);
    if(s.cur!==B||s.map!==B||!s.nmDrawn||!s.solidsNative)fails.push(`race ${how} ${d}ms ${A}->${B} t${t}: playing ${s.map} on native ${s.cur} (drawn ${s.nmDrawn}, native collision ${s.solidsNative})`);}
   await toLobby();}}
 const errors=H.errors.slice(errs0);if(errors.length)fails.push('page exceptions: '+JSON.stringify(errors.slice(0,4)));
 if(fails.length){console.error([...new Set(fails)].slice(0,30).join('\n'));process.exit(1);}
 console.log(`Map double-draw: ${n} matches (${PLAN.map(p=>p[0]+(p[2]!=='-'?' '+p[2]:'')).join(', ')}): no legacy map drawn over a native map, one native root`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
