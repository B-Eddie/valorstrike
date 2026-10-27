// ---- ROCKLAN MOVEMENT ----
// Movement-only overlay. The original mixed animation library and upper-body actions stay intact.
var XRM = { assets: /*MOVEMENT_ASSETS*/null, promise: null, dirs: ['N','NE','E','SE','S','SW','W','NW'] };
function xrmClamp(v, lo=0, hi=1) { return Math.max(lo, Math.min(hi, v)); }
function xrmDirections(f, side) {
  const a = (Math.atan2(-side, f) / (Math.PI / 4) + 8) % 8, i = Math.floor(a), u = a - i;
  return [[XRM.dirs[i], 1-u], [XRM.dirs[(i+1)%8], u]];
}
function xrmGround(sp, crouch, f, side, knife) {
  const T = {}, moving = xrmClamp((sp-.12)/.3), sprint = knife ? xrmClamp((sp-4.5)/.8) : 0;
  // PowerWalk supplies the intermediate gait instead of speeding a single forward run in every direction.
  const run = xrmClamp((sp-4.05)/.65), power = xrmClamp((sp-3.5)/.55)*(1-run);
  const gaits = {walk:(1-power-run)*(1-sprint),powerWalk:power*(1-sprint),run:run*(1-sprint),sprint};
  T.idle = (1-crouch)*(1-moving); T.crouch = crouch*(1-moving);
  for (const [d,w] of xrmDirections(f,side)) if(w>1e-8) {
    for(const gait in gaits) if(gaits[gait]>0) T[gait+d]=(1-crouch)*moving*gaits[gait]*w;
    T['crouchWalk'+d]=crouch*moving*w;
  }
  return T;
}
function xrmJumpDirections(f,side) {
  const dirs=['N','E','S','W'],a=(Math.atan2(-side,f)/(Math.PI/2)+4)%4,i=Math.floor(a),u=a-i;
  return [[dirs[i],1-u],[dirs[(i+1)%4],u]];
}
function xrmContactPhase(meta) { return meta&&meta.contact&&meta.contact.footPhase?meta.contact.footPhase.left:0; }
function xrmLandingTime(meta,age) {
  const u=xrmClamp(age/.3),compression=(meta.phase||{}).compressionSample||.0635;
  return u<.15?u/.15*compression:compression+(u-.15)/.85*(meta.duration-compression);
}
function xrmRead(file) {
  const item = XRM.assets && XRM.assets[file];
  return Promise.resolve().then(()=>fetch('models/valorant/movement/'+file+(item?'?v='+item.sha256.slice(0,16):''))).then(r=>{
    if(!r.ok)throw Error('movement '+file+' HTTP '+r.status); return r.arrayBuffer();
  }).then(async b=>{
    if(item && typeof crypto!=='undefined' && crypto.subtle) {
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==item.sha256)throw Error('movement integrity '+file);
    }
    return b;
  });
}
function xrmLoad() {
  if(!XRM.promise) XRM.promise=Promise.all([xrmRead('movement.json'),xrmRead('movement.bin')]).then(([j,b])=>({h:JSON.parse(new TextDecoder().decode(j)),f:new Float32Array(b)})).catch(e=>{XRM.promise=null;throw e;});
  return XRM.promise;
}
function xrmClips(data,slug) {
  const row=data.h.agents[slug]; if(!row)throw Error('movement rig missing '+slug);
  const clips={},meta={};
  for(const c of row.clips) {
    const tracks=c.tracks.map(t=>{
      const times=data.f.slice(t.times,t.times+t.count),size=t.type==='quaternion'?4:3,values=data.f.slice(t.values,t.values+t.count*size);
      return t.type==='quaternion'?new THREE.QuaternionKeyframeTrack(t.name,times,values):new THREE.VectorKeyframeTrack(t.name,times,values);
    });
    clips[c.name]=new THREE.AnimationClip('RocklanMovement_'+c.name,c.duration,tracks);meta[c.name]=c;
  }
  return {clips,meta};
}
// Agent readiness includes movement assets; failures follow the existing asset-loading retry path.
if(typeof xvaLoco==='function') { const original=xvaLoco; xvaLoco=function(){
  const self=this,args=arguments;
  return Promise.all([Promise.resolve().then(()=>original.apply(self,args)),Promise.resolve().then(()=>xrmLoad())]).then(([L,movement])=>({...L,movement}));
}; }
if(typeof xvaKit==='function') { const original=xvaKit; xvaKit=function(gl,L,slug){
  const kit=original.apply(this,arguments);if(!L.movement)return kit;
  const movement=xrmClips(L.movement,slug),aliases={Idle_Loop:'idle',Walk_Loop:'walkN',Jog_Fwd_Loop:'runN',Crouch_Idle_Loop:'crouch',Crouch_Fwd_Loop:'crouchWalkN',Jump_Start:'jump',Jump_Loop:'fall',Jump_Land:'land'};
  for(const name in aliases) {
    const clip=movement.clips[aliases[name]];if(!clip)throw Error('movement alias missing '+aliases[name]);
    kit.L[name]=clip;
  }
  // crouchSpine is the IdlePose_UB -> CrouchPose_UB spine difference; its Spine2-4 part pitches the arms (which ride on Spine4) 18 deg
  // further down, because the pack's arm curves that keep the gun level in that pose are not copied. Keep the hip-level Spine1 lean.
  const cs=movement.clips.crouchSpine;if(cs)cs.tracks=cs.tracks.filter(t=>t.name==='Spine1.quaternion');
  kit.movement=movement;return kit;
}; }
if(typeof xvAgent==='function') { const original=xvAgent; xvAgent=function(M,kit){
  const result=original.apply(this,arguments),X=M&&M.sx;if(!X||!kit.movement||X.rm)return result;
  const R=X.rm={...kit.movement,actions:{},add:{},phase:0,crouch:0,lastSpeed:0,dir:[1,0],airAge:0,stopAge:Infinity,landAge:Infinity};
  // Base compatibility aliases remain lower-body actions; extra directions never alter global non-movement mappings.
  const aliases={idle:'idle',crouch:'crouch',jump:'jump',fall:'fall',land:'land',walkN:'walk',runN:'run',crouchWalkN:'crouchWalk'};
  for(const n in R.clips) {
    const c=R.clips[n],meta=R.meta[n],a=X.mx.clipAction(c);
    if(meta.additive){a.blendMode=THREE.AdditiveAnimationBlendMode;a.setEffectiveWeight(0);R.add[n]=a;}
    else {const key=aliases[n]||'rm_'+n;R.actions[n]=key;X.a[key]=a;if(X.w[key]==null)X.w[key]=0;}
  }
  // Name lists cached once: the per-frame passes walk arrays instead of for-in over ~115 action / ~45 additive keys.
  R.names=Object.keys(R.actions);R.keys=R.names.map(n=>R.actions[n]);R.cycleNames=R.names.filter(n=>R.meta[n].naturalSpeed>0);
  R.addNames=Object.keys(R.add);R.addLean=R.addNames.map(n=>n.startsWith('lean_')?n.slice(5):null);
  // The old forward-jog support-lift curve belongs to a different donor. Sole probes/terrain IK remain active.
  X.contactLift=null;
  return result;
}; }
function xrmStanceSpeed(m) { return m.contact&&m.contact.stanceSpeed>0?m.contact.stanceSpeed:m.naturalSpeed; }
function xrmCycle(X,T,dt,sp) {
  const R=X.rm,scale=Math.max(.1,X.sc.parent.scale.y||1);let hz=0,total=0;
  // contact.stanceSpeed: the measured speed at which the planted foot stands still (work/calibrate_rocklan_stride.cjs); the builder's
  // naturalSpeed estimate ran the cycles 12-52 % fast (moonwalking feet) and stays as the fallback.
  for(const n in T)if(R.meta[n]&&R.meta[n].naturalSpeed>0&&T[n]>0){const m=R.meta[n];hz+=T[n]*sp/(xrmStanceSpeed(m)*scale*m.duration);total+=T[n];}
  if(total>0)R.phase=(R.phase+dt*hz/total)%1;
  // Only cycles that have weight or are getting some need their clock (an idle cycle is set the frame its target rises).
  for(const n of R.cycleNames) {
    const key=R.actions[n];if(!(T[n]>0)&&!(X.w[key]>0))continue;
    const a=X.a[key],m=R.meta[n];a.paused=true;a.time=((R.phase+xrmContactPhase(m))%1)*m.duration;
  }
}
function xrmPoseTime(X,n,t) {
  const R=X.rm,key=R.actions[n],a=key&&X.a[key];if(!a)return;
  a.paused=true;a.time=xrmClamp(t,0,Math.max(0,a.getClip().duration-1e-6));
}
function xrmTurn(X,T,F,dt) {
  const R=X.rm;
  if(F.sp>.35){R.turn=null;R.turnSum=0;return;}
  if(Number.isFinite(F.dyaw)&&Math.abs(F.dyaw)/Math.max(dt,1e-6)>.03) {
    R.turnQuiet=0;R.turnSum=(R.turnSum||0)+F.dyaw;
    if(Math.abs(R.turnSum)>.12){
      const direction=R.turnSum>0?'W':'E',degrees=Math.abs(R.turnSum)*180/Math.PI,angle=[45,90,135,180].find(a=>a>=degrees)||180;
      if(!R.turn||R.turn.direction!==direction)R.turn={direction,angle,progress:0,strength:1};
      else {R.turn.progress*=R.turn.angle/angle;R.turn.angle=angle;R.turn.strength=1;}
      R.turn.goal=xrmClamp(degrees/angle);
    }
  } else {R.turnQuiet=(R.turnQuiet||0)+dt;if(R.turnQuiet>.15)R.turnSum=0;}
  if(!R.turn)return;
  const turn=R.turn,n='turn'+turn.direction+turn.angle,c='crouchTurn'+turn.direction+turn.angle,m=R.meta[n];
  if(!m){R.turn=null;return;}
  turn.progress+=(turn.goal-turn.progress)*(1-Math.exp(-dt*18));
  if(R.turnQuiet>.15)turn.strength*=Math.exp(-dt*18);
  if(turn.strength<.002){R.turn=null;return;}
  for(const key in T)T[key]*=1-turn.strength;
  T[n]=(1-R.crouch)*turn.strength;T[c]=R.crouch*turn.strength;
  xrmPoseTime(X,n,turn.progress*m.duration);xrmPoseTime(X,c,turn.progress*R.meta[c].duration);
}
function xrmAdditives(X,T,dt,sp,enabled) {
  const R=X.rm,stopTime=R.stopAge,stopWeight=enabled&&Number.isFinite(stopTime)&&stopTime<.22?(1-stopTime/.22)*R.stopStrength:0;
  const leanK=xrmClamp(sp/.8);
  for(let i=0;i<R.addNames.length;i++) {
    const n=R.addNames[i],a=R.add[n],meta=R.meta[n],lean=R.addLean[i];let target=0;
    if(enabled&&lean)target=(T[lean]||0)*leanK;
    // fast path: an idle lean (most of the ~45 additives every frame) has nothing to blend
    if(lean&&!(target>0)&&!R.rope&&a.getEffectiveWeight()===0){if(a.isScheduled())a.stop();continue;}
    if(n==='stopLower'||n==='stopSpine')target=stopWeight;
    if(R.rope&&meta.traversal)target=R.ropeTargets[n]||0;
    if(R.wasAir&&!R.rope&&n==='jumpSpine')target=R.takeoff*(1-R.crouch)*.35;
    if(R.wasAir&&!R.rope&&n==='crouchJumpSpine')target=R.takeoff*R.crouch*.35;
    if(n==='landSpine')target=!R.wasAir&&R.landAge<.3?xUbLandEnv(R.landAge/.3)*(R.landStrength||0)*(1-R.crouch):0;
    if(n==='crouchLandLower'||n==='crouchLandSpine')target=!R.wasAir&&R.landAge<.3?xUbLandEnv(R.landAge/.3)*(R.landStrength||0)*R.crouch:0;
    if(n==='crouchSpine'&&!R.rope)target=R.crouch;
    if(R.suppressPosture)target=0;
    const weight=R.suppressPosture?0:a.getEffectiveWeight()+(target-a.getEffectiveWeight())*(1-Math.exp(-dt*20));
    a.setEffectiveWeight(weight<.001?0:weight);
    if(weight>.001){
      if(!a.isScheduled())a.play();a.paused=true;
      const donor=lean?R.meta[lean]:meta;
      a.time=n.startsWith('stop')?xrmClamp(stopTime/.22)*meta.duration:/^(landSpine|crouchLand)/.test(n)?xrmLandingTime(R.meta.land,R.landAge+dt):((R.phase+xrmContactPhase(donor))%1)*meta.duration;
      if(n==='jumpSpine'||n==='crouchJumpSpine')a.time=Math.min(meta.duration,n==='jumpSpine'?R.jumpTime||0:R.crouchJumpTime||0);
    }
    else if(a.isScheduled())a.stop();
  }
}
function xrmWeights(X,targets,dt) {
  const R=X.rm,F=R.frame,b=F.b,sp=F.sp,rope=!!((b.xkr&&b.xk!=null)||b.rope>0),air=X.air&&!rope; // b.rope: Split's ascenders (rope_runtime.js u.rope, row [25])
  const full=xrmClamp(Math.max((targets.plant||0)+(targets.death1||0)+(targets.death2||0),(X.w.plant||0)+(X.w.death1||0)+(X.w.death2||0)));
  if(full>.001||X.dd){
    // Full-body events retain the base animator's crouch/yaw, timing and target weights.
    R.crouch=X.cb;R.suppressPosture=true;R.landAge=R.stopAge=Infinity;R.wasAir=X.air;R.rope=false;R.lastSpeed=sp;
    for(const key of R.keys)if(!XUB_LO.includes(key))targets[key]=0;
    xrmAdditives(X,{},dt,sp,false);return;
  }
  R.crouch+=((b.cr?1:0)-R.crouch)*(1-Math.exp(-dt*10));
  // Native crouch correction and both halves of the waist use the same amount, including crouch-jumps.
  X.cb=R.crouch;
  if(Math.hypot(F.f,F.side)>1e-5)R.dir=[F.f,F.side];
  const [f,side]=R.dir,T=xrmGround(sp,R.crouch,f,side,F.knife);
  R.rope=rope;R.ropeTargets={};R.takeoff=0;
  if(rope){
    for(const n in T)delete T[n];X.air=true;X.airH=Math.max(1,X.airH||0);X.lnd=0;R.landAge=Infinity;R.turn=null;
    // letting go mid-climb falls straight into the airborne loop (no takeoff: the air branch only sets these on leaving the ground)
    R.jumpDirs=[['',1]];R.airAge=Math.max(R.airAge||0,.16);
    T[F.dy>1e-4?'ropeUp':F.dy< -1e-4?'ropeDown':'ropeIdle']=1;
    if(sp>.15){R.ropeTargets.ropeHorizontal=xrmClamp(Math.abs(side)/Math.max(1e-6,Math.hypot(f,side)));R.ropeTargets[f>=0?'ropeForward':'ropeBack']=xrmClamp(Math.abs(f)/Math.max(1e-6,Math.hypot(f,side)));}
    for(const n of ['ropeIdle','ropeUp','ropeDown'])if(R.actions[n]){
      const m=R.meta[n];xrmPoseTime(X,n,m.duration>0?(R.phase*m.duration):0);
    }
    R.phase=(R.phase+dt*Math.max(.25,Math.abs(F.dy/dt)/3.5))%1;
  } else if(air) {
    for(const n in T)delete T[n];R.landAge=Infinity;R.turn=null;
    if(!R.wasAir){R.airAge=0;R.jumpDirs=sp<.35?[['',1]]:xrmJumpDirections(f,side);}
    R.airAge+=dt;
    const takeoff=F.dy>0?1-xrmClamp(R.airAge/.16):0;R.takeoff=takeoff;
    for(const [d,w] of R.jumpDirs)T['jump'+d]=(1-R.crouch)*takeoff*w;
    T.crouchJump=R.crouch*takeoff;
    T.fall=(1-R.crouch)*(1-takeoff);T.crouchFall=R.crouch*(1-takeoff);
    for(const n of R.jumpDirs.map(([d])=>'jump'+d).concat('crouchJump')){const m=R.meta[n];if(m){const p=m.phase||{},start=Math.max(0,(p.firstExtension||.16)-.08),time=start+Math.min(.16,R.airAge);xrmPoseTime(X,n,time);if(n==='crouchJump')R.crouchJumpTime=time;else R.jumpTime=time;}}
    // In-place falling cycles follow capsule translation; never add the source jump's whole wind-up as world motion.
    for(const n of ['fall','crouchFall']){const m=R.meta[n];if(m)xrmPoseTime(X,n,Math.min(m.duration-1e-6,R.airAge));}
    X.lnd=0;
  }
  if(!air&&!rope&&R.wasAir){R.landAge=0;const L=xUbLandStart(F.vyMin||-6.9,sp);R.landStrength=L.w;}
  R.wasAir=air||rope;
  if(!air&&!rope&&R.lastSpeed>.8&&(R.lastSpeed-sp)/Math.max(dt,1e-5)>8&&R.stopAge>.22){R.stopAge=0;R.stopStrength=xrmClamp(R.lastSpeed/5.4)*.35;}
  R.stopAge+=dt;R.lastSpeed=sp;
  R.suppressPosture=full>.001||!!X.uo||!!X.dd;
  for(const n of XUB_LO)targets[n]=0;
  for(const key of R.keys)targets[key]=0;
  for(const n in T)if(R.actions[n])targets[R.actions[n]]=(T[n]||0)*(1-full);
  // Authored directional hips supply their own yaw; retain the original aim-pitch code.
  X.yaw=0;
  if(!air&&!rope){xrmTurn(X,T,F,dt);for(const n in T)if(R.actions[n])targets[R.actions[n]]=(T[n]||0)*(1-full);xrmCycle(X,T,dt,sp);}
  xrmAdditives(X,T,dt,sp,!air&&!rope&&full<.01&&!X.uo);
  R.targets=T;
}
if(typeof xUbW==='function'){const original=xUbW;xUbW=function(X,T,dt,k){
  if(X.rm&&X.rm.frame)xrmWeights(X,T,dt);
  else if(X.rm&&X.dd)for(const n in X.rm.add){const a=X.rm.add[n];a.setEffectiveWeight(0);a.stop();}
  return original.call(this,X,T,dt,k);
};}
// The envelope is derived from the pack landing's knee give; its full authored crouch is not a second physics jump.
if(typeof xUbLand==='function'){const original=xUbLand;xUbLand=function(X,dt){
  const R=X.rm;if(!R||!R.frame)return original.apply(this,arguments);
  const a=X.a.land;if(!a||R.wasAir||R.rope)return;
  R.landAge+=dt;const u=R.landAge/.3,weight=u<1&&!R.suppressPosture?xUbLandEnv(u)*(R.landStrength||0)*(1-R.crouch):0;
  if(weight<=0){a.setEffectiveWeight(0);X.w.land=0;return;}
  if(!a.isScheduled())a.play();a.paused=true;
  a.time=xrmLandingTime(R.meta.land,R.landAge);
  X.w.land=weight;a.setEffectiveWeight(weight);
  for(const n in R.actions)if(n!=='land'){const key=R.actions[n];if(X.w[key])X.a[key].setEffectiveWeight(X.w[key]*(1-weight));}
};}
function xrmInstallAnimator(){
  if(typeof xUbAnim!=='function'||xUbAnim.movementOnly)return;
  const original=xUbAnim;xUbAnim=function(b,M,sp,dt){
    const X=M&&M.sx,R=X&&X.rm;if(!R||!(dt>0))return original.apply(this,arguments);
    const P=b.g.position,dx=X.px==null?0:P.x-X.px,dz=X.pz==null?0:P.z-X.pz,dy=X.py==null?0:P.y-X.py,ry=b.g.rotation.y;
    const dyaw=R.heading==null?0:Math.atan2(Math.sin(ry-R.heading),Math.cos(ry-R.heading));R.heading=ry;
    R.frame={b,sp:Math.max(0,sp),dy,dyaw,vyMin:X.vyMin,f:dx*Math.sin(ry)+dz*Math.cos(ry),side:dx*Math.cos(ry)-dz*Math.sin(ry),knife:M.w==='Knife'};
    try{return original.apply(this,arguments);}finally{R.frame=null;}
  };xUbAnim.movementOnly=true;
}
xrmInstallAnimator();
// Ground contact owns leg rotations only. Existing vertical contact/terrain passes run first.
// The actor, pelvis, sibling torso, camera and movement motor never move to satisfy an anchor.
function xrmPlantSetup(X) {
  if(X.rm.plant)return X.rm.plant;
  const legs=['L','R'].map(side=>({side,up:X.sc.getObjectByName(side+'_Hip'),lo:X.sc.getObjectByName(side+'_Knee'),hand:X.sc.getObjectByName(side+'_Foot')}));
  if(legs.some(L=>!L.up||!L.lo||!L.hand))return null;
  // Reuse the native contact pass's small sole sample set. Nearly rigid foot/toe weights
  // identify actual skin contact instead of locking an ankle while its sole rolls away.
  for(const L of legs){L.probes=[];for(const {o,indices} of X.contactProbes||[]){
    const g=o.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;if(!si||!sw)continue;
    for(const i of indices){let weight=0;for(let k=0;k<4;k++){
      const n=o.skeleton.bones[si.array[i*4+k]].name;
      if(n===L.side+'_Foot'||n===L.side+'_Toe')weight+=sw.array[i*4+k];
    }if(weight>.98)L.probes.push({o,i});}
  }}
  return X.rm.plant={legs,bones:legs.flatMap(L=>[L.up,L.lo,L.hand]),saved:Array.from({length:6},()=>new THREE.Quaternion()),
    before:Array.from({length:6},()=>new THREE.Quaternion()),restore:false,side:null,anchor:new THREE.Vector3(),last:new THREE.Vector3(),hasLast:false,
    v:Array.from({length:9},()=>new THREE.Vector3()),footQ:new THREE.Quaternion(),
    G:{ik:Array.from({length:9},()=>new THREE.Vector3()),q:[new THREE.Quaternion(),new THREE.Quaternion()]}};
}
function xrmPlantRelease(P) { if(P){P.side=null;P.age=0;P.active=false;P.clamped=false;} }
function xrmPlantPoint(L,out) {
  const W=L.probe;if(!W)return L.hand.getWorldPosition(out);
  W.o.skeleton.update();out.fromBufferAttribute(W.o.geometry.attributes.position,W.i);
  const skin=W.o.applyBoneTransform||W.o.boneTransform;skin.call(W.o,W.i,out);return out.applyMatrix4(W.o.matrixWorld);
}
function xrmPlantRestore(X) {
  const P=X&&X.rm&&X.rm.plant;if(!P||!P.restore)return;
  P.bones.forEach((b,i)=>b.quaternion.copy(P.saved[i]));P.restore=false;
}
function xrmPlantPose(M,P) {
  const X=M.sx,R=X.rm,dt=X.poseDt,root=M.m.getWorldPosition(P.v[0]);
  const shift=P.hasLast?P.last.distanceTo(root):0,vertical=P.hasLast?Math.abs(P.last.y-root.y):0;
  P.last.copy(root);P.hasLast=true;
  const full=['plant','death1','death2'].some(n=>(X.w[n]||0)>.001);
  const blocked=!(dt>0&&dt<=.05)||X.air||R.wasAir||R.rope||R.turn||R.suppressPosture||R.plantBlockedTargets||full||X.uo||X.lo||X.dd||M.dead;
  if(blocked||!(X.spS>.35)||shift>Math.max(.22,2*(X.spS||0)*dt+.08)||vertical>.04||typeof xgIK!=='function'||typeof xgWorldQ!=='function'||typeof xgSetWorldQ!=='function'){
    xrmPlantRelease(P);return;
  }
  const [left,right]=P.legs;left.hand.getWorldPosition(P.v[1]);right.hand.getWorldPosition(P.v[2]);
  let side=P.v[1].y<=P.v[2].y?'L':'R';
  // Five millimetres of hysteresis avoids bouncing between nearly level support feet.
  if(P.side&&Math.abs(P.v[1].y-P.v[2].y)<.005)side=P.side;
  const L=side==='L'?left:right,foot=side==='L'?P.v[1]:P.v[2];
  if(P.side!==side){
    P.side=side;L.probe=null;let low=Infinity;
    for(const W of L.probes){L.probe=W;xrmPlantPoint(L,P.v[3]);if(P.v[3].y<low){low=P.v[3].y;L.best=W;}}
    L.probe=L.best||null;xrmPlantPoint(L,P.anchor);P.age=0;
  }
  P.age+=dt;P.active=false;P.clamped=false;
  const contact=xrmPlantPoint(L,P.v[3]),delta=P.v[4].subVectors(P.anchor,contact);
  const target=P.v[3].copy(foot);target.x+=delta.x;target.z+=delta.z;
  // A bad state correction or a source phase without a usable stance yields to the authored pose.
  // Toe-off: once the authored contact point has lifted 3 cm off its anchor the stance is over; holding on stretched the leg to its
  // reach clamp and dragged the sole (strafe walks, end of run stances).
  if(Math.hypot(delta.x,delta.z)>.22||P.age>.65||-delta.y>.03){xrmPlantRelease(P);return;}
  // Nothing to correct (the anchoring frame): keep the authored leg. Solving anyway re-derived a near-straight heel-strike leg with
  // up to 8 mm of IK error, a one-frame pop of the planted sole.
  if(Math.hypot(delta.x,delta.z)<1e-5){P.active=true;P.target=(P.target||new THREE.Vector3()).copy(target);return;}
  const hip=L.up.getWorldPosition(P.v[5]),knee=L.lo.getWorldPosition(P.v[6]);
  const l1=hip.distanceTo(knee),l2=knee.distanceTo(foot),dy=target.y-hip.y,max=(l1+l2)*.995;
  if(!(max>Math.abs(dy)+.001)){xrmPlantRelease(P);return;}
  const horizontal=Math.hypot(target.x-hip.x,target.z-hip.z),limit=Math.sqrt(Math.max(0,max*max-dy*dy));
  // Past the leg's reach by more than 2 cm the stance is over (the body has moved on): yield instead of dragging a straight leg.
  if(horizontal>limit+.02){xrmPlantRelease(P);return;}
  if(horizontal>limit){
    const k=limit/Math.max(1e-8,horizontal);target.x=hip.x+(target.x-hip.x)*k;target.z=hip.z+(target.z-hip.z)*k;P.clamped=true;
  }
  const dir=P.v[7].subVectors(target,hip).normalize(),pole=P.v[8].subVectors(knee,hip);pole.addScaledVector(dir,-pole.dot(dir));
  if(pole.lengthSq()<1e-8)pole.set(0,0,1).transformDirection(M.m.matrixWorld);pole.normalize();
  xgWorldQ(L.hand,P.footQ);P.bones.forEach((b,i)=>P.before[i].copy(b.quaternion));
  try {
    xgIK(L,target,pole,P.G);xgSetWorldQ(L.hand,P.footQ);
    if(P.bones.some(b=>!Number.isFinite(b.quaternion.x+b.quaternion.y+b.quaternion.z+b.quaternion.w)))throw Error('invalid locomotion contact');
    P.restore=true;P.active=true;P.target=(P.target||new THREE.Vector3()).copy(target);
  } catch(e) {P.bones.forEach((b,i)=>b.quaternion.copy(P.before[i]));xrmPlantRelease(P);}
  M.m.updateMatrixWorld(true);
}
if(typeof xUbW==='function'){const original=xUbW;xUbW=function(X,T){
  if(X.rm)X.rm.plantBlockedTargets=['plant','death1','death2'].some(n=>(T[n]||0)>.001);
  return original.apply(this,arguments);
};}
if(typeof xUbPre==='function'){const original=xUbPre;xUbPre=function(M){
  const result=original.apply(this,arguments);xrmPlantRestore(M&&M.sx);return result;
};}
if(typeof xUbPost==='function'){const original=xUbPost;xUbPost=function(M){
  const X=M&&M.sx,P=X&&X.rm&&xrmPlantSetup(X);
  // Capture the unmodified mixer pose, before other post passes save their own IK offsets.
  if(P)P.bones.forEach((b,i)=>P.saved[i].copy(b.quaternion));
  const result=original.apply(this,arguments);if(P)xrmPlantPose(M,P);return result;
};}
// ---- END ROCKLAN MOVEMENT ----
