// Visual-hole survey over each original map's render meshes (scene.gltf): from player eye height at sampled
// playable nodes, cast below-horizon rays (-35/-15/-5/-2 deg x 24 headings). A ray that escapes the meshes
// sees the void unless the runtime backdrop skirt (work/native_maps_runtime.js) catches it inside the far plane.
// Reports raw-mesh void and void with the skirt for both camera setups (five/retake 500/260, other modes 200/90),
// and checks render floor exists under each node.
// Usage: node tools/eval-visual-holes.mjs [nodesPerMap] [maps...]   (OUT=file.json writes the leftovers)
import fs from 'node:fs';import * as T from 'three';import {loadVisual,loadSkirt} from './view-map.mjs';
process.chdir(new URL('..',import.meta.url).pathname); // paths below are relative to server/
const per=+process.argv[2]||300,maps=process.argv.slice(3).length?process.argv.slice(3):['ascent','bind','haven','split','lotus','breeze'],out={};let worst=0;
for(const key of maps){const t0=Date.now(),bvh=loadVisual(key),nav=JSON.parse(fs.readFileSync('../models/valorant/maps/'+key+'/navigation.json')),valid=nav.nodes.map((n,i)=>i).filter(i=>nav.valid[i]),ray=new T.Ray();
 const skirts=[loadSkirt(key,{far:500,fogFar:260}),loadSkirt(key,{far:200,fogFar:90})];let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 let rays=0,raw=0;const left=[[],[]],noFloor=[];for(let k=0;k<per;k++){const n=nav.nodes[valid[Math.floor(rnd()*valid.length)]];
  ray.origin.set(n[0],n[1]+.5,n[2]);ray.direction.set(0,-1,0);const f=bvh.raycastFirst(ray,T.DoubleSide);if(!f||f.distance>1.2)noFloor.push(n);
  for(const el of [-35,-15,-5,-2])for(let a=0;a<24;a++){const th=a/24*Math.PI*2,e=el*Math.PI/180;ray.origin.set(n[0],n[1]+1.6,n[2]);ray.direction.set(Math.sin(th)*Math.cos(e),Math.sin(e),Math.cos(th)*Math.cos(e));rays++;
   const h=bvh.raycastFirst(ray,T.DoubleSide);if(h&&h.distance<=400)continue;raw++;skirts.forEach((s,i)=>{if(!(s.hit(ray.origin,ray.direction)<s.far))left[i].push({from:n.map(v=>+v.toFixed(2)),elev:el,heading:a*15});});}}
 out[key]={rays,raw,skirt500:left[0],skirt200:left[1],noFloor};worst=Math.max(worst,left[0].length,left[1].length);
 console.log(key,'nodes',per,'below-horizon rays',rays,'void raw',raw,'void with skirt (far 500)',left[0].length,'(far 200)',left[1].length,'nodes without render floor',noFloor.length,((Date.now()-t0)/1000).toFixed(1)+'s');}
if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));process.exitCode=worst?1:0;
