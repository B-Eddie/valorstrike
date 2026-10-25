// Repair pass: bone-following damage volumes and joint-constrained corpse physics.
// Retargeted crouch clips barely lower the native head. Correct their vertical root motion
// after the mixer, then undo it before the next mixer evaluation.
{const pre=xUbPre,post=xUbPost;xUbPre=function(M){const X=M.sx;if(X&&X.crouchRestore){X.crouchBone.position.copy(X.crouchRestore);X.crouchRestore=null;}return pre(M);};xUbPost=function(M){post(M);const X=M.sx;if(!M.valorant||!X||X.dd||M.dead||X.nativeContact)return;const head=X.sc.getObjectByName('Head'),pelvis=X.sc.getObjectByName('Root');X.crouchBone=pelvis;if(!head||!pelvis)return;M.m.updateMatrixWorld(true);const hp=head.getWorldPosition(new THREE.Vector3());if(X.standHead==null)X.standHead=hp.y-M.m.getWorldPosition(new THREE.Vector3()).y;const cb=Math.max(0,Math.min(1,X.cb||0));if(cb<.001)return;const desired=M.m.getWorldPosition(new THREE.Vector3()).y+X.standHead-.45*cb,delta=desired-hp.y;X.crouchRestore=pelvis.position.clone();const p=pelvis.getWorldPosition(new THREE.Vector3());p.y+=delta;pelvis.position.copy(pelvis.parent.worldToLocal(p));pelvis.updateMatrix();M.m.updateMatrixWorld(true);};}
// Native rigs (nativeContact): the retargeted crouch clips move only the Pelvis bone, but Spine1 is the Pelvis's
// sibling under Splitter, so the torso never follows it down; with the aim upper layer a full crouch dropped the head
// ~4 cm while the authoritative head volume drops ch (0.45 m at full crouch, server/src/hitboxes.js). After the mixer
// and contact correction, lower the torso chain (Spine1) so the Head bone sits at the upright head height minus
// 0.45 * crouch blend, measured against the agent root; legs and feet are untouched. Undone before the next mixer pass.
const XRC={drop:.45,stand:1.72};
{const pre=xUbPre,post=xUbPost;xUbPre=function(M){const X=M&&M.sx;if(X&&X.ncRestore){X.ncBone.position.copy(X.ncRestore);X.ncRestore=null;}return pre(M);};xUbPost=function(M){post(M);const X=M.sx;if(!M.valorant||!X||!X.nativeContact||X.dd||M.dead||!X.sc)return;
 if(X.ncBone===undefined){X.ncBone=X.sc.getObjectByName('Spine1')||null;X.ncHead=X.sc.getObjectByName('Head')||null;X.ncV=new THREE.Vector3();X.ncR=new THREE.Vector3();}
 if(!X.ncBone||!X.ncHead||!X.ncBone.parent)return;M.m.updateMatrixWorld(true);const v=X.ncV,root=M.m.getWorldPosition(X.ncR).y,head=X.ncHead.getWorldPosition(v).y-root,cb=Math.max(0,Math.min(1,X.cb||0));
 if(cb<.001){if(!X.air&&!X.lo&&Number.isFinite(head))X.ncStand=X.ncStand==null?head:X.ncStand+(head-X.ncStand)*.2;return;}
 const want=(X.ncStand==null?XRC.stand:X.ncStand)-XRC.drop*cb,delta=want-head;if(!(delta<-.001)||delta<-.8)return;
 X.ncRestore=X.ncBone.position.clone();X.ncBone.getWorldPosition(v);v.y+=delta;X.ncBone.position.copy(X.ncBone.parent.worldToLocal(v));X.ncBone.updateMatrix();M.m.updateMatrixWorld(true);};}
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
// Skeleton-preserving corpse physics. Only the major joints are simulated (Verlet particles with
// distance, rigidity and joint-limit constraints); bones are then re-aimed, never stretched, so
// face/twist/helper bones keep their authored offsets and the skin cannot explode.
const XR_JOINTS=['Pelvis','Spine2','Spine4','Neck','Head','L_Shoulder','L_Elbow','L_Hand','R_Shoulder','R_Elbow','R_Hand','L_Hip','L_Knee','L_Foot','L_Toe','R_Hip','R_Knee','R_Foot','R_Toe'];
const XR_LINKS=[['Pelvis','Spine2'],['Spine2','Spine4'],['Spine4','Neck'],['Neck','Head'],['Head','HeadEnd'],['Spine4','L_Shoulder'],['Spine4','R_Shoulder'],['L_Shoulder','L_Elbow'],['L_Elbow','L_Hand'],['R_Shoulder','R_Elbow'],['R_Elbow','R_Hand'],['Pelvis','L_Hip'],['Pelvis','R_Hip'],['L_Hip','L_Knee'],['L_Knee','L_Foot'],['L_Foot','L_Toe'],['R_Hip','R_Knee'],['R_Knee','R_Foot'],['R_Foot','R_Toe'],
 // rigid pelvis and chest blocks
 ['L_Hip','R_Hip'],['L_Hip','Spine2'],['R_Hip','Spine2'],['L_Shoulder','R_Shoulder'],['L_Shoulder','Spine2'],['R_Shoulder','Spine2'],['L_Shoulder','Neck'],['R_Shoulder','Neck'],['Neck','HeadEnd',.92,1.02],
 // joint limits as distance ranges (fraction of the rest distance)
 ['Pelvis','Spine4',.82,1.02],['Spine2','Neck',.86,1.02],['Spine4','Head',.84,1.03],['Spine4','HeadEnd',.8,1.04],['L_Shoulder','L_Hand',.32,1],['R_Shoulder','R_Hand',.32,1],['L_Hip','L_Foot',.45,1],['R_Hip','R_Foot',.45,1],['L_Knee','L_Toe',.86,1.08],['R_Knee','R_Toe',.86,1.08],['Spine4','L_Knee',.55,1.25],['Spine4','R_Knee',.55,1.25],['Spine2','L_Elbow',.45,1.6],['Spine2','R_Elbow',.45,1.6],['L_Knee','R_Knee',.35,2.2],['L_Foot','R_Foot',.25,3]];
