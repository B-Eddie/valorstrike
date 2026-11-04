// Movement-only data integrity and the actual native animator; no browser rendering claim.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {runtime,build,T,root}=require('./rocklan_movement_harness.cjs');
// CE: the crouch drop = shared motor C.crouchEye (measured 0.40 m since 2026-11-04, was 0.45): repair_runtime XRC.drop follows it
const CE=require('../server/src/motor.cjs').C.crouchEye;
const OUT=path.join(root,'models/valorant/movement'),PACK=process.env.ROCKLAN_PACK||'/home/hatch/workspace/valorstrike-refresh/rocklan-pack';
// The source pack (6,195 files, not in the repo) only exists on the authoring machine: without it the baked-data checks still run
// and the PSA source-hash / sample-equality checks are skipped (and reported), so CI and other machines can run this test.
const HAVE_PACK=fs.existsSync(PACK);
const header=JSON.parse(fs.readFileSync(path.join(OUT,'movement.json'))),provenance=JSON.parse(fs.readFileSync(path.join(OUT,'provenance.json')));
const raw=fs.readFileSync(path.join(OUT,'movement.bin')),floats=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const dirs=['N','NE','E','SE','S','SW','W','NW'],gaits=['walk','powerWalk','run','sprint','crouchWalk'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const dataBefore=hash(Buffer.concat([Buffer.from(JSON.stringify(header)),raw]));
const lower=/^(Spine1|Pelvis|[LR]_(Hip|Knee|Foot|Toe))\.(quaternion|position)$/;
const spine=/^Spine[1234]\.quaternion$/;
function near(a,b,tol,label){assert(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${label}: ${a} vs ${b} (tol ${tol})`);}
function trackData(t){const size=t.type==='quaternion'?4:3;return floats.subarray(t.values,t.values+t.count*size);}
function semanticClip(c){return {name:c.name,duration:c.duration,tracks:c.tracks.map(t=>({name:t.name,times:Array.from(t.times),values:Array.from(t.values)}))};}
function sameClip(a,b,label){assert.deepEqual(semanticClip(a),semanticClip(b),label);}
function psaMeta(file){
 const b=fs.readFileSync(file);let at=0,info,names,keys;
 while(at<b.length){const n=b.toString('utf8',at,at+20).replace(/\0.*$/,''),size=b.readInt32LE(at+24),count=b.readInt32LE(at+28);at+=32;
  if(n==='ANIMINFO')info=b.subarray(at,at+size*count);
  if(n==='BONENAMES')names=Array.from({length:count},(_,i)=>b.toString('utf8',at+i*size,at+i*size+64).replace(/\0.*$/,''));
  if(n==='ANIMKEYS')keys=b.subarray(at,at+size*count);at+=size*count;
 }
 assert(info&&names&&keys,'valid ActorX movement chunks');
 return {b,names,keys,fps:info.readFloatLE(152),frames:info.readInt32LE(164),first:info.readInt32LE(160)};
}
function integrity(){
 assert.equal(raw.length%4,0,'aligned Float32 movement binary');assert.equal(Object.keys(header.agents).length,30,'all thirty game rigs');
 const ledger=new Map(provenance.clips.map(c=>[c.name,c]));assert(ledger.size>=120,'complete movement ledger');
 let tracks=0,neutralSamples=0;
 for(const row of Object.values(header.agents)){
  assert.equal(row.clips.length,ledger.size,'every rig has the complete movement set');
  const map=new Map(row.clips.map(c=>[c.name,c]));
  for(const gait of gaits)for(const d of dirs){assert(map.has(gait+d),gait+d);assert(map.has('lean_'+gait+d),'lean '+gait+d);}
  for(const d of ['E','W'])for(const angle of [45,90,135,180])for(const prefix of ['turn','crouchTurn'])assert(map.has(prefix+d+angle),prefix+d+angle);
  for(const n of ['idle','crouch','jump','jumpN','jumpE','jumpS','jumpW','crouchJump','fall','crouchFall','land','stopLower','stopSpine','jumpSpine','crouchJumpSpine','landSpine','ropeIdle','ropeUp','ropeDown','ropeHorizontal','ropeForward','ropeBack'])assert(map.has(n),n);
  for(const c of row.clips){
   assert(['COPIED','EXTRAPOLATED'].includes(c.status),c.name+' explicit provenance');assert(c.duration>0&&c.frames>0&&c.fps>0,c.name+' cadence');
   assert.deepEqual(c.sources,ledger.get(c.name).sources,c.name+' source references');
   if(c.status==='EXTRAPOLATED')assert(c.derivation.length>30,c.name+' derivation');
   if(c.gait&&!c.additive){assert(c.naturalSpeed>0,c.name+' measured natural speed');assert(c.contact.samples>=120,c.name+' measured contact samples');}
   for(const t of c.tracks){tracks++;
    assert((c.layer==='spine'?spine:lower).test(t.name),c.name+' forbidden channel '+t.name);
    assert(!t.name.endsWith('.position')||t.name==='Pelvis.position',c.name+' root motion only on Pelvis');
    assert(t.times>=0&&t.values>=0&&Number.isInteger(t.count)&&t.count===c.frames,c.name+' valid offsets/count');
    const size=t.type==='quaternion'?4:3;assert(t.times+t.count<=floats.length&&t.values+t.count*size<=floats.length,c.name+' binary bounds');
    const times=floats.subarray(t.times,t.times+t.count),values=trackData(t);near(times[0],0,1e-7,c.name+' time zero');
    for(let i=1;i<times.length;i++)assert(times[i]>times[i-1],c.name+' strictly increasing key times');
    near(times.at(-1),(c.frames-1)/c.fps,1e-5,c.name+' recorded cadence');
    for(const v of values)assert(Number.isFinite(v),c.name+' finite bone data');
    if(t.type==='quaternion')for(let i=0;i<values.length;i+=4)near(Math.hypot(...values.subarray(i,i+4)),1,3e-6,c.name+' normalized quaternion');
   }
  }
 }
 const sourceMap=new Map();
 for(const s of provenance.sources){
  assert(/^Animations\/Agent Animations\/Shared\/Simple\/TP_Core_/.test(s.file),'movement source scope '+s.file);
  assert(!/(?:Ability|Equip|Reload|Fire|Shoot|Death|Hit_|Emote|Plant|Defuse|Inspect)/i.test(s.file),'nonmovement source excluded '+s.file);
  if(!HAVE_PACK)continue;
  const p=psaMeta(path.join(PACK,s.file));sourceMap.set(s.file,p);assert.equal(hash(p.b),s.sha256,s.file+' frozen source hash');
  near(p.fps,s.fps,1e-7,s.file+' source fps');assert.equal(p.frames,s.frames,s.file+' source frames');
 }
 // Jett is the native reference rig. Its copied rotations must be the PSA samples,
 // independently decoded here, rather than merely agreeing with a second generated artifact.
 let sourceSamples=0;
 for(const c of HAVE_PACK?header.agents.jett.clips.filter(c=>c.status==='COPIED'&&c.sources.length===1):[]){
  const src=sourceMap.get(c.sources[0]);
  for(const t of c.tracks.filter(t=>t.type==='quaternion')){
   const bone=src.names.indexOf(t.name.split('.')[0]),values=trackData(t);assert(bone>=0,c.name+' source bone exists');
   for(let f=0;f<c.frames;f++){
    const at=((src.first+f)*src.names.length+bone)*32,q=Array.from({length:4},(_,i)=>src.keys.readFloatLE(at+12+i*4)),norm=Math.hypot(...q);
    for(let k=0;k<4;k++)near(values[f*4+k],q[k]*(k<3?-1:1)/norm,2e-6,c.name+' copied PSA quaternion');sourceSamples++;
   }
  }
 }
 // Additive retargeting must preserve rotation angle across rigs, and source identity deltas stay identity.
 // A bind rotation accidentally multiplied into additive data fails both checks.
 const donor=header.agents.jett.clips;
 for(const c of donor.filter(c=>c.additive))for(const t of c.tracks.filter(t=>t.type==='quaternion')){
  const values=trackData(t),src=c.sources.length===1?sourceMap.get(c.sources[0]):null,bone=t.name.split('.')[0],boneIndex=src?.names.indexOf(bone);
  for(const [slug,row]of Object.entries(header.agents)){
   const target=trackData(row.clips.find(x=>x.name===c.name).tracks.find(x=>x.name===t.name));
   for(let f=0;f<c.frames;f++)near(Math.abs(target[f*4+3]),Math.abs(values[f*4+3]),2e-6,slug+' '+c.name+' additive angle invariant');
  }
  if(src&&boneIndex>=0)for(let f=0;f<c.frames;f++){
   const at=((src.first+f)*src.names.length+boneIndex)*32,xyz=[0,1,2].map(i=>src.keys.readFloatLE(at+12+i*4));
   if(Math.hypot(...xyz)<1e-7){neutralSamples++;near(Math.abs(values[f*4+3]),1,2e-6,c.name+' neutral additive identity');}
  }
 }
 if(HAVE_PACK)assert(neutralSamples>100,'neutral additive samples were actually exercised');
 else console.log('Rocklan pack not at '+PACK+' (set ROCKLAN_PACK): PSA source hash/sample checks skipped');
 const glb=fs.readFileSync(path.join(OUT,'tp-movement-baked.glb'));assert.equal(glb.readUInt32LE(0),0x46546c67,'GLB magic');assert.equal(glb.readUInt32LE(4),2,'GLB version');assert.equal(glb.readUInt32LE(8),glb.length,'GLB byte size');
 const jsonSize=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+jsonSize)),binOffset=28+jsonSize;
 assert.equal(j.animations.length,ledger.size,'baked GLB complete movement set');
 function accessor(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],count=a.count*({SCALAR:1,VEC3:3,VEC4:4}[a.type]);const at=binOffset+(v.byteOffset||0)+(a.byteOffset||0);assert(at+count*4<=glb.length,'GLB accessor bounds');return Array.from({length:count},(_,k)=>glb.readFloatLE(at+k*4));}
 for(const a of j.animations){const c=donor.find(c=>c.name===a.name);assert(c,a.name+' GLB dead reference');assert.equal(a.channels.length,c.tracks.length,a.name+' GLB tracks');
  for(const channel of a.channels){const sampler=a.samplers[channel.sampler],n=j.nodes[channel.target.node].name+'.'+(channel.target.path==='rotation'?'quaternion':'position'),t=c.tracks.find(t=>t.name===n);assert(t,a.name+' GLB forbidden bone '+n);
   assert.deepEqual(accessor(sampler.input),Array.from(floats.subarray(t.times,t.times+t.count)),a.name+' baked times');assert.deepEqual(accessor(sampler.output),Array.from(trackData(t)),a.name+' baked bone values');
  }
 }
 assert.deepEqual(provenance.mechanics.changed,[],'motor values unchanged without source evidence');
 return {rigs:12,clips:ledger.size,tracks,sourceHashes:sourceMap.size,sourceQuaternionSamples:sourceSamples,neutralSamples};
}
function waist(R,label){const F=R.c.api.xUbFollow(R.X);assert(F,label+' native sibling relationship');const expected=F.offset.clone().multiply(F.p.scale).applyQuaternion(F.p.quaternion).add(F.p.position);near(F.s.position.distanceTo(expected),0,1e-6,label+' paired waist');}
function preserved(R){
 const {kit,originalKit,X,c}=R;assert.equal(c.movementMappings(),c.originalApi.mappings,'global nonmovement state mappings unchanged');
 for(const [name,clip]of Object.entries(originalKit.U))sameClip(kit.U[name],clip,'unchanged upper animation '+name);
 for(const [name,clip]of Object.entries(originalKit.A))sameClip(kit.A[name],clip,'unchanged additive combat animation '+name);
 const movementNames=new Set(['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Crouch_Idle_Loop','Crouch_Fwd_Loop','Jump_Start','Jump_Loop','Jump_Land']);
 for(const [name,clip]of Object.entries(originalKit.C)){
  sameClip(kit.C[name],clip,'unchanged full/lobby clip '+name);
  if(!movementNames.has(name))sameClip(kit.L[name],originalKit.L[name],'unchanged lower nonmovement clip '+name);
 }
 const map={aim:'Pistol_Aim_Neutral',knife:'Sword_Idle',reload:'Pistol_Reload',cast:'Spell_Simple_Shoot',throw:'OverhandThrow'};
 for(const [n,clip]of Object.entries(map))assert.equal(X.a[n].getClip(),kit.U[clip],'original nonmovement action '+n);
 for(const [n,clip]of Object.entries({plant:'Fixing_Kneeling',death1:'Death01',death2:'Death02'}))assert.equal(X.a[n].getClip(),kit.C[clip],'original full action '+n);
 assert.equal(X.contactLift,null,'old donor support-lift disabled for movement overlay');
}
async function rigs(){
 const c=await runtime(),rows=[];
 for(const slug of Object.keys(header.agents)){
  const R=await build(slug,c);preserved(R);R.advance(60);const stand=R.at('Head').y-R.M.m.position.y;let contact=0;
  for(const opt of [{speed:3.24},{speed:5.4,angle:Math.PI/2},{speed:5.4,angle:Math.PI},{speed:0,cr:true},{speed:2,cr:true,angle:Math.PI*1.5}]){
   R.advance(50,opt);
   for(let i=0;i<20;i++){R.advance(1,opt);waist(R,slug);contact=Math.max(contact,Math.abs(R.sole()));assert(Math.abs(R.sole())<.025,slug+' locomotion support-foot contact '+R.sole());}
   if(opt.cr)near(R.at('Head').y-R.M.m.position.y,stand-CE,.02,slug+' crouch head drop');
  }
  R.advance(90);near(R.at('Head').y-R.M.m.position.y,stand,.02,slug+' stand-up height restored');
  rows.push({slug,maxContactCm:+(contact*100).toFixed(3)});
 }
 return rows;
}
async function animator(){
 const R=await build('jett'),{X}=R;R.advance(90);const checks=[];
 for(const [gait,speed,extra]of [['walk',3.24,{}],['powerWalk',3.95,{}],['run',5.4,{}],['sprint',6.75,{knife:true}],['crouchWalk',2,{cr:true}]])for(let d=0;d<8;d++){
  R.M.w=extra.knife?'Knife':'Vandal';R.advance(35,{speed,angle:d*Math.PI/4,cr:!!extra.cr});
  const n=gait+dirs[d],a=X.a[X.rm.actions[n]];assert((X.rm.targets[n]||0)>.5,n+' actual directional gait target');assert(a.getEffectiveWeight()>.45,n+' actual mixer weight');
  assert(a.paused,n+' stride manually synchronized');assert(X.rm.add['lean_'+n].getEffectiveWeight()>.1,n+' movement lean applied');near(X.yaw,0,1e-8,n+' no procedural chest counter-turn');waist(R,n);
  const previous=X.rm.phase;R.advance(1,{speed,angle:d*Math.PI/4,cr:!!extra.cr});
  const expected=Object.entries(X.rm.targets).reduce((sum,[k,w])=>sum+(X.rm.meta[k]?.naturalSpeed>0?w*speed/(R.c.xrmStanceSpeed(X.rm.meta[k])*X.sc.parent.scale.y*X.rm.meta[k].duration):0),0);
  const total=Object.entries(X.rm.targets).reduce((sum,[k,w])=>sum+(X.rm.meta[k]?.naturalSpeed>0?w:0),0);
  near((X.rm.phase-previous+1)%1,(expected/total/60)%1,1e-6,n+' measured stride rate');
  checks.push(n);
 }
 let turns=0;
 for(const cr of [false,true])for(const direction of ['E','W'])for(const angle of [45,90,135,180]){
  R.advance(90,{cr});X.rm.turn=null;X.rm.turnSum=0;const p=R.position;
  R.frame(1/60,p.x,p.y,p.z,(direction==='W'?1:-1)*angle*Math.PI/180,{cr});
  const n=(cr?'crouchTurn':'turn')+direction+angle;
  assert(X.rm.targets[n]>.99,n+' actual turn-in-place target');assert(X.a[X.rm.actions[n]].getEffectiveWeight()>0,n+' turn mixer');waist(R,n);turns++;
 }
 R.M.w='Vandal';R.advance(45,{speed:5.4});R.advance(1);assert(X.rm.add.stopLower.getEffectiveWeight()>0,'deceleration uses copied stop lower posture');assert(X.rm.add.stopSpine.getEffectiveWeight()>0,'deceleration uses copied stop spine posture');R.advance(45);assert(X.rm.add.stopLower.getEffectiveWeight()<.001,'stop posture releases to idle');
 // Crouch survives jump initiation and falling, rather than standing up in the air.
 R.advance(75,{cr:true});R.advance(3,{dy:5,cr:true});assert(X.air,'actual base animator detects jump');assert(X.rm.targets.crouchJump>.5,'crouched takeoff selected');assert(X.rm.add.crouchJumpSpine.getEffectiveWeight()>0,'crouch takeoff spine additive used');waist(R,'crouch jump');
 R.advance(20,{dy:1,cr:true});assert(X.rm.targets.crouchFall>.95,'crouched falling selected');
 R.advance(12,{dy:-1,cr:true});const p=R.position;R.frame(1/60,p.x,0,p.z,0,{cr:true});R.advance(3,{cr:true});assert(X.a.land.getEffectiveWeight()>0,'actual ground contact triggers landing');assert(X.rm.add.crouchLandSpine.getEffectiveWeight()>0,'crouch landing spine additive used');assert(X.rm.add.crouchLandLower.getEffectiveWeight()>0,'crouch landing lower additive used');waist(R,'crouch landing');R.advance(30,{cr:true});assert(X.a.land.getEffectiveWeight()<.001,'landing releases');
 // Standing directional jump is sampled from a takeoff window, not the 3.2 s source wind-up.
 R.advance(90);R.advance(3,{speed:3.24,angle:Math.PI/2,dy:5});assert((X.rm.targets.jumpE||0)>0,'directional jump E selected');assert(X.rm.add.jumpSpine.getEffectiveWeight()>0,'standing jump spine additive used');
 const jump=X.a[X.rm.actions.jumpE],phase=X.rm.meta.jumpE.phase;assert(jump.time>=phase.firstExtension-.09&&jump.time<=phase.firstExtension+.09,'jump sample around source first extension');
 R.advance(15,{dy:1});assert(X.rm.targets.fall>.95,'standing falling selected');
 let pos=R.position;R.frame(1/60,pos.x,0,pos.z);R.advance(30);
 R.advance(20,{rope:true,dy:2});assert(X.rm.targets.ropeUp>.95,'rope climb up');assert(X.a[X.rm.actions.ropeUp].getEffectiveWeight()>.9,'rope up mixer');
 R.advance(20,{rope:true,dy:-1});assert(X.rm.targets.ropeDown>.95,'rope descend');
 R.advance(25,{rope:true,speed:3});assert(X.rm.add.ropeForward.getEffectiveWeight()>0,'rope forward additive used');R.advance(25,{rope:true,speed:3,angle:Math.PI/2});assert(X.rm.add.ropeHorizontal.getEffectiveWeight()>0,'horizontal zipline additive used');
 R.advance(25,{rope:true,speed:3,angle:Math.PI});assert(X.rm.add.ropeBack.getEffectiveWeight()>0,'rope backward additive used');waist(R,'rope traversal');
 pos=R.position;R.frame(1/60,pos.x,0,pos.z);R.advance(60);assert(X.rm.add.ropeForward.getEffectiveWeight()<.001,'rope additives release on detach');assert(X.rm.targets.idle>.95,'detach returns to idle');
 // Existing upper-body and full actions keep their exact clip objects through movement updates.
 preserved(R);
 return {directionGaits:checks.length,turns,jumpLand:true,rope:true,stop:true};
}
async function loader(){
 const c={THREE:T,Promise,TextDecoder,console,baseReject:true};
 c.xvaLoco=()=>c.baseReject?Promise.reject(Error('base unavailable')):Promise.resolve({base:true});vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'rocklan_movement_runtime.js'),'utf8'),c);
 const unhandled=[],listen=e=>unhandled.push(e);process.on('unhandledRejection',listen);
 try {
  // Both legs reject here: the base loader and movement's missing-fetch path.
  // Neither rejection may escape the one readiness promise or leave the failed cache poisoned.
  let pending;assert.doesNotThrow(()=>{pending=c.xvaLoco();},'readiness returns a promise if fetch is absent');
  await assert.rejects(pending,/base unavailable|fetch/);await new Promise(setImmediate);
  assert.equal(unhandled.length,0,'no orphan rejection from a concurrent loader failure');assert.equal(c.XRM.promise,null,'failed movement cache resets');
  c.baseReject=false;c.fetch=async()=>({ok:false,status:404});await assert.rejects(c.xvaLoco(),/HTTP 404/);assert.equal(c.XRM.promise,null,'HTTP failure resets');
  c.fetch=async url=>({ok:true,arrayBuffer:async()=>{
   const b=fs.readFileSync(path.join(OUT,url.includes('movement.json')?'movement.json':'movement.bin'));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  }});
  const recovered=await c.xvaLoco();assert.equal(recovered.base,true,'base readiness result retained');assert.equal(Object.keys(recovered.movement.h.agents).length,30,'retry recovers complete movement header');assert.equal(recovered.movement.f.length,floats.length,'retry recovers complete movement binary');
  return {missingFetch:true,concurrentFailure:true,httpFailure:true,retry:true};
 } finally {process.removeListener('unhandledRejection',listen);}
}
async function contact(quick=false){
 const c=await runtime(),base=await build('jett',c),planted=await build('jett',c),pose=c.xrmPlantPose,rows=[];
 const point=W=>{const p=new T.Vector3().fromBufferAttribute(W.o.geometry.attributes.position,W.i);W.o.skeleton.update();W.o.applyBoneTransform(W.i,p);return p.applyMatrix4(W.o.matrixWorld);};
 const cases=[];let footRotMax=0;
 for(const [gait,speed,cr,knife]of [['walk',3.24,false,false],['run',5.4,false,false],['crouchWalk',2,true,false],['sprint',6.75,false,true]])for(let d=0;d<(quick?1:8);d++)cases.push({gait,speed,cr,knife,d});
 for(const {gait,speed,cr,knife,d}of cases){
  const opt={speed,cr,angle:d*Math.PI/4};base.M.w=planted.M.w=knife?'Knife':'Vandal';
  c.xrmPlantPose=()=>{};base.advance(75,{cr});c.xrmPlantPose=pose;planted.advance(75,{cr});
  let previous=null,baseTravel=0,contactTravel=0,samples=0,held=0,clamps=0,maxStep=0;
  for(let i=0;i<150;i++){
   c.xrmPlantPose=()=>{};base.advance(1,opt);c.xrmPlantPose=pose;planted.advance(1,opt);
   assert(base.M.m.position.equals(planted.M.m.position),gait+' actor motion unchanged');
   assert(base.X.b.pelvis.position.distanceTo(planted.X.b.pelvis.position)<1e-8,gait+' pelvis position unchanged');
   assert(base.X.sc.parent.position.distanceTo(planted.X.sc.parent.position)<1e-6,gait+' wrapper/contact Y unchanged');
   for(const side of ['L','R']){
    const a=base.bone(side+'_Foot'),b=planted.bone(side+'_Foot');
    // 2e-3 rad (0.11 deg): xgSetWorldQ re-derives the foot's local rotation from the decomposed (scaled) parent world matrix, which
    // leaves 1.3e-4..8.6e-4 rad of round-off (also on the 63f8fe6 base); the old 2e-6 bound could never pass. Still far below anything visible.
    {const e=a.getWorldQuaternion(new T.Quaternion()).angleTo(b.getWorldQuaternion(new T.Quaternion()));footRotMax=Math.max(footRotMax,e);near(e,0,2e-3,gait+' authored foot world rotation preserved');}
    const p=n=>planted.at(side+'_'+n),q=n=>base.at(side+'_'+n);
    near(p('Hip').distanceTo(p('Knee')),q('Hip').distanceTo(q('Knee')),1e-6,gait+' thigh length');
    near(p('Knee').distanceTo(p('Foot')),q('Knee').distanceTo(q('Foot')),1e-6,gait+' shin length');
   }
   waist(planted,gait+' '+dirs[d]+' contact');
   const P=planted.X.rm.plant;if(!P?.active){previous=null;continue;}held++;if(P.clamped)clamps++;
   const L=P.legs.find(L=>L.side===P.side),W=L.probe;assert(W,gait+' actual skinned sole witness');
   const q=point(W),p=point({o:base.X.sc.getObjectByName(W.o.name),i:W.i});
   const token=[P.side,W.o.name,W.i,P.anchor.x,P.anchor.z].join(':');
   if(previous?.token===token){
    const rawStep=Math.hypot(p.x-previous.p.x,p.z-previous.p.z),step=Math.hypot(q.x-previous.q.x,q.z-previous.q.z);
    baseTravel+=rawStep;contactTravel+=step;samples++;maxStep=Math.max(maxStep,step);
    if(!P.clamped)assert(step<.003,gait+' '+dirs[d]+' skinned contact XZ drift '+step);
   }
   previous={token,p,q};
  }
  assert(samples>30,gait+' '+dirs[d]+' genuine stance samples');assert(baseTravel>.01,gait+' '+dirs[d]+' uncorrected skin visibly travels');
  // Relative OR absolute: since the stride calibration the uncorrected skin hardly slips (walk E ~3 mm/frame), so a third of it is
  // a fraction of a millimetre; holding the contact point to < 1.5 mm/frame mean is the goal either way.
  assert(contactTravel<baseTravel*.35||contactTravel/samples<.0015,gait+' '+dirs[d]+' contact reduces actual skin slip '+contactTravel/baseTravel+' ('+(contactTravel/samples*1000).toFixed(2)+' mm/frame)');
  rows.push({gait,direction:dirs[d],footRotMaxRad:+footRotMax.toExponential(2),heldFrames:held,stanceSamples:samples,reachClamps:clamps,baseMeanMm:+(baseTravel/samples*1000).toFixed(3),contactMeanMm:+(contactTravel/samples*1000).toFixed(3),maxContactStepMm:+(maxStep*1000).toFixed(3)});
 }
 // The hook yields at every forbidden boundary, including a pending full-body target
 // before its action has acquired any weight. Each check calls only the movement contact hook.
 const {X}=planted,P=X.rm.plant;planted.advance(60,{speed:5.4});
 for(const [label,set,undo]of [
  ['air',()=>X.air=true,()=>X.air=false],['rope',()=>X.rm.rope=true,()=>X.rm.rope=false],
  ['turn',()=>X.rm.turn={},()=>X.rm.turn=null],['upper event',()=>X.uo='reload',()=>X.uo=null],
  ['full-body target',()=>X.rm.plantBlockedTargets=true,()=>X.rm.plantBlockedTargets=false],
  ['full-body weight',()=>X.w.plant=.2,()=>X.w.plant=0],['death',()=>X.dd=1,()=>X.dd=0],
  ['large dt',()=>X.poseDt=.2,()=>X.poseDt=1/60],['zero dt',()=>X.poseDt=0,()=>X.poseDt=1/60]
 ]){
  P.side='L';P.active=true;const before=P.bones.map(b=>b.quaternion.clone());set();c.xrmPlantPose(planted.M,P);assert.equal(P.active,false,label+' releases contact');P.bones.forEach((b,i)=>assert(b.quaternion.equals(before[i]),label+' no leg pose write'));undo();
 }
 // Undo happens after all existing pre passes and stays stable when the mixer skips equal values.
 c.xrmPlantPose=pose;planted.advance(60,{speed:5.4});planted.step(0);const stable=planted.at('L_Foot');
 for(let i=0;i<10;i++){planted.step(0);assert(planted.at('L_Foot').distanceTo(stable)<1e-6,'zero-time contact undo does not stack');}
 return rows;
}
(async()=>{
 if(process.env.ROCKLAN_MOVEMENT_TEST==='contact'){console.log(JSON.stringify({ok:true,contact:await contact(process.env.ROCKLAN_MOVEMENT_QUICK==='1')},null,2));return;}
 const data=integrity(),loading=await loader(),rigRows=await rigs(),state=await animator(),contacts=await contact();
 assert.equal(hash(Buffer.concat([Buffer.from(JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT,'movement.json'))))),fs.readFileSync(path.join(OUT,'movement.bin'))])),dataBefore,'tests do not mutate packed movement data');
 console.log(JSON.stringify({ok:true,data,loader:loading,rigs:rigRows,animator:state,contact:contacts,browserVisuals:'not tested'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
