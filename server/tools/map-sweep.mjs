// Remaining-issues sweep over a map's playable area, with the shared motor (server and offline client walk the same
// BVH, leash and clips: server/src/motor.cjs == vendor/valorant-feel.js):
//  trap:      (every TRAP-th sampled node, default 3) the motor walks 0.4 s from the node in a direction and ends where
//             it cannot walk out again (8 directions x 0.3 s, < 0.1 m each): a stuck spot a player can walk into
//  stuck:     a capsule placed on a playable node cannot leave it: walking 0.4 s in each of 8 directions moves it
//             < 0.3 m every time, and a jump / crouch-jump in each direction does not free it either
//  embedded:  the node's capsule (r .4, 1.8 m) overlaps collision at its floor and 0.32 m above it (spawning there sinks)
//  edgeWall:  a cardinal navigation edge between two playable nodes (both able to hold a capsule) that the motor cannot
//             walk (run 0.8 s toward the next node, jump if it is > 0.42 m higher); re-run without the leash
//             tells `leash` (an invisible wall the leash put on a normal path) from `collision` (geometry). A collision
//             block with no render surface within 0.75 m along the edge at knee / chest height is `invisible`.
//  spawns:    the server's team spawn candidates (simulation.js teamSpawnPoint: playable nodes within 12 m of the
//             anchor, |dy| < 2, capsule .43 clear): count, embedded / stuck ones, nav-reachable to each site anchor
//  sites:     each site anchor: in its plant zone (world.plantAt) and plantable (spike.js siteAt: |y - anchor y| < 2),
//             on a playable node; playable nodes inside the zone: plantable / zone-but-wrong-height (siteAt refuses)
//  callouts:  every callout nearest-playable-node within 3 m and nav-reachable from the attacker spawn
// Usage: node tools/map-sweep.mjs [maps...]  (STRIDE=n stuck/edge sampling, default 2; JSON=path writes the report)
import fs from 'node:fs';import {loadWorld} from '../src/world.js';import {createRequire} from 'node:module';
process.chdir(new URL('..',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require(process.env.MOTOR||'../src/motor.cjs');
export const MAPS=['ascent','bind','haven','split','lotus','breeze'];
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const DT=1/30,DIRS=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4)]);
function place(w,p){const y=w.ground(p[0],p[2],p[1]+.1);return {x:p[0],z:p[2],y:Number.isFinite(y)&&y>p[1]-1?y:p[1],vx:0,vz:0,vy:0,ch:0};}
function run(w,P,dir,T,plan){for(let t=0;t<T;t+=DT){const i={x:dir[0],z:dir[1],speed:6.75,jump:false,duck:false};if(plan)plan(t,i);Motor.step(P,i,DT,w);}return P;}
function reach(w,from,to){const seen=new Uint8Array(w.nav.nodes.length),q=[from];seen[from]=1;for(let k=0;k<q.length;k++){if(q[k]===to)return true;for(const j of w.nav.adj[q[k]])if(!seen[j]&&w.allowed.has(j)){seen[j]=1;q.push(j);}}return false;}
function reachSet(w,from){const seen=new Uint8Array(w.nav.nodes.length),q=[from];seen[from]=1;for(let k=0;k<q.length;k++)for(const j of w.nav.adj[q[k]])if(!seen[j]&&w.allowed.has(j)){seen[j]=1;q.push(j);}return seen;}
// The server collision BVH (public/worlds, as world.js builds it): centroids of the triangles a capsule box meets.
export async function collisionOf(key){const T=await import('three'),{MeshBVH}=await import('three-mesh-bvh'),dir='public/worlds/'+key+'/',meta=JSON.parse(fs.readFileSync(dir+'meta.json')),rd=f=>{const b=fs.readFileSync(dir+f);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(rd('position.bin')),3));const index=new Uint32Array(rd('index.bin'));g.setIndex(new T.BufferAttribute(index,1));const roots=[];for(let i=0;i<meta.roots;i++)roots.push(rd('bvh'+i+'.bin'));const bvh=MeshBVH.deserialize({roots,index},g,{setIndex:false});
 return {touching:(x,z,r,y,H)=>{const box=new T.Box3(new T.Vector3(x-r,y+.025,z-r),new T.Vector3(x+r,y+H,z+r)),out=[];bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+.025||!t.intersectsBox(box))return false;out.push([(t.a.x+t.b.x+t.c.x)/3,(t.a.y+t.b.y+t.c.y)/3,(t.a.z+t.b.z+t.c.z)/3]);return out.length>=64;}});return out;}};}
