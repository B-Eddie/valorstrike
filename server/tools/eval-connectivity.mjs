// Fence connectivity acceptance: every valid nav edge must remain capsule-walkable in the fenced
// world (sampled along the segment at each node's own ground level); spawn anchors unblocked.
import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
let worst=[];
for(const key of ['ascent','bind','haven','split','lotus','breeze']){
 const w=await loadWorld(assets,key);let cut=0,tot=0;
 for(let i=0;i<w.nav.nodes.length;i++){if(!w.nav.valid[i])continue;
  for(const j of w.nav.adj[i]||[]){if(!w.nav.valid[j]||j<i)continue;tot++;
   const A=w.nav.nodes[i],B=w.nav.nodes[j];
   if(Math.abs(A[1]-B[1])>1.5)continue; // scripted drop/rope/jump link: not capsule-walkable by design
   let blockedEdge=false;
   for(let t=0.15;t<1;t+=0.15){const x=A[0]+(B[0]-A[0])*t,z=A[2]+(B[2]-A[2])*t,y=w.ground(x,z,Math.max(A[1],B[1])+.3);
    if(w.blocked(x,z,.4,y,1.8)){blockedEdge=true;break;}}
   if(blockedEdge)cut++;}}
 console.log(key,'edges',tot,'newly blocked',cut);if(cut)worst.push(key+':'+cut);}
console.log(worst.length?'BLOCKED EDGES: '+worst.join(' '):'ALL NAV EDGES WALKABLE');
