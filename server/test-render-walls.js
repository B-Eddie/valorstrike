// Visible walls have collision where they are drawn (user, Lotus: "There's still a hole in Lotus. It's next to the mound"
// / "It's in the wall" / "The hitboxes also don't line up with walls in that map"). The exporter kept name-matched
// objects (/Water|Light|Shadow|Floater|.../ in the object name) out of collision.bin, which also dropped solid walls:
// Lotus' rock wall west of C Mound (x -42.5, z 16.8-21.5) and C Hall / C Site temple walls, Breeze's Mid Bottom stall
// building. tools/map-render-walls.mjs appends those render triangles to collision-patch.bin. On the prebuilt server
// world (public/worlds, also what the page fetches):
//  1. Lotus C Mound west wall: horizontal rays toward it hit collision where the rock is drawn (within 0.1 m), at foot,
//     chest and head height across the whole former gap; bullets (world.ray) stop at it;
//  2. a unit walking west into that wall from the mound side is stopped at the rock face (never inside or behind it);
//  3. Breeze Mid Bottom stall: a ray across it stops at its drawn wall, not 20 m further;
//  4. map-wide alignment on Lotus and Breeze: of horizontal sight rays from seeded playable nodes that hit a solid
//     drawn wall within 12 m, the share where collision lets the ray pass more than 0.6 m beyond the wall is bounded
//     (was 2.4% on Lotus, 1.0% on Breeze before the patch; 0.06% / 0.08% after); the median offset is 0;
//  5. the tool is idempotent on the shipped patch: no reachable solid render-only surface is left uncovered.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import * as T from 'three';
import {loadWorld} from './src/world.js';import {loadRender} from './tools/map-render.mjs';import {renderWalls,NONSOLID} from './tools/map-render-walls.mjs';
const here=path.dirname(new URL(import.meta.url).pathname),require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const world=k=>loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(here,'public'+new URL(r.url).pathname)))},k);
const solidHit=(R,ray,max)=>{for(const h of R.bvh.raycast(ray,T.DoubleSide).sort((a,b)=>a.distance-b.distance)){if(h.distance>max)return null;const m=R.prims[R.triMat[h.faceIndex]];if(m.alpha==='BLEND'||NONSOLID.test(m.name))continue;return h.distance;}return null;};
const ray=new T.Ray();
// 4. alignment metric over seeded playable nodes
function alignment(W,R,per){let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,pl=W.playable;let walls=0,pass=0;const offs=[],bad=[];
 for(let k=0;k<per;k++){const n=W.nav.nodes[pl[Math.floor(rnd()*pl.length)]];for(const hgt of [.5,1.2,1.7])for(let a=0;a<24;a++){const th=(a+rnd())/24*Math.PI*2,o=[n[0],n[1]+hgt,n[2]],d=[Math.sin(th),0,Math.cos(th)];
  ray.origin.set(...o);ray.direction.set(...d);const r=solidHit(R,ray,12);if(r==null)continue;walls++;const c=W.ray(o,d,13);if(!Number.isFinite(c)||c>r+.6){pass++;if(bad.length<6)bad.push(o.map((v,i)=>+(v+d[i]*r).toFixed(2)));}else offs.push(c-r);}}
 offs.sort((a,b)=>a-b);return {walls,pass,share:pass/walls,median:offs[offs.length>>1],bad};}
{const W=await world('lotus'),R=loadRender('lotus',{bvh:true});
 // 1. C Mound west wall, former gap z 16.8..21.5
 let n=0;for(let z=16.9;z<=21.4;z+=.25)for(const y of [5.2,5.9,6.6,7.4]){const o=[-40.6,y,z],d=[-1,0,0];ray.origin.set(...o);ray.direction.set(...d);const r=solidHit(R,ray,4);if(r==null)continue;n++;
  const c=W.ray(o,d,6);assert.ok(Number.isFinite(c)&&Math.abs(c-r)<.1,'Lotus C Mound west rock wall at z '+z.toFixed(2)+' y '+y+': drawn at '+r.toFixed(2)+' m, collision '+(Number.isFinite(c)?c.toFixed(2):'none')+' (hole in the wall)');}
 assert.ok(n>=60,'rock wall drawn across the former gap ('+n+' rays)');
 // 2. walk west into the wall from the mound side
 for(const z of [17.5,19,20.5]){const s=W.nav.nodes[W.near(-41.5,z,4.83)],u={x:s[0],y:s[1],z:s[2]};
  for(let i=0;i<128*2;i++)Motor.step(u,{x:-1,z:0,speed:6.75},1/128,W);
  ray.origin.set(u.x,u.y+1,u.z);ray.direction.set(-1,0,0);const r=solidHit(R,ray,5);assert.ok(r!=null,'rock wall drawn west of the unit at '+[u.x,u.y,u.z].map(v=>v.toFixed(2)));
  assert.ok(r>.2,'walking west from z '+z+' stops at the drawn rock face (unit '+r.toFixed(2)+' m from it at '+[u.x,u.y,u.z].map(v=>v.toFixed(2))+')');assert.ok(u.x>-42.6&&u.y>4.5,'and stays in front of it on the C floor');}
 const a=alignment(W,R,600);console.log('lotus alignment',JSON.stringify(a));
 assert.ok(a.share<.004,'Lotus: drawn walls collision passes through '+(a.share*100).toFixed(2)+'% of '+a.walls+' wall hits (e.g. '+a.bad.map(p=>p.join(',')).join(' ')+')');assert.equal(a.median,0,'Lotus median wall offset 0');
 const left=renderWalls('lotus',{R});assert.equal(left.tris.length,0,'Lotus: reachable solid render-only surfaces left uncovered: '+JSON.stringify(left.byMaterial)+' (run node tools/map-render-walls.mjs lotus)');}
{const W=await world('breeze'),R=loadRender('breeze',{bvh:true});
 for(const [o,d] of [[[-10,4.6,30],[1,0,0]],[[-10,5.6,30],[1,0,0]],[[-1,4.6,24],[0,0,1]]]){ray.origin.set(...o);ray.direction.set(...d);const r=solidHit(R,ray,25),c=W.ray(o,d,30);assert.ok(r!=null&&Number.isFinite(c)&&Math.abs(c-r)<.2,'Breeze Mid Bottom stall from '+o+': drawn at '+r?.toFixed(2)+' m, collision '+c.toFixed(2));}
 const a=alignment(W,R,400);console.log('breeze alignment',JSON.stringify(a));assert.ok(a.share<.004,'Breeze: collision passes through '+(a.share*100).toFixed(2)+'% of drawn wall hits');
 const left=renderWalls('breeze',{R});assert.equal(left.tris.length,0,'Breeze: reachable solid render-only surfaces left uncovered: '+JSON.stringify(left.byMaterial));}
console.log('render walls: Lotus C Mound west wall + Breeze Mid Bottom stall have collision where drawn; wall alignment bounded on Lotus/Breeze; tool idempotent');
