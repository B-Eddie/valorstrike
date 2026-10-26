// hk-35 (browser qa_recent4 / fog4 follow-ups), on the real page (page_harness):
//  1. Sage Resurrection on a native map: the crystal rises out of the corpse's own floor (y0 - 1 -> y0 + 0.9), not out of
//     the legacy y 0 floor (it sat 8 m under Ascent's floor, so the 3.3 s channel had no visible crystal); the ally stands
//     after 2 + 1.3 s as before.
//  2. Footsteps: a heard runner always sounds - SFX.step's range = the server's hearing range (fog.js FOG.step 30 m; the page
//     cut at 25 m, so an online row for a hidden runner 25-30 m away played nothing); 31 m is silent.
//  3. The metal ring is the legacy maps' raised-floor rule only (native floors sit ~7 m up: every step rang metal there).
const assert=require('assert/strict'),path=require('path'),fs=require('fs');const {boot}=require('./page_harness.cjs');
(async()=>{
 const fog=fs.readFileSync(path.join(__dirname,'..','server','src','fog.js'),'utf8'),m=/FOG=Object\.freeze\(\{[^}]*\bstep:(\d+(?:\.\d+)?)/.exec(fog);assert.ok(m,'fog.js FOG.step found');
 const H=boot({real3:true,seed:5}),xe=H.xe,J=c=>JSON.parse(xe('JSON.stringify('+c+')'));
 // a live 5v5 for the page's units (as test_ability_parity.cjs)
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 H.$('pm5v5').click();await adv(50);
 for(let t=0;t<30000&&!(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'));t+=100){
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}await adv(100);}
 assert.ok(xe('running'),'5v5 did not start');xe('FV.buy=0;window.__god=1;true');
 // 1. Resurrection crystal over a raised (native-map-like) floor
 const rz=J(`(()=>{const a=allies.filter(Boolean)[0];if(!a)return ["no ally"];const pk=J.pick,P=player,o=[];J.pick="Sage";J.rz=null;J.ult=K().u;
   P.y=7;P.ch=0;yaw=0;pitch=0;a.g.position.set(P.x,7,P.z-5);a.alive=false;a.xm=null;sgKey("KeyX");if(!J.rz)return ["no channel",J.ult];
   o.push(+J.rz.m.position.y.toFixed(3));sgTick(2.65);o.push(+J.rz.m.position.y.toFixed(3),a.alive);sgTick(.6);o.push(+J.rz.m.position.y.toFixed(3),a.alive);sgTick(.1);o.push(a.alive,J.rz,a.hp);
   J.pick=pk;P.y=0;return o;})()`);
 assert.equal(rz[0],6,'crystal starts 1 m under the corpse floor (7): '+JSON.stringify(rz));
 assert.ok(rz[1]>6&&rz[1]<7.9&&rz[2]===false,'rising during the last 1.3 s, ally still down: '+JSON.stringify(rz));
 assert.ok(rz[3]>7.7&&rz[3]<=7.9&&rz[4]===false,'crystal near the top (floor + 0.9) at 3.25 s, ally still down: '+JSON.stringify(rz));
 assert.deepEqual(rz.slice(5),[true,null,100],'ally stands at 3.3 s with 100 HP: '+JSON.stringify(rz));
 // the bare channel object (no y0, as older callers build it) still rises from y -1 (legacy floor)
 const lg=J(`(()=>{const a=allies.filter(Boolean)[0];a.alive=false;J.rz={a,t:XPAR2.rez.w+XPAR2.rez.r,m:new THREE.Object3D()};sgTick(3.2);const y=+J.rz.m.position.y.toFixed(3);sgTick(.2);a.alive=true;return y;})()`);
 assert.ok(lg>-1&&lg<=0.9,'legacy channel object (no y0) rises from y -1: '+lg);
 // 2. step range = the server's hearing range
 assert.equal(J('SFX.stepR'),+m[1],'SFX.stepR = fog.js FOG.step');assert.equal(+m[1],30,'FOG.step 30 m');
 const st=J(`(()=>{const o=[],s0=sOk,c0=sCap;sOk=()=>true;sCap=(k)=>{o.push(k);return null;};try{for(const d of [5,24,28,29.9,31]){camera.position.set(0,1.6,0);SFX.step({x:d,y:0,z:0});o.push(d);}}finally{sOk=s0;sCap=c0;}return o;})()`);
 assert.deepEqual(st,['step',5,'step',24,'step',28,'step',29.9,31],'runner at 5 / 24 / 28 / 29.9 m reaches the step voice, 31 m is silent: '+JSON.stringify(st));
 // 3. metal ring: legacy raised floor yes, native map floor no
 const mt=J(`(()=>{const n0=typeof nmActive==="function"?nmActive:null,o=[xStepMetal(0),xStepMetal(0.5)];nmActive=()=>({});o.push(xStepMetal(7.05),xStepMetal(0.5));nmActive=n0||(()=>null);return o;})()`);
 assert.deepEqual(mt,[false,true,false,false],'metal: legacy 0 / 0.5, native 7.05 / 0.5: '+JSON.stringify(mt));
 {const pe=H.errors.filter(e=>e.phase!=='load');assert.equal(pe.length,0,'page errors after load: '+JSON.stringify(pe.slice(0,3)).slice(0,400));}
 console.log('test_rez_crystal_steps OK',JSON.stringify({rz,lg,st,mt}));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
