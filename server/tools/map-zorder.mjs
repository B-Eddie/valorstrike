// Z-fight layer ORDER (render meshes, scene.gltf). map-zfight.mjs finds coplanar overlapping triangle pairs (within
// TOL = 1 cm of one plane) and gives the overlapping materials different polygonOffset levels, but chose WHICH material
// sits higher by graph colouring alone. The two layers of a pair are rarely exactly coplanar: one is 0.2-10 mm in front
// of the other. When the higher level is the one BEHIND by s, the runtime's constant depth-step bias (NM_ZBIAS x level,
// a world offset growing with distance squared) equals s at one distance, and there the two swap every frame (the
// "flickering on walls" left after 978f4e3; work/test_map_flicker.cjs). This pass measures, per pair, which layer is in
// front as seen from the surface's front face (the glTF winding: Unreal drew these single-sided; ~95-97% of the
// surfaces in view face the eye), at the overlap's centroid, and re-assigns the levels so that
//   - a layer in front of another (by > EPS) sits on a HIGHER level (never a crossover; equal levels cost .6 of a
//     reversed pair: they only fight beyond the distance where the gap drops under a depth step),
//   - exact-coplanar layers (|gap| <= EPS) and back-to-back faces sit on DIFFERENT levels (as before),
// by weighted local search from the current levels (pinned materials keep theirs), levels 0..K-1 (K = 6: o[0..4]).
// Pairs at the seams players reported (map-zfight SEAMS, 8 m) weigh 1000x, as in map-zfight's colouring, and must
// also sit on different levels there (server/test-map-zfight.js).
// orderPairs(key,{fix,R}) -> Map 'A\nB' -> {front:area A over B, back:area B over A, co:coplanar area}
// relevel(pairs,current{material:level},pins{material:level},K) -> {material:level}
// Usage: node tools/map-zorder.mjs [maps...]  (FIX=zfight-fix.json in; OUT=path writes the re-levelled fix)
import fs from 'node:fs';import * as T from 'three';import {loadRender} from './map-render.mjs';import {SEAMS} from './map-zfight.mjs';
const TOL=.01,MIN_AREA=.005,DOT=.9995,EPS=.0005,DECAL=/Decal|Floater/i;
function clip(poly,a,b){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],sp=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),sq=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);if(sp>=0)out.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;}
function area2(P){let s=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];s+=p[0]*q[1]-q[0]*p[1];}return s/2;}
function overlapPoly(A,B){const ccw=t=>area2(t)<0?[t[0],t[2],t[1]]:t;A=ccw(A);B=ccw(B);let P=A;for(let i=0;i<3&&P.length;i++)P=clip(P,B[i],B[(i+1)%3]);if(P.length<3)return null;const a=area2(P);if(Math.abs(a)<1e-12)return null;let cx=0,cy=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],c=p[0]*q[1]-q[0]*p[1];cx+=(p[0]+q[0])*c;cy+=(p[1]+q[1])*c;}return {area:Math.abs(a),c:[cx/(6*a),cy/(6*a)]};}
export function orderPairs(key,{fix=null,R=null}={}){R=R||loadRender(key,{bvh:true});const {pos,index,triMat,prims,bvh}=R,nt=index.length/3,name=k=>prims[k].name;
 const focus=SEAMS[key]||[];const dropped=new Set();if(fix&&fix.d)for(const [m,list] of Object.entries(fix.d)){const k=prims.findIndex(p=>p.name===m);if(k>=0)for(const t of list)dropped.add(prims[k].tri0+t);}
 const a=[new T.Vector3(),new T.Vector3(),new T.Vector3()],b=[new T.Vector3(),new T.Vector3(),new T.Vector3()],n=new T.Vector3(),m=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3(),u=new T.Vector3(),w=new T.Vector3(),box=new T.Box3(),p=new T.Vector3();
 const tri=(t,o)=>{for(let j=0;j<3;j++){const v=index[t*3+j]*3;o[j].set(pos[v],pos[v+1],pos[v+2]);}};const areaOf=(q,o)=>{e1.subVectors(q[1],q[0]);e2.subVectors(q[2],q[0]);o.crossVectors(e1,e2);const s=o.length();if(s>0)o.multiplyScalar(1/s);return s/2;};
 const pairs=new Map(),add=(A,B,f,bk,co)=>{const k=A<B?A+'\n'+B:B+'\n'+A;let g=pairs.get(k);if(!g)pairs.set(k,g={front:0,back:0,co:0,fa:0,ba:0,gaps:[]});if(A<B){g.front+=f;g.back+=bk;}else{g.front+=bk;g.back+=f;}g.co+=co;return g;};
 for(let t=0;t<nt;t++){if(dropped.has(t)||DECAL.test(name(triMat[t])))continue;tri(t,a);const A=areaOf(a,n);if(A<1e-4)continue;const d=n.dot(a[0]);box.makeEmpty();for(const q of a)box.expandByPoint(q);box.expandByScalar(TOL);
  u.set(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0).cross(n).normalize();w.crossVectors(n,u);const P2=q=>[q.dot(u),q.dot(w)],A2=a.map(P2);
  bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(box),intersectsTriangle:(tr,s)=>{if(s<=t||triMat[s]===triMat[t]||dropped.has(s)||DECAL.test(name(triMat[s])))return false;
   b[0].copy(tr.a);b[1].copy(tr.b);b[2].copy(tr.c);for(const q of b)if(Math.abs(n.dot(q)-d)>TOL)return false;const B=areaOf(b,m);if(B<1e-4||Math.abs(m.dot(n))<DOT)return false;
   if(a.every(q=>b.some(r=>q.distanceTo(r)<TOL)))return false;/* exact duplicate: map-zfight drops one copy */
   const ov=overlapPoly(A2,b.map(P2));if(!ov||ov.area<MIN_AREA)return false;
   // gap of s in front of t along t's front normal, at the overlap centroid
   p.copy(u).multiplyScalar(ov.c[0]).addScaledVector(w,ov.c[1]).addScaledVector(n,d);const ns=m.dot(n);const gap=m.dot(e1.subVectors(b[0],p))/ns;
   const At=name(triMat[t]),Bs=name(triMat[s]),seam=focus.some(([x,z])=>(p.x-x)**2+(p.z-z)**2<=64),wt=ov.area*(seam?1000:1);if(seam)add(At,Bs,0,0,wt);/* seams: never on one level */if(ns<0)add(At,Bs,0,0,wt);/* back-to-back faces: either may face the eye */
   else if(gap>EPS)add(Bs,At,wt,0,0);else if(gap<-EPS)add(At,Bs,wt,0,0);else add(At,Bs,0,0,wt);
   {const g=pairs.get(At<Bs?At+'\n'+Bs:Bs+'\n'+At),f=ns>0&&Math.abs(gap)>EPS;if(f&&((gap>0)===(Bs<At)))g.fa+=ov.area;else if(f)g.ba+=ov.area;}
   const g=pairs.get(At<Bs?At+'\n'+Bs:Bs+'\n'+At);if(g.gaps.length<64)g.gaps.push(+(At<Bs?-gap:gap).toFixed(4));return false;}});}
 return pairs;}
