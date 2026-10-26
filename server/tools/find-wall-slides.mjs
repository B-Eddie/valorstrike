// Finds slanted-wall slide spots on a map for browser checks (work/browser_wall_slide.cjs): from nav nodes, walk 1.2 s in 8
// directions with the shared motor; a spot qualifies when the walk hits a wall (blocked along the walk) and keeps moving along
// it at 2-6.3 m/s in a direction 15-75 deg off the walk, on the same floor (|dy| < 0.1). Prints JSON [from, dir, m/s, deg].
// Usage: node tools/find-wall-slides.mjs bind [max=6]
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require('../src/motor.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const key=process.argv[2]||'bind',MAX=+(process.argv[3]||6),DT=1/30;const w=await loadWorld(assets,key);
const DIRS=Array.from({length:16},(_,k)=>[Math.cos(k*Math.PI/8),Math.sin(k*Math.PI/8)]);const out=[];const N=w.nav.nodes;
const ids=[...(w.allowed||new Set(N.map((_,i)=>i)))];for(let k=0;k<ids.length&&out.length<MAX;k+=Math.max(1,Math.floor(ids.length/1500))){const n=N[ids[k]];if(!n)continue;
 for(const d of DIRS){const y=w.ground(n[0],n[2],n[1]+.1);if(!Number.isFinite(y))continue;const P={x:n[0],z:n[2],y,vx:0,vz:0,vy:0,ch:0};let hit=-1;const tr=[];
  for(let t=0;t<1.6;t+=DT){const x0=P.x,z0=P.z;Motor.step(P,{x:d[0],z:d[1],speed:6.75},DT,w);const mx=P.x-x0,mz=P.z-z0,along=(mx*d[0]+mz*d[1])/DT;tr.push([t,P.x,P.z,P.y,mx/DT,mz/DT,along]);if(hit<0&&t>.2&&along<5.5)hit=tr.length-1;}
  if(hit<0||hit>tr.length-12)continue;const a=tr[hit+3],b=tr[tr.length-1],dt=b[0]-a[0];if(dt<.3)continue;const vx=(b[1]-a[1])/dt,vz=(b[2]-a[2])/dt,sp=Math.hypot(vx,vz);
  if(sp<2||sp>6.3||Math.abs(b[3]-y)>.1)continue;const deg=Math.acos(Math.max(-1,Math.min(1,(vx*d[0]+vz*d[1])/sp)))*180/Math.PI;if(deg<15||deg>75||Math.abs(sp-6.75*Math.cos(deg*Math.PI/180))>.6)continue;/* a clean slide: ~6.75 cos(angle) */
  // start 1 m back from the contact point so the browser walk reaches the wall quickly
  const c=tr[hit],from=[+(c[1]-d[0]*1).toFixed(2),+y.toFixed(2),+(c[2]-d[1]*1).toFixed(2)];const fy=w.ground(from[0],from[2],y+.1);if(!Number.isFinite(fy)||Math.abs(fy-y)>.05)continue;
  if(out.some(o=>Math.hypot(o[0][0]-from[0],o[0][2]-from[2])<6))continue;out.push([from,[+d[0].toFixed(3),+d[1].toFixed(3)],+sp.toFixed(2),+deg.toFixed(1)]);break;}}
console.log(JSON.stringify(out));
