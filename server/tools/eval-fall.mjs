// Random-walk fall-through survey: from random playable nodes, walk random headings for 2.5 s
// and flag positions below every floor the navigation mesh knows at that spot (or with no floor).
import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname); // paths below are relative to server/
const require=createRequire(import.meta.url),motor=require(process.env.MOTOR||'../src/motor.cjs'),walks=+process.argv[2]||300,maps=process.argv.slice(3).length?process.argv.slice(3):['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const out={};
for(const key of maps){const w=await loadWorld(assets,key),N=w.nav.nodes,cell=new Map();for(const i of w.playable){const k=Math.round(N[i][0]/1.5)+','+Math.round(N[i][2]/1.5);(cell.get(k)||cell.set(k,[]).get(k)).push(N[i][1]);}
 const floorMin=(x,z)=>{let m=Infinity;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const y of cell.get((Math.round(x/1.5)+dx)+','+(Math.round(z/1.5)+dz))||[])m=Math.min(m,y);return m;};
 const bad=[];for(let k=0;k<walks;k++){const A=N[w.playable[Math.floor(rnd()*w.playable.length)]],y0=w.ground(A[0],A[2],A[1]+.1);if(w.blocked(A[0],A[2],.4,y0,1.8))continue;const a=rnd()*Math.PI*2,P={x:A[0],z:A[2],y:y0,vx:0,vz:0,vy:0};
  for(let t=0;t<2.5;t+=1/60){motor.step(P,{x:Math.sin(a),z:Math.cos(a),speed:5.4},1/60,w);const fm=floorMin(P.x,P.z);if(!P.air&&(P.y<fm-1.2||(fm===Infinity&&P.y<y0-1.2))){bad.push({at:[P.x,P.y,P.z].map(v=>+v.toFixed(2)),start:A,heading:+a.toFixed(3),navFloor:fm});break;}}}
 out[key]=bad;console.log(key,'walks',walks,'below-floor landings',bad.length);for(const b of bad.slice(0,8))console.log('  ',JSON.stringify(b));}
if(process.env.OUT)await fs.writeFile(process.env.OUT,JSON.stringify(out,null,1));
