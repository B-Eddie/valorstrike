// Offline PVS estimate (hk-30): how much a cell-based precomputed visibility would cut LOW map triangles on the map-perf views.
// For each view (eye 1.6 m over a random nav node, 8 yaws), each chunk of the runtime chunk plan that passes the frustum (and its
// maxDist): visible when any of up to K sample points on its triangles (centroids, nudged 2 cm toward the eye) has a clear line to
// any of 5 eyes (the view's eye and +-2 m in x / z = a 4 m cell, approximating the union a cell PVS would store). Occluder = the full
// render mesh (BVH). Sampling can miss a sliver (over-estimates the cut); the 5-eye union under-estimates it. Both noted in the plan.
//   (server/) VIEWS=24 K=24 node tools/map-pvs-est.mjs ascent   [JSON=out.json]
import {loadRender} from './map-render.mjs';
import {views,count,sphereOf,runtimeApi} from './map-perf.mjs';
import * as T from 'three';import fs from 'node:fs';
const key=process.argv[2]||'ascent',K=+process.env.K||16;const R=loadRender(key,{bvh:true}),V=views(key);
const api=runtimeApi();const items=R.prims.map(p=>({key:[p.tex,p.alpha,p.name.replace(/_\d+$/,'')].join('|'),name:p.name,pos:R.pos,index:R.index,tri0:p.tri0,tris:p.tris}));
for(const it of items){const t=it.key.split('|');it.key=t[0]+'|'+t[1]+'|'+(api.nmDetailDistance(it.name)||0)+'|'+(/Floor|Ground/i.test(it.name)?1:0);}
const plan=api.nmChunkPlan(items,api.NM_OPT);
const objs=plan.map(o=>{const a=[];for(const q of o.parts){const it=items[q.item];if(q.tris)for(const t of q.tris)a.push(it.tri0+t);else for(let t=0;t<it.tris;t++)a.push(it.tri0+t);}const s=sphereOf(R.pos,R.index,Uint32Array.from(a));
 const st=Math.max(1,Math.floor(a.length/K)),smp=[];for(let i=0;i<a.length&&smp.length<K;i+=st){const k=a[i]*3;const c=[0,1,2].map(j=>(R.pos[R.index[k]*3+j]+R.pos[R.index[k+1]*3+j]+R.pos[R.index[k+2]*3+j])/3);smp.push(c);}
 return {c:s.c,r:s.r,tris:a.length,maxDist:o.maxDist||0,smp};});
const cam=new T.PerspectiveCamera(70.5,16/9,.05,500),fr=new T.Frustum(),m=new T.Matrix4(),s=new T.Sphere(),ray=new T.Ray(),dir=new T.Vector3(),eye=new T.Vector3();
const vf=2*Math.atan(Math.tan(103*Math.PI/360)/(16/9))*180/Math.PI;cam.fov=vf;cam.updateProjectionMatrix();
const OFF=[[0,0],[2,0],[-2,0],[0,2],[0,-2]];const t0=Date.now();let rays=0;const per=[];let A=0,B=0,CA=0,CB=0;
for(const v of V){cam.position.set(...v.p);cam.rotation.set(0,v.yaw,0);cam.updateMatrixWorld(true);m.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);fr.setFromProjectionMatrix(m);let tb=0,ta=0,cb=0,ca=0;
 for(const o of objs){if(o.maxDist&&Math.hypot(o.c[0]-v.p[0],o.c[1]-v.p[1],o.c[2]-v.p[2])-o.r>o.maxDist)continue;s.center.set(...o.c);s.radius=o.r;if(!fr.intersectsSphere(s))continue;tb+=o.tris;cb++;
  let vis=Math.hypot(o.c[0]-v.p[0],o.c[1]-v.p[1],o.c[2]-v.p[2])<o.r+2;
  for(const [dx,dz] of OFF){if(vis)break;eye.set(v.p[0]+dx,v.p[1],v.p[2]+dz);for(const p of o.smp){dir.set(p[0]-eye.x,p[1]-eye.y,p[2]-eye.z);const d=dir.length();if(d<1e-3){vis=true;break;}dir.multiplyScalar(1/d);ray.origin.copy(eye);ray.direction.copy(dir);rays++;
   const h=R.bvh.raycastFirst(ray,T.DoubleSide);if(!h||h.distance>=d-0.05){vis=true;break;}}}
  if(vis){ta+=o.tris;ca++;}}
 per.push([tb,ta,cb,ca]);A+=ta;B+=tb;CA+=ca;CB+=cb;}
per.sort((x,y)=>y[0]-x[0]);const w=per[0];
const out={key,views:V.length,chunks:objs.length,K,rays,ms:Date.now()-t0,frustum:{tris:Math.round(B/V.length),calls:Math.round(CB/V.length)},pvs:{tris:Math.round(A/V.length),calls:Math.round(CA/V.length)},cut:+(1-A/B).toFixed(3),
 worstFrustum:{tris:w[0],calls:w[2]},worstWithPvs:{tris:w[1],calls:w[3]},worstPvsAfter:Math.max(...per.map(p=>p[1]))};
console.log(JSON.stringify(out));if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(out,null,1));
