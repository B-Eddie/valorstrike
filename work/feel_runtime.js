// ---- VALORANT FEEL ----
var VF = { model:window.ValorantFeel, profiles:window.VALORANT_WEAPON_STATS.weapons, time:0, shot:0, bloom:0, lastWeapon:'', recoilX:0, recoilY:0, settled:1, sequence:0 };
const VF_C=VF.model.C;
function vfWeapon(){return mode==='duel'?(du.w==='op'?'Operator':'Knife'):mode==='aim'?aimW():rw==='knife'?'Knife':wName();}
function vfProfile(w){return VF.profiles[w]||{equipTimeSeconds:.75,reloadTimeSeconds:2.5,firstBulletAccuracy:0,runSpeedMultiplier:1};}
for(const [w,p]of Object.entries(VF.profiles)){const W=WEAP[w];if(!W)continue;W.mag=p.magazineSize;W.rate=p.fireRate;W.rld=p.reloadTimeSeconds;W.equip=p.equipTimeSeconds;W.pel=p.shotgunPelletCount>1?p.shotgunPelletCount:W.pel;VRUN[w]=p.runSpeedMultiplier;FSA[w]=Math.tan(Math.max(0,p.firstBulletAccuracy)*Math.PI/180);const d=p.damageRanges[0];W.body=Math.floor(d.bodyDamage);W.head=Math.floor(d.headDamage);W.legs=Math.floor(d.legDamage);if(p.adsStats)XZ[w]=p.adsStats.zoomMultiplier;delete W.spin;}
// Ranges and rates come from the same local snapshot in every mode.
wDmg=function(W,part,distance){const w=Object.keys(WEAP).find(k=>WEAP[k]===W),p=VF.profiles[w];if(!p)return W[part]||W.body;const ranges=p.damageRanges,row=ranges.find(r=>distance>=r.rangeStartMeters&&distance<r.rangeEndMeters)||ranges[ranges.length-1];return Math.floor(row[part==='head'?'headDamage':part==='legs'?'legDamage':'bodyDamage']);};
xEq=function(w){return w==='Knife'?.75:vfProfile(w).equipTimeSeconds;};
xRate=function(W){const w=Object.keys(WEAP).find(k=>WEAP[k]===W),p=VF.profiles[w];return ads&&p&&p.adsStats?p.adsStats.fireRate:W.rate;};
xSCf=function(z){return 2*Math.atan(Math.tan(VF_C.verticalFov*Math.PI/360)/z)*180/Math.PI;};
xTag=function(t){if(!t)return;t.tagT=.5;t.tagK=.275;};
// The motor owns all movement multipliers, avoiding stacked scope/weapon scaling.
moveP=function(dt,run,hold){
 const P=player;if(!P)return;const w=vfWeapon(),p=vfProfile(w),kn=w==='Knife',kk=J.dr?{}:keys,fx=-Math.sin(yaw),fz=-Math.cos(yaw);let x=0,z=0;if(kk.KeyW){x+=fx;z+=fz;}if(kk.KeyS){x-=fx;z-=fz;}if(kk.KeyA){x+=fz;z-=fx;}if(kk.KeyD){x-=fz;z+=fx;}
 P.tagT=Math.max(0,(P.tagT||0)-dt);let speed=6.75*(kn?1:p.runSpeedMultiplier||.8)*(ads&&p.adsStats?p.adsStats.runSpeedMultiplier:1);if(J.dis>0)speed*=1.6;if(typeof sgSlow==='function')speed*=sgSlow(P);
 const native=typeof nmActive==='function'&&nmActive(),world={ground:(x,z,y)=>groundAt(x,z,.3,y),blocked:(x,z,r,y,h)=>native?sgBlk(x,z,r,y)||nmBlocked(native,x,z,r,y,h):blocked(x,z,r,y),leash:native?(x,z,y,x0,z0)=>nmLeash(native,x,z,y,x0,z0):null,ceiling:native?(x,z,low,high)=>{const ray=new THREE.Ray(new THREE.Vector3(x,low+.01,z),new THREE.Vector3(0,1,0)),hit=native.bvh.raycastFirst(ray,THREE.DoubleSide);return !!hit&&hit.distance<high-low;}:null};
 const result=VF.model.step(P,{x,z,jump:!!kk.Space,duck:!!(kk.ControlLeft||kk.ControlRight),walk:!!(kk.ShiftLeft||kk.ShiftRight),speed,tag:P.tagT>0?P.tagK:1,hold:!!hold||!!J.dr},dt,world);
 if(result.landed){SFX.land();P.st=0;}
 // Footfalls follow distance. Shift-walking and crouching stay silent.
 P.footDistance=(P.footDistance||0)+result.speed*dt;if(P.footDistance>1.85&&P.mv&&!P.air&&!P.wk&&!P.cr){P.footDistance%=1.85;SFX.selfStep(P.y>1);}
 // Preserve explicit ability impulses; ordinary air steering never creates a speed boost.
 if(kLg>0){const t=Math.min(dt,kLg);kLg-=t;const nx=P.x+kLx*8*t,nz=P.z+kLz*8*t;if(!world.blocked(nx,nz,.4,P.y,1.8-P.ch)&&!(world.leash&&!world.leash(nx,nz,P.y,P.x,P.z))){P.x=nx;P.z=nz;}}
};
gSpread=function(w,W,B){const p=vfProfile(w),P=B||player||{},state={sf:B?(B.sf!=null?B.sf:B.mv?1:0):P.sf,mv:P.mv,air:P.air,cr:P.cr,wk:P.wk,lp:P.lp||0,ads:B?0:ads};let cone=VF.model.spread(state,w,p);if(!B){const recovery=w==='Vandal'?.375:w==='Phantom'?.35:.28,elapsed=VF.time-VF.shot,bloom=elapsed<recovery?VF.bloom*Math.max(0,1-elapsed/recovery):0;cone+=bloom;if(xCU>performance.now())cone+=.06;if(xAD.bs)cone+=.045;}else cone+=Math.min(B.n||0,10)*.0025*(W.rec||1);return cone;};
// Circular angular spread in the shot's own basis, with a stable early climb and late directional drift.
gFire=function(d,w,W){if(VF.lastWeapon!==w||VF.time-VF.shot>.375){VF.sequence=0;VF.recoilX=VF.recoilY=VF.bloom=0;}VF.lastWeapon=w;const n=VF.sequence++,p=vfProfile(w),cone=gSpread(w,W),disc=VF.model.disk(),right=new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0)).normalize();if(right.lengthSq()<.5)right.set(1,0,0);const up=new THREE.Vector3().crossVectors(right,d).normalize(),rifle=['Vandal','Phantom','Bulldog','Guardian'].includes(w),weight=(W.rec||1)*(player.cr?.85:1)*(ads?.85:1);
 if(n===0){VF.drift=Math.random()<.5?-1:1;VF.recoilX=0;VF.recoilY=0;}else{VF.recoilY=Math.min(rifle?.065:.05,VF.recoilY+(rifle?(n<7?.006:.0015):.008)*weight);if(n>6){VF.recoilX+=VF.drift*.003*weight;if(Math.abs(VF.recoilX)>.022){VF.drift=-Math.sign(VF.recoilX);}if(Math.random()<.12)VF.drift*=-1;}}
 d.addScaledVector(right,disc[0]*cone+VF.recoilX-rclH).addScaledVector(up,disc[1]*cone+VF.recoilY-rcl).normalize();spray=VF.sequence;sprW=w;VF.bloom=Math.min(.024,VF.bloom+.0015*weight);VF.shot=VF.time;rcl=VF.recoilY*.55+.0035*weight;rclH=VF.recoilX*.55;
};
// Aim range, matches and duels all respect the same equip lock and firing cadence.
{const shoot0=shoot;shoot=function(){if(VM.sw>0)return;const before=ammo;const r=shoot0.apply(this,arguments);if(ammo<before&&rw!=='knife')fcd=1/(xRate(WEAP[wName()])*vfRateK());return r;};const aim0=aimFire;aimFire=function(){if(VM.sw>0)return;const before=AM.ammo,r=aim0.apply(this,arguments);if(AM.ammo<before)AM.cd=1/xRate(WEAP[aimW()]);return r;};}
{const key=aimKey;aimKey=function(c){const w=aimW();key(c);if(w!==aimW()){VM.sw=VM.swT=xEq(aimW());VF.drawWeapon=aimW();VF.sequence=VF.bloom=0;VF.shot=-10;}};}
// Smooth native rig state transitions and normalized one-shot durations.
// The exported FP clips run ~2.5x slower than the source montages (keys at 24 fps for 60 fps sequences: Idle 6.83 s vs
// SequenceLength 2.73 s, Operator Fire 4.5 s vs 1.8 s, knife Attack 4.79 s vs 1.92 s), so clips with no gameplay timer
// played in slow motion: the Operator/Marshal/Bucky bolt or pump was still mid-cycle at the next allowed shot and knife
// swings lasted ~4.8 s. Equip and reload follow the weapon's equip/reload times (weapons.json, as the server); inspect
// the 2.2 s inspect window; every other clip its authored SequenceLength. A bolt/pump fire montage (cycle >= 0.5 s)
// finishes within the fire interval, so the gun is ready in hand exactly when the next shot is allowed.
function vfDuration(F,kind,entry){const p=vfProfile(F.w);if(kind==='equip')return xEq(F.w);if(kind==='reload')return p.reloadTimeSeconds;if(kind==='inspect')return 2.2;const seq=entry&&+entry.SequenceLength;if(!(seq>0))return null;if(kind==='fire'&&p.fireRate>0&&1/p.fireRate>=.5)return Math.min(seq,1/p.fireRate);return seq;}
// Fire cadence multipliers the server applies (simulation.js: concussed x0.8, Empress x1.15). The shot wrapper below
// replaced the base cadence with the plain profile rate, which dropped both.
function vfRateK(){let k=1;try{if(typeof xCU!=='undefined'&&xCU>performance.now())k*=.8;const online=typeof NET!=='undefined'&&NET.socket;if(online?!!(typeof netReyna!=='undefined'&&netReyna&&netReyna.empress):(typeof jOn==='function'&&jOn()&&J.emp>0))k*=1.15;}catch(e){}return k;}
xvFPPlay=function(F,kind,phase){const label=kind==='idle'?'Idle':kind.charAt(0).toUpperCase()+kind.slice(1),entry=F.entries.find(e=>e.Translatable===label)||F.entries.find(e=>e.Translatable.startsWith(label));if(!entry)return;
 if(F.kind!==kind){const prior=F.action,priorGun=F.gaction,arm=F.ac[entry.Name],gunAction=F.gc[entry.WeaponAnimName||'Idle'];F.kind=kind;F.action=arm;F.gaction=gunAction;F.age=0;const duration=vfDuration(F,kind,entry);F.duration=duration||(arm?arm.getClip().duration:.2);
  for(const [action,previous]of [[arm,prior],[gunAction,priorGun]])if(action){action.enabled=true;action.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration?action.getClip().duration/duration:1);action.setLoop(kind==='idle'?THREE.LoopRepeat:THREE.LoopOnce,kind==='idle'?Infinity:1);action.clampWhenFinished=kind!=='idle';action.play();if(previous&&previous!==action)action.crossFadeFrom(previous,kind==='fire'?.025:.065,false);}
 }
 if(phase!=null){for(const action of [F.action,F.gaction])if(action)action.time=Math.min(action.getClip().duration-.0001,Math.max(0,phase)*action.getClip().duration);F.am.update(0);F.gm.update(0);}
};
// A separate lens keeps weapon proportions stable while the world camera zooms.
var VF_VIEW={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(55,1,.015,10),phase:0,lastAir:false,land:0,swayX:0,swayY:0,bob:0,ready:false};
VF_VIEW.scene.add(new THREE.HemisphereLight(0xffffff,0x8a95a5,1.7));{const light=new THREE.DirectionalLight(0xffffff,.9);light.position.set(-1,3,2);VF_VIEW.scene.add(light);}
// Every renderer owns its own draw function. Rebind after AA/quality recreation;
// retaining a function bound to a disposed renderer breaks the viewmodel layer.
function vfBindRenderer(r){if(r.userData&&r.userData.vfBound)return;r.userData=r.userData||{};r.userData.vfBound=true;const draw=r.render.bind(r);r.render=function(s,c){const world=s===scene&&c===camera;if(world){r.info.autoReset=false;r.info.reset();}const result=draw(s,c),F=XV.fp;if(world){VF.worldDraw={...r.info.render};}if(s===scene&&c===camera&&F&&F.root.visible&&running&&player&&player.hp>0&&!paused){const auto=r.autoClear;r.autoClear=false;r.clearDepth();VF_VIEW.camera.aspect=camera.aspect;VF_VIEW.camera.updateProjectionMatrix();draw(VF_VIEW.scene,VF_VIEW.camera);r.autoClear=auto;}return result;};}
vfBindRenderer(renderer);
{const remake=xRemake;xRemake=function(){remake();vfBindRenderer(renderer);};}

