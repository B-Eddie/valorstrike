// Render-only floors -> collision (user: "a missing wall ... made me fall off the map", on the lilypad map = Lotus).
// work/export_native_map.py drops every source object whose name matches /Water/ from collision.bin, which also dropped
// Lotus' C water channel FLOOR (material Jam_Water_CSite_FloorBlendMoss_MI: the shallow riverbed under the lilypads,
// C Main / C Site / C Bend, x -66.7..-42.5, z -6.6..16.9, y 4.28-4.4, ~282 m2 inside the official minimap footprint).
// Only the moss carpets and lilypads lying on it had collision, so the gaps between them fell straight through to the
// map's bottom (y -5) - the leash kept walkers on the moss-patch navigation, but any step past a patch edge, a knockback,
// or a dash/satchel landing between the patches dropped the unit out of the map (map-escapes.json: 16 Lotus C falls).
// VALORANT's C water is walkable floor, so the render floor triangles of these materials (normal.y > 0.7) are appended to
// collision-patch.bin (the floor-patch file build-world.cjs and the page fallback already append). Idempotent: the
// existing patch keeps its own triangles (map-collision-patch.mjs mismatches) and these are re-added without duplicates.
// Void pockets: even with that floor, Lotus C keeps pockets with no surface at all (render or collision) beside the
// playable navigation (C Main stream bank, C Waterfall pool, C Bend west edge, ...): map-void-fill.json lists them as
// 0.25 m-cell rectangles (scan: within 2.5 m of a playable node at the C water level, no collision within 9 m below,
// a 0.3 m capsule fits). Inside the official minimap footprint a rectangle becomes floor at the water level (VALORANT's
// C water is walkable); outside it becomes a 3 m invisible wall box (the map boundary), so nothing there drops a unit
// out of the map. Boxes (map-void-fill.json <map>.boxes): a hole in a drawn wall at any height with no source geometry
// behind it (Lotus' A Door east wall slot, the gap in the minimap's right wall below A) -> a closed invisible wall box.
// Usage: node tools/map-render-floors.mjs [maps...]   (WRITE=0 dry run)
import fs from 'node:fs';import {loadRender,root} from './map-render.mjs';
process.chdir(new URL('..',import.meta.url).pathname);
export const VOID_FILL=JSON.parse(fs.readFileSync(new URL('../map-void-fill.json',import.meta.url)));
export const RENDER_FLOORS={lotus:/^Jam_Water_CSite_FloorBlendMoss_MI$/};
const key3=(P,i)=>[0,1,2].map(a=>Math.round(P[i*3+a]*1000)).join(',');
export function renderFloors(key){const re=RENDER_FLOORS[key];if(!re)return null;const R=loadRender(key,{bvh:false}),P=R.pos,I=R.index,out=[];
 for(let t=0;t<I.length/3;t++){if(!re.test(R.prims[R.triMat[t]].name))continue;const a=I[t*3],b=I[t*3+1],c=I[t*3+2];
  const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
  if(l<1e-12||Math.abs(ny)/l<.7)continue;out.push([[P[a*3],P[a*3+1],P[a*3+2]],[P[b*3],P[b*3+1],P[b*3+2]],[P[c*3],P[c*3+1],P[c*3+2]]]);}
 const F=VOID_FILL[key];if(F){const y=F.y,H=3;
  for(const [x0,x1,z0,z1] of F.floor)out.push([[x0,y,z0],[x0,y,z1],[x1,y,z1]],[[x0,y,z0],[x1,y,z1],[x1,y,z0]]);
  for(const [x0,x1,z0,z1] of F.wall){const a=y-.5,b=y+H,q=(p,q2,r,t)=>out.push([p,q2,r],[p,r,t]);
   q([x0,a,z0],[x1,a,z0],[x1,b,z0],[x0,b,z0]);q([x1,a,z0],[x1,a,z1],[x1,b,z1],[x1,b,z0]);q([x1,a,z1],[x0,a,z1],[x0,b,z1],[x1,b,z1]);q([x0,a,z1],[x0,a,z0],[x0,b,z0],[x0,b,z1]);q([x0,b,z0],[x1,b,z0],[x1,b,z1],[x0,b,z1]);}
  /* boxes: holes in a drawn wall at any height (no source geometry at all, render or collision) -> a closed invisible wall box
     [x0, x1, z0, z1, y0, y1] (Lotus A Door east wall slot) */
  for(const {box:[x0,x1,z0,z1,a,b]} of F.boxes||[]){const q=(p,q2,r,t)=>out.push([p,q2,r],[p,r,t]);
   q([x0,a,z0],[x1,a,z0],[x1,b,z0],[x0,b,z0]);q([x1,a,z0],[x1,a,z1],[x1,b,z1],[x1,b,z0]);q([x1,a,z1],[x0,a,z1],[x0,b,z1],[x1,b,z1]);q([x0,a,z1],[x0,a,z0],[x0,b,z0],[x0,b,z1]);q([x0,b,z0],[x1,b,z0],[x1,b,z1],[x0,b,z1]);q([x0,a,z0],[x0,a,z1],[x1,a,z1],[x1,a,z0]);}}
 return out;}
export function mergePatch(key,tris){const f=root(key)+'collision-patch.bin',V=[],X=[],vm=new Map(),seen=new Set();
 const add=tri=>{const k=tri.map(v=>v.map(x=>Math.round(x*1000)).join(',')).sort().join('|');if(seen.has(k))return false;seen.add(k);for(const v of tri){const s=v.map(x=>Math.round(x*1e5)).join(',');let i=vm.get(s);if(i===undefined){i=V.length/3;vm.set(s,i);V.push(...v);}X.push(i);}return true;};
 let kept=0,added=0;if(fs.existsSync(f)){const b=fs.readFileSync(f),nv=b.readUInt32LE(0),ni=b.readUInt32LE(4),p=new Float32Array(b.buffer.slice(b.byteOffset+8,b.byteOffset+8+nv*12)),ix=new Uint32Array(b.buffer.slice(b.byteOffset+8+nv*12,b.byteOffset+8+nv*12+ni*4));
  for(let t=0;t<ni/3;t++)if(add([0,1,2].map(j=>[p[ix[t*3+j]*3],p[ix[t*3+j]*3+1],p[ix[t*3+j]*3+2]])))kept++;}
 for(const t of tris)if(add(t))added++;
 const b=Buffer.alloc(8+V.length*4+X.length*4);b.writeUInt32LE(V.length/3,0);b.writeUInt32LE(X.length,4);Buffer.from(new Float32Array(V).buffer).copy(b,8);Buffer.from(new Uint32Array(X).buffer).copy(b,8+V.length*4);
 if(process.env.WRITE!=='0')fs.writeFileSync(f,b);return {kept,added,vertices:V.length/3,triangles:X.length/3,bytes:b.length};}
if(import.meta.url===`file://${process.argv[1]}`){for(const k of (process.argv.slice(2).length?process.argv.slice(2):Object.keys(RENDER_FLOORS))){const t=renderFloors(k);if(!t){console.log(k,'no render-only floors listed');continue;}console.log(k,JSON.stringify({renderFloorTriangles:t.length,...mergePatch(k,t)}));}}
