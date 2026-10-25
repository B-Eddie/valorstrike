// Walk the shared motor up every short rising navigation edge on the six original maps and
// report how many climbs succeed without jumping. Usage: node eval-stairs.mjs [motor.cjs] [limitPerMap]
import {loadWorld} from './src/world.js';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),motor=require(process.argv[2]||'./src/motor.cjs'),limit=+process.argv[3]||400;
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};let total=0,okAll=0,fallsAll=0;
for(const key of ['ascent','bind','haven','split','lotus','breeze']){const w=await loadWorld(assets,key),N=w.nav.nodes,edges=[];
 for(const a of w.playable)for(const b of w.nav.adj[a]){if(!w.allowed.has(b))continue;const dy=N[b][1]-N[a][1],dh=Math.hypot(N[b][0]-N[a][0],N[b][2]-N[a][2]);if(dy>.12&&dy<.42&&dh<1.6)edges.push([a,b]);}
 let ok=0,falls=0,n=0;const step=Math.max(1,Math.floor(edges.length/limit));
 for(let i=0;i<edges.length;i+=step){const [a,b]=edges[i],A=N[a],Bn=N[b];const y0=w.ground(A[0],A[2],A[1]+.1);if(w.blocked(A[0],A[2],.4,y0,1.8))continue;n++;
  // start 0.6 m behind a, walk toward b and 1 m beyond
  const dx=Bn[0]-A[0],dz=Bn[2]-A[2],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;const P={x:A[0],z:A[2],y:y0,vx:0,vz:0,vy:0};let reached=false,minY=P.y;
  for(let t=0;t<2;t+=1/60){motor.step(P,{x:ux,z:uz,speed:5.4},1/60,w);minY=Math.min(minY,P.y);if(Math.hypot(P.x-Bn[0],P.z-Bn[2])<.35&&Math.abs(P.y-Bn[1])<.2){reached=true;break;}}
  if(reached)ok++;if(minY<y0-1.5)falls++;}
 console.log(key,'rising edges',edges.length,'tested',n,'climbed',ok,(100*ok/Math.max(1,n)).toFixed(1)+'%','big drops',falls);total+=n;okAll+=ok;fallsAll+=falls;}
console.log('ALL tested',total,'climbed',okAll,(100*okAll/total).toFixed(1)+'%','big drops',fallsAll);
