// Real-geometry crouch-jump: a Breeze ledge (1.38 m over the floor, found by tools/scan-crouch-jump.mjs with MOTOR_OLD) that a
// plain jump cannot climb from any take-off point but a crouch-jump (jump, crouch in the air) can, with the shared motor on the server world, at
// the server's 40 Hz and the page's 60 / 144 Hz. MOTOR=<path> runs another motor copy (red check against an older one).
import {loadWorld} from './src/world.js';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const Motor=createRequire(import.meta.url)(process.env.MOTOR||'./src/motor.cjs');
assert.equal(await fs.readFile('src/motor.cjs','utf8'),await fs.readFile('../vendor/valorant-feel.js','utf8'));
const W=await loadWorld({fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))},'breeze');
function attempt(s,dir,d,crouch,hz){const back=2.6,u={x:s[0]-dir[0]*back,y:s[1],z:s[2]-dir[1]*back};u.y=W.ground(u.x,u.z,u.y+.5);let jumped=false,t=0;
 while(t<2.4){const along=(u.x-(s[0]-dir[0]*back))*dir[0]+(u.z-(s[2]-dir[1]*back))*dir[1],pre=!jumped&&along>=back-d;if(pre)jumped=true;
  Motor.step(u,{x:dir[0],z:dir[1],speed:5.4,jump:pre,duck:crouch&&jumped},1/hz,W);t+=1/hz;
  assert.ok(!W.blocked(u.x,u.z,.38,u.y,1.8-(u.ch||0)),'capsule never embedded');}
 return u;}
let n=0;
for(const L of [{start:[-4.25,4.0166,29.75],dir:1}]){const a=L.dir*Math.PI/4,dir=[Math.cos(a),Math.sin(a)];
 const top=W.ground(L.start[0]+dir[0]*.9,L.start[2]+dir[1]*.9,L.start[1]+1.6),rise=top-L.start[1];assert.ok(rise>1.3&&rise<1.4,'ledge rise '+rise);
 for(const hz of [40,60,144]){const on=u=>Math.abs(u.y-top)<.05;let plain=0,cj=0;
  for(let d=.3;d<=2.2;d+=.1){if(on(attempt(L.start,dir,d,false,hz)))plain++;if(on(attempt(L.start,dir,d,true,hz)))cj++;}
  assert.equal(plain,0,`Breeze ${L.start} (${rise.toFixed(2)} m) ${hz} Hz: no plain jump climbs it`);assert.ok(cj>0,`Breeze ${L.start} (${rise.toFixed(2)} m) ${hz} Hz: a crouch-jump climbs it`);n++;}}
console.log('crouch-jump on a real Breeze ledge:',n,'ledge x tick-rate cases, plain jump never climbs, crouch-jump does; motor pair identical');
