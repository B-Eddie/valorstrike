// Fall-through survey: walk the shared motor along sampled flat navigation edges on the six
// original maps and report places where the capsule drops far below both endpoints (holes).
// Usage: node eval-holes.mjs [samplesPerMap] [maps...]
import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname); // paths below are relative to server/
const require=createRequire(import.meta.url),motor=require('../src/motor.cjs'),limit=+process.argv[2]||600,maps=process.argv.slice(3).length?process.argv.slice(3):['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};const out={};
for(const key of maps){const w=await loadWorld(assets,key),N=w.nav.nodes,edges=[];for(const a of w.playable)for(const b of w.nav.adj[a])if(a<b&&w.allowed.has(b)&&Math.abs(N[b][1]-N[a][1])<.5)edges.push([a,b]);
 const step=Math.max(1,Math.floor(edges.length/limit)),holes=[];let n=0;
 for(let i=0;i<edges.length;i+=step){for(const [a,b]of [edges[i],[edges[i][1],edges[i][0]]]){const A=N[a],B=N[b],y0=w.ground(A[0],A[2],A[1]+.1);if(w.blocked(A[0],A[2],.4,y0,1.8))continue;n++;
  const dx=B[0]-A[0],dz=B[2]-A[2],l=Math.hypot(dx,dz),P={x:A[0],z:A[2],y:y0,vx:0,vz:0,vy:0},lo=Math.min(A[1],B[1])-1;
  for(let t=0;t<1.2;t+=1/60){motor.step(P,{x:dx/l,z:dz/l,speed:5.4},1/60,w);if(P.y<lo){holes.push([+P.x.toFixed(2),+P.y.toFixed(2),+P.z.toFixed(2),'from',A,'to',B]);break;}if(Math.hypot(P.x-B[0],P.z-B[2])<.3)break;}}}
 out[key]=holes;console.log(key,'walks',n,'fall-throughs',holes.length);for(const h of holes.slice(0,12))console.log('  ',JSON.stringify(h));}
if(process.env.OUT)await fs.writeFile(process.env.OUT,JSON.stringify(out));
