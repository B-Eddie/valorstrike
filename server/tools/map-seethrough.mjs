// Visual-gap survey: what a player can see through, or sees floating, on each original map. Sample-based (seeded
// playable navigation nodes, eye height 1.6 m), memory-light (one map at a time, render meshes from scene.gltf).
//  seeThrough  a sight ray hits server collision within 30 m but the render meshes show nothing there (no render
//              face within 0.75 m of the collision hit): an invisible wall the player sees through. 'sky' when the
//              render ray escapes the meshes entirely (the skybox shows through), else 'beyond' (the next render
//              surface is further away).
//  cracks      a sight ray at or above the horizon escapes the render meshes (sky) while the four rays 2 deg around it
//              all hit solid (not foliage/wire/decal) geometry within 30 m: the skybox shows through a gap in otherwise
//              closed geometry.
//  floating    a render node (prop) under 6 m across, within 12 m of a sampled eye, whose bottom is > 0.25 m clear of
//              any render surface below at its centre and four inset corners, with nothing within 0.3 m beside or
//              above it (not hung, not wall-mounted). Foliage/decal/vista/sky/light-cone materials are skipped.
// Results are clustered (3 m) and reported largest first.
// Usage: node tools/map-seethrough.mjs [nodesPerMap] [maps...]   (JSON=path writes the full report)
import fs from 'node:fs';import * as T from 'three';import {loadWorld} from '../src/world.js';import {loadRender} from './map-render.mjs';
process.chdir(new URL('..',import.meta.url).pathname);
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const SKIP=/Decal|Floater|Foliage|Leaves|Grass|Palm|Tree|Plant|Bush|Vine|Ivy|Vista|Sky|Cloud|LightCone|Godray|Volumetric|Wires|Cable|Fog|Water|Smoke|Dust|Particle/i;
export function cluster(list,r=3){const G=[];for(const p of list){let g=G.find(g=>Math.abs(g.at[1]-p.at[1])<2&&Math.hypot(g.at[0]-p.at[0],g.at[2]-p.at[2])<r);if(!g){g={at:p.at,n:0,ex:[]};G.push(g);}g.n++;if(g.ex.length<3)g.ex.push(p);}return G.sort((a,b)=>b.n-a.n);}
export async function scanSeeThrough(key,{per=250,w=null,R=null}={}){
 w=w||await loadWorld(assets,key);R=R||loadRender(key,{bvh:true});const {bvh,prims,pos,index,triMat}=R,nav=w.nav;
 const valid=nav.nodes.map((n,i)=>i).filter(i=>nav.valid[i]);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const ray=new T.Ray(),eyes=[],see=[],crack=[];let rays=0;
 for(let k=0;k<per;k++){const n=nav.nodes[valid[Math.floor(rnd()*valid.length)]];const o=[n[0],n[1]+1.6,n[2]];eyes.push(o);
  for(const el of [-8,0,8,20])for(let a=0;a<24;a++){const th=(a+rnd()*.5)/24*Math.PI*2,e=el*Math.PI/180,d=[Math.sin(th)*Math.cos(e),Math.sin(e),Math.cos(th)*Math.cos(e)];rays++;
   ray.origin.set(...o);ray.direction.set(...d);const h=bvh.raycastFirst(ray,T.DoubleSide);
   if((!h||h.distance>400)&&el>=0){// sky through a crack: every neighbour 2 deg away is closed within 30 m
    let shut=0;for(const [dh,de] of [[2,0],[-2,0],[0,2],[0,-2]]){const th2=th+dh*Math.PI/180,e2=e+de*Math.PI/180;ray.direction.set(Math.sin(th2)*Math.cos(e2),Math.sin(e2),Math.cos(th2)*Math.cos(e2));const g=bvh.raycastFirst(ray,T.DoubleSide);if(g&&g.distance<30&&!SKIP.test(prims[triMat[g.faceIndex]].name))shut++;}
    if(shut===4)crack.push({at:o.map(v=>+v.toFixed(2)),from:o.map(v=>+v.toFixed(2)),elev:el,heading:Math.round(th*180/Math.PI)});ray.direction.set(...d);}
   const c=w.ray(o,d,30);if(!Number.isFinite(c)||c<.6)continue;
   if(h&&h.distance<=c+.75)continue;const at=o.map((v,i)=>+(v+d[i]*c).toFixed(2));
   see.push({at,from:o.map(v=>+v.toFixed(2)),elev:el,heading:Math.round(th*180/Math.PI),collision:+c.toFixed(2),render:h?+h.distance.toFixed(2):null,kind:h?'beyond':'sky'});}}
 // floating props: group primitives by gltf node mesh
 const byMesh=new Map();prims.forEach((p,k)=>{if(!byMesh.has(p.mesh))byMesh.set(p.mesh,[]);byMesh.get(p.mesh).push(k);});
 const flo=[],box=new T.Box3(),v=new T.Vector3(),near=(x,y,z)=>eyes.some(e=>(e[0]-x)**2+(e[2]-z)**2<144&&Math.abs(e[1]-y)<8);
 const self=(t,ks)=>ks.includes(triMat[t]);
 const cast=(o,d,ks,max)=>{ray.origin.set(...o);ray.direction.set(...d);const hs=bvh.raycast(ray,T.DoubleSide);let best=Infinity;for(const h of hs){if(h.distance>max)continue;const t=h.faceIndex;if(t!=null&&self(t,ks))continue;if(h.distance<best)best=h.distance;}return best;};
 for(const [mesh,ks] of byMesh){if(ks.some(k=>SKIP.test(prims[k].name)))continue;box.makeEmpty();for(const k of ks){const p=prims[k];for(let i=p.vert0;i<p.vert0+p.verts;i++)box.expandByPoint(v.set(pos[i*3],pos[i*3+1],pos[i*3+2]));}
  const s=box.getSize(new T.Vector3());if(s.x>6||s.z>6||s.y>6||Math.max(s.x,s.z)<.15)continue;const c=box.getCenter(new T.Vector3());if(!near(c.x,box.min.y,c.z))continue;
  const ix=s.x*.3,iz=s.z*.3,pts=[[c.x,c.z],[c.x-ix,c.z-iz],[c.x+ix,c.z-iz],[c.x-ix,c.z+iz],[c.x+ix,c.z+iz]];
  let gap=Infinity;for(const [x,z] of pts)gap=Math.min(gap,cast([x,box.min.y+.1,z],[0,-1,0],ks,8)-.1);if(gap<=.25)continue;// cast from 10 cm up: a floor flush with the prop's base still counts
  const side=[[1,0,0,s.x/2],[-1,0,0,s.x/2],[0,0,1,s.z/2],[0,0,-1,s.z/2],[0,1,0,s.y/2]].some(([dx,dy,dz,h])=>cast([c.x,c.y,c.z],[dx,dy,dz],ks,h+.3)<h+.3);if(side)continue;
  flo.push({at:[+c.x.toFixed(2),+box.min.y.toFixed(2),+c.z.toFixed(2)],mesh,materials:[...new Set(ks.map(k=>prims[k].name))],size:[+s.x.toFixed(2),+s.y.toFixed(2),+s.z.toFixed(2)],gap:Number.isFinite(gap)?+gap.toFixed(2):null});}
 return {key,nodes:per,rays,seeThrough:see.length,sky:see.filter(p=>p.kind==='sky').length,clusters:cluster(see),cracks:crack.length,crackClusters:cluster(crack),floating:flo.sort((a,b)=>(b.gap??99)-(a.gap??99))};}
if(import.meta.url===`file://${process.argv[1]}`){const per=+process.argv[2]||250,maps=process.argv.slice(3).length?process.argv.slice(3):MAPS,out={};
 for(const key of maps){const t=Date.now(),r=await scanSeeThrough(key,{per});out[key]=r;
  console.log(key,'nodes',per,'sight rays',r.rays,'see-through',r.seeThrough,'(sky',r.sky+')','clusters',r.clusters.length,'sky cracks',r.cracks,'floating props',r.floating.length,((Date.now()-t)/1000).toFixed(1)+'s');
  for(const g of r.clusters.slice(0,8))console.log('  see',g.n,g.at.join(','),g.ex[0].kind,'from',g.ex[0].from.join(','),'c',g.ex[0].collision,'r',g.ex[0].render);
  for(const g of r.crackClusters.slice(0,8))console.log('  crack',g.n,'from',g.ex[0].from.join(','),'elev',g.ex[0].elev,'heading',g.ex[0].heading);
  for(const f of r.floating.slice(0,8))console.log('  float',f.at.join(','),'gap',f.gap,'size',f.size.join('x'),f.materials.slice(0,3).join(' '));}
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(out,null,1));}
