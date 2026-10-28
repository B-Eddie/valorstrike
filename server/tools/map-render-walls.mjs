// Solid render walls the exporter left out of collision -> collision-patch.bin (user, Lotus: "There's still a hole in
// Lotus. It's next to the mound" / "It's in the wall" / "The hitboxes also don't line up with walls in that map").
// work/export_native_map.py keeps an object out of collision.bin when its NAME matches
// /Foliage|Grass|Leaves|Canopy|Ivy|VFX|Decal|Floater|Light|Shadow|Wires|Sky|Cloud|Fog|Vista|Backdrop|FX_|Water/. That is
// right for plants and light cones but it also caught solid architecture whose object name merely contains one of the
// words (a C waterfall rock wall, "...WallExteriorLight..." trims, a temple wall by the C stream): the wall is drawn but
// players walk into it and bullets fly through it. Lotus C Mound: the rock wall west of the mound (x -42.5, z 16.8-21.5,
// floor to 4 m up) has no collision at all, so a player walks into the rock and sees through it, out of the map; the
// C Hall / C Site temple walls and the B / A Link pattern trims are the same. Breeze Mid Bottom: the whole wooden stall
// building (x -6..5, z 28..36) only had collision for its barrels (the leash kept walkers out; shots went through).
// The source of truth is the render mesh: a render triangle with NO identical collision.bin triangle is render-only
// (its object was name-excluded). Such a triangle is restored to collision when
//   - its material is solid architecture (not foliage / decal / floater / wire / vista / sky / water / glass / light
//     props such as worklights - those stay walk- and shoot-through as before), and
//   - part of it is within reach of the playable navigation (a 0.2 m sample within 1.1 m horizontally of a playable nav
//     node, between 0.1 m below and 2.1 m above it), and
//   - (or) it shares an edge chain with such a triangle (same material, render-only) and has an uncovered sample up to 6 m
//     above a playable node: the rest of a restored wall above head height, which bullets hit too;
//   - that sample has no collision within 0.15 m (collision.bin minus collision-exclude.bin plus the current patch), so
//     walls already covered by another object's collision are left alone.
// The triangles are appended to collision-patch.bin (build-world.cjs and the page fallback already append it; the worker
// serves the built world to the page). Idempotent: a second run finds them covered and adds nothing.
// Usage: node tools/map-render-walls.mjs [maps...]   (default lotus breeze; WRITE=0 dry run)
import fs from 'node:fs';import * as T from 'three';import {MeshBVH} from 'three-mesh-bvh';import {createRequire} from 'node:module';
import {loadRender,root} from './map-render.mjs';import {mergePatch} from './map-render-floors.mjs';
const require=createRequire(import.meta.url),Motor=require('../src/motor.cjs');
// Shipped for Lotus and Breeze (whole walls / a building missing). Ascent 0; Bind, Haven, Split only have small metal trims /
// lamp glows a few cm off already-solid walls (wall alignment 0.03-0.08% of wall hits, like Lotus/Breeze after) - not patched.
export const MAPS=['lotus','breeze'];
export const NONSOLID=/Decal|Floater|Foliage|Leaves|Grass|Plant|Palm|Tree|Bush|Vine|Ivy|Vista|Sky|Cloud|LightCone|Godray|Volumetric|Wires|Cable|Fog|Water|Smoke|Dust|Particle|Glass|LightShaft|Glow|Graffiti|Mural|Sticker|Poster|^Light_\d|LightBlocker|^Petals_M0_Petals_/i;
export const WALLS={reach:1.1,below:.1,above:2.1,grow:6,step:.2,cover:.05};
const vk=(A,i)=>Math.round(A[i*3]*200)+','+Math.round(A[i*3+1]*200)+','+Math.round(A[i*3+2]*200);
// collision as build-world.cjs assembles it (raw minus exclusion plus patch), as a BVH; and the raw triangle set
export function baseCollision(key){const dir=root(key),b=fs.readFileSync(dir+'collision.bin'),nv=b.readUInt32LE(0),ni=b.readUInt32LE(4),p=new Float32Array(b.buffer,b.byteOffset+8,nv*3),I=new Uint32Array(b.buffer,b.byteOffset+8+nv*12,ni);
 const raw=new Set();for(let t=0;t<ni/3;t++)raw.add([vk(p,I[t*3]),vk(p,I[t*3+1]),vk(p,I[t*3+2])].sort().join('|'));
 const drop=new Uint8Array(ni/3);if(fs.existsSync(dir+'collision-exclude.bin')){const ex=fs.readFileSync(dir+'collision-exclude.bin'),n=ex.readUInt32LE(0);for(let r=0;r<n;r++)drop.fill(1,ex.readUInt32LE(4+r*8),ex.readUInt32LE(4+r*8)+ex.readUInt32LE(8+r*8));}
 let pv=0,pi=0,pp=null,px=null;if(fs.existsSync(dir+'collision-patch.bin')){const q=fs.readFileSync(dir+'collision-patch.bin');pv=q.readUInt32LE(0);pi=q.readUInt32LE(4);pp=new Float32Array(q.buffer.slice(q.byteOffset+8,q.byteOffset+8+pv*12));px=new Uint32Array(q.buffer.slice(q.byteOffset+8+pv*12,q.byteOffset+8+pv*12+pi*4));}
 let keep=0;for(let t=0;t<drop.length;t++)if(!drop[t])keep++;const pos=new Float32Array(nv*3+pv*3);pos.set(p);if(pp)pos.set(pp,nv*3);const idx=new Uint32Array(keep*3+pi);let k=0;
 for(let t=0;t<drop.length;t++)if(!drop[t]){idx[k++]=I[t*3];idx[k++]=I[t*3+1];idx[k++]=I[t*3+2];}for(let i=0;i<pi;i++)idx[k++]=px[i]+nv;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(idx,1));return {raw,bvh:new MeshBVH(g,{maxLeafTris:12,maxDepth:64})};}
