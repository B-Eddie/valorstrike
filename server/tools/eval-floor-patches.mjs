// Find walkable collision triangles inside the playable area that have no render geometry on
// top of them (the player stands on an invisible floor and sees the void). Writes per-map patch
// geometry to ../models/valorant/maps/<key>/floor-patches.bin when WRITE=1:
// [u32 vertexCount][f32 xyz * vertexCount] (non-indexed triangles).
import fs from 'node:fs';import * as T from 'three';import {loadVisual} from './view-map.mjs';import {loadWorld} from '../src/world.js';
process.chdir(new URL('..',import.meta.url).pathname); // paths below are relative to server/
const maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};const summary={};
for(const key of maps){const vis=loadVisual(key),w=await loadWorld(assets,key),N=w.nav.nodes,cells=new Set();for(const i of w.playable){const n=N[i];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)cells.add(Math.floor(n[0]/2+dx)+','+Math.floor(n[2]/2+dz)+','+Math.round(n[1]/2));}
 const raw=fs.readFileSync('../models/valorant/maps/'+key+'/collision.bin'),nv=raw.readUInt32LE(0),ni=raw.readUInt32LE(4),p=new Float32Array(raw.buffer.slice(raw.byteOffset+8,raw.byteOffset+8+nv*12)),I=new Uint32Array(raw.buffer.slice(raw.byteOffset+8+nv*12,raw.byteOffset+8+nv*12+ni*4));
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),ray=new T.Ray(),keep=[];let area=0,tested=0;
 const covered=(x,y,z)=>{ray.origin.set(x,y+.3,z);ray.direction.set(0,-1,0);const h=vis.raycastFirst(ray,T.DoubleSide);return h&&h.distance<.6;};
 for(let i=0;i<ni;i+=3){a.fromArray(p,I[i]*3);b.fromArray(p,I[i+1]*3);c.fromArray(p,I[i+2]*3);n.subVectors(b,a).cross(new T.Vector3().subVectors(c,a));const ar=n.length()/2;if(ar<1e-4)continue;n.normalize();if(Math.abs(n.y)<.7)continue;
  const cx=(a.x+b.x+c.x)/3,cy=(a.y+b.y+c.y)/3,cz=(a.z+b.z+c.z)/3;if(!cells.has(Math.floor(cx/2)+','+Math.floor(cz/2)+','+Math.round(cy/2)))continue;tested++;
  // sample centroid and the three edge midpoints pulled toward the centroid
  let miss=0;for(const q of [[cx,cy,cz],[(a.x+cx)/2,(a.y+cy)/2,(a.z+cz)/2],[(b.x+cx)/2,(b.y+cy)/2,(b.z+cz)/2],[(c.x+cx)/2,(c.y+cy)/2,(c.z+cz)/2]])if(!covered(...q))miss++;
  if(miss>=3){keep.push(a.x,a.y+.01,a.z,b.x,b.y+.01,b.z,c.x,c.y+.01,c.z);area+=ar;}}
 summary[key]={tested,uncoveredTriangles:keep.length/9,uncoveredArea:+area.toFixed(1)};console.log(key,JSON.stringify(summary[key]));
 if(process.env.WRITE){const out=Buffer.alloc(4+keep.length*4);out.writeUInt32LE(keep.length/3,0);Buffer.from(new Float32Array(keep).buffer).copy(out,4);fs.writeFileSync('../models/valorant/maps/'+key+'/floor-patches.bin',out);}}
