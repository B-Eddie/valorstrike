// No shader program is linked after the loading gate opens (gpu lane step 4, user 31 Oct 2026: "unplayable" lag, worst
// "when I'm getting shot at"). Real renderer probe (qa/gpu/hitbench.cjs PROBE=1, SwiftShader, offline 5v5 Ascent): 48
// programs at the gate, then 4 more on the first frames of the match, all in the viewmodel pass - the held Classic's
// rig (GN_BasePistol skinned body + magazine + Tritium sights, MeshStandardMaterial) and the agent's first-person arms
// (FP_<agent> skinned Lambert). The gate warmed every weapon glTF (xvFPPreload) but the held rigs themselves (agent arms +
// gun, built by xvFPWarm once the match runs) landed after the warm draw, so their programs were linked in-match (a link
// is a 20-200 ms frame on a real GPU driver). Now the gate builds the held rigs (xvFPRigs: the same xvFPGet calls
// xvFPWarm makes, capped) before its warm draw, which draws them once in the viewmodel pass.
// Checks on the real page (offline 5v5 Ascent, real three scene graph, the repo's .glb assets: page_harness glb), through
// the real loading gate: from the moment the overlay is gone, 4 s of play with the held native rig on screen and a
// weapon swap to the knife and back: no new program (perf_render_emu program keys, live phase only).
//   node work/test_late_programs.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {boot,lsStore}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,native:true,fastGlobal:true,glb:true,ls:lsStore([['vs.gq','low']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();await sleep(1);}};
const frames=async n=>{for(let i=0;i<n;i++){H.advance(17);await tick();await sleep(2);xe('__PS.endFrame();1');}};
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true'); // before the match: the gate's warm draws are seen
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);
 let ok=false;for(let t=0;t<90000;t+=50){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg')){ok=true;break;}
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>b.dataset.a==='Killjoy'&&!b.disabled)||tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
  await adv(50);}
 assert(ok,'match started through the loading gate');
 const at0=JSON.parse(xe('JSON.stringify({n:__PS.progs.size,ag:J.pick,fp:!!XV.fp})'));
 xe('__PS.endFrame();__PS.live=true;__PS.progNew.length=0;for(const b of bots)b.cd=1e9;for(const a of allies)a.cd=1e9;player.hp=1e4;true');
 let on=-1;for(let i=0;i<240;i++){await frames(1);if(on<0&&xe('!!(XV.fp&&XV.fp.root.visible)'))on=i;}
 assert(on>=0,'held native rig on screen after the gate');
 const swap=async k=>{H.key(k,true);H.key(k,false);await frames(60);};
 await swap('Digit3');await swap('Digit2');await swap('Digit3');await swap('Digit2');
 const late=JSON.parse(xe('JSON.stringify(__PS.progNew.map(p=>p.obj+" | "+String(p.key).slice(0,90)))'));
 console.log('gate',JSON.stringify(at0),'rig on frame',on,'late programs',late.length);for(const s of late)console.log('  LATE',s);
 assert.deepEqual(late,[],'no shader program linked after the loading gate opened');
 console.log(`late programs: 0 after the loading gate (${at0.n} at the gate, agent ${at0.ag}, held rig on frame ${on}, knife swaps)`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
