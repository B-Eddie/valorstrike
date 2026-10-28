// perf3 (user: "keep iterating lag in BOTH offline and online games, focus online first"): the game server's world
// queries on the tick path must not allocate, and must answer exactly what the library answered.
// An online 5v5 profile (work/perf_online_profile.cjs: the real page against the real worker in-process) put the server at
// ~3-5 MB of garbage per 50 ms tick, most of it three-mesh-bvh's raycastFirst / shapecast under world.ray (fog of war sight
// rays, ability rays), world.blocked (every unit's motor step) and world.ground (floor probes), and ~1 ms per tick in
// world.nearValid's linear scan over every valid nav node (oobKill, every unit every tick).
// Checked on the real collision worlds (ascent + split; MAPS=all for six):
//  - world.ray / rayN / ground / blocked / ceiling == the original implementations on the library (MeshBVH.raycastFirst,
//    MeshBVH.shapecast with fresh closures, string-keyed floor cells), bit for bit, for thousands of random queries
//    (axis-aligned and degenerate directions included);
//  - world.nearValid == the full scan over valid nodes (world.nearValidScan), ties included;
//  - bytes allocated per ray / ground / blocked call (young generation big enough that no scavenge runs while measuring).
import cp from 'node:child_process';
if(!process.execArgv.some(a=>/semi-space/.test(a))){const r=cp.spawnSync(process.execPath,['--max-semi-space-size=256',...process.argv.slice(1)],{stdio:'inherit'});process.exit(r.status==null?1:r.status);}
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import v8 from 'node:v8';import * as T from 'three';import {loadWorld} from './src/world.js';import Motor from './src/motor.cjs';
const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
const MAPS=process.env.MAPS==='all'?['ascent','bind','breeze','haven','lotus','split']:(process.env.MAPS||'ascent,split').split(',');
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const out=[];
// the original (5456dcd) world.js queries on the library, kept here as the reference
function reference(W,key){const bvh=W.bvh,nav=W.nav;
 const floorCells=new Map();nav.nodes.forEach((p,i)=>{if(nav.valid&&!nav.valid[i])return;const k=Math.floor(p[0])+','+Math.floor(p[2]);if(!floorCells.has(k))floorCells.set(k,[]);floorCells.get(k).push(p);});
 const line=new T.Line3(),box=new T.Box3(),q=new T.Vector3(),v=new T.Vector3();
 const ground=(x,z,y)=>{const ray=new T.Ray(new T.Vector3(x,y+.32,z),new T.Vector3(0,-1,0));for(let i=0;i<24;i++){const h=bvh.raycastFirst(ray,T.DoubleSide);if(!h)break;if(Math.abs(h.face.normal.y)>.45)return h.point.y;ray.origin.y=h.point.y-.005;}let support=null,best=.65*.65;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of floorCells.get((Math.floor(x)+dx)+','+(Math.floor(z)+dz))||[]){const d=(p[0]-x)**2+(p[2]-z)**2;if(d<best&&p[1]<=y+.32&&p[1]>=y-.65){best=d;support=p;}}return support?Math.min(y,support[1]):y-10;};
 const blocked=(x,z,r,y,height=1.8)=>{if(Motor.clipBlocked(key,x,z,r,y,height))return true;line.start.set(x,y+r+.025,z);line.end.set(x,y+Math.max(r+.025,height-r),z);box.min.set(x-r,y+.025,z-r);box.max.set(x+r,y+height,z+r);let hit=false;bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+.025)return false;if(Math.min(t.a.x,t.b.x,t.c.x)>box.max.x||Math.max(t.a.x,t.b.x,t.c.x)<box.min.x||Math.min(t.a.z,t.b.z,t.c.z)>box.max.z||Math.max(t.a.z,t.b.z,t.c.z)<box.min.z||Math.min(t.a.y,t.b.y,t.c.y)>box.max.y)return false;if(t.closestPointToSegment(line,q,v)<r-.012){hit=true;return true;}return false;}});return hit;};
 const ray=(o,d,max=Infinity)=>{const h=bvh.raycastFirst(new T.Ray(new T.Vector3(...o),new T.Vector3(...d)),T.DoubleSide);return h&&h.distance<max?h.distance:Infinity;};
 const rayN=(o,d,max=Infinity)=>{const h=bvh.raycastFirst(new T.Ray(new T.Vector3(...o),new T.Vector3(...d)),T.DoubleSide);if(!h||!(h.distance<=max))return null;const n=h.face&&h.face.normal;return {distance:h.distance,normal:n?[n.x,n.y,n.z]:null};};
 return {ground,blocked,ray,rayN,ceiling:(x,z,l,h)=>ray([x,l+.01,z],[0,1,0],h-l)<Infinity};}
