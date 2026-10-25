// Collision floor patches: where the render mesh has a walkable floor over the playable area but the collision mesh has
// none (Lotus: whole stretches of Stone_M0_FloorBlendMoss with no collision under them, so only the navigation-node
// fallback held units up, and anything 0.65 m from a node fell into the void), copy those render floor triangles into
// the collision. Sampling: the hole-scan grid (0.25 m around every playable node); a sample is a mismatch when the
// first render surface below it is an opaque floor (normal.y > 0.7, not foliage/decal/glass) within a step of the node
// and the collision has no surface within 0.3 m of it. The render triangles hit at mismatch samples are written to
// models/valorant/maps/<key>/collision-patch.bin ([u32 vertexCount][u32 indexCount][f32 xyz...][u32 idx...], same layout
// as collision.bin); build-world.cjs appends them to the server/client collision world.
// Usage: node tools/map-collision-patch.mjs [maps...]  (WRITE=0 dry run)
import fs from 'node:fs';import * as T from 'three';import {loadWorld} from '../src/world.js';import {loadRender,root} from './map-render.mjs';
process.chdir(new URL('..',import.meta.url).pathname);
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
// decals and foliage cut-outs (runtime nmDecalStyle/nmFoliageCut classes) are never floors
const detail=n=>/Decal|Floater/i.test(n)||(/Plant(?!er)|Foliage|Leaf|Leaves|Fern|Shrub|Creeper|Bush|MossOvergrowth|Flower|Ivy|Grass_M0_Cards|Cabbage|Jasmine|Philodendron|MorningGlory|Agave/i.test(n)&&!/Blend|Trunk|Bark|Planter|Wall|Floor|Stone|Rock|Tile|Brick/i.test(n));
export async function mismatches(key,{R,w}={}){w=w||await loadWorld(assets,key);R=R||loadRender(key);const N=w.nav.nodes,seen=new Set(),tris=new Set(),pts=[];const ray=new T.Ray(),offs=[-.25,0,.25];let samples=0;
 const floorPrim=R.prims.map(p=>p.alpha==='OPAQUE'&&!detail(p.name)&&!/Glass|Water/i.test(p.name));
 for(const i of w.playable){const n=N[i];for(const ox of offs)for(const oz of offs){const x=+(n[0]+ox).toFixed(2),z=+(n[2]+oz).toFixed(2),k=x+','+z+','+Math.round(n[1]*2);if(seen.has(k))continue;seen.add(k);samples++;
  ray.origin.set(x,n[1]+.6,z);ray.direction.set(0,-1,0);let h=R.bvh.raycastFirst(ray,T.DoubleSide),guard=0;while(h&&!floorPrim[R.triMat[h.faceIndex]]&&guard++<6){ray.origin.y=h.point.y-.005;h=R.bvh.raycastFirst(ray,T.DoubleSide);}
  if(!h||Math.abs(h.point.y-n[1])>.45||Math.abs(h.face.normal.y)<.7)continue;const fy=h.point.y,d=w.ray([x,fy+.3,z],[0,-1,0],.6);if(Number.isFinite(d))continue;
  tris.add(h.faceIndex);pts.push([x,+fy.toFixed(2),z]);}}
 return {samples,tris:[...tris],pts};}
export function writePatch(key,R,tris){const map=new Map(),P=[],I=[];for(const t of tris)for(let j=0;j<3;j++){const v=R.index[t*3+j];let a=map.get(v);if(a===undefined){a=P.length/3;map.set(v,a);P.push(R.pos[v*3],R.pos[v*3+1],R.pos[v*3+2]);}I.push(a);}
 const b=Buffer.alloc(8+P.length*4+I.length*4);b.writeUInt32LE(P.length/3,0);b.writeUInt32LE(I.length,4);Buffer.from(new Float32Array(P).buffer).copy(b,8);Buffer.from(new Uint32Array(I).buffer).copy(b,8+P.length*4);fs.writeFileSync(root(key)+'collision-patch.bin',b);return {vertices:P.length/3,triangles:I.length/3,bytes:b.length};}
export function clusters(pts){const G=[];for(const p of pts){let g=G.find(g=>Math.abs(g.y-p[1])<1&&Math.abs(g.x0-p[0])<4&&Math.abs(g.z0-p[2])<4);if(!g){g={x0:p[0],z0:p[2],y:p[1],x:[p[0],p[0]],z:[p[2],p[2]],n:0};G.push(g);}g.n++;g.x=[Math.min(g.x[0],p[0]),Math.max(g.x[1],p[0])];g.z=[Math.min(g.z[0],p[2]),Math.max(g.z[1],p[2])];}return G.map(g=>({n:g.n,x:g.x,z:g.z,y:g.y}));}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):MAPS;for(const k of maps){const R=loadRender(k),r=await mismatches(k,{R});let wrote=null;if(r.tris.length&&process.env.WRITE!=='0')wrote=writePatch(k,R,r.tris);else if(!r.tris.length&&fs.existsSync(root(k)+'collision-patch.bin')&&process.env.WRITE!=='0')fs.unlinkSync(root(k)+'collision-patch.bin');
 console.log(k,JSON.stringify({samples:r.samples,mismatchSamples:r.pts.length,triangles:r.tris.length,wrote,clusters:clusters(r.pts).filter(c=>c.n>=3)}));}}
