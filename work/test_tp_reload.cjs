// TP Rocklan reload: the explicit online reload clock and the donor weapon-part clip.
//   Server: rows [27] = reload seconds remaining (0 when not reloading; fog-hidden rows 0).
//   Client: work/tp_reload_runtime.js turns a 0 -> >0 row edge into the xAmRn reload-start counter (remote reloads
//   play for the server's own remaining time, replacing the every-N-shots guess), and stands a rigged clone of the
//   held gun in for the static one while a reload runs, scrubbing the converted GNTP clip by grip progress (G.rp).
//   Donor: models/valorant/animations/tp-rocklan-reload-sheriff.glb (LOCAL-ONLY converted asset, absent on a clean
//   checkout: those assertions skip).
//   node work/test_tp_reload.cjs
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');const root=path.join(__dirname,'..');
let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
(async()=>{
 // ---- server: row [27] reload clock ----
 const {SpikeSimulation}=await import('file://'+root+'/server/src/spike.js'),{fogRow}=await import('file://'+root+'/server/src/fog.js');
 const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 {const s=new SpikeSimulation(W,'five','ascent',()=>.5),j=s.add('jet','Jett'),v=s.add('v0');s.start(false);s.buy=0;s.roundDelay=0;const row=()=>s.rows().find(r=>r[0]===j.id);
  ok(row().length===28,'row carries [27]');
  ok(row()[27]===0,'no reload: [27] 0');
  j.ammo=1;ok(s.command(j,{t:'reload'}),'reload command accepted');
  const left=row()[27];ok(left>1&&left<=2.6,'[27] = reload seconds remaining ('+left+')');
  ok(fogRow(row())[27]===0,'fog-hidden row: no reload clock');
  s.time+=5;s.finishReload(j);ok(row()[27]===0,'finished reload: [27] back to 0');
 }
 // ---- donor clip (local-only asset) ----
 const donor=path.join(root,'models/valorant/animations/tp-rocklan-reload-sheriff.glb');
 if(fs.existsSync(donor)){
  const {T,parse}=require('./valorant_rigs');
  const rig=await parse(path.join(root,'models/valorant/sheriff.glb')),don=await parse(donor);
  const clip=don.animations.find(c=>c.name==='GNTP_Core_Revolver_S0_Reload');ok(!!clip,'donor carries the revolver reload clip');
  const sc=rig.scene,mx=new T.AnimationMixer(sc),a=mx.clipAction(clip);a.play();
  const cyl=sc.getObjectByName('Mag_Rotator');ok(!!cyl,'native gun rig has the cylinder bone');
  const rest=cyl.quaternion.clone(),ang=t=>{a.time=t;mx.update(0);return cyl.quaternion.angleTo(rest)*57.3;};
  ok(ang(0)<5,'cylinder closed at the start');
  ok(ang(0.65)>45,'cylinder swung out mid-reload ('+ang(0.65).toFixed(0)+' deg)');
  ok(ang(clip.duration-0.001)<5,'cylinder closed again at the end');
 }else console.log('(donor glb absent: clip assertions skipped)');
 // ---- client block ----
 const src=fs.readFileSync(root+'/work/tp_reload_runtime.js','utf8');
 ok(/'Sheriff'/.test(src)&&/'Vandal'/.test(src)&&/'Bucky'/.test(src)&&/tp-rocklan-reload-' \+ w.toLowerCase\(\)/.test(src),'12-gun donor table');
 ok(!/'Ares'|'Guardian'|'Odin'|'Shorty'|'Spectre'|'Bandit'|'Warden'|'Outlaw'/.test(src.replace(/weapon folders ship[\s\S]*?procedural only\)\./,'')),'no donor entries for the 8 source-gap guns');
 // online row edge -> xAmRn counter (+ elapsed offset for mid-reload joins, cut on cancel)
 {const c={MP:{me:9},bots:[],allies:[{nid:3}],window:{},WEAP:{Vandal:{rld:2.5}}};c.mpCliSnap=function(){};
  vm.createContext(c);const slice=src.slice(src.indexOf('// Online reload clock'));vm.runInContext(slice,c);
  const u=c.allies[0];
  const rw=(rl)=>[3,0,'n','Jett',0,0,0,0,100,50,1,'Vandal',1,0,0,30,90,0,0,0,0,-1,0,0,0,0,0,rl]; // [0..27], [27] = reload clock
  c.mpCliSnap({u:[rw(0)]});
  ok(u.xAmRn==null,'no reload on the row: no counter');
  c.mpCliSnap({u:[rw(2.4)]});
  ok(u.xAmRn===1&&u.rlOn===1,'reload edge: counter bumped, duration from the row ('+u.xAmRd+'s)');
  ok(Math.abs((u.xAmEl||0)-0.1)<1e-9,'join offset: elapsed = rld - remaining ('+(u.xAmEl||0)+'s)');
  c.mpCliSnap({u:[rw(1.2)]});
  ok(u.xAmRn===1,'same reload still running: no double start');
  c.mpCliSnap({u:[rw(0)]});
  ok(u.rlOn===0&&u.xAmCut===1,'reload over (or cancelled): edge resets and marks the cut');
  c.mpCliSnap({u:[rw(2.5)]});
  ok(u.xAmRn===2,'a second reload starts fresh');
  const hid=rw(1.0);hid[22]=1;c.mpCliSnap({u:[hid]});
  ok(u.rlOn===0&&u.xAmCut===1,'fog-hidden mid-reload: cut, no restart');
  const old=[[3,0,'n','Jett',0,0,0,0,100,50,1,'Vandal',1,0,0,30,90,0,0,0,0,-1,0,0,0,0,0,0]];old[0].length=27;
  c.mpCliSnap({u:old});ok(u.xAmRn===2&&u.rlOn===0,'older server without [27]: untouched (shots guess stays)');
 }
 // rigged stand-in: reload -> static gun hidden, rig scrubbed by G.rp; end -> restored; equip/fire one-shots; cancel cut
 {const T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));
  const arm=new T.Object3D();arm.name='Mag_Rotator';
  const srcScene=new T.Group();srcScene.add(arm);
  const clip=new T.AnimationClip('GNTP_Core_Revolver_S0_Reload',2.5,[new T.NumberKeyframeTrack('Mag_Rotator.userData.spin',[0,1.25,2.5],[0,1,0])]);
  const eq=new T.AnimationClip('GNTP_Core_Revolver_S0_Equip',1.0,[new T.NumberKeyframeTrack('Mag_Rotator.userData.spin',[0,1],[0,1])]);
  const fr=new T.AnimationClip('GNTP_Core_PumpShotgun_S0_Fire',1.2,[new T.NumberKeyframeTrack('Mag_Rotator.userData.spin',[0,1.2],[0,1])]);
  const c={THREE:{SkeletonUtils:{clone:(o)=>{const g=new T.Group();g.add(new T.Object3D());return g;}},AnimationMixer:T.AnimationMixer},
   XV:{config:{}},xvConstraints:()=>{},xvLoad:(n)=>Promise.resolve(n.indexOf('tp-rocklan')>=0?{animations:[clip,eq,fr]}:{scene:srcScene}),
   window:{},WEAP:{Sheriff:{rld:2.5}}};
  c.xgPose=function(){};c.xUbPost=function(){};c.xgHeldSync=function(M){M.w='Bucky';};vm.createContext(c);vm.runInContext(src,c);
  const parent=new T.Group(),gun=new T.Group();gun.visible=true;parent.add(gun);
  const M={w:'Sheriff',gun,sx:{grip:{rl:1,rp:0.5},shots:0}};
  vm.runInContext('xrwPose('+JSON.stringify(null)+')',c);ok(true,'null model tolerated');
  for(let i=0;i<30;i++){c.xrwPose(M,1/60);await new Promise(r=>setImmediate(r));} // let the donor promise land
  ok(gun.visible===false,'reloading: static gun hidden');
  ok(parent.children.find(x=>x!==gun),'rigged clone stood in');
  // cancel: server clock dropped to 0 mid-gesture -> the reload override is cut
  M.unit={xAmCut:1};c.xrwPose(M,1/60);
  ok(M.unit.xAmCut===0&&M.sx.uo===undefined,'cancel consumed');
  M.sx.uo='reload';M.unit.xAmCut=1;c.xrwPose(M,1/60);
  ok(M.sx.uo===null&&M.sx.ut===0,'cancel cuts the reload override');
  M.sx.grip.rl=0;M.sx.grip.rp=-1;c.xrwPose(M,1/60);
  ok(gun.visible===true&&parent.children.length===1,'reload over: static gun back, rig removed');
  // equip: a weapon swap onto a donor gun plays the one-shot equip clip, then returns the static gun
  M.w='Sheriff';c.xgHeldSync(M);for(let i=0;i<30;i++){c.xrwPose(M,1/60);await new Promise(r=>setImmediate(r));} /* the swap stub moves Sheriff -> Bucky */
  ok(parent.children.length===2,'equip: rig stood in');
  for(let i=0;i<80;i++)c.xrwPose(M,1/60);
  ok(parent.children.length===1&&gun.visible===true,'equip clip finished: static gun back');
  // fire: Bucky (pump) cycles per shot; Stinger (SMG) does not
  M.w='Bucky';const S0=c.XRWB.state.get(M);M.sx.shots=1;c.xrwPose(M,1/60);
  ok(S0.mode==='fire','pump shotgun: shot starts the action-cycle clip');
  for(let i=0;i<90;i++)c.xrwPose(M,1/60);ok(S0.mode===null&&!S0.rig,'fire clip done: static back');
  M.w='Stinger';M.sx.shots=2;c.xrwPose(M,1/60);ok(c.XRWB.state.get(M).mode!=='fire','SMG: no per-shot rigged stand-in');
  // death mid-reload: the xUbPost wrapper drops the stand-in even though the grip skips dead units
  M.w='Sheriff';M.sx.grip.rl=1;M.sx.grip.rp=0.3;for(let i=0;i<10;i++){c.xrwPose(M,1/60);await new Promise(r=>setImmediate(r));}
  ok(parent.children.length===2,'reloading again: rig stood in');
  M.dead=true;c.xUbPost(M);ok(gun.visible===true&&parent.children.length===1,'death mid-reload: rig dropped, static restored');
  c.xrwPose(M,1/60);ok(parent.children.length===1,'still dead: no new rig');
  M.dead=false;M.sx.grip.rl=0;M.sx.grip.rp=-1;c.xrwPose(M,1/60);ok(parent.children.length===1&&gun.visible===true,'revived, not reloading: static only');
 }
 // donor absent: the procedural reload carries on, static gun untouched
 {const T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));
  const c={THREE:{SkeletonUtils:{clone:(o)=>new T.Group()},AnimationMixer:T.AnimationMixer},XV:{config:{}},xvConstraints:()=>{},xvLoad:()=>Promise.reject(new Error('absent')),window:{}};
  c.xgPose=function(){};c.xUbPost=function(){};vm.createContext(c);vm.runInContext(src,c);
  const parent=new T.Group(),gun=new T.Group();gun.visible=true;parent.add(gun);
  const M={w:'Vandal',gun,sx:{grip:{rl:1,rp:0.5}}};
  for(let i=0;i<20;i++){c.xrwPose(M);await new Promise(r=>setImmediate(r));}
  ok(gun.visible===true&&parent.children.length===1,'donor absent: static gun untouched');
  ok(c.XRWB.don.Vandal===null,'absence cached (no reload loop)');
  c.xrwPose(M);ok(parent.children.length===1,'cached absence stays procedural');
 }
 console.log('test_tp_reload OK ('+checks+' checks)');
})().catch(e=>{console.error(e);process.exitCode=1;});
