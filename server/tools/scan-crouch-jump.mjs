// Find real map ledges that a plain jump cannot climb but a crouch-jump (jump, then crouch in the air) can, with the shared
// motor on the server world. Usage: node tools/scan-crouch-jump.mjs [map ...] (from server/). Prints JSON lines per hit.
import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';import {createRequire} from 'node:module';const req=createRequire(import.meta.url),Motor=req('../src/motor.cjs'),Old=process.env.MOTOR_OLD?req(process.env.MOTOR_OLD):null;
const maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','breeze','haven','lotus','split'];
export function attempt(W,s,dir,d,crouch,hz=60,M=Motor){const u={x:s[0]-dir[0]*2.6,y:s[1],z:s[2]-dir[1]*2.6};let jumped=false,t=0;
 for(let i=0;i<60;i++){const g=W.ground(u.x,u.z,u.y+.5);if(Math.abs(g-u.y)<.5){u.y=g;break;}}
 while(t<2.4){const along=(u.x-(s[0]-dir[0]*2.6))*dir[0]+(u.z-(s[2]-dir[1]*2.6))*dir[1],pre=!jumped&&along>=2.6-d;if(pre)jumped=true;
  M.step(u,{x:dir[0],z:dir[1],speed:5.4,jump:pre,duck:crouch&&jumped},1/hz,W);t+=1/hz;}
 return u;}
for(const map of maps){const W=await loadWorld({fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))},map);
 const nodes=W.nav.nodes;let hits=0,tried=0;
 for(let i=0;i<nodes.length&&hits<3;i+=(+process.env.STRIDE||3)){if(W.nav.valid&&!W.nav.valid[i])continue;const p=nodes[i];
  for(let k=0;k<8&&hits<3;k++){const a=k*Math.PI/4,dir=[Math.cos(a),Math.sin(a)];
   // a ledge 0.6 m ahead rising 1.20-1.34 m, flat on top for 0.6 m more, the floor here flat for 2.6 m back
   const top=W.ground(p[0]+dir[0]*.9,p[2]+dir[1]*.9,p[1]+1.6),rise=top-p[1];if(!(rise>(+process.env.RISE_MIN||1.2)&&rise<1.4))continue;
   if(Math.abs(W.ground(p[0]+dir[0]*1.5,p[2]+dir[1]*1.5,p[1]+1.6)-top)>.05)continue;
   let flat=true;for(let b=.3;b<=2.6;b+=.3)if(Math.abs(W.ground(p[0]-dir[0]*b,p[2]-dir[1]*b,p[1]+.3)-p[1])>.05){flat=false;break;}if(!flat)continue;
   tried++;const on=u=>Math.abs(u.y-top)<.05;let plain=false,cj=null;
   for(let d=.3;d<=2.2;d+=.1){if(on(attempt(W,p,dir,d,false)))plain=true;if(cj==null&&on(attempt(W,p,dir,d,true)))cj=+d.toFixed(2);}
   if(!plain&&cj!=null&&Old){for(let d=.3;d<=2.2;d+=.1)if(on(attempt(W,p,dir,d,true,60,Old))){cj=null;break;}}
   if(!plain&&cj!=null){hits++;console.log(JSON.stringify({map,start:p,dir:k,rise:+rise.toFixed(3),jumpAt:cj}));}}}
 console.error(map,'ledges tried',tried,'crouch-jump-only',hits);}
