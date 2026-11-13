import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import Motor from './motor.cjs';
import {fastBVH} from './bvh-fast.js';
export async function loadWorld(assets,key){
 const get=async f=>{const r=await assets.fetch(new Request('https://assets.local/worlds/'+key+'/'+f));if(!r.ok)throw Error('World asset missing: '+f);return r;};
 const meta=await (await get('meta.json')).json();const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(await(await get('position.bin')).arrayBuffer()),3));
 const index=new Uint32Array(await(await get('index.bin')).arrayBuffer());geometry.setIndex(new T.BufferAttribute(index,1));
 const roots=[];for(let i=0;i<meta.roots;i++)roots.push(await(await get('bvh'+i+'.bin')).arrayBuffer());
 const bvh=MeshBVH.deserialize({roots,index},geometry,{setIndex:false});
 const plants=await(await get('plants.json')).json();const nav=await(await get('navigation.json')).json(),map=await(await get('map.json')).json();
 // floor cells (ground's nav-node fallback) keyed by one small integer per 1 m cell instead of a 'x,z' string per lookup
 // (9 strings per ground call); a cell outside +-FC_R m has no nodes either way (an out-of-range or non-finite query finds nothing, as before)
 const FC_R=1<<14,fcKey=(fx,fz)=>(fx>-FC_R&&fx<FC_R&&fz>-FC_R&&fz<FC_R)?(fx+FC_R)*(2*FC_R)+(fz+FC_R):-1;
 const floorCells=new Map();nav.nodes.forEach((p,i)=>{if(nav.valid&&!nav.valid[i])return;const key=fcKey(Math.floor(p[0]),Math.floor(p[2]));if(key<0)throw Error('navigation node outside the floor-cell range');if(!floorCells.has(key))floorCells.set(key,[]);floorCells.get(key).push(p);});
 // Rope ascenders (shared motor ROPES): the motor climbs them; A* routes run over them through extra nav links (lower <->
 // upper floor node of each rope, valid nodes). Added before the leash grid and the playable set are built (the page does the same, native_maps_runtime nmRopes): Split's Vent room floor and the B Hell
 // pocket are only left (Vent: only reached) by rope, so they join the playable set. ropeLinks: 'a>b' -> {a, b, k, up}.
 const ropes=Motor.ROPES[key]||null,ropeLinks=new Map();for(const l of Motor.ropeLinks(ropes,nav.nodes,i=>!nav.valid||!!nav.valid[i])){ropeLinks.set(l.a+'>'+l.b,l);if(!nav.adj[l.a].includes(l.b))nav.adj[l.a].push(l.b);}
 const line=new T.Line3(),box=new T.Box3(),q=new T.Vector3(),v=new T.Vector3(),FQ=fastBVH(bvh),NOC=[];
 // perf3: the BVH queries below go through bvh-fast.js (allocation-free ports of MeshBVH.raycastFirst / shapecast, same answers bit for bit; test-bvh-fast.js)
 const RS=FQ.S,down=()=>{RS.dx=0;RS.dy=-1;RS.dz=0;RS.side=T.DoubleSide;RS.near=0;RS.far=Infinity;};
 const ground=(x,z,y)=>{RS.ox=x;RS.oy=y+.32;RS.oz=z;for(let i=0;i<24;i++){down();const h=FQ.cast();if(!h)break;if(Math.abs(h.face.normal.y)>.45)return h.point.y;RS.oy=h.point.y-.005;}let support=null,best=.65*.65;const fx=Math.floor(x),fz=Math.floor(z);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const L=floorCells.get(fcKey(fx+dx,fz+dz))||NOC;for(let k=0;k<L.length;k++){const p=L[k],d=(p[0]-x)**2+(p[2]-z)**2;if(d<best&&p[1]<=y+.32&&p[1]>=y-.65){best=d;support=p;}}}return support?Math.min(y,support[1]):y-10;};
 // Player clips (shared motor, movement only) first: invisible walls over open edges such as Ascent's A ramp pit.
 const BQ={y:.5,r:.5}/* object double fields: a double stored into a closure variable is boxed per store */,bTri=t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=BQ.y+.025)return false;/* cheap reject: triangle bounds outside the capsule box */if(Math.min(t.a.x,t.b.x,t.c.x)>box.max.x||Math.max(t.a.x,t.b.x,t.c.x)<box.min.x||Math.min(t.a.z,t.b.z,t.c.z)>box.max.z||Math.max(t.a.z,t.b.z,t.c.z)<box.min.z||Math.min(t.a.y,t.b.y,t.c.y)>box.max.y)return false;return t.closestPointToSegment(line,q,v)<BQ.r-.012;};
 const blockedRaw=(x,z,r,y,height=1.8)=>{if(Motor.clipBlocked(key,x,z,r,y,height))return true;line.start.set(x,y+r+.025,z);line.end.set(x,y+Math.max(r+.025,height-r),z);box.min.set(x-r,y+.025,z-r);box.max.set(x+r,y+height,z+r);if(FQ.fast){/* the same test on raw floats (bvh-fast capsuleAny): the box, the segment, y + .025 and r - .012 exactly as above */const K=FQ.C;K.x0=box.min.x;K.y0=box.min.y;K.z0=box.min.z;K.x1=box.max.x;K.y1=box.max.y;K.z1=box.max.z;K.sx=line.start.x;K.sy=line.start.y;K.sz=line.start.z;K.ex=line.end.x;K.ey=line.end.y;K.ez=line.end.z;K.yb=y+.025;K.lim=r-.012;return FQ.capsuleAny();}BQ.y=y;BQ.r=r;return FQ.shapeAny(box,bTri);};
 // Capsule answers are remembered (net lane, 13 Nov 2026): this world's collision never changes, so the same capsule gives the same
 // answer for good. The shared motor asks the same few capsules over and over when a unit is held against geometry - a player
 // pressing into a corner on Ascent: 256 queries a step, 48 distinct, the same ones again every tick while it stays there, each
 // ~60 us in that dense spot = 16 ms of a 25 ms tick for one unit (27 ms worst), which the deployed room could not keep up with.
 // A direct-mapped table keyed on the exact arguments (compared exactly, so an answer is never borrowed from a near miss).
 const BC_N=8192,bcX=new Float64Array(BC_N).fill(NaN),bcZ=new Float64Array(BC_N),bcR=new Float64Array(BC_N),bcY=new Float64Array(BC_N),bcH=new Float64Array(BC_N),bcV=new Uint8Array(BC_N);
 const blocked=(x,z,r,y,height=1.8)=>{const i=(Math.imul(x*4096|0,73856093)^Math.imul(z*4096|0,19349663)^Math.imul(y*4096|0,83492791)^Math.imul(r*1048576|0,40503)^Math.imul(height*4096|0,9973))&(BC_N-1);
  if(bcX[i]===x&&bcZ[i]===z&&bcR[i]===r&&bcY[i]===y&&bcH[i]===height)return bcV[i]===1;const v=blockedRaw(x,z,r,y,height);bcX[i]=x;bcZ[i]=z;bcR[i]=r;bcY[i]=y;bcH[i]=height;bcV[i]=v?1:0;return v;};
 // Playable leash (shared motor): horizontal moves stay on the navigation footprint (see motor.cjs leashOk); with the
 // move's origin (x0, z0) an outside unit may only move back toward it.
 const leashCells=Motor.leashGrid(nav.nodes,nav.valid,nav.adj),leash=(x,z,y,x0,z0)=>Motor.leashOk(leashCells,x,z,y,ground,x0,z0);
 // new T.Vector3(...o): a missing component is 0 (the constructor's default)
 const c0=v=>v===undefined?0:v,setRay=(o,d)=>{RS.ox=c0(o[0]);RS.oy=c0(o[1]);RS.oz=c0(o[2]);RS.dx=c0(d[0]);RS.dy=c0(d[1]);RS.dz=c0(d[2]);RS.side=T.DoubleSide;RS.near=0;RS.far=Infinity;};
 const ray=(o,d,max=Infinity)=>{setRay(o,d);const h=FQ.cast();return h&&h.distance<max?h.distance:Infinity;};
 // ray with the surface normal (Sova bolt bounces): {distance, normal:[x,y,z]} | null
 // rayClear(): the ray the caller wrote into rayS (ox oy oz / dx dy dz, and max) has no hit closer than max - ray(o, d, max)
 // === Infinity (side DoubleSide, no near / far, as ray) without the arrays or a boxed double (fog of war's sight tests)
 const rayClear=()=>{RS.side=T.DoubleSide;RS.near=0;RS.far=Infinity;const h=FQ.cast();return !(h&&h.distance<RS.max);};
 const rayN=(o,d,max=Infinity)=>{setRay(o,d);const h=FQ.cast();if(!h||!(h.distance<=max))return null;const n=h.face&&h.face.normal;return {distance:h.distance,normal:n?[n.x,n.y,n.z]:null};};
 const seen=new Set(),components=[];for(let i=0;i<nav.nodes.length;i++){if(seen.has(i)||!nav.valid[i])continue;const c=[i];seen.add(i);for(let k=0;k<c.length;k++)for(const j of nav.adj[c[k]])if(!seen.has(j)&&nav.valid[j]){seen.add(j);c.push(j);}components.push(c);}components.sort((a,b)=>b.length-a.length);const playable=components[0],allowed=new Set(playable);
 // Nearest playable node. A uniform grid over the playable nodes replaces the full scan (bots call this on every
 // repath); rings are searched outward until no farther cell can beat the best, and ties keep the scan's order, so
 // the result is identical to the linear scan (test-perf.js checks this).
 const nearScan=(x,z,y)=>{let best=-1,d=Infinity;for(const i of playable){const p=nav.nodes[i],v=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?2*(p[1]-y)**2:0);if(v<d){best=i;d=v;}}return best;};
 const CELL=4;let gx0=Infinity,gz0=Infinity,gx1=-Infinity,gz1=-Infinity;for(const i of playable){const p=nav.nodes[i];gx0=Math.min(gx0,p[0]);gz0=Math.min(gz0,p[2]);gx1=Math.max(gx1,p[0]);gz1=Math.max(gz1,p[2]);}
 const GW=playable.length?Math.floor((gx1-gx0)/CELL)+1:0,GH=playable.length?Math.floor((gz1-gz0)/CELL)+1:0,cells=Array.from({length:GW*GH},()=>[]);
 playable.forEach((i,k)=>{const p=nav.nodes[i];cells[Math.floor((p[2]-gz0)/CELL)*GW+Math.floor((p[0]-gx0)/CELL)].push(k);});
 const near=(x,z,y)=>{if(!playable.length)return -1;if(!Number.isFinite(x)||!Number.isFinite(z))return nearScan(x,z,y);const fy=Number.isFinite(y);
  const cx=Math.max(0,Math.min(GW-1,Math.floor((x-gx0)/CELL))),cz=Math.max(0,Math.min(GH-1,Math.floor((z-gz0)/CELL)));let bestK=-1,d=Infinity;
  for(let r=0,R=Math.max(GW,GH);r<=R;r++){if(r>0){const lb=(r-1)*CELL;if(lb*lb>d)break;}
   for(let j=cz-r;j<=cz+r;j++){if(j<0||j>=GH)continue;const edge=j===cz-r||j===cz+r;for(let i=cx-r;i<=cx+r;i+=edge?1:2*r||1){if(i<0||i>=GW)continue;
    for(const k of cells[j*GW+i]){const p=nav.nodes[playable[k]],v=(p[0]-x)**2+(p[2]-z)**2+(fy?2*(p[1]-y)**2:0);if(v<d||(v===d&&k<bestK)){bestK=k;d=v;}}}}}
  return bestK<0?-1:playable[bestK];};
 const allValid=nav.nodes.map((_,i)=>i).filter(i=>!nav.valid||nav.valid[i]),nearValidScan=(x,z,y)=>{let best=-1,d=Infinity;for(const i of allValid){const p=nav.nodes[i],v=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?2*(p[1]-y)**2:0);if(v<d){best=i;d=v;}}return best;}; // every valid node is intended coverage: fragmentation into islands is a data defect (fence-v2), not out-of-play
 // perf3: nearValid (oobKill: every unit, every server tick) on the same kind of grid as near(), over every valid node;
 // identical to the full scan (ties keep the scan's order; test-bvh-fast.js / test-perf.js style check)
 let vx0=Infinity,vz0=Infinity,vx1=-Infinity,vz1=-Infinity;for(const i of allValid){const p=nav.nodes[i];vx0=Math.min(vx0,p[0]);vz0=Math.min(vz0,p[2]);vx1=Math.max(vx1,p[0]);vz1=Math.max(vz1,p[2]);}
 const VW=allValid.length?Math.floor((vx1-vx0)/CELL)+1:0,VH=allValid.length?Math.floor((vz1-vz0)/CELL)+1:0,vcells=Array.from({length:VW*VH},()=>[]);
 allValid.forEach((i,k)=>{const p=nav.nodes[i];vcells[Math.floor((p[2]-vz0)/CELL)*VW+Math.floor((p[0]-vx0)/CELL)].push(k);});
 const nearValid=(x,z,y)=>{if(!allValid.length)return -1;if(!Number.isFinite(x)||!Number.isFinite(z))return nearValidScan(x,z,y);const fy=Number.isFinite(y);
  const cx=Math.max(0,Math.min(VW-1,Math.floor((x-vx0)/CELL))),cz=Math.max(0,Math.min(VH-1,Math.floor((z-vz0)/CELL)));let bestK=-1,d=Infinity;
  for(let r=0,R=Math.max(VW,VH);r<=R;r++){if(r>0){const lb=(r-1)*CELL;if(lb*lb>d)break;}
   for(let j=cz-r;j<=cz+r;j++){if(j<0||j>=VH)continue;const edge=j===cz-r||j===cz+r;for(let i=cx-r;i<=cx+r;i+=edge?1:2*r||1){if(i<0||i>=VW)continue;
    const L=vcells[j*VW+i];for(let m=0;m<L.length;m++){const k=L[m],p=nav.nodes[allValid[k]],v=(p[0]-x)**2+(p[2]-z)**2+(fy?2*(p[1]-y)**2:0);if(v<d||(v===d&&k<bestK)){bestK=k;d=v;}}}}}
  return bestK<0?-1:allValid[bestK];};

 const plantAt=(x,z)=>{const t=map.transform,p=map.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),sx=ca*x-sa*z+t.cx,sz=sa*x+ca*z+t.cz,u=Math.floor((sx*100*p.xMultiplier+p.xScalarToAdd)*1024),v=Math.floor((-sz*100*p.yMultiplier+p.yScalarToAdd)*1024);for(const row of plants.rows[v]||[])if(u>=row[0]&&u<row[1])return row[2];return '';};return {plantAt,ground,blocked,blockedRaw,leash,ropes,ropeLinks,ray,rayN,rayS:RS,rayClear,near,nearValid,nearValidScan,nearScan,bvh,nav,map,playable,allowed,bytes:geometry.attributes.position.array.byteLength+index.byteLength+roots.reduce((a,r)=>a+r.byteLength,0),ceiling:(x,z,l,h)=>ray([x,l+.01,z],[0,1,0],h-l)<Infinity};
}