function vfViewTick(F,dt){const P=player,V=VF_VIEW;if(!F)return;
 if(F.root.parent!==V.scene){if(F.root.parent)F.root.parent.remove(F.root);V.scene.add(F.root);}if(V.lastAir&&!P.air)V.land=Math.min(1,P.landImpact||.5);V.lastAir=!!P.air;V.land=VF.model.damp(V.land,0,12,dt);const speed=Math.hypot(P.vx||0,P.vz||0),target=P.mv&&!P.air?Math.min(1,speed/5.4):0;V.bob=VF.model.damp(V.bob,target,16,dt);V.phase+=speed*dt*3.4;
 V.swayX=VF.model.damp(V.swayX,Math.max(-1,Math.min(1,VM.sx||0)),18,dt);V.swayY=VF.model.damp(V.swayY,Math.max(-1,Math.min(1,VM.sy||0)),18,dt);const k=xAD.k||0;
 F.root.scale.setScalar(1);F.root.position.copy(F.origin);F.root.position.x+=.045-V.swayX*.012+Math.sin(V.phase)*.006*V.bob;F.root.position.y-=.035+Math.abs(Math.cos(V.phase))*.008*V.bob+V.land*.025;F.root.position.y+=Math.max(-.02,Math.min(.02,-(P.vy||0)*.002));F.root.rotation.set(-V.swayY*.009,Math.PI/2-V.swayX*.01,-V.swayX*.012+Math.sin(V.phase)*.003*V.bob);
 if(k>0){F.root.updateMatrixWorld(true);const optic=F.ws.getObjectByName('Reflex')||F.ws.getObjectByName('Scope');if(optic){const p=optic.getWorldPosition(new THREE.Vector3());F.root.position.x-=p.x*k;F.root.position.y-=(p.y+.025)*k;}else{F.root.position.x-=.12*k;F.root.position.y+=.045*k;}F.root.position.z+=.07*k;}
}
// Preload the selected loadout to reduce fallback frames during weapon switches.
var VF_RIGS=new Map(),VF_PENDING=new Map();{const load=xvFPLoad;xvFPLoad=function(ag,w){const key=ag+'|'+w;if(VF_RIGS.has(key)){const F=VF_RIGS.get(key);VF_RIGS.delete(key);VF_RIGS.set(key,F);return Promise.resolve(F);}if(VF_PENDING.has(key))return VF_PENDING.get(key);const pending=load(ag,w).then(F=>{VF_RIGS.set(key,F);while(VF_RIGS.size>6){const [k,old]=VF_RIGS.entries().next().value;if(old===XV.fp){VF_RIGS.delete(k);VF_RIGS.set(k,old);continue;}VF_RIGS.delete(k);vfDisposeRig(old);}return F;}).finally(()=>VF_PENDING.delete(key));VF_PENDING.set(key,pending);return pending;};}
function vfDisposeRig(F){if(F.root.parent)F.root.parent.remove(F.root);F.am.stopAllAction();F.gm.stopAllAction();F.root.traverse(o=>{if(o.isMesh)[].concat(o.material||[]).forEach(m=>m.dispose());});}
xvFPClear=function(F){if(!F)return;if(F.root.parent)F.root.parent.remove(F.root);F.root.visible=false;F.am.stopAllAction();F.gm.stopAllAction();};
{const tick=xvFPTick;xvFPTick=function(dt){tick(dt);const F=XV.fp;if(!F)return;if(F.root.visible){if(!F.kind)xvFPPlay(F,VM.sw>0?'equip':'idle');vfViewTick(F,dt);if(VF.prefetch!==F.ag){VF.prefetch=F.ag;for(const w of ['Knife',mode==='five'?(FV.sec||'Classic'):'Classic',mode==='five'?(FV.pri||'Vandal'):'Vandal'])if(w!==F.w)xvFPLoad(F.ag,w).catch(()=>{});}}
 // Timer-driven native reloads also work in the practice range.
 const reload=mode==='aim'?AM.rl:mode==='duel'?du.reload:reloading;if(reload>0)xvFPPlay(F,'reload',1-reload/vfProfile(F.w).reloadTimeSeconds);else if(F.kind==='equip'&&VM.sw>0)xvFPPlay(F,'equip',1-VM.sw/Math.max(.001,VM.swT||xEq(F.w)));else if(F.kind!=='idle'&&F.age>F.duration)xvFPPlay(F,'idle');};}
