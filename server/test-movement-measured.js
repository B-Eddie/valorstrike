// Movement constants matched to measured VALORANT values (Jeff 2026-11-03: "go through every value and change it so its
// valorant measured values"; work/validation/movement-audit-2026-11-03.md):
//  1. crouch eye drop 0.40 m (Stark: 10 crouches over a 400 u square = 40 u each): a held crouch settles the motor at
//     ch = 0.40 (eye 1.6 -> 1.2 m), the capsule at 1.4 m, the crouched head hitbox 0.40 m lower, an air tuck at 0.20 m;
//  2. tagging = the game-file curve (valorant.gs Vandal: min tagging speed 15 %, 0.75 s curve; wiki 72.5 % slow): x0.275 at
//     the hit, back to full linearly over 0.75 s, never under 15 %; the server (simulation.js tagHit / tagMul) and the page
//     prediction (index.html xTagK on the shared motor) give the same multiplier and the same positions at 40 and 60 Hz;
//  3. no landing movement lock (VALORANT has none; the old unread C.landingLock / P.lp is gone): landing keeps momentum.
// Plus the motor pair stays byte-identical.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
import {tagHit,tagMul} from './src/simulation.js';import {poseOf,hitVolumes} from './src/hitboxes.js';
const require=createRequire(import.meta.url),M=require('./src/motor.cjs');
assert.equal(await fs.readFile('src/motor.cjs','utf8'),await fs.readFile('../vendor/valorant-feel.js','utf8'),'motor == vendor');
const flat={ground:()=>0,blocked:()=>false},out=[];
// 1. crouch
assert.equal(M.C.crouchEye,.4);
for(const hz of [40,60,128]){const P={x:0,y:0,z:0,vx:0,vz:0,vy:0};for(let i=0;i<hz;i++)M.step(P,{x:0,z:0,speed:5.4,duck:true},1/hz,flat);
 assert.ok(Math.abs(P.ch-.4)<1e-9,hz+' Hz: crouched ch '+P.ch);assert.ok(Math.abs((P.y+M.C.eyeHeight-P.ch)-1.2)<1e-9,hz+' Hz: crouched eye 1.2 m');}
{const P={x:0,y:0,z:0,vx:0,vz:0,vy:0};let apex=0,tuck=0;for(let i=0;i<120;i++){const r=M.step(P,{x:0,z:0,speed:5.4,jump:i===0,duck:i>2},1/128,flat);apex=Math.max(apex,P.y);if(P.ch>=.4-1e-9&&P.air)tuck=1;if(r.landed)break;}
 assert.ok(tuck,'air crouch reaches the full 0.40 m');assert.ok(apex>1.165+.2-.02&&apex<1.165+.2+.02,'crouch-jump feet apex = 1.165 + 0.20 m ('+apex.toFixed(3)+')');}
{const s=hitVolumes({x:0,y:0,z:0,look:0,ch:0}),c=hitVolumes({x:0,y:0,z:0,look:0,ch:.4}),hy=v=>v.head?(v.head.c||v.head.center||v.head)[1]:null;
 const k=poseOf({ch:.4}).k;assert.equal(k,1,'ch 0.40 = the full crouch pose');
 const a=JSON.stringify(s),b=JSON.stringify(c);assert.notEqual(a,b,'crouched hit volumes differ');}
// 2. tag curve
assert.equal(M.C.tagTime,.75);assert.equal(M.C.tagMul,.275);assert.equal(M.C.tagMin,.15);
assert.equal(M.tagK(.275,.75),.275);assert.ok(Math.abs(M.tagK(.275,.375)-(.275+.725*.5))<1e-12);assert.equal(M.tagK(.275,0),1);assert.equal(M.tagK(.05,.75),.15,'never under 15 %');assert.equal(M.tagK(.2,8),.2,'a status slow longer than the curve holds its slow');
const html=await fs.readFile('../index.html','utf8'),i0=html.indexOf('function xTagK');assert.ok(i0>0,'xTagK found');
globalThis.ValorantFeel=require('../vendor/valorant-feel.js');
const xTagK=new Function('return '+html.slice(i0,html.indexOf('\n',i0)).replace(/\}\s*$/,'}'))();
for(const hz of [40,60]){const dt=1/hz,sim={time:10},S={x:0,y:0,z:0,vx:0,vz:0,vy:0,team:0},C={x:0,y:0,z:0,vx:0,vz:0,vy:0};
 for(let i=0;i<hz/2;i++){M.step(S,{x:1,z:0,speed:5.4},dt,flat);M.step(C,{x:1,z:0,speed:5.4},dt,flat);sim.time+=dt;}
 tagHit(sim,S,{shotgunPelletCount:1},15);C.tagT=M.C.tagTime;C.tagK=M.C.tagMul;C.tagS=0;const curve=[];
 for(let i=0;i<hz*1.2;i++){const ks=tagMul(S,sim.time),kc=xTagK(C);assert.ok(Math.abs(ks-kc)<1e-9,`${hz} Hz t=${(i*dt).toFixed(3)}: server x${ks} = prediction x${kc}`);
  if(i===0)assert.ok(Math.abs(ks-.275)<1e-9,'x0.275 at the hit');curve.push(ks);
  M.step(S,{x:1,z:0,speed:5.4,tag:ks},dt,flat);M.step(C,{x:1,z:0,speed:5.4,tag:kc},dt,flat);C.tagT=Math.max(0,C.tagT-dt);sim.time+=dt;
  assert.ok(Math.abs(S.x-C.x)<1e-9,hz+' Hz: positions agree');}
 for(let i=1;i<curve.length;i++)assert.ok(curve[i]>=curve[i-1]-1e-12,'recovers monotonically');assert.equal(curve[Math.ceil(.75*hz)+1],1,'full speed after 0.75 s');
 const mid=curve[Math.round(.375*hz)];assert.ok(Math.abs(mid-(.275+.725*Math.round(.375*hz)/hz/.75))<1e-9,'linear recovery ('+mid+')');out.push(hz+' Hz x'+curve.filter((_,j)=>j%Math.round(hz/8)===0).map(v=>v.toFixed(2)).join('/'));}
// 3. no landing movement lock
assert.equal(M.C.landingLock,undefined);
{const P={x:0,y:0,z:0,vx:0,vz:0,vy:0};for(let i=0;i<64;i++)M.step(P,{x:1,z:0,speed:5.4},1/128,flat);let land=null;for(let i=0;i<200;i++){const r=M.step(P,{x:1,z:0,speed:5.4,jump:i===0},1/128,flat);if(r.landed){land=Math.hypot(P.vx,P.vz);break;}}
 assert.ok(land!=null&&Math.abs(land-5.4)<1e-9&&P.lp===undefined&&P.ls>0,'landing keeps 5.4 m/s, no P.lp, landing spread set');}
console.log('movement measured values: crouch eye 0.40 m (eye 1.2 m, air tuck 0.20 m); tag curve server = prediction, '+out.join('; ')+'; no landing lock; motor pair identical');
