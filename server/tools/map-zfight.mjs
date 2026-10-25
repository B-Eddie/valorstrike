// Z-fighting scan (render meshes, scene.gltf). At runtime every converted map material is double-sided
// (nmPrepareScene), so two triangles of different primitives that lie on the same plane (all three corners of one within
// TOL of the other's plane, normals parallel either way) and overlap by more than MIN_AREA flicker against each other.
// Classes per pair:
//   dup      the same triangle twice (corners within TOL): one copy is hidden for good -> drop it (keep the opaque /
//            larger-material copy)
//   decal    one side is a Decal/Floater material: the runtime already pulls those forward (nmDecalApply polygonOffset)
//   overlay  partial overlap of two surface layers: the layer with less total area in the map (the trim/overlay/patch)
//            is pulled forward with a material polygonOffset so it wins every frame instead of flickering; offsets are
//            graded (levels 1..4, colorLayers) so overlapping layers sit on different levels
// scanZFight(key,{region,fix}) -> {pairs, area, byClass, top:[...], fix:{o:[material names], d:{material:[tri ids]}}}
// region: [[x,z,r],...] restricts the scan to triangles whose centroid is inside one of the circles (tests).
// fix: a runtime fix (NM_ZFIX entry {o:{material:level},d:{material:[tri]}}) to apply first (dropped triangles skipped;
// a pair whose materials sit at different offset levels counts as resolved).
// Usage: node tools/map-zfight.mjs [maps...]   (JSON=path writes the full report)
import fs from 'node:fs';import * as T from 'three';import {loadRender} from './map-render.mjs';
const TOL=.01,MIN_AREA=.005,DOT=.9995;
const DECAL=/Decal|Floater/i;
function clip(poly,a,b){// keep the side of edge a->b where the triangle lies (ccw in 2D)
 const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],sp=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),sq=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);if(sp>=0)out.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;}
function area2(P){let s=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];s+=p[0]*q[1]-q[0]*p[1];}return s/2;}
export function overlap(A,B){// two 2D triangles -> overlap area
 const ccw=t=>area2(t)<0?[t[0],t[2],t[1]]:t;A=ccw(A);B=ccw(B);let P=A;for(let i=0;i<3&&P.length;i++)P=clip(P,B[i],B[(i+1)%3]);return P.length>2?Math.abs(area2(P)):0;}
// Offset levels for the overlapping layers: weighted DSatur colouring of the material overlap graph with K levels
// (0 = no offset, 1..K-1 = pulled forward that many steps; K = 5, so at most 4 steps), most constrained material first, each taking the level
// that leaves the fewest overlapping triangle pairs on one level. Every pair whose materials differ in level is drawn
// in a fixed order instead of flickering. groups: scan 'top' entries ({pair:'A | B [overlay]',cls,n}).
// focus: [[x,z,r],...] areas whose pairs weigh 1000x (the seams players reported), so they are separated first.
export const SEAMS={ascent:[[-22,-18.75],[11.25,2],[14.5,20.5],[49,-39.75]],split:[[-35.75,18.5],[15.75,-18]],breeze:[[-18.25,-70.25],[7.75,-48]]};
export function colorLayers(groups,K=5,focus=null){const adj=new Map(),w=new Map(),add=(a,b,n)=>{let l=adj.get(a);if(!l)adj.set(a,l=new Set());l.add(b);w.set(a+'\n'+b,(w.get(a+'\n'+b)||0)+n);};
 for(const g of groups){if(g.cls!=='overlay')continue;const [a,b]=g.pair.replace(/ \[[a-z]+\]$/,'').split(' | ');if(a===b)continue;const n=g.n*(focus&&g.at&&focus.some(([x,z,r])=>(g.at[0]-x)**2+(g.at[2]-z)**2<=r*r)?1000:1);add(a,b,n);add(b,a,n);}
 const col=new Map(),names=[...adj.keys()].sort(),deg=new Map(names.map(m=>[m,[...adj.get(m)].reduce((s,n)=>s+w.get(m+'\n'+n),0)]));
 while(col.size<names.length){let best=null,bs=-1,bd=-1;for(const m of names){if(col.has(m))continue;const sat=new Set();for(const n of adj.get(m))if(col.has(n))sat.add(col.get(n));if(sat.size>bs||(sat.size===bs&&deg.get(m)>bd)){best=m;bs=sat.size;bd=deg.get(m);}}
  const cost=new Array(K).fill(0);for(const n of adj.get(best))if(col.has(n))cost[col.get(n)]+=w.get(best+'\n'+n);let c=0;for(let k=1;k<K;k++)if(cost[k]<cost[c])c=k;col.set(best,c);}
 const o={};for(const m of names)if(col.get(m)>0)o[m]=col.get(m);return o;}
