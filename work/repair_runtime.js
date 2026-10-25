// Repair pass: bone-following damage volumes and joint-constrained corpse physics.
// Retargeted crouch clips barely lower the native head. Correct their vertical root motion
// after the mixer, then undo it before the next mixer evaluation.
{const pre=xUbPre,post=xUbPost;xUbPre=function(M){const X=M.sx;if(X&&X.crouchRestore){X.crouchBone.position.copy(X.crouchRestore);X.crouchRestore=null;}return pre(M);};xUbPost=function(M){post(M);const X=M.sx;if(!M.valorant||!X||X.dd||M.dead||X.nativeContact)return;const head=X.sc.getObjectByName('Head'),pelvis=X.sc.getObjectByName('Root');X.crouchBone=pelvis;if(!head||!pelvis)return;M.m.updateMatrixWorld(true);const hp=head.getWorldPosition(new THREE.Vector3());if(X.standHead==null)X.standHead=hp.y-M.m.getWorldPosition(new THREE.Vector3()).y;const cb=Math.max(0,Math.min(1,X.cb||0));if(cb<.001)return;const desired=M.m.getWorldPosition(new THREE.Vector3()).y+X.standHead-.45*cb,delta=desired-hp.y;X.crouchRestore=pelvis.position.clone();const p=pelvis.getWorldPosition(new THREE.Vector3());p.y+=delta;pelvis.position.copy(pelvis.parent.worldToLocal(p));pelvis.updateMatrix();M.m.updateMatrixWorld(true);};}
function xrHitboxes(b,M){
 if(b&&b.nt)return;
 if(!b||!b.body||!b.head||!M||!M.sx||M.dead)return;
 const sc=M.sx.sc,head=sc.getObjectByName('Head'),pelvis=sc.getObjectByName(M.valorant?'Pelvis':'pelvis');
 if(!head||!pelvis)return;M.m.updateMatrixWorld(true);b.g.updateMatrixWorld(true);
 const h=b.g.worldToLocal(head.getWorldPosition(new THREE.Vector3())),p=b.g.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3()));
 b.head.position.copy(h);b.head.position.y+=.08;b.head.scale.setScalar(.78);
 const top=Math.max(.65,h.y-.13),bottom=.06,height=top-bottom;
 b.body.position.set(p.x,(top+bottom)/2,p.z);b.body.scale.set(.72,height/1.8,.72);b.body.updateMatrixWorld(true);b.head.updateMatrixWorld(true);
}
{const update=xVisB;xVisB=function(b){const r=update.apply(this,arguments);xrHitboxes(b,b&&b.xm);return r;};}
function xrRagdoll(M){
 M.m.updateMatrixWorld(true);const sc=M.sx.sc,points=[],by=new Map();
 sc.traverse(b=>{if(!b.isBone)return;const p=b.getWorldPosition(new THREE.Vector3());const item={b,p,old:p.clone(),q:b.getWorldQuaternion(new THREE.Quaternion()),parent:null,length:0};points.push(item);by.set(b,item);});
 for(const a of points){a.parent=by.get(a.b.parent)||null;if(a.parent)a.length=a.p.distanceTo(a.parent.p);a.children=points.filter(c=>c.b.parent===a.b);a.child=a.children.find(c=>!/Twst|Twist|Helper|Ndl|Weapon|Camera/.test(c.b.name))||a.children[0];if(a.child)a.dir=a.child.p.clone().sub(a.p).normalize();}
 const floor=M.m.position.y;for(const a of points)a.old.x-=.025;return {points,floor,time:0};
}
function xrRagdollTick(M,dt){
 const now=performance.now();if(!M.ragStarted)M.ragStarted=now;if(now-M.ragStarted>2800)return false;
 // A slow display must not keep old corpses in physics for minutes.

 if(!M.ragdoll){const pose=[];M.sx.sc.traverse(b=>{if(b.isBone)pose.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);});M.sx.mx.stopAllAction();for(const [b,p,q,s]of pose){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}M.ragdoll=xrRagdoll(M);}
 const R=M.ragdoll;R.time+=dt;const steps=Math.max(1,Math.ceil(Math.min(dt,.05)/(1/120))),h=Math.min(dt,.05)/steps;
 for(let step=0;step<steps;step++){
  for(const a of R.points){const v=a.p.clone().sub(a.old).multiplyScalar(.985);a.old.copy(a.p);a.p.add(v);a.p.y-=9.81*h*h;let floor=R.floor;try{floor=groundAt(a.p.x,a.p.z,.08,R.floor+.1);}catch(e){}a.floor=floor;}
  for(let iteration=0;iteration<8;iteration++){
   for(const a of R.points)if(a.parent&&a.length>1e-5){const d=a.p.clone().sub(a.parent.p),len=d.length();if(len>1e-8){d.multiplyScalar((len-a.length)/len*.5);a.p.sub(d);a.parent.p.add(d);}}
   for(const a of R.points){const floor=a.floor;const radius=/Head|head/.test(a.b.name)?.12:.045;if(a.p.y<floor+radius){a.p.y=floor+radius;a.old.x+=(a.p.x-a.old.x)*.28;a.old.z+=(a.p.z-a.old.z)*.28;}}
  }
 }
 // Rebuild each bone from the solved world-space joints, preserving its original roll.
 for(const a of R.points){const parent=a.b.parent;parent.updateWorldMatrix(true,false);a.b.position.copy(parent.worldToLocal(a.p.clone()));let q=a.q.clone();if(a.child&&a.dir){const dir=a.child.p.clone().sub(a.p).normalize();q.premultiply(new THREE.Quaternion().setFromUnitVectors(a.dir,dir));}a.b.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));a.b.updateMatrixWorld(true);}
 return R.time<2.8;
}
{const die=xDie;xDie=function(b){const r=die.apply(this,arguments);if(b&&b.xm&&b.xm.dead){b.xm.diedAt=b.xm.diedAt||performance.now();}return r;};}
{const visual=xVis;xVis=function(dt){const now=performance.now();for(let i=XDEAD.length-1;i>=0;i--){const e=XDEAD[i],age=(now-(e.c.diedAt||now))/1000;if(age>4){scene.remove(e.c.m);scene.remove(e.gn);xDisp(e.gn);const j=XSOL.mx.indexOf(e.c);if(j>=0)XSOL.mx.splice(j,1);XDEAD.splice(i,1);}else e.t=Math.max(e.t,age);}return visual(dt);};}
{const death=xUbDead;xUbDead=function(M,dt){return M&&M.sx&&M.sx.sc?xrRagdollTick(M,dt):death(M,dt);};}
// ---- END REPAIR PASS ----