const XR_AIM=[['Spine1','Spine4'],['Neck','Head'],['Head','HeadEnd'],['L_Clavicle','L_Shoulder'],['L_Shoulder','L_Elbow'],['L_Elbow','L_Hand'],['R_Clavicle','R_Shoulder'],['R_Shoulder','R_Elbow'],['R_Elbow','R_Hand'],['L_Hip','L_Knee'],['L_Knee','L_Foot'],['L_Foot','L_Toe'],['R_Hip','R_Knee'],['R_Knee','R_Foot'],['R_Foot','R_Toe']];
const XR_RADIUS={Head:.11,HeadEnd:.1,Pelvis:.12,Spine2:.12,Spine4:.12,Neck:.07,L_Hand:.04,R_Hand:.04,L_Toe:.03,R_Toe:.03,L_Foot:.05,R_Foot:.05};
function xrBasis(up,right,q){const u=up.clone().normalize(),r=right.clone().sub(u.clone().multiplyScalar(right.dot(u))).normalize(),f=new THREE.Vector3().crossVectors(r,u);return q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r,u,f));}
function xrRagdoll(M,ground){
 M.m.updateMatrixWorld(true);const sc=M.sx.sc,P={},list=[],root=sc.getObjectByName('Splitter')||sc.getObjectByName('Pelvis');
 for(const n of XR_JOINTS){const b=sc.getObjectByName(n);if(!b)return null;const p=b.getWorldPosition(new THREE.Vector3());P[n]={n,b,p,old:p.clone(),r:XR_RADIUS[n]||.05,floor:-Infinity};list.push(P[n]);}
 {const h=P.Head.p,dir=h.clone().sub(P.Neck.p);if(dir.lengthSq()<1e-8)dir.set(0,1,0);dir.normalize();const p=h.clone().add(dir.multiplyScalar(.2));P.HeadEnd={n:'HeadEnd',b:null,p,old:p.clone(),r:.1,floor:-Infinity,local:P.Head.b.worldToLocal(p.clone())};list.push(P.HeadEnd);}
 const links=[];for(const [a,b,lo=1,hi=1]of XR_LINKS){const A=P[a],B=P[b];if(!A||!B)continue;const rest=A.p.distanceTo(B.p);if(rest<1e-4)continue;links.push({A,B,lo:rest*lo,hi:rest*hi});}
 const aims=[];for(const [bn,tn]of XR_AIM){const bone=sc.getObjectByName(bn),T=P[tn];if(!bone||!T)continue;bone.updateWorldMatrix(true,false);const off=T.b?bone.worldToLocal(T.b.getWorldPosition(new THREE.Vector3())):bone.worldToLocal(T.p.clone());aims.push({bone,T,off});}
 const q0=root.getWorldQuaternion(new THREE.Quaternion()),hipQ=xrBasis(P.Spine2.p.clone().sub(P.Pelvis.p),P.R_Hip.p.clone().sub(P.L_Hip.p),new THREE.Quaternion()).invert();
 const chest=sc.getObjectByName('Spine4'),c0=chest.getWorldQuaternion(new THREE.Quaternion()),chestQ=xrBasis(P.Neck.p.clone().sub(P.Spine4.p),P.R_Shoulder.p.clone().sub(P.L_Shoulder.p),new THREE.Quaternion()).invert();
 // Fall away from the facing direction (or along the killing shot when known), capped so a bad hit vector cannot launch the body.
 const ry=M.m.getWorldQuaternion(new THREE.Quaternion()),fwd=new THREE.Vector3(0,0,1).applyQuaternion(ry);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,1);fwd.normalize();
 const push=(M.ragHit&&Number.isFinite(M.ragHit.x)&&Number.isFinite(M.ragHit.z))?new THREE.Vector3(M.ragHit.x,0,M.ragHit.z):fwd.clone().negate();if(push.lengthSq()<1e-6)push.copy(fwd).negate();push.normalize();
 const base=P.Pelvis.p.y,top=Math.max(.5,P.Head.p.y-base);for(const a of list){const k=Math.max(0,Math.min(1,(a.p.y-base)/top));a.old.addScaledVector(push,-(0.35+1.5*k)/120);}
 // Unsimulated chains below the root (fingers, hair, skirts, straps) keep their authored offsets, so a
 // body lying flat pushes them through the floor. Each (bone -> child) pair whose child dips under the
 // floor of its nearest simulated ancestor is swung up about the bone (xrDrape). Hands own their fingers.
 const drape=[],sim=new Set(list.map(a=>a.b).filter(Boolean)),aimed=new Set(aims.map(A=>A.bone));
 root.traverse(b=>{if(!b.isBone||b===root||sim.has(b)||aimed.has(b)||!b.parent||!b.parent.isBone)return;const par=b.parent;if(par!==P.L_Hand.b&&par!==P.R_Hand.b&&(sim.has(par)||aimed.has(par)||par===root))return;let a=par;while(a&&!sim.has(a))a=a.parent;const J=a&&list.find(j=>j.b===a);if(!J||b.position.lengthSq()<1e-8)return;drape.push({bone:par,child:b,J});});
 const R={P,list,links,aims,drape,root,q0,hipQ,chest,c0,chestQ,ground,time:0,frame:0,refY:base,rest:0,fwd};try{xrSupports(R,sc,sim);}catch(e){for(const a of list){a.sup=null;delete a.supD;}}xrGround(R,true);return R;
}
// Contact volume: a joint particle is a point, but the skin around it (a thick back, a cloak, a heel)
// reaches further. Once at death, sample the skinned surface near each simulated joint and keep its
// extreme points (14 directions, bone-local). Each frame the lowest of them sets that joint's
// clearance, so whatever side the body lands on rests on the floor instead of sinking into it.
const XR_DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]].map(d=>{const l=Math.hypot(...d);return d.map(x=>x/l);});
const XR_REACH=.32,XR_MAXCLEAR=.3,XR_SAMPLES=6000;
// BufferAttribute.getComponent only exists from three r152; the page runs r149, where calling it threw inside
// xrSupports and left null contact points that then threw in every solve (corpses froze upright). getX..getW exist in both.
const XR_GC=(at,i,k)=>k===0?at.getX(i):k===1?at.getY(i):k===2?at.getZ(i):at.getW(i);
// Every stride-th vertex of a geometry with its dominant bone and its four skin indices/weights, cached per geometry
// (every corpse of an agent shares it).
const XR_SL=new WeakMap();
function xrSampleList(g,stride){let c=XR_SL.get(g);if(c&&c.stride===stride)return c;const ps=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,n=Math.ceil(ps.count/stride);
 c={stride,n,vi:new Int32Array(n),dom:new Int32Array(n),si:new Int32Array(n*4),sw:new Float32Array(n*4)};
 for(let i=0,s=0;i<ps.count;i+=stride,s++){let best=-1,bi=0;c.vi[s]=i;for(let k=0;k<4;k++){const w=XR_GC(sw,i,k),j=XR_GC(si,i,k);c.si[s*4+k]=j;c.sw[s*4+k]=w;if(w>best){best=w;bi=j;}}c.dom[s]=bi;}
 XR_SL.set(g,c);return c;}
