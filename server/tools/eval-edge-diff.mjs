import {loadWorld} from '../src/world.js';import fs from 'node:fs/promises';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
const base=JSON.parse(await fs.readFile('/tmp/edge-baseline.json','utf8'));
for(const key of ['ascent','bind','haven','split','lotus','breeze']){
 const w=await loadWorld(assets,key);const bset=new Set(base[key]);const map=JSON.parse(await fs.readFile('../models/valorant/maps/'+key+'/map.json','utf8'));
 const fresh=[];
 for(let i=0;i<w.nav.nodes.length;i++){if(!w.nav.valid[i])continue;
  for(const j of w.nav.adj[i]||[]){if(!w.nav.valid[j]||j<i||bset.has(i+'-'+j))continue;
   const A=w.nav.nodes[i],B=w.nav.nodes[j];
   if(Math.abs(A[1]-B[1])>1.5)continue;
   for(let t=0.15;t<1;t+=0.15){const x=A[0]+(B[0]-A[0])*t,z=A[2]+(B[2]-A[2])*t,y=w.ground(x,z,Math.max(A[1],B[1])+.3);
    if(w.blocked(x,z,.4,y,1.8)){fresh.push([i,j]);break;}}}}
 console.log('==',key,'fence-blocked edges',fresh.length);
 const near=(p)=>{const c=(map.callouts||[]).map(co=>({n:co.name,d:Math.hypot(co.position[0]-p[0],co.position[2]-p[2])})).sort((a,b)=>a.d-b.d)[0];return c?c.n+'('+c.d.toFixed(0)+'m)':'?'};
 fresh.slice(0,6).forEach(([i,j])=>{const A=w.nav.nodes[i],B=w.nav.nodes[j];console.log('  ',A.map(v=>v.toFixed(0)).join(','),'->',B.map(v=>v.toFixed(0)).join(','),'@',near(A));});}