// playable navigation = largest valid component over nav links + rope links (as src/world.js)
export function playableNodes(key){const nav=JSON.parse(fs.readFileSync(root(key)+'navigation.json')),adj=nav.adj.map(a=>a.slice());
 for(const l of Motor.ropeLinks(Motor.ROPES[key]||null,nav.nodes,i=>!!nav.valid[i]))if(!adj[l.a].includes(l.b))adj[l.a].push(l.b);
 const seen=new Uint8Array(nav.nodes.length);let best=[];for(let i=0;i<nav.nodes.length;i++){if(seen[i]||!nav.valid[i])continue;const c=[i];seen[i]=1;for(let k=0;k<c.length;k++)for(const j of adj[c[k]])if(!seen[j]&&nav.valid[j]){seen[j]=1;c.push(j);}if(c.length>best.length)best=c;}
 return best.map(i=>nav.nodes[i]);}
export function reachFn(nodes,{reach,below,above}=WALLS){const cell=new Map();for(const p of nodes){const k=Math.floor(p[0])+','+Math.floor(p[2]);(cell.get(k)||cell.set(k,[]).get(k)).push(p);}
 return (x,y,z)=>{const cx=Math.floor(x),cz=Math.floor(z);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(const p of cell.get((cx+dx)+','+(cz+dz))||[]){if(y<p[1]-below||y>p[1]+above)continue;if((p[0]-x)**2+(p[2]-z)**2<reach*reach)return true;}return false;};}
// -> {tris:[[a,b,c],...] to add, samples (reachable uncovered sample count before), byMaterial}
export function renderWalls(key,{R=null,C=null}={}){R=R||loadRender(key,{bvh:false});C=C||baseCollision(key);const P=R.pos,I=R.index,nodes=playableNodes(key),body=reachFn(nodes),high=reachFn(nodes,{...WALLS,above:WALLS.grow}),tgt={point:new T.Vector3(),distance:0},v=new T.Vector3(),byMaterial={};
 /* three-mesh-bvh closestPointToPoint can return a hit beyond maxThreshold (whole leaf scanned): check the distance */const covered=(x,y,z)=>{const r=C.bvh.closestPointToPoint(v.set(x,y,z),tgt,0,WALLS.cover);return !!r&&r.distance<=WALLS.cover;};
 const cand=new Map();// render-only solid triangle -> uncovered samples {body, high}
 for(let t=0;t<I.length/3;t++){const m=R.prims[R.triMat[t]];if(NONSOLID.test(m.name)||m.alpha==='BLEND')continue;const a=I[t*3],b=I[t*3+1],c=I[t*3+2];if(C.raw.has([vk(P,a),vk(P,b),vk(P,c)].sort().join('|')))continue;
  const A=[P[a*3],P[a*3+1],P[a*3+2]],B=[P[b*3],P[b*3+1],P[b*3+2]],D=[P[c*3],P[c*3+1],P[c*3+2]],L=Math.max(Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),Math.hypot(B[0]-D[0],B[1]-D[1],B[2]-D[2]),Math.hypot(D[0]-A[0],D[1]-A[1],D[2]-A[2])),n=Math.min(60,Math.max(1,Math.ceil(L/WALLS.step)));
  let lo=0,hi=0;for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const u=i/n,w=j/n,s=1-u-w,x=A[0]*s+B[0]*u+D[0]*w,y=A[1]*s+B[1]*u+D[1]*w,z=A[2]*s+B[2]*u+D[2]*w;if(!high(x,y,z))continue;if(covered(x,y,z))continue;hi++;if(body(x,y,z))lo++;}
  if(hi)cand.set(t,{lo,hi,A,B,D,m:m.name,k:R.triMat[t]});}
 // grow from body-reach seeds over shared vertices within the same primitive
 const byVert=new Map();for(const t of cand.keys())for(let j=0;j<3;j++){const q=vk(P,I[t*3+j])+'#'+cand.get(t).k;(byVert.get(q)||byVert.set(q,[]).get(q)).push(t);}
 const take=new Set(),queue=[];for(const [t,e] of cand)if(e.lo){take.add(t);queue.push(t);}
 while(queue.length){const t=queue.pop(),e=cand.get(t);for(let j=0;j<3;j++)for(const u of byVert.get(vk(P,I[t*3+j])+'#'+e.k)||[])if(!take.has(u)){take.add(u);queue.push(u);}}
 const out=[];let samples=0;for(const t of take){const e=cand.get(t);out.push([e.A,e.B,e.D]);samples+=e.hi;const s=byMaterial[e.m]||(byMaterial[e.m]={tris:0,samples:0});s.tris++;s.samples+=e.hi;}
 return {tris:out,samples,byMaterial};}
if(import.meta.url===`file://${process.argv[1]}`){process.chdir(new URL('..',import.meta.url).pathname);for(const k of (process.argv.slice(2).length?process.argv.slice(2):MAPS)){const R=loadRender(k,{bvh:false});
 /* repeat to a fixed point: a restored triangle can leave a sliver of a neighbour uncovered */for(let pass=0;pass<4;pass++){const r=renderWalls(k,{R});const m=r.tris.length?mergePatch(k,r.tris):{added:0};
  console.log(k,'pass',pass,JSON.stringify({renderWallTriangles:r.tris.length,uncoveredSamples:r.samples,...m}));for(const [n,e] of Object.entries(r.byMaterial).sort((a,b)=>b[1].samples-a[1].samples).slice(0,12))console.log('  ',n,JSON.stringify(e));if(!m.added||process.env.WRITE==='0')break;}}}
