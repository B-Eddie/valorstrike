// Rocklan fan-extracted movement curves only. Never read or rewrite the game's mixed animation assets.
// Run after installing the server's existing dependencies: node work/build_rocklan_movement.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {T,parse}=require('./valorant_rigs');
const ROOT=path.join(__dirname,'..');
const PACK=process.env.ROCKLAN_PACK||'/home/hatch/workspace/valorstrike-refresh/rocklan-pack';
const SOURCE=path.join(PACK,'Animations/Agent Animations/Shared/Simple');
const OUT=path.join(ROOT,'models/valorant/movement');
const AGENTS=['jett','phoenix','sova','sage','reyna','raze','killjoy','omen','skye','chamber','breach','cypher'];
const DIRS=['N','NE','E','SE','S','SW','W','NW'];
const LOWER=/^(Pelvis|[LR]_(Hip|Knee|Foot|Toe))$/;
const SPINE=/^Spine[1234]$/;
const cache=new Map();
function readPSA(name){
 if(cache.has(name))return cache.get(name);
 const file=path.join(SOURCE,name+'.psa');
 if(!fs.existsSync(file))throw Error('Required movement source missing: '+file);
 const b=fs.readFileSync(file),chunks={};let offset=0;
 while(offset<b.length){
  if(offset+32>b.length)throw Error('Truncated PSA header: '+name);
  const id=b.toString('utf8',offset,offset+20).replace(/\0.*$/,''),size=b.readInt32LE(offset+24),count=b.readInt32LE(offset+28);offset+=32;
  if(size<0||count<0||offset+size*count>b.length)throw Error('Invalid PSA chunk: '+name);
  chunks[id]={size,count,data:b.subarray(offset,offset+size*count)};offset+=size*count;
 }
 const bn=chunks.BONENAMES,an=chunks.ANIMINFO,ky=chunks.ANIMKEYS;
 if(!bn||!an||!ky||an.count!==1||ky.size!==32)throw Error('Unsupported movement PSA: '+name);
 const names=Array.from({length:bn.count},(_,i)=>bn.data.toString('utf8',i*bn.size,i*bn.size+64).replace(/\0.*$/,''));
 const fps=an.data.readFloatLE(152),frames=an.data.readInt32LE(164),first=an.data.readInt32LE(160);
 if(!(fps>0&&frames>0)||ky.count<(first+frames)*bn.count)throw Error('Invalid PSA cadence: '+name);
 const result={name,file,names,index:Object.fromEntries(names.map((n,i)=>[n,i])),fps,frames,duration:(frames-1)/fps,
  sha256:crypto.createHash('sha256').update(b).digest('hex'),
  key(bone,frame){const i=this.index[bone];if(i==null)return null;const at=((first+Math.min(frames-1,Math.max(0,frame)))*names.length+i)*32;return Array.from({length:7},(_,j)=>ky.data.readFloatLE(at+j*4));}};
 const root=Array.from({length:frames},(_,f)=>result.key('Root',f)?.slice(0,3)||[0,0,0]),split=Array.from({length:frames},(_,f)=>result.key('Splitter',f).slice(0,3));
 result.motionEvidence={coordinateFrame:'PSA native source coordinates; metres; Z is up',
  rootNet:root[0].map((x,k)=>(root.at(-1)[k]-x)/100),splitterNet:split[0].map((x,k)=>(split.at(-1)[k]-x)/100),
  splitterExcursion:split[0].map((_,k)=>(Math.max(...split.map(p=>p[k]))-Math.min(...split.map(p=>p[k])))/100)};
 cache.set(name,result);return result;
}
const specs=[];
function add(name,source,options={}){specs.push({name,source,layer:'lower',status:'COPIED',...options});}
add('idle','TP_Core_Idle_LB');add('crouch','TP_Core_CrouchIdle_LB');
add('crouchSpine','TP_Core_CrouchPose_UB',{layer:'spine',additive:true,status:'EXTRAPOLATED',subtract:'TP_Core_IdlePose_UB',derivation:'Derive only the spine rotation difference between the generic pack IdlePose_UB and CrouchPose_UB to apply crouch torso posture over preserved weapon/arm actions. No weapon grip, aim, arm or hand channel is copied.'});
for(const [gait,source]of [['walk','Walk'],['run','Run'],['powerWalk','PowerWalk'],['sprint','Sprint'],['crouchWalk','CrouchWalk']]){
 for(const direction of DIRS)add(gait+direction,'TP_Core_'+source+direction+'_LB',{gait,direction});
 for(const direction of DIRS){
  // E is the sole absent crouch additive. The pack supplies the equivalent absolute E upper movement clip.
  const stem='TP_Core_'+source+'Add'+direction+'_UB';
  if(fs.existsSync(path.join(SOURCE,stem+'.psa')))add('lean_'+gait+direction,stem,{layer:'spine',additive:true,gait,direction});
  else if(gait==='crouchWalk'&&direction==='E')add('lean_'+gait+direction,'TP_Core_CrouchWalkE_UB',{layer:'spine',additive:true,gait,direction,status:'EXTRAPOLATED',subtract:'TP_Core_CrouchWalk_Subtract_UB',derivation:'The pack lacks CrouchWalkAddE_UB. Subtract the pack CrouchWalk_Subtract_UB reference from its CrouchWalkE_UB spine rotations to derive the movement-only E additive; preserve all arm/weapon tracks.'});
  else throw Error('Missing directional movement additive '+stem);
 }
}
add('jump','TP_Core_Jump_LB',{phaseKind:'jump'});
for(const direction of ['N','E','S','W'])add('jump'+direction,'TP_Core_Jump'+direction+'_LB',{direction,phaseKind:'jump'});
add('crouchJump','TP_Core_Crouch_Jump_LB',{phaseKind:'jump'});
add('fall','TP_Core_Falling_LB');add('crouchFall','TP_Core_CrouchFalling_LB');add('land','TP_Core_JumpLand_LB',{phaseKind:'land'});
for(const crouch of [false,true])for(const direction of ['E','W'])for(const degrees of [45,90,135,180])add((crouch?'crouchTurn':'turn')+direction+degrees,'TP_Core_'+(crouch?'CrouchTurn':'Turn')+direction+degrees+'_LB',{turn:{direction,degrees,signedDegrees:direction==='E'?-degrees:degrees,crouch,rootYawAuthored:false,derivation:'The named angle describes intended actor heading change. Source Root/Splitter rotation is static: synchronize foot-replant phase to observed heading change without driving actor or camera orientation.'}});
for(const [name,stem]of [['ropeIdle','IdlePose_LB'],['ropeUp','NavUp_LB'],['ropeDown','NavDown_LB'],['ropeHorizontal','HorizontalAdd_LB'],['ropeForward','NavForwardAdd_LB'],['ropeBack','NavBackAdd_LB']])add(name,'TP_Core_BasePistol_S0_Rope_'+stem,{additive:stem.includes('Add'),traversal:true,derivation:'Only the rope traversal lower-body curves are copied from Shared; weapon/aim/arm channels are excluded.'});
add('stopLower','TP_Core_StopAdd',{additive:true,rootDelta:true,phaseKind:'stop'});
add('stopSpine','TP_Core_StopAdd',{layer:'spine',additive:true,phaseKind:'stop'});
// Jump and landing torso deltas are locomotion posture. Weapon/arm channels never enter this layer.
add('jumpSpine','TP_Core_JumpAdd_UB',{layer:'spine',additive:true,phaseKind:'jump'});
add('crouchJumpSpine','TP_Core_Crouch_JumpAdd_UB',{layer:'spine',additive:true,phaseKind:'jump'});
add('landSpine','TP_Core_JumpLandAdd_UB',{layer:'spine',additive:true,phaseKind:'land'});
add('crouchLandLower','TP_Core_Crouch_JumpLandAdd',{additive:true,rootDelta:true,phaseKind:'land'});
add('crouchLandSpine','TP_Core_Crouch_JumpLandAdd',{layer:'spine',additive:true,phaseKind:'land'});
const q=new T.Quaternion(),v=new T.Vector3();
const rounded=x=>+x.toFixed(7);
function rawQuaternion(key){return key?new T.Quaternion(-key[3],-key[4],-key[5],key[6]).normalize():new T.Quaternion();}
function convert(spec,scene,reference){
 const source=readPSA(spec.source),sub=spec.subtract?readPSA(spec.subtract):null;
 const bones=Object.keys(reference).filter(n=>(spec.layer==='spine'?SPINE.test(n):LOWER.test(n)||(!spec.additive&&n==='Spine1'))&&scene.getObjectByName(n));
 const split=scene.getObjectByName('Splitter'),invSplit=split.quaternion.clone().invert();
 const times=Array.from({length:source.frames},(_,f)=>f/source.fps);
 const tracks=bones.map(n=>({name:n+'.quaternion',type:'quaternion',times,values:[]}));
 const rootTrack=spec.layer==='lower'&&(!spec.additive||spec.rootDelta)?{name:'Pelvis.position',type:'vector',times,values:[]}:null;
 const corrections=Object.fromEntries(bones.map(n=>[n,reference[n].q.clone().invert().multiply(scene.getObjectByName(n).quaternion)]));
 for(let f=0;f<source.frames;f++){
  for(let i=0;i<bones.length;i++){
   const bone=bones[i],off=corrections[bone];q.copy(rawQuaternion(source.key(bone,f)));
   if(sub){const r=rawQuaternion(sub.key(bone,Math.min(f,sub.frames-1)));q.premultiply(r.invert());}
   if(spec.additive)q.premultiply(off.clone().invert()).multiply(off).normalize();
   else q.multiply(off).normalize();
   tracks[i].values.push(...q.toArray().map(rounded));
  }
  if(rootTrack){
   const root=source.key('Splitter',f),pelvis=source.key('Pelvis',f);
   v.set(root[0]/100,root[1]/100,root[2]/100);if(!spec.additive)v.sub(split.position);v.applyQuaternion(invSplit);
   if(pelvis)v.add(new T.Vector3(pelvis[0]/100,pelvis[1]/100,pelvis[2]/100));
   rootTrack.values.push(...v.toArray().map(rounded));
  }
 }
 if(rootTrack)tracks.push(rootTrack);
 return {name:spec.name,duration:Math.max(1/source.fps,source.duration),fps:source.fps,frames:source.frames,
  status:spec.status,sources:[source,...(sub?[sub]:[])].map(s=>path.relative(PACK,s.file)),additive:!!spec.additive,layer:spec.layer,
  ...(spec.gait?{gait:spec.gait,direction:spec.direction}:{}),...(spec.traversal?{traversal:true}:{}),
  ...(spec.turn?{turn:spec.turn}:{}),
  derivation:spec.derivation||'Native pack bone samples copied at their recorded cadence; centimetres converted to metres and native axes retargeted while retaining target bone lengths.',
  ...(spec.phaseKind?{phaseKind:spec.phaseKind}:{}),tracks};
}
function threeClip(clip){return new T.AnimationClip(clip.name,clip.duration,clip.tracks.map(t=>new (t.type==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack)(t.name,t.times,t.values)));}
function sample(scene,clip,count=180){
 const mx=new T.AnimationMixer(scene),action=mx.clipAction(threeClip(clip));action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const left=scene.getObjectByName('L_Foot'),right=scene.getObjectByName('R_Foot'),pelvis=scene.getObjectByName('Pelvis'),p=[];
 for(let i=0;i<=count;i++){mx.setTime(clip.duration*i/count);scene.updateMatrixWorld(true);p.push({time:clip.duration*i/count,left:left.getWorldPosition(new T.Vector3()).toArray(),right:right.getWorldPosition(new T.Vector3()).toArray(),pelvis:pelvis.getWorldPosition(new T.Vector3()).toArray()});}
 mx.stopAllAction();return p;
}
function contactMetadata(scene,clip){
 const samples=sample(scene,clip),angle=DIRS.indexOf(clip.direction)*Math.PI/4,dx=-Math.sin(angle),dz=Math.cos(angle),project=p=>p[0]*dx+p[2]*dz;
 const velocities=[];let lowerTravel=0,lo=Infinity,hi=-Infinity;
 for(let i=1;i<samples.length;i++){
  const a=samples[i],b=samples[i-1],foot=a.left[1]<a.right[1]?'left':'right';
  const travel=project(a[foot])-project(b[foot]);lowerTravel+=Math.abs(travel);
  lo=Math.min(lo,project(a.left));hi=Math.max(hi,project(a.left));
  // A contact candidate is the lower foot travelling backward through the stance.
  if(travel<0)velocities.push({speed:-travel/(a.time-b.time),phase:(a.time+b.time)/(2*clip.duration),foot});
 }
 velocities.sort((a,b)=>a.speed-b.speed);
 const middle=velocities.slice(Math.floor(velocities.length*.15),Math.max(1,Math.ceil(velocities.length*.85)));
 const mean=middle.reduce((s,x)=>s+x.speed,0)/Math.max(1,middle.length);
 // The estimate matches the shipped movement tests' support travel / complete stride estimator.
 const supportEstimate=(lowerTravel+2*(hi-lo))/(2*clip.duration);
 const extrema={};for(const foot of ['left','right']){let best=0;for(let i=1;i<samples.length;i++)if(project(samples[i][foot])>project(samples[best][foot]))best=i;extrema[foot]=best/(samples.length-1);}
 return {naturalSpeed:supportEstimate,contact:{method:'Average of lower-support-foot projected travel/time and complete left-foot stride excursion/time; model units/s. In-place animation estimate, not a measured game speed.',supportSpeed:mean,samples:samples.length,footPhase:extrema,phaseMeaning:'Maximum forward foot projection; approximate contact entry, not an authored event.',confidence:'estimated; no authored contact markers or browser visual verification'}};
}
function phaseMetadata(scene,clip){
 const samples=sample(scene,clip,Math.max(120,clip.frames*2));
 const minAt=(from,to)=>{let best=from;for(let i=from+1;i<=to;i++)if(samples[i].pelvis[1]<samples[best].pelvis[1])best=i;return samples[best].time;};
 const maxAt=(from,to)=>{let best=from;for(let i=from+1;i<=to;i++)if(samples[i].pelvis[1]>samples[best].pelvis[1])best=i;return samples[best].time;};
 if(clip.phaseKind==='jump'){
  const initialDip=minAt(0,Math.floor(samples.length*.35)),peak=maxAt(Math.floor(samples.length*.05),Math.floor(samples.length*.6));
  return {duration:clip.duration,initialDip,firstExtension:peak,takeoffSample:initialDip,tuckSample:Math.min(clip.duration,peak+.18),
   method:'Pose extrema measured from retargeted pelvis height, not physics event timestamps. Runtime may select the takeoff/tuck window without compressing the complete 3.2-second source.',confidence:'extrapolated event timing; source has no authored jump markers'};
 }
 if(clip.phaseKind==='land')return {duration:clip.duration,compressionSample:minAt(0,samples.length-1),method:'Minimum retargeted pelvis height estimates landing compression; contact timing is unproven.'};
 return {duration:clip.duration,method:'Copied additive stop posture; runtime envelope follows observed deceleration. Clip duration is not motor stop time.'};
}
function writeGLB(source,clips,file){
 const src=fs.readFileSync(source),length=src.readUInt32LE(12),j=JSON.parse(src.subarray(20,20+length));
 const nodes=j.nodes.map(n=>{const x={...n};delete x.mesh;delete x.skin;delete x.weights;return x;}),nodeIndex=Object.fromEntries(nodes.map((n,i)=>[n.name,i]));
 const buffers=[],bufferViews=[],accessors=[];let byteOffset=0;
 const push=(values,type)=>{const data=Buffer.from(Float32Array.from(values).buffer),view=bufferViews.length;bufferViews.push({buffer:0,byteOffset,byteLength:data.length});buffers.push(data);byteOffset+=data.length;
  const a={bufferView:view,componentType:5126,count:values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};if(type==='SCALAR'){a.min=[values[0]];a.max=[values.at(-1)];}accessors.push(a);return accessors.length-1;};
 const animations=clips.map(c=>{const samplers=[],channels=[];for(const track of c.tracks){const bone=track.name.split('.')[0];if(nodeIndex[bone]==null)throw Error('Missing baked movement GLB bone '+bone);samplers.push({input:push(track.times,'SCALAR'),output:push(track.values,track.type==='vector'?'VEC3':'VEC4'),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:nodeIndex[bone],path:track.type==='vector'?'translation':'rotation'}});}return {name:c.name,samplers,channels,extras:{additive:c.additive,layer:c.layer,status:c.status}};});
 const output={asset:{version:'2.0',generator:'Movement-only Rocklan direct PSA baked curves'},scene:j.scene||0,scenes:j.scenes,nodes,animations,accessors,bufferViews,buffers:[{byteLength:byteOffset}],extras:{source:'Rocklan fan-extracted pack; not official Riot data',blenderExport:false,additiveClips:'Animation extras.additive identifies delta curves; apply as additive animation.'}};
 let json=Buffer.from(JSON.stringify(output));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(buffers),header=Buffer.alloc(20),bh=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([header,json,bh,bin]));
}
(async()=>{
 if(!fs.existsSync(SOURCE)||!fs.existsSync(path.join(SOURCE,'TP_Core_RunN_LB.psa')))throw Error('Rocklan Shared movement library missing or unusable; refusing replacement assets.');
 const referenceScene=(await parse(path.join(ROOT,'models/valorant/jett.glb'))).scene,reference={};referenceScene.traverse(o=>{if(o.isBone)reference[o.name]={q:o.quaternion.clone(),p:o.position.clone()};});
 const header={version:1,format:'Track times/values are Float32 element offsets into movement.bin, with count keyframes; quaternion=4 components, vector=3.',bones:Object.keys(reference).filter(n=>LOWER.test(n)||SPINE.test(n)),agents:{},
  transitions:{start:{status:'EXTRAPOLATED',derivation:'Blend the pack idle and directional gait at shared contact phase using actual speed/acceleration; the complete Shared movement set has no generic authored start clip.'},crouchEnter:{status:'EXTRAPOLATED',derivation:'Interpolate the copied idle and crouch lower-body poses following the existing motor crouch amount; no generic authored crouch-enter clip is present.'},crouchExit:{status:'EXTRAPOLATED',derivation:'Reverse the idle/crouch pose interpolation following the existing motor stand-up amount.'},directionChange:{status:'EXTRAPOLATED',derivation:'Interpolate adjacent authored 45-degree direction samples with phase synchronization; the eight authored gait directions themselves are copied.'},diagonalJump:{status:'EXTRAPOLATED',derivation:'Blend the two adjacent copied N/E/S/W directional jump curves for diagonal takeoffs; no diagonal jump source is present.'},ropeAttachDetach:{status:'EXTRAPOLATED',derivation:'Crossfade the copied rope lower poses with copied ground or falling poses at the implemented traversal boundary; no generic attach/detach movement clips are present.'}},
  restrictions:'Movement channels only: no arms, hands, neck/head, weapon, ability, emote, hit reaction, death or device channels. Native Splitter translation is carried by Pelvis.position; runtime carries sibling Spine1 from the pelvis bind relationship.'};
 const values=[],dedupe=new Map();let at=0;const append=a=>{const b=Buffer.from(Float32Array.from(a).buffer),hash=crypto.createHash('sha256').update(b).digest('hex');if(dedupe.has(hash))return dedupe.get(hash);const start=at;values.push(b);at+=a.length;dedupe.set(hash,start);return start;};
 let jettClips;
 for(const slug of AGENTS){
  const scene=(await parse(path.join(ROOT,'models/valorant',slug+'.glb'))).scene,clips=specs.map(s=>convert(s,scene,reference));
  for(const clip of clips){if(clip.gait&&clip.layer==='lower'&&!clip.additive)Object.assign(clip,contactMetadata(scene,clip));if(clip.phaseKind&&clip.layer==='lower')clip.phase=phaseMetadata(scene,clip);}
  if(slug==='jett')jettClips=clips;
  header.agents[slug]={clips:clips.map(c=>({...c,tracks:c.tracks.map(t=>({name:t.name,type:t.type,times:append(t.times),values:append(t.values),count:t.times.length}))}))};
  console.log(slug+': '+clips.length+' movement-only clips');
 }
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'movement.bin'),Buffer.concat(values));fs.writeFileSync(path.join(OUT,'movement.json'),JSON.stringify(header));
 writeGLB(path.join(ROOT,'models/valorant/jett.glb'),jettClips,path.join(OUT,'tp-movement-baked.glb'));
 const provenance={source:'Rocklan FREE Valorant Blender 3D Model Pack; fan-extracted reference, not official Riot data',base:'63f8fe64d749c6634273c92732f5f049712d0a79',conversion:'Direct ActorX PSA parsing and GLTF serialization. Blender is not installed; portable download failed because the configured network proxy is unreachable. Blender export remains unmet.',
  sourceScope:'Only specifically named movement files in Shared/Simple are opened. Weapon animations, weapon/ability/emote/death/hit/plant/device curves are excluded.',
  clips:jettClips.map(({tracks,...c})=>c),transitions:header.transitions,
  sources:[...cache.values()].map(s=>({file:path.relative(PACK,s.file),sha256:s.sha256,frames:s.frames,fps:s.fps,duration:s.duration,motionEvidence:s.motionEvidence})),
  mechanics:{changed:[],evidence:'All directional ground gait roots are in place. Source curves establish cadence, posture and directional contact travel, not authoritative movement speed, acceleration, friction, stopping distance, gravity or rope speed. Existing motor values are preserved.'},
  limitations:['No rendered browser comparison completed.','Contact phases and contact speeds are estimates from retargeted foot trajectories, not authored source events.','Animation-specific start, crouch-entry/exit and rope boundary timings are extrapolated blends.','Exact parity with Riot gameplay is unproven.']};
 fs.writeFileSync(path.join(OUT,'provenance.json'),JSON.stringify(provenance,null,2));console.log('Wrote '+at+' Float32 values and baked movement GLB.');
})().catch(error=>{console.error(error);process.exitCode=1;});
