// First draw of a newly bought / swapped-to gun does not hitch (gundraw lane, 2026-10-30). The first-person view of every
// gun is the native rig (work/valorant_runtime.js xvFPLoad: the agent's -fp arms + the weapon glTF + the weapon's FP_/GN_
// animation files). Only the held weapon, the knife and the Classic were loaded at match start (xvFPWarm), so buying any
// other gun loaded and parsed its animation files mid-round (the biggest piece: ~70-200 ms CPU per gun in this harness,
// GLTFLoader building every keyframe track on the main thread), and the frame after the rig was built uploaded the weapon's
// skinned geometry and linked its viewmodel-pass program (perf_render_emu: 6-7 new geometries + 1 program on the first
// Phantom). Now the loading gate preloads every gun the mode can hold (offline 5v5: every gun in the buy menu) behind the
// overlay and draws each weapon model once in the viewmodel pass there, so a buy / swap only clones the rig (a few ms).
// Checks on the real page (offline 5v5 Ascent, real three scene graph, the repo's .glb assets served: page_harness glb),
// through the real loading gate, then in the buy phase for each gun bought (primaries swap in, sidearms by key 2), from
// the buy until its native rig is on screen and a few frames after:
//  - no glTF parse (its arms / weapon / animation files were all loaded behind the overlay)
//  - no new shader program, no new geometry buffer, no texture upload (perf_render_emu counts, live phase only)
// Bandit and Warden are left out: they have no entry in the skins table (xskAsset throws), so they never get a native rig.
//   node work/test_gun_draw_warm.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {boot,lsStore}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,native:true,fastGlobal:true,glb:true,ls:lsStore([['vs.gq','medium']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();await sleep(1);}};
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true'); // before the match: the gate's warm draws are seen
xe(`window.__GD={parse:0,clone:0};{const P=THREE.GLTFLoader.prototype,p=P.parse;P.parse=function(){if(__PS.live)__GD.parse++;return p.apply(this,arguments);};
 const c=THREE.SkeletonUtils.clone;THREE.SkeletonUtils.clone=function(){if(__PS.live)__GD.clone++;return c.apply(this,arguments);};}true`);
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);
 let ok=false;for(let t=0;t<60000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg')){ok=true;break;}
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>b.dataset.a==='Jett'&&!b.disabled)||tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
  await adv(100);}
 assert(ok,'match started through the loading gate');
 // the static gun models (xGmLoad, started at mode launch) and the held rig: in before the measured phase either way
 for(let i=0;i<400&&!xe('XGM.rdy&&!!XV.fp');i++)await adv(50);
 assert(xe('XGM.rdy&&!!XV.fp'),'gun models and the held native rig loaded');
 xe('for(const b of bots)b.cd=1e9;for(const a of allies)a.cd=1e9;FV.buy=1e4;FV.cr=1e6;player.hp=1e4;true');await adv(300);
 const res=[];
 for(const [w,key] of [['Vandal'],['Sheriff','Digit2'],['Phantom'],['Ghost','Digit2'],['Operator'],['Spectre'],['Judge'],['Odin']]){
  xe('__PS.endFrame();__PS.live=true;__GD.parse=0;__GD.clone=0;FV.cr=1e6;FV.buy=1e4;player.hp=1e4;true');
  const E={prog:0,geo:0,tex:0},progs=[];
  xe(`fBuy(${JSON.stringify(w)});true`);if(key){H.key(key,true);H.key(key,false);}
  let on=-1;for(let i=0;i<400;i++){H.advance(17);await tick();await sleep(2);const e=JSON.parse(xe('JSON.stringify(__PS.endFrame())'));E.prog+=e.prog||0;E.geo+=e.geo||0;E.tex+=e.tex||0;
   if(on<0&&xe(`!!(XV.fp&&XV.fp.w===${JSON.stringify(w)}&&XV.fp.root.visible)`))on=i;if(on>=0&&i>=on+6)break;}
  progs.push(...JSON.parse(xe('JSON.stringify(__PS.progNew.splice(0).map(p=>p.obj+" | "+p.key.slice(0,100)))')));
  const G=JSON.parse(xe('JSON.stringify(__GD)'));xe('__PS.live=false;true');
  const r={w,onFrame:on,parse:G.parse,clone:G.clone,...E,progs:progs.slice(0,2)};res.push(r);console.log('GUN',JSON.stringify(r));
 }
 for(const r of res){
  assert(r.onFrame>=0,`${r.w}: native rig on screen after the buy`);
  assert.equal(r.parse,0,`${r.w}: no glTF parse mid-round (arms / weapon / animations loaded behind the loading overlay)`);
  assert.equal(r.prog,0,`${r.w}: no shader program linked by its first draw (${r.progs.join(' ; ')})`);
  assert.equal(r.geo,0,`${r.w}: no geometry buffer uploaded by its first draw`);
  assert.equal(r.tex,0,`${r.w}: no texture uploaded by its first draw`);
 }
 assert.deepEqual(H.errors.slice(0,3),[],'no page errors');
 console.log('test_gun_draw_warm: PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