export async function sweep(key,{stride=2,render=null,collision=null}={}){const w=await loadWorld(assets,key),N=w.nav.nodes,S=w.nav.step||.75,out={key,playable:w.playable.length,stride};
 const embedded=i=>{const p=N[i],y=w.ground(p[0],p[2],p[1]+.1);return w.blocked(p[0],p[2],.4,y,1.8)&&w.blocked(p[0],p[2],.4,y+.32,1.8);};
 const free=i=>{const p=N[i],y=w.ground(p[0],p[2],p[1]+.1);return !w.blocked(p[0],p[2],.4,y,1.8);};
 const stuckAt=i=>{const p=N[i];for(const d of DIRS){const P=run(w,place(w,p),d,.4);if(Math.hypot(P.x-p[0],P.z-p[2])>=.3||Math.abs(P.y-p[1])>.5)return null;}
  for(const d of DIRS){const P=run(w,place(w,p),d,1.1,(t,i)=>{i.jump=t<.1;i.duck=t>.12;});if(Math.hypot(P.x-p[0],P.z-p[2])>=.3)return 'jump';}return 'stuck';};
 // trap: a spot the motor walks INTO and cannot walk out of (8 directions, 0.3 s, < 0.1 m each); a jump may still free it
 const trapAt=P0=>{for(const d of DIRS){const P=Object.assign({},P0);run(w,P,d,.3);if(Math.hypot(P.x-P0.x,P.z-P0.z)>=.1||Math.abs(P.y-P0.y)>.3)return false;}return true;};
 out.trap=[];const trapStride=+process.env.TRAP||3;
 // stuck / embedded over every stride-th playable node
 out.stuck=[];out.jumpOnly=[];out.embedded=[];out.sampled=0;
 for(let k=0;k<w.playable.length;k+=stride){const i=w.playable[k];out.sampled++;if(embedded(i)){out.embedded.push(N[i].map(v=>+v.toFixed(2)));continue;}const s=stuckAt(i);
  if(!s&&(k/stride)%trapStride===0)for(const d of DIRS){const P=run(w,place(w,N[i]),d,.4);if(Math.hypot(P.x-N[i][0],P.z-N[i][2])<.3||P.air)continue;const Q={x:P.x,y:P.y,z:P.z,vx:0,vz:0,vy:0,ch:0};if(trapAt(Q)){out.trap.push({from:N[i].map(v=>+v.toFixed(2)),dir:d.map(v=>+v.toFixed(2)),at:[Q.x,Q.y,Q.z].map(v=>+v.toFixed(2))});break;}}if(s==='stuck')out.stuck.push(N[i].map(v=>+v.toFixed(2)));else if(s==='jump')out.jumpOnly.push(N[i].map(v=>+v.toFixed(2)));}
 // cardinal edges between capsule-free playable nodes
 out.edges=0;out.edgeWall=[];const leash=w.leash;
 // Run toward the next node; an edge up more than a step (0.42 m) is also tried with a jump after two frames of run-up
 // (a standing jump keeps no air speed: the air cap is the take-off speed). Reached = within 0.35 m horizontally, < 1.2 m apart.
 const walkEdge=(a,b,useLeash)=>{if(!useLeash)w.leash=undefined;const p=N[a],q=N[b],L=Math.hypot(q[0]-p[0],q[2]-p[2]),d=[(q[0]-p[0])/L,(q[2]-p[2])/L],up=q[1]-p[1]>.42;let ok=false,P=null;
  for(const jump of up?[false,true]:[false]){P=place(w,p);for(let t=0;t<.8&&!ok;t+=DT){Motor.step(P,{x:d[0],z:d[1],speed:6.75,jump:jump&&t>1.5*DT&&t<.12},DT,w);if(Math.hypot(P.x-q[0],P.z-q[2])<.35&&Math.abs(P.y-q[1])<1.2)ok=true;}
   // a drop edge (> 1 m down): the run carries past the next node in the air; reached = landed on its floor beyond it
   if(!ok&&p[1]-q[1]>1&&!P.air&&Math.abs(P.y-q[1])<.6&&(P.x-p[0])*d[0]+(P.z-p[2])*d[1]>=L-.35)ok=true;if(ok)break;}
  w.leash=leash;return ok||P;};
 // Why the motor refused the next 5 cm from where the walk stopped (motor.cjs moveAxis, same checks in the same order).
 const C=Motor.C,why=(P,d)=>{const x=P.x+d[0]*.05,z=P.z+d[1]*.05,H=1.8;if(leash&&!leash(x,z,P.y,P.x,P.z))return {why:'leash'};if(!w.blocked(x,z,.4,P.y,H))return {why:'free'};
  let lift=null;for(let h=.05;h<=2;h+=.05)if(!w.blocked(x,z,.4,P.y+h,H)){lift=+h.toFixed(2);break;}const top=P.y+C.stepHeight,support=w.ground(x,z,top);
  if(support>top+.001)return {why:'tall',lift};if(w.blocked(x,z,.41,top,H))return {why:'tall',lift};if(w.ceiling(P.x,P.z,P.y+H,top+H))return {why:'ceiling',lift};
  const sx=Math.sign(d[0]),sz=Math.sign(d[1]);let prev=Math.max(w.ground(P.x,P.z,top),P.y-.2),dip=false;for(let s=.1;s<.55;s+=.1){const g=w.ground(P.x+sx*s,P.z+sz*s,top);if(g<prev-1)continue;if(g-prev>C.stepHeight+.01)return {why:dip?'riserDip':'riser',lift,at:+s.toFixed(1),rise:+(g-prev).toFixed(2),overStand:+(g-P.y).toFixed(2)};if(g<prev-.1)dip=true;prev=g;}
  return {why:'base',lift};};
 for(let k=0;k<w.playable.length;k+=stride){const a=w.playable[k],p=N[a];if(!free(a))continue;
  for(const b of w.nav.adj[a]){if(!w.allowed.has(b))continue;const q=N[b],dx=q[0]-p[0],dz=q[2]-p[2];if(!((Math.abs(Math.abs(dx)-S)<.05&&Math.abs(dz)<.05)||(Math.abs(Math.abs(dz)-S)<.05&&Math.abs(dx)<.05)))continue;if(!free(b))continue;
   out.edges++;const r=walkEdge(a,b,true);if(r===true)continue;const L0=Math.hypot(dx,dz),rec={from:p.map(v=>+v.toFixed(2)),to:q.map(v=>+v.toFixed(2)),stop:[r.x,r.y,r.z].map(v=>+v.toFixed(2))};Object.assign(rec,why(r,[dx/L0,dz/L0]));
   if(leash&&walkEdge(a,b,false)===true){rec.kind='leash';}else{rec.kind='collision';if(render&&collision){
    // the collision triangles the capsule meets 5 cm ahead of where it stopped; invisible = none of them has a render
    // surface within 5 cm of its centroid (collision without anything drawn there)
    const x=r.x+dx/L0*.05,z=r.z+dz/L0*.05,tris=collision.touching(x,z,.4,r.y,1.8);rec.touching=tris.length;let shown=0;for(const c of tris)if(render.near(c)<=.05)shown++;rec.shown=shown;if(tris.length&&!shown)rec.kind='invisible';}}
   out.edgeWall.push(rec);}}
 // spawns
 const M=w.map;out.spawns={};const siteIdx={};for(const [s,a]of Object.entries(M.sites))siteIdx[s]=w.near(a[0],a[2],a[1]);
 for(const [team,anchor]of [['attacker',M.attacker],['defender',M.defender]]){const c=w.playable.filter(i=>{const p=N[i];return Math.hypot(p[0]-anchor[0],p[2]-anchor[2])<12&&Math.abs(p[1]-anchor[1])<2&&!w.blocked(p[0],p[2],.43,p[1],1.92);});
  const r=reachSet(w,c[0]??w.near(anchor[0],anchor[2],anchor[1]));const bad=[];for(const i of c){const e=embedded(i),s=e?null:stuckAt(i),cut=!r[i];if(e||s==='stuck'||cut)bad.push({at:N[i],embedded:e,stuck:s==='stuck',cut});}
  out.spawns[team]={candidates:c.length,bad,reachSites:Object.fromEntries(Object.entries(siteIdx).map(([s,i])=>[s,!!r[i]]))};}
 // sites
 out.sites={};for(const [s,a]of Object.entries(M.sites)){const ai=siteIdx[s],an=N[ai];let plantable=0,wrongHeight=[];
  for(const i of w.playable){const p=N[i];if(w.plantAt(p[0],p[2])!==s)continue;if(Math.abs(p[1]-a[1])<2)plantable++;else wrongHeight.push(p.map(v=>+v.toFixed(2)));}
  out.sites[s]={anchor:a,anchorZone:w.plantAt(a[0],a[2]),anchorNode:an,anchorNodeDist:+Math.hypot(an[0]-a[0],an[2]-a[2]).toFixed(2),anchorNodeZone:w.plantAt(an[0],an[2]),anchorFloor:+w.ground(a[0],a[2],a[1]+.5).toFixed(2),plantable,wrongHeight:wrongHeight.length,wrongHeightAt:wrongHeight.slice(0,40)};}
 // callouts
 const atk=reachSet(w,w.near(M.attacker[0],M.attacker[2],M.attacker[1]));out.callouts=[];
 for(const c of M.callouts||[]){const p=c.position,i=w.near(p[0],p[2],p[1]),n=N[i],d=Math.hypot(n[0]-p[0],n[2]-p[2]);out.callouts.push({name:c.name,at:p,node:n,dist:+d.toFixed(2),dy:+(n[1]-p[1]).toFixed(2),reach:!!atk[i]});}
 return out;}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):MAPS,all={};let R=null,CL=null;
 for(const key of maps){const t=Date.now();if(process.env.RENDER){const {loadRender}=await import('./map-render.mjs');const r=loadRender(key,{bvh:true});const T=await import('three');const tgt={point:new T.Vector3()},v=new T.Vector3();R={ray:(o,d)=>{const h=r.bvh.raycastFirst(new T.Ray(new T.Vector3(...o),new T.Vector3(...d)),T.DoubleSide);return h?h.distance:Infinity;},near:c=>{v.set(...c);const h=r.bvh.closestPointToPoint(v,tgt,0,.5);return h?h.distance:Infinity;}};CL=await collisionOf(key);}
  const r=await sweep(key,{stride:+process.env.STRIDE||2,render:R,collision:CL});all[key]=r;R=null;CL=null;
  const kinds={};for(const e of r.edgeWall){const k=e.kind+'/'+e.why;kinds[k]=(kinds[k]||0)+1;}
  console.log(key,'playable',r.playable,'sampled',r.sampled,'stuck',r.stuck.length,'trap',r.trap.length,'jumpOnly',r.jumpOnly.length,'embedded',r.embedded.length,'edges',r.edges,'blocked',JSON.stringify(kinds),((Date.now()-t)/1000).toFixed(0)+'s');
  for(const [k,v]of Object.entries(r.spawns))console.log('  spawn',k,v.candidates,'bad',v.bad.length,JSON.stringify(v.reachSites));
  for(const [k,v]of Object.entries(r.sites))console.log('  site',k,'anchorZone',v.anchorZone,'anchorNodeZone',v.anchorNodeZone,'nodeDist',v.anchorNodeDist,'plantable',v.plantable,'wrongHeight',v.wrongHeight);
  for(const c of r.callouts)if(!c.reach||c.dist>3)console.log('  callout',c.name,JSON.stringify(c));
  if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(all,null,1));}}