// cost of levels la (first of the key) / lb for one pair group
const pairCost=(g,la,lb)=>g.front*(la>lb?0:la===lb?.6:1)+g.back*(lb>la?0:la===lb?.6:1)+g.co*(la===lb?1:0);
export function relevel(pairs,current={},pins={},K=6,maxFree=K-1){const adj=new Map(),mats=new Set();for(const [k,g] of pairs){const [A,B]=k.split('\n');mats.add(A);mats.add(B);for(const [x,y,s] of [[A,B,0],[B,A,1]]){let l=adj.get(x);if(!l)adj.set(x,l=[]);l.push([y,g,s]);}}
 const L=new Map();for(const x of mats)L.set(x,pins[x]!=null?pins[x]:Math.min(current[x]||0,maxFree));
 const local=(x,l)=>{let c=0;for(const [y,g,s] of adj.get(x)){const ly=L.get(y);c+=s?pairCost(g,ly,l):pairCost(g,l,ly);}return c;};
 const total=()=>{let c=0;for(const [k,g] of pairs){const [A,B]=k.split('\n');c+=pairCost(g,L.get(A),L.get(B));}return c;};const before=total();
 const order=[...mats].sort();for(let it=0;it<50;it++){let moved=0;for(const x of order){if(pins[x]!=null)continue;const cur=L.get(x);let best=cur,bc=local(x,cur);for(let l=0;l<=maxFree;l++){if(l===cur)continue;const c=local(x,l);if(c<bc-1e-9){bc=c;best=l;}}if(best!==cur){L.set(x,best);moved++;}}if(!moved)break;}
 const out={};for(const [x,l] of L)if(l>0)out[x]=l;return {levels:out,before,after:total()};}
