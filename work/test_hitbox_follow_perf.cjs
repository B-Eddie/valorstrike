// Shooting-at-enemies lag (user 2026-10-27: "whenever I shoot at enemies, it starts lagging a lot"): every agent rig on
// screen re-places its bone-following hit volumes (repair_runtime.js xrHitboxes) twice a frame (after the xVisB move and
// after the pose in xSolTick). Each call searched the skeleton for Head and Pelvis by name and re-composed the whole rig
// twice (M.m.updateMatrixWorld(true) + b.g.updateMatrixWorld(true), ~2 x 280 nodes), so five enemies in view cost
// ~12,800 extra local-matrix composes per frame in work/bench_shoot_enemy.cjs (VIEW: 11.8 k behind -> 24.5 k in front).
// Now: the two bones are cached per rig and only their own ancestor chains are brought up to date; the volumes land on
// exactly the same floats (checked against the original code on real rigs, with the unit moved and re-posed between
// calls without any matrix update in between).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {build,T}=require('./tp_body_harness.cjs');
const rr=fs.readFileSync(path.join(__dirname,'repair_runtime.js'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'missing '+a);return s.slice(i,j);};
const NEW=cut(rr,'const XR_HB=','\n{const update=xVisB;'),FN=NEW.slice(NEW.indexOf('function xrHitboxes(b,M){'));
// the version before this fix, for the equivalence check
const REF=`function xrHitboxesRef(b,M){
 if(b&&b.nt)return;
 if(!b||!b.body||!b.head||!M||!M.sx||M.dead)return;
 const sc=M.sx.sc,head=sc.getObjectByName('Head'),pelvis=sc.getObjectByName(M.valorant?'Pelvis':'pelvis');
 if(!head||!pelvis)return;M.m.updateMatrixWorld(true);b.g.updateMatrixWorld(true);
 const h=b.g.worldToLocal(head.getWorldPosition(new THREE.Vector3())),p=b.g.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3()));
 b.head.position.copy(h);b.head.position.y+=.08;b.head.scale.setScalar(.78);
 const top=Math.max(.65,h.y-.13),bottom=.06,height=top-bottom;
 b.body.position.set(p.x,(top+bottom)/2,p.z);b.body.scale.set(.72,height/1.8,.72);b.body.updateMatrixWorld(true);b.head.updateMatrixWorld(true);
}`;
// count on every Object3D prototype in play (the GLB loader's three and the harness's three are separate module copies)
let um=0,byName=0;const counted=new Set();
const count=o=>{let p=o;while(p&&!Object.prototype.hasOwnProperty.call(p,'updateMatrix'))p=Object.getPrototypeOf(p);if(!p||counted.has(p))return;counted.add(p);
 const um0=p.updateMatrix,gn0=p.getObjectByName;p.updateMatrix=function(){um++;return um0.call(this);};p.getObjectByName=function(n){byName++;return gn0.call(this,n);};};
count(new T.Object3D());
const unit=(M)=>{const g=new T.Group(),body=new T.Mesh(new T.CapsuleGeometry(.4,1,4,10)),head=new T.Mesh(new T.SphereGeometry(.25,12,10));body.position.y=.9;head.position.y=1.75;g.add(body,head,M.m);return {g,body,head,xm:M};};
const snap=b=>[...b.head.position.toArray(),...b.head.scale.toArray(),...b.body.position.toArray(),...b.body.scale.toArray(),...b.head.matrixWorld.elements,...b.body.matrixWorld.elements];
(async()=>{
 let calls=0,newUm=0,refUm=0,newByName=0;
 for(const slug of ['jett','reyna']){
  // two identical rigs on one scene: A runs the shipped code, B the original
  const A=await build(slug),B=await build(slug,A.c);count(A.X.sc);const scene=new T.Scene(),ua=unit(A.M),ub=unit(B.M);scene.add(ua.g,ub.g);
  const c=A.c;vm.runInContext(NEW+'\n'+REF+';globalThis.HB={xrHitboxes,xrHitboxesRef};',c);
  const rnd=(()=>{let s=7;return ()=>(s=(s*16807)%2147483647)/2147483647;})();
  for(const R of [A,B])R.play('run',0);scene.updateMatrixWorld(true);
  for(let f=0;f<40;f++){
   // move, turn and re-pose both units the same way, with NO matrix update afterwards (stale world matrices, as mid-frame)
   const x=(rnd()-.5)*30,y=rnd()*4,z=(rnd()-.5)*30,ry=rnd()*6.283,cb=f%10<5?0:rnd(),lo=['idle','run','walk'][f%3];
   for(const [R,u] of [[A,ua],[B,ub]]){u.g.position.set(x,y,z);u.g.rotation.y=ry;R.play(lo,cb,(rnd()-.5)*.3,(rnd()-.5)*.4);R.X.poseDt=1/60;c.api.xUbPre(R.M);R.X.mx.update(1/60+f*.013);}
   um=0;byName=0;c.HB.xrHitboxes(ua,A.M);newUm+=um;if(f)newByName+=byName;
   um=0;c.HB.xrHitboxesRef(ub,B.M);refUm+=um;calls++;
   const a=snap(ua),b=snap(ub);for(let i=0;i<a.length;i++)assert.equal(a[i],b[i],`${slug} frame ${f}: hit volume value ${i} differs (${a[i]} vs ${b[i]})`);
  }
 }
 const perNew=newUm/calls,perRef=refUm/calls;
 console.log(`  hit volume follow: ${perNew.toFixed(1)} local-matrix composes per call (original ${perRef.toFixed(1)}), ${newByName} bone name searches after the first call`);
 assert.ok(perNew<=60,'hit volumes re-compose only the Head / Pelvis chains, not the whole rig: '+perNew.toFixed(1)+' composes per call');
 assert.equal(newByName,0,'Head / Pelvis cached per rig (no skeleton search per frame)');
 assert.doesNotMatch(FN,/new THREE\.|updateMatrixWorld\(true\);b\.g|M\.m\.updateMatrixWorld/,'no per-call vectors, no whole-rig passes');
 console.log('Hitbox follow perf: bone-following hit volumes cache their bones, update only the two bone chains, same floats as before on real rigs');
})().catch(e=>{console.error(e);process.exit(1);});
