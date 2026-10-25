import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
const out={};
for(const key of ['ascent','bind','haven','split','lotus','breeze']){
 const w=await loadWorld(assets,key);const bad=new Set();
 for(let i=0;i<w.nav.nodes.length;i++){if(!w.nav.valid[i])continue;
  for(const j of w.nav.adj[i]||[]){if(!w.nav.valid[j]||j<i)continue;
   const A=w.nav.nodes[i],B=w.nav.nodes[j];
   if(Math.abs(A[1]-B[1])>1.5)continue;
   for(let t=0.15;t<1;t+=0.15){const x=A[0]+(B[0]-A[0])*t,z=A[2]+(B[2]-A[2])*t,y=w.ground(x,z,Math.max(A[1],B[1])+.3);
    if(w.blocked(x,z,.4,y,1.8)){bad.add(i+'-'+j);break;}}}}
 out[key]=[...bad];console.log(key,'baseline blocked',out[key].length);}
await fs.writeFile('/tmp/edge-baseline.json',JSON.stringify(out));