// Hand-set (map-notes, z-fighting): Haven's puddle overlapped layers on all of levels 0..4 and keeps level 5 to itself;
// Split's trim was the last seam pair.
export const PINS={haven:{Puddle_2_M0_MI:5},split:{Metal_M5_KingdomMetalTrimConstruction_MI:5}},EXCLUSIVE={haven:5};
const toLevels=o=>{const r={};(o||[]).forEach((l,i)=>{for(const n of l)r[n]=i+1;});return r;},toO=lv=>{const o=[[],[],[],[],[]];for(const [n,l] of Object.entries(lv))if(l>0)o[l-1].push(n);for(const l of o)l.sort();while(o.length&&!o[o.length-1].length)o.pop();return o;};
if(import.meta.url===`file://${process.argv[1]}`){const maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
 const fixes=JSON.parse(fs.readFileSync(process.env.FIX||new URL('../../work/validation/map/zfight-fix.json',import.meta.url).pathname,'utf8')),out=JSON.parse(JSON.stringify(fixes));
 for(const k of maps){const t0=Date.now(),pairs=orderPairs(k,{fix:fixes[k]}),cur=toLevels(fixes[k].o),pins={...(PINS[k]||{})};
  // materials only the old pass layered (pairs this pass does not see, e.g. decal-only partners) keep their level
  const r=relevel(pairs,cur,pins,6,EXCLUSIVE[k]?EXCLUSIVE[k]-1:5);const lv={};for(const [n,l] of Object.entries(cur))if(!r.levels.hasOwnProperty(n)&&![...pairs.keys()].some(q=>q.split('\n').includes(n)))lv[n]=pins[n]!=null||!EXCLUSIVE[k]||l<EXCLUSIVE[k]?l:EXCLUSIVE[k]-1;Object.assign(lv,r.levels);
  let rev=0,revA=0;for(const [q,g] of pairs){const [A,B]=q.split('\n'),la=cur[A]||0,lb=cur[B]||0;if((g.front>0&&la<lb)||(g.back>0&&lb<la)){rev++;revA+=la<lb?g.fa:g.ba;}}
  let rev2=0,revA2=0,same=0;for(const [q,g] of pairs){const [A,B]=q.split('\n'),la=lv[A]||0,lb=lv[B]||0;if((g.front>0&&la<lb)||(g.back>0&&lb<la)){rev2++;revA2+=la<lb?g.fa:g.ba;}if(g.co>0&&la===lb)same++;}
  out[k]={...fixes[k],o:toO(lv)};console.log(k,pairs.size,'pairs; reversed (higher level behind)',rev,'('+revA.toFixed(2)+' m2) ->',rev2,'('+revA2.toFixed(2)+' m2); coplanar left on one level',same,'; cost',r.before.toFixed(2),'->',r.after.toFixed(2),((Date.now()-t0)/1000).toFixed(0)+'s');}
 if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(out));}