const same=(a,b,what)=>{if(Object.is(a,b))return;assert.deepEqual(a,b,what);};
// bytes per call: warmed up first (compiling f allocates); allocated = heap growth + whatever the GCs during the run freed
// (v8.GCProfiler); the queries sit in tagged arrays so a call passes already-boxed numbers and only the query's own garbage counts
const alloc=(f,n)=>{for(let i=0;i<30000;i++)f(i);const g=new v8.GCProfiler();g.start();const h0=v8.getHeapStatistics().used_heap_size;for(let i=0;i<n;i++)f(i);const h1=v8.getHeapStatistics().used_heap_size,st=g.stop();let freed=0;for(const e of st.statistics)freed+=e.beforeGC.heapStatistics.usedHeapSize-e.afterGC.heapStatistics.usedHeapSize;return Math.max(0,h1-h0+freed)/n;};
for(const map of MAPS){const W=await loadWorld(assets,map);assert(W.bvh,'world exposes its collision BVH (W.bvh) for this check');assert.equal(typeof W.nearValidScan,'function','world.nearValidScan (the full scan nearValid must equal)');
 const R=reference(W,map),N=W.nav.nodes,valid=N.map((_,i)=>i).filter(i=>!W.nav.valid||W.nav.valid[i]),pick=()=>N[valid[Math.floor(rnd()*valid.length)]];
 const dirs=[[0,-1,0],[0,1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,0,0]];
 const dir=k=>{if(k%17===0)return dirs[(k/17|0)%dirs.length];let x=rnd()-.5,y=(rnd()-.5)*(k%3?.4:2),z=rnd()-.5;const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
 const Q=[];for(let k=0;k<6000;k++){const p=pick(),o=[p[0]+(rnd()-.5)*4,p[1]+.2+rnd()*2,p[2]+(rnd()-.5)*4];Q.push([o,dir(k),k%4===0?Infinity:rnd()*40]);}
 let hits=0;for(const [o,d,m] of Q){const a=W.ray(o,d,m),b=R.ray(o,d,m);same(a,b,`${map} ray ${o} ${d} ${m}`);if(a<Infinity)hits++;same(W.rayN(o,d,m),R.rayN(o,d,m),`${map} rayN ${o} ${d} ${m}`);}
 assert(hits>Q.length/4,'rays hit the map ('+hits+')');
 for(let k=0;k<4000;k++){const p=pick(),x=p[0]+(rnd()-.5)*(k%5?2:12),z=p[2]+(rnd()-.5)*(k%5?2:12),y=p[1]+(rnd()-.5)*(k%3?1:8);same(W.ground(x,z,y),R.ground(x,z,y),`${map} ground ${x} ${z} ${y}`);}
 same(W.ground(NaN,0,0),R.ground(NaN,0,0),'ground NaN');same(W.ground(1e7,1e7,0),R.ground(1e7,1e7,0),'ground far away');
 let bl=0;for(let k=0;k<6000;k++){const p=pick(),r=[.3,.4,.5,.25][k%4],x=p[0]+(rnd()-.5)*(k%4?1.5:5),z=p[2]+(rnd()-.5)*(k%4?1.5:5),y=p[1]+(rnd()-.5)*(k%3?.4:3),h=k%5?1.8:1.2;const a=W.blocked(x,z,r,y,h);same(a,R.blocked(x,z,r,y,h),`${map} blocked ${x} ${z} ${r} ${y} ${h}`);if(a)bl++;}
 assert(bl>300&&bl<5700,'blocked answers both ways ('+bl+')');
 for(let k=0;k<1500;k++){const p=pick(),x=p[0]+(rnd()-.5)*2,z=p[2]+(rnd()-.5)*2,l=p[1]+rnd(),h=l+.5+rnd()*3;same(W.ceiling(x,z,l,h),R.ceiling(x,z,l,h),`${map} ceiling`);}
 // nearValid == full scan (far points, missing y, exact node positions = ties)
 for(let k=0;k<5000;k++){const p=pick(),far=k%10===0?300:30,x=p[0]+(rnd()-.5)*far,z=p[2]+(rnd()-.5)*far,y=k%3?p[1]+(rnd()-.5)*6:undefined;assert.equal(W.nearValid(x,z,y),W.nearValidScan(x,z,y),`${map} nearValid(${x},${z},${y})`);}
 for(let k=0;k<500;k++){const p=pick();assert.equal(W.nearValid(p[0],p[2],p[1]),W.nearValidScan(p[0],p[2],p[1]));assert.equal(W.nearValid(p[0],p[2]),W.nearValidScan(p[0],p[2]));}
 for(const [x,z,y] of [[NaN,0,0],[0,NaN,0],[Infinity,0,0],[0,0,NaN],[1e9,-1e9,0]])assert.equal(W.nearValid(x,z,y),W.nearValidScan(x,z,y),'nearValid edge '+[x,z,y]);
 // allocation per call
 const qo=Q.map(q=>q[0]),qd=Q.map(q=>q[1]),P=valid.map(i=>{const p=N[i];return [p[0]+.3,p[1]+.5,p[2]-.2,.4,'tagged'];});
 const aRay=alloc(i=>W.ray(qo[i%qo.length],qd[i%qd.length],30),20000),aGround=alloc(i=>{const p=P[i%P.length];W.ground(p[0],p[2],p[1]);},20000),aBlocked=alloc(i=>{const p=P[i%P.length];W.blocked(p[0],p[2],p[3],p[1]);},20000),aNear=alloc(i=>{const p=P[i%P.length];W.nearValid(p[0],p[2],p[1]);},20000);
 const ref=alloc(i=>R.ray(qo[i%qo.length],qd[i%qd.length],30),3000);
 out.push(`${map} B/call ray ${aRay.toFixed(0)} (library ${ref.toFixed(0)}) ground ${aGround.toFixed(0)} blocked ${aBlocked.toFixed(0)} nearValid ${aNear.toFixed(0)}`);
 assert(aRay<=16,`${map}: world.ray allocates ${aRay.toFixed(0)} B per call (library ${ref.toFixed(0)})`);assert(aGround<=16,`${map}: world.ground allocates ${aGround.toFixed(0)} B per call`);assert(aBlocked<=16,`${map}: world.blocked allocates ${aBlocked.toFixed(0)} B per call`);assert(aNear<=16,`${map}: world.nearValid allocates ${aNear.toFixed(0)} B per call`);
}
console.log('Server world queries: ray / rayN / ground / blocked / ceiling == library, nearValid == full scan, allocation-free; '+out.join('; '));