export function scanZFight(key,{region=null,fix=null,R=null}={}){
 if(fix&&Array.isArray(fix.o)){const o={};fix.o.forEach((l,i)=>{for(const n of l)o[n]=i+1;});fix={...fix,o};}
 R=R||loadRender(key,{bvh:true});const {pos,index,triMat,prims,bvh}=R,nt=index.length/3,name=k=>prims[k].name;
 const dropped=new Set();if(fix&&fix.d)for(const [m,list] of Object.entries(fix.d)){const k=prims.findIndex(p=>p.name===m);if(k>=0)for(const t of list)dropped.add(prims[k].tri0+t);}
 const matArea=new Float64Array(prims.length),tri=(t,o)=>{for(let j=0;j<3;j++){const v=index[t*3+j]*3;o[j].set(pos[v],pos[v+1],pos[v+2]);}};
 const a=[new T.Vector3(),new T.Vector3(),new T.Vector3()],b=[new T.Vector3(),new T.Vector3(),new T.Vector3()],n=new T.Vector3(),m=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3(),u=new T.Vector3(),w=new T.Vector3(),box=new T.Box3();
 const areaOf=(p,o)=>{e1.subVectors(p[1],p[0]);e2.subVectors(p[2],p[0]);o.crossVectors(e1,e2);const s=o.length();if(s>0)o.multiplyScalar(1/s);return s/2;};
 for(let t=0;t<nt;t++){tri(t,a);matArea[triMat[t]]+=areaOf(a,n);}
 const inRegion=t=>{if(!region)return true;let x=0,z=0;for(let j=0;j<3;j++){const v=index[t*3+j]*3;x+=pos[v];z+=pos[v+2];}x/=3;z/=3;return region.some(([cx,cz,r])=>(x-cx)**2+(z-cz)**2<=r*r);};
 const pairs=[];
 for(let t=0;t<nt;t++){if(dropped.has(t)||!inRegion(t))continue;tri(t,a);const A=areaOf(a,n);if(A<1e-4)continue;const d=n.dot(a[0]);box.makeEmpty();for(const p of a)box.expandByPoint(p);box.expandByScalar(TOL);
  // 2D basis on the plane
  u.set(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0).cross(n).normalize();w.crossVectors(n,u);const P2=p=>[p.dot(u),p.dot(w)],A2=a.map(P2);
  bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(box),intersectsTriangle:(tr,i)=>{const s=i;/* already resolved (indirect BVH) */if(s<=t||triMat[s]===triMat[t]||dropped.has(s))return false;
   b[0].copy(tr.a);b[1].copy(tr.b);b[2].copy(tr.c);for(const p of b)if(Math.abs(n.dot(p)-d)>TOL)return false;const B=areaOf(b,m);if(B<1e-4||Math.abs(m.dot(n))<DOT)return false;
   const ov=overlap(A2,b.map(P2));if(ov<MIN_AREA)return false;
   const dup=a.every(p=>b.some(q=>p.distanceTo(q)<TOL));pairs.push({t,s,ov,dup,c:[(a[0].x+a[1].x+a[2].x)/3,(a[0].y+a[1].y+a[2].y)/3,(a[0].z+a[1].z+a[2].z)/3]});return false;}});}
 const edges=new Map(),fixOut={o:{},d:{}},byClass={dup:0,decal:0,overlay:0,resolved:0},groups=new Map();let area=0;
 for(const p of pairs){const ka=triMat[p.t],kb=triMat[p.s],na=name(ka),nb=name(kb);let cls;
  if(DECAL.test(na)||DECAL.test(nb))cls='decal';else if(p.dup)cls='dup';else cls='overlay';
  if(cls!=='dup'&&fix&&fix.o&&(fix.o[na]||0)!==(fix.o[nb]||0))cls='resolved';
  if(cls==='decal')cls='resolved';
  byClass[cls]++;if(cls==='resolved')continue;area+=p.ov;
  if(cls==='dup'){// drop the copy in the blended / smaller material
   const blend=k=>prims[k].alpha==='BLEND'?1:0,dropK=blend(ka)!==blend(kb)?(blend(ka)?ka:kb):(matArea[ka]<matArea[kb]?ka:kb),dt=dropK===ka?p.t:p.s;(fixOut.d[name(dropK)]=fixOut.d[name(dropK)]||[]).push(dt-prims[dropK].tri0);}
  else{const [fr,bk]=matArea[ka]<matArea[kb]?[na,nb]:[nb,na];let l=edges.get(fr);if(!l)edges.set(fr,l=new Set());l.add(bk);}
  const g=[na,nb].sort().join(' | ')+' ['+cls+']';let G=groups.get(g);if(!G)groups.set(g,G={pair:g,cls,n:0,area:0,at:p.c.map(v=>+v.toFixed(2))});G.n++;G.area+=p.ov;}
 // (offset levels are assigned below from the pair groups, colorLayers)
 for(const k in fixOut.d)fixOut.d[k]=[...new Set(fixOut.d[k])].sort((x,y)=>x-y);
 const top=[...groups.values()].sort((x,y)=>y.area-x.area).map(g=>({...g,area:+g.area.toFixed(3)}));fixOut.o=colorLayers(top,5,SEAMS[key]&&SEAMS[key].map(([x,z])=>[x,z,8]));
 return {key,triangles:nt,pairs:pairs.length,open:pairs.length-byClass.resolved,area:+area.toFixed(3),byClass,top,layers:edges.size,fix:{o:Object.fromEntries(Object.entries(fixOut.o).sort()),d:fixOut.d}};}
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'],rep={};
 const region=process.env.REGION?JSON.parse(process.env.REGION):null,fixes=process.env.FIX?JSON.parse(fs.readFileSync(process.env.FIX,'utf8')):{};
 for(const k of maps){const t0=Date.now(),r=scanZFight(k,{region,fix:fixes[k]||null});rep[k]=r;console.log(k,r.triangles,'tris;',r.pairs,'coplanar overlaps,',r.open,'open (',JSON.stringify(r.byClass),') area',r.area,'m2; fix',Object.keys(r.fix.o).length,'offset materials,',Object.values(r.fix.d).reduce((s,l)=>s+l.length,0),'dropped tris;',((Date.now()-t0)/1000).toFixed(0)+'s');for(const g of r.top.slice(0,8))console.log('  ',g.n,g.area,g.at.join(','),g.pair);}
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(rep,null,1));}
