// Kill-cost perf, ragdolls (browser profile: xrRagdollTick was the top per-frame cost after a kill and the ~250 ms
// ragdoll build was mostly xrSupports CPU-skinning up to 6000 vertices): corpses re-solve at most 30 Hz (15 Hz beyond
// 35 m from the camera) on the real elapsed time, at most four simulate at once, and contact sampling reuses a
// per-geometry sample list with skins each sample from per-bone matrices built once (same points as boneTransform).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const rr=fs.readFileSync(path.join(root,'work/repair_runtime.js'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'missing '+a);return s.slice(i,j);};
// 1. Corpse tick rate and cap (the death hook wrapper, with xrRagdollTick stubbed).
{let now=0;const calls=[];const c={Math,performance:{now:()=>now},camera:{position:{x:0,z:0}},xUbDead:()=>false,xrRagdollTick:(M,dt,w)=>{calls.push([M.id,w]);if(!M.ragdoll)M.ragdoll={time:0};M.ragdoll.time+=w;return M.ragdoll.time<3;}};
 vm.createContext(c);vm.runInContext(cut(rr,'const XR_ACT=[]','\n// ---- END REPAIR PASS ----')+';globalThis.XR_ACT=XR_ACT;',c);
 const body=(id,x=0)=>({id,sx:{sc:{}},m:{position:{x,z:0}}});const A=body(1);
 for(let f=0;f<120;f++){now+=1000/120;c.xUbDead(A,1/120);} // one second at 120 fps
 const n=calls.length;assert(n>=28&&n<=33,'near corpse re-solves ~30 times a second at 120 fps: '+n);
 {const t=calls.slice(1).reduce((s,x)=>s+x[1],0);assert(t>.9&&t<=1.0001,'skipped frames are passed on as real time (falls just as fast): '+t);}
 calls.length=0;const F=body(2,80);for(let f=0;f<120;f++){now+=1000/120;c.xUbDead(F,1/120);}
 const nf=calls.filter(x=>x[0]===2).length;assert(nf>=13&&nf<=17,'far corpse ~15 Hz: '+nf);
 // cap: a fifth falling body freezes the oldest one that has fallen for over a second
 c.XR_ACT.length=0;const B=[1,2,3,4,5].map(i=>body(10+i));let frozen=null;
 for(let f=0;f<240&&!frozen;f++){now+=1000/60;for(let i=0;i<B.length;i++){if(f<i*20)continue;const r=c.xUbDead(B[i],1/60);if(r===false&&B[i].ragdoll.time<3)frozen=B[i];}}
 assert.equal(frozen,B[0],'oldest active body freezes when a fifth simulates');assert(c.XR_ACT.length<=4,'at most four bodies simulate at once');
 assert(/xUbDead=function\(M,dt\)\{[^]*?performance\.now\(\)[^]*?xrRagdollTick\(M,dt,w\)/.test(rr),'death hook still passes real elapsed time');}
// 2. Contact sampling: sample list cached per geometry; the precomputed-bone-matrix blend gives the same contact
// points as the original per-vertex boneTransform (reference copied below) on real agents.
const REF=String.raw`function xrSupportsRef(R,sc,sim){
 const byBone=new Map(),J=new Map();for(const a of R.list)if(a.b)J.set(a.b,a);const owner=b=>{if(byBone.has(b))return byBone.get(b);let x=b;while(x&&!J.has(x))x=x.parent;const j=x?J.get(x):null;byBone.set(b,j);return j;};
 const inv=new Map();for(const a of R.list)if(a.b){a.b.updateWorldMatrix(true,false);inv.set(a,new THREE.Matrix4().copy(a.b.matrixWorld).invert());a.sup=XR_DIRS.map(()=>null);a.supD=XR_DIRS.map(()=>-Infinity);}
 const meshes=[];let total=0;sc.traverse(o=>{if(o.isSkinnedMesh&&o.visible!==false&&o.geometry&&o.geometry.attributes.skinIndex){meshes.push(o);total+=o.geometry.attributes.position.count;}});
 const stride=Math.max(1,Math.ceil(total/XR_SAMPLES)),v=new THREE.Vector3(),l=new THREE.Vector3(),jp=new THREE.Vector3();
 for(const o of meshes){o.updateMatrixWorld(true);o.skeleton.update();const ps=o.geometry.attributes.position,si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,bt=o.applyBoneTransform||o.boneTransform;if(!bt)continue;
  for(let i=0;i<ps.count;i+=stride){let best=-1,bi=0;for(let k=0;k<4;k++){const w=XR_GC(sw,i,k);if(w>best){best=w;bi=XR_GC(si,i,k);}}const bone=o.skeleton.bones[bi];const a=bone&&owner(bone);if(!a||!a.sup)continue;
   v.fromBufferAttribute(ps,i);bt.call(o,i,v);v.applyMatrix4(o.matrixWorld);if(!Number.isFinite(v.y))continue;a.b.getWorldPosition(jp);if(v.distanceTo(jp)>XR_REACH)continue;l.copy(v).applyMatrix4(inv.get(a));
   for(let k=0;k<XR_DIRS.length;k++){const d=XR_DIRS[k],s=l.x*d[0]+l.y*d[1]+l.z*d[2];if(s>a.supD[k]){a.supD[k]=s;a.sup[k]=(a.sup[k]||new THREE.Vector3()).copy(l);}}}}
 for(const a of R.list)if(a.sup){a.sup=a.sup.filter(Boolean);delete a.supD;if(!a.sup.length)a.sup=null;}
}`;
(async()=>{
 const H=require('./rig_harness.cjs'),src=H.section('repair_runtime.js','// Skeleton-preserving corpse physics.','{const die=xDie;');
 assert(rr.includes('const XR_SL=new WeakMap();')&&rr.includes('xrSampleList(o.geometry,stride)'),'per-geometry sample list');
 let tNew=0,tRef=0;
 for(const slug of ['jett','reyna']){const A=await H.agent(slug,'Idle_Loop');const c=H.context({groundAt:()=>0});vm.runInContext(src+'\n'+REF,c);A.m.position.set(1,0,2);A.m.rotation.y=.7;A.m.updateMatrixWorld(true);
  assert(c.xrRagdollTick(A.M,1/60)!==undefined&&A.M.ragdoll,'ragdoll built '+slug);const R=A.M.ragdoll,sc=A.M.sx.sc;
  const run=f=>{for(const a of R.list)a.sup=null;const t=process.hrtime.bigint();f(R,sc);const ms=Number(process.hrtime.bigint()-t)/1e6;return [R.list.map(a=>a.sup&&a.sup.map(v=>v.toArray())),ms];};
  run(c.xrSupports);const [n,mn]=run(c.xrSupports),[r,mr]=run(c.xrSupportsRef);tNew+=mn;tRef+=mr;
  let pts=0;for(let j=0;j<r.length;j++){assert.equal(!!n[j],!!r[j],slug+' joint '+j+' support presence');if(!r[j])continue;assert.equal(n[j].length,r[j].length);for(let k=0;k<r[j].length;k++){pts++;for(let q=0;q<3;q++)assert(Math.abs(n[j][k][q]-r[j][k][q])<1e-4,slug+' support point '+j+'/'+k+' differs');}}
  assert(pts>50,'compared '+pts+' support points');
  const S=c.xrSampleList(sc.getObjectByProperty('isSkinnedMesh',true).geometry,1);assert.equal(c.xrSampleList(sc.getObjectByProperty('isSkinnedMesh',true).geometry,1),S,'cached');}
 console.log('  contact sampling: precomputed-matrix '+tNew.toFixed(1)+' ms vs per-vertex boneTransform '+tRef.toFixed(1)+' ms (2 agents, same points)');
console.log('Ragdoll perf: corpse re-solve 30/15 Hz on real time, <=4 simulating, cached contact samples, same contact points from precomputed bone matrices');
})().catch(e=>{console.error(e);process.exit(1);});