function xrSupports(R,sc,sim){
 const byBone=new Map(),J=new Map();for(const a of R.list)if(a.b)J.set(a.b,a);const owner=b=>{if(byBone.has(b))return byBone.get(b);let x=b;while(x&&!J.has(x))x=x.parent;const j=x?J.get(x):null;byBone.set(b,j);return j;};
 const inv=new Map();for(const a of R.list)if(a.b){a.b.updateWorldMatrix(true,false);inv.set(a,new THREE.Matrix4().copy(a.b.matrixWorld).invert());a.sup=XR_DIRS.map(()=>null);a.supD=XR_DIRS.map(()=>-Infinity);}
 const meshes=[];let total=0;sc.traverse(o=>{if(o.isSkinnedMesh&&o.visible!==false&&o.geometry&&o.geometry.attributes.skinIndex){meshes.push(o);total+=o.geometry.attributes.position.count;}});
 const stride=Math.max(1,Math.ceil(total/XR_SAMPLES)),v=new THREE.Vector3(),l=new THREE.Vector3(),JP=new Map();for(const a of R.list)if(a.b)JP.set(a,a.b.getWorldPosition(new THREE.Vector3()));
 // perf (kill cost): the sample list is cached per geometry, and each vertex is skinned with the same linear blend as
 // three's boneTransform but from per-bone matrices built once per mesh (world * bindMatrixInverse * bone * boneInverse
 // * bindMatrix), so the contact points are unchanged; joint positions are read once instead of per vertex.
 for(const o of meshes){o.updateMatrixWorld(true);o.skeleton.update();const ps=o.geometry.attributes.position,bt=o.applyBoneTransform||o.boneTransform;if(!bt)continue;
  const S=xrSampleList(o.geometry,stride),sk=o.skeleton,bm=new Map(),tmp=new THREE.Matrix4(),pre=new THREE.Matrix4().multiplyMatrices(o.matrixWorld,o.bindMatrixInverse),bnd=o.bindMatrix;
  const boneM=bi=>{let m=bm.get(bi);if(m!==undefined)return m;const b=sk.bones[bi],ib=sk.boneInverses[bi];m=b&&ib?new THREE.Matrix4().multiplyMatrices(pre,tmp.multiplyMatrices(b.matrixWorld,ib)).multiply(bnd).elements:null;bm.set(bi,m);return m;};
  for(let s=0;s<S.n;s++){const bone=sk.bones[S.dom[s]];const a=bone&&owner(bone);if(!a||!a.sup)continue;
   const i=S.vi[s],px=ps.getX(i),py=ps.getY(i),pz=ps.getZ(i);let x=0,y=0,z=0,ok=true;
   for(let k=0;k<4;k++){const w=S.sw[s*4+k];if(!w)continue;const e=boneM(S.si[s*4+k]);if(!e){ok=false;break;}x+=w*(e[0]*px+e[4]*py+e[8]*pz+e[12]);y+=w*(e[1]*px+e[5]*py+e[9]*pz+e[13]);z+=w*(e[2]*px+e[6]*py+e[10]*pz+e[14]);}
   if(ok)v.set(x,y,z);else{v.set(px,py,pz);bt.call(o,i,v);v.applyMatrix4(o.matrixWorld);}if(!Number.isFinite(v.y))continue;if(v.distanceTo(JP.get(a))>XR_REACH)continue;l.copy(v).applyMatrix4(inv.get(a));
   for(let k=0;k<XR_DIRS.length;k++){const d=XR_DIRS[k],s=l.x*d[0]+l.y*d[1]+l.z*d[2];if(s>a.supD[k]){a.supD[k]=s;a.sup[k]=(a.sup[k]||new THREE.Vector3()).copy(l);}}}}
 for(const a of R.list)if(a.sup){a.sup=a.sup.filter(Boolean);delete a.supD;if(!a.sup.length)a.sup=null;}
}
function xrClearance(R){const v=XR_V[6]||(XR_V[6]=new THREE.Vector3()),jp=XR_V[7]||(XR_V[7]=new THREE.Vector3());for(const a of R.list){if(!a.sup){a.rd=a.r;continue;}a.b.updateWorldMatrix(true,false);a.b.getWorldPosition(jp);let lo=jp.y;for(const s of a.sup){if(!s)continue;v.copy(s).applyMatrix4(a.b.matrixWorld);if(v.y<lo)lo=v.y;}const c=jp.y-lo;a.rd=Number.isFinite(c)?Math.min(XR_MAXCLEAR,Math.max(a.r,c)):a.r;}}
function xrGround(R,force){const g=R.ground||(typeof groundAt==='function'?groundAt:null);for(const a of R.list){if(!force&&(R.frame+a.n.length)%4)continue;let f=R.refY-.9;if(g)try{const v=g(a.p.x,a.p.z,.08,R.refY+.15);if(Number.isFinite(v))f=v;}catch(e){}a.floor=Math.max(f,R.refY-3);}}
function xrSolve(R,dt){
 const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps,g=9.81*h*h,maxStep=.35;R.frame++;xrGround(R,false);xrClearance(R);
 for(let s=0;s<steps;s++){
  for(const a of R.list){let vx=(a.p.x-a.old.x)*.99,vy=(a.p.y-a.old.y)*.99,vz=(a.p.z-a.old.z)*.99;const m=Math.hypot(vx,vy,vz);if(m>maxStep){const k=maxStep/m;vx*=k;vy*=k;vz*=k;}a.old.copy(a.p);a.p.x+=vx;a.p.y+=vy-g;a.p.z+=vz;}
  for(let it=0;it<10;it++){
   for(const L of R.links){const A=L.A,B=L.B,dx=B.p.x-A.p.x,dy=B.p.y-A.p.y,dz=B.p.z-A.p.z,len=Math.sqrt(dx*dx+dy*dy+dz*dz);if(len<1e-7)continue;const t=len<L.lo?L.lo:len>L.hi?L.hi:len;if(t===len)continue;const k=(len-t)/len*.5;A.p.x+=dx*k;A.p.y+=dy*k;A.p.z+=dz*k;B.p.x-=dx*k;B.p.y-=dy*k;B.p.z-=dz*k;}
   xrKnees(R);
   for(const a of R.list){const lim=a.floor+(a.rd||a.r);if(a.p.y<lim){a.p.y=lim;if(a.old.y<lim)a.old.y=lim+(a.old.y-lim)*.2;a.old.x+=(a.p.x-a.old.x)*.35;a.old.z+=(a.p.z-a.old.z)*.35;}}
  }
 }
 for(const a of R.list)if(!Number.isFinite(a.p.x)||!Number.isFinite(a.p.y)||!Number.isFinite(a.p.z))return false;
 return true;
}
// Knees bend forward only: when a shin folds the wrong way about the pelvis axis, nudge the knee
// (only the knee, by a bounded amount) toward the front of its hip-foot line.
function xrKnees(R){const P=R.P,up=XR_V[0].copy(P.Spine2.p).sub(P.Pelvis.p),right=XR_V[1].copy(P.R_Hip.p).sub(P.L_Hip.p),fwd=XR_V[2].crossVectors(up,right);if(fwd.lengthSq()<1e-10||right.lengthSq()<1e-10)return;fwd.normalize();right.normalize();const t=XR_V[3],n=XR_V[4],ax=XR_V[5];for(const s of ['L_','R_']){const hip=P[s+'Hip'].p,K=P[s+'Knee'],knee=K.p,foot=P[s+'Foot'].p;t.copy(knee).sub(hip);n.copy(foot).sub(knee);if(t.cross(n).dot(right)<=0)continue;ax.copy(foot).sub(hip);const l=ax.length();if(l<1e-5)continue;ax.multiplyScalar(1/l);t.copy(fwd).addScaledVector(ax,-fwd.dot(ax));if(t.lengthSq()<1e-8)continue;t.normalize();knee.addScaledVector(t,.004);K.old.addScaledVector(t,.004);}}
const XR_V=[0,1,2,3,4,5].map(()=>new THREE.Vector3()),XR_Q=[new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion()];
function xrPose(R){
 const P=R.P,root=R.root,[v0,v1,v2,v3]=XR_V,[q,pq,wq]=XR_Q;
 const setWorldQ=(b,w)=>{b.parent.updateWorldMatrix(true,false);b.parent.getWorldQuaternion(pq);b.quaternion.copy(pq.invert().multiply(w));b.updateMatrixWorld(false);};
 // Root: orientation from the hip frame, position so the pelvis joint lands on its particle.
 xrBasis(P.Spine2.p.clone().sub(P.Pelvis.p),P.R_Hip.p.clone().sub(P.L_Hip.p),q).multiply(R.hipQ);setWorldQ(root,wq.copy(q).multiply(R.q0));
 root.updateMatrixWorld(true);const pel=P.Pelvis.b.getWorldPosition(v0),delta=v1.copy(P.Pelvis.p).sub(pel),rw=root.getWorldPosition(v2).add(delta);root.position.copy(root.parent.worldToLocal(rw));root.updateMatrixWorld(true);
 const aim=(A)=>{const b=A.bone;b.updateWorldMatrix(true,false);const bp=b.getWorldPosition(v0),cur=v1.copy(A.off).applyMatrix4(b.matrixWorld).sub(bp),want=v2.copy(A.T.p).sub(bp);if(cur.lengthSq()<1e-10||want.lengthSq()<1e-10)return;q.setFromUnitVectors(cur.normalize(),want.normalize());b.getWorldQuaternion(wq);setWorldQ(b,wq.premultiply(q));};
 for(const A of R.aims){if(A.bone===R.chest)continue;aim(A);if(A.bone.name==='Spine1'){xrBasis(P.Neck.p.clone().sub(P.Spine4.p),P.R_Shoulder.p.clone().sub(P.L_Shoulder.p),q).multiply(R.chestQ);setWorldQ(R.chest,wq.copy(q).multiply(R.c0));}}
 root.updateMatrixWorld(true);xrDrape(R);
}
const XR_DRAPE_GAP=.03;
function xrDrape(R){
 if(!R.drape||!R.drape.length)return;const [p,c,d,w]=XR_V,[q,pq,wq]=XR_Q;
 for(const D of R.drape){const b=D.bone,lim=D.J.floor+XR_DRAPE_GAP;D.child.getWorldPosition(c);if(!(c.y<lim))continue;b.getWorldPosition(p);d.copy(c).sub(p);const len=d.length();if(len<1e-6)continue;
  let dy=Math.min(lim-p.y,len*.98);if(dy<=d.y)continue;const hx=d.x,hz=d.z,hl=Math.hypot(hx,hz),h=Math.sqrt(Math.max(0,len*len-dy*dy));
  if(hl>1e-6)w.set(hx/hl*h,dy,hz/hl*h);else w.set(h,dy,0);q.setFromUnitVectors(d.multiplyScalar(1/len),w.multiplyScalar(1/len));
  b.getWorldQuaternion(wq).premultiply(q);b.parent.getWorldQuaternion(pq);b.quaternion.copy(pq.invert().multiply(wq));b.updateMatrixWorld(true);}
}
// dt is the animation step (the caller clamps it to 0.05 s); wall, when given, is the real time since the
// previous corpse tick. Corpses advance on real time so a low-fps client (1-10 fps, where 0.05 s per frame
// left bodies standing upright until the 4 s fade) still sees them collapse. Large steps are split into
// 0.05 s chunks (each substepped at 120 Hz), never frozen, up to the 4 s corpse lifetime (browser: swiftshader at ~0.4 fps, 2.5 s
// between frames, left every corpse upright until the fade under the old 2 s / 1 s limits); a longer gap (a pause or hidden tab) uses the clamped step.
function xrRagdollTick(M,dt,wall){
 if(!M.ragdoll&&M.ragdoll!==null){const pose=[];M.sx.sc.traverse(b=>{if(b.isBone)pose.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);});M.sx.mx.stopAllAction();for(const [b,p,q,s]of pose){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}let R=null;try{R=xrRagdoll(M);}catch(e){console.warn('ragdoll unavailable',e);}M.ragdoll=R;if(R)R.good=R.list.map(a=>a.p.clone());}
 const R=M.ragdoll;if(!R)return false;
 dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.05)):0;if(Number.isFinite(wall)&&wall>dt&&wall<=4)dt=wall;if(!dt)return true;R.time+=dt;
 let ok=true;try{for(let left=dt;ok&&left>1e-6;left-=.05)ok=xrSolve(R,Math.min(.05,left));}catch(e){ok=false;}
 if(!ok){R.list.forEach((a,i)=>{a.p.copy(R.good[i]);a.old.copy(R.good[i]);});try{xrPose(R);}catch(e){}return false;}
 R.list.forEach((a,i)=>R.good[i].copy(a.p));
 try{xrPose(R);}catch(e){return false;}
 let e=0;for(const a of R.list)e+=a.p.distanceToSquared(a.old);R.rest=e<1e-7*R.list.length?R.rest+dt:0;
 return R.time<3.2&&R.rest<.4;
}
{const die=xDie;xDie=function(b){const r=die.apply(this,arguments);if(b&&b.xm&&b.xm.dead){b.xm.diedAt=b.xm.diedAt||performance.now();}return r;};}
{const visual=xVis;xVis=function(dt){const now=performance.now();for(let i=XDEAD.length-1;i>=0;i--){const e=XDEAD[i],age=(now-(e.c.diedAt||now))/1000;if(age>4){scene.remove(e.c.m);scene.remove(e.gn);xDisp(e.gn);const j=XSOL.mx.indexOf(e.c);if(j>=0)XSOL.mx.splice(j,1);XDEAD.splice(i,1);}else e.t=Math.max(e.t,age);}return visual(dt);};}
// perf (kill cost): a built corpse re-solves at most 30 times a second (15 beyond 35 m from the camera); the skipped
// real time is passed on, so it falls exactly as fast. At most XR_ACT.max bodies simulate at once: when a fifth body
// drops, the oldest one that has been falling for over a second freezes where it lies (settled bodies already stop).
const XR_ACT=[];XR_ACT.max=4;
{const death=xUbDead;xUbDead=function(M,dt){if(!(M&&M.sx&&M.sx.sc))return death(M,dt);const now=performance.now();
 if(M.ragdoll&&M.ragW!=null){let iv=33;try{const p=M.m.position,c=camera.position;if(Math.hypot(p.x-c.x,p.z-c.z)>35)iv=66;}catch(e){}if(now-M.ragW<iv)return true;}
 while(XR_ACT.length&&now-(XR_ACT[0].ragW||0)>1500)XR_ACT.shift();if(XR_ACT.indexOf(M)<0)XR_ACT.push(M);
 if(XR_ACT.length>XR_ACT.max&&XR_ACT[0]===M&&M.ragdoll&&M.ragdoll.time>1){XR_ACT.shift();return false;}
 const w=M.ragW!=null?(now-M.ragW)/1000:dt;M.ragW=now;const r=xrRagdollTick(M,dt,w);if(!r){const i=XR_ACT.indexOf(M);if(i>=0)XR_ACT.splice(i,1);}return r;};}
// ---- END REPAIR PASS ----
