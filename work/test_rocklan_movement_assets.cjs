// Asset-boundary and numerical checks for the dedicated movement layer, independent of mixed base clips.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parse}=require('./valorant_rigs');
const root=path.join(__dirname,'..'),dir=path.join(root,'models/valorant/movement');
const header=JSON.parse(fs.readFileSync(path.join(dir,'movement.json'))),provenance=JSON.parse(fs.readFileSync(path.join(dir,'provenance.json')));
const buffer=fs.readFileSync(path.join(dir,'movement.bin')),F=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.length/4);
const allowed=/^(Pelvis|Spine[1-4]|[LR]_(Hip|Knee|Foot|Toe))\.(quaternion|position)$/;
const names=['N','NE','E','SE','S','SW','W','NW'];
const byAgent={};let tracks=0,keys=0,maxError=0;
for(const [agent,data]of Object.entries(header.agents)){
 const clips=byAgent[agent]=Object.fromEntries(data.clips.map(c=>[c.name,c]));assert.equal(data.clips.length,121,agent+' full movement coverage');
 for(const gait of ['walk','run','powerWalk','sprint','crouchWalk'])for(const direction of names){const c=clips[gait+direction];assert(c&&c.naturalSpeed>0,gait+direction+' has contact calibration');assert(c.contact.footPhase.left>=0&&c.contact.footPhase.left<=1);assert(clips['lean_'+gait+direction],'all directional movement leans present');}
 for(const name of ['idle','crouch','crouchSpine','jump','jumpN','jumpE','jumpS','jumpW','crouchJump','fall','crouchFall','land','ropeIdle','ropeUp','ropeDown','ropeHorizontal','ropeForward','ropeBack','stopLower','stopSpine','jumpSpine','crouchJumpSpine','landSpine','crouchLandLower','crouchLandSpine'])assert(clips[name],name+' covered');
 for(const crouch of [false,true])for(const direction of ['E','W'])for(const degrees of [45,90,135,180])assert(clips[(crouch?'crouchTurn':'turn')+direction+degrees],'standing and crouched turn footwork covered');
 assert.equal(clips.lean_crouchWalkE.status,'EXTRAPOLATED');
 for(const clip of data.clips){
  assert(clip.duration>0&&clip.frames>1);assert(['COPIED','EXTRAPOLATED'].includes(clip.status));
  for(const track of clip.tracks){
   tracks++;const components=track.type==='quaternion'?4:3;assert(allowed.test(track.name),'forbidden animation channel '+track.name);
   assert(!track.name.endsWith('.position')||track.name==='Pelvis.position','only pelvis may translate');
   if(clip.layer==='spine')assert(/^Spine[1-4]\.quaternion$/.test(track.name),'spine overlay must preserve weapon and arm channels');
   assert(track.times>=0&&track.values>=0&&track.times+track.count<=F.length&&track.values+track.count*components<=F.length,'binary track bounds');
   for(let i=0;i<track.count;i++){
    keys++;assert(Number.isFinite(F[track.times+i]));if(i)assert(F[track.times+i]>F[track.times+i-1],'strict keyframe time order');
    const values=F.slice(track.values+i*components,track.values+(i+1)*components);assert(values.every(Number.isFinite));
    if(components===4){const error=Math.abs(Math.hypot(...values)-1);maxError=Math.max(maxError,error);assert(error<2e-6,'normalized quaternion');}
   }
  }
 }
}
assert.equal(Object.keys(header.agents).length,12,'all game agent rigs retargeted');
// Neutral source deltas must stay neutral on every retargeted rig. An absolute bind correction on
// additive tracks passes normalization checks but rotates these bones and twists the body.
let neutralDeltas=0;
for(const reference of header.agents.jett.clips.filter(c=>c.additive))for(const track of reference.tracks.filter(t=>t.type==='quaternion'))for(let i=0;i<track.count;i++){
 const start=track.values+i*4;if(Math.hypot(F[start],F[start+1],F[start+2])>2e-7)continue;
 neutralDeltas++;for(const clips of Object.values(byAgent)){const target=clips[reference.name].tracks.find(t=>t.name===track.name);const p=target.values+i*4;assert(Math.hypot(F[p],F[p+1],F[p+2])<2e-6,'identity additive remains identity after retargeting');}
}
assert(neutralDeltas>100,'neutral additive guard exercised');
// Freeze precisely which on-disk movement files supplied the baked curves.
const pack=process.env.ROCKLAN_PACK||'/home/hatch/workspace/valorstrike-refresh/rocklan-pack';
const havePack=fs.existsSync(pack);if(!havePack)console.log('Rocklan pack not at '+pack+' (set ROCKLAN_PACK): source hash / direct PSA sample checks skipped');
for(const source of provenance.sources){assert(source.file.startsWith('Animations/Agent Animations/Shared/Simple/'));if(!havePack)continue;const file=path.join(pack,source.file);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),source.sha256,'source integrity '+source.file);}
assert.deepEqual(provenance.mechanics.changed,[],'in-place samples cannot prove motor constant changes');
// Compare the actual baked Jett samples directly with ActorX records. Jett is the reference
// bind basis, so copied quaternion samples must be exactly the normalized source conjugates.
let copiedSamples=0;const sourceCache=new Map();
function sourceKeys(file){
 if(sourceCache.has(file))return sourceCache.get(file);const b=fs.readFileSync(path.join(pack,file)),chunks={};let at=0;
 while(at<b.length){const name=b.toString('utf8',at,at+20).replace(/\0.*$/,''),size=b.readInt32LE(at+24),count=b.readInt32LE(at+28);at+=32;chunks[name]={size,count,data:b.subarray(at,at+size*count)};at+=size*count;}
 const bn=chunks.BONENAMES,names=Array.from({length:bn.count},(_,i)=>bn.data.toString('utf8',i*bn.size,i*bn.size+64).replace(/\0.*$/,'')),first=chunks.ANIMINFO.data.readInt32LE(160),data=chunks.ANIMKEYS.data;
 const out={names,quaternion(bone,frame){const off=((first+frame)*names.length+names.indexOf(bone))*32+12,q=[-data.readFloatLE(off),-data.readFloatLE(off+4),-data.readFloatLE(off+8),data.readFloatLE(off+12)],norm=Math.hypot(...q);return q.map(x=>x/norm);}};sourceCache.set(file,out);return out;
}
for(const clip of havePack?header.agents.jett.clips.filter(c=>c.status==='COPIED'):[]){
 const source=sourceKeys(clip.sources[0]);for(const track of clip.tracks.filter(t=>t.type==='quaternion'))for(const i of [0,Math.floor(track.count/2),track.count-1]){
  const expected=source.quaternion(track.name.split('.')[0],i),actual=F.slice(track.values+i*4,track.values+(i+1)*4),dot=expected.reduce((sum,x,k)=>sum+x*actual[k],0);assert(Math.abs(Math.abs(dot)-1)<5e-7,'copied PSA sample '+clip.name+'/'+track.name);copiedSamples++;
 }
}
(async()=>{const gl=await parse(path.join(dir,'tp-movement-baked.glb'));assert.equal(gl.animations.length,121);let meshes=0;gl.scene.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,0,'baked GLB is skeleton and motion only');
 for(const animation of gl.animations)for(const track of animation.tracks)assert(allowed.test(track.name),'baked GLB forbidden track');
 console.log('Rocklan movement assets: '+Object.keys(header.agents).length+' rigs ×121 clips, '+tracks+' tracks / '+keys+' keys; '+copiedSamples+' direct PSA sample comparisons, source hashes, complete directions/air/rope/stops/turns, preserved additive identity, skeleton GLB passed; max quaternion error '+maxError.toExponential(2));
})().catch(e=>{console.error(e);process.exitCode=1;});