// Same-weapon equips (buying, respawning, draw cancellation) restart the native equip animation too.
{const tick=vmTick;vmTick=function(dt){VF.time+=dt;const w=vfWeapon(),changed=VF.drawWeapon!==w,redraw=VM.sw>(VF.drawRemaining||0)+.001;if(changed){VF.drawWeapon=w;VM.sw=VM.swT=xEq(w);VF.sequence=VF.bloom=0;VF.shot=-10;}if((changed||redraw)&&XV.fp&&XV.fp.w===w){XV.fp.kind=null;xvFPPlay(XV.fp,'equip');}const prev=XV.fp;tick(dt);if(XV.fp&&XV.fp!==prev){XV.fp.kind=null;xvFPPlay(XV.fp,VM.sw>0?'equip':'idle',VM.sw>0?1-VM.sw/VM.swT:0);}if(XV.fp&&XV.fp.root.parent===camera)VF_VIEW.scene.add(XV.fp.root);VF.drawRemaining=VM.sw;};}
{const fire=duelShoot;duelShoot=function(){if(VM.sw>0)return;return fire.apply(this,arguments);};}
window.xValorantFeel={state:VF,view:VF_VIEW,model:VF.model,weapon:vfWeapon,profile:vfProfile};
// ---- END VALORANT FEEL ----
