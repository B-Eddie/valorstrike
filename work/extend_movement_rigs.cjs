// Extend models/valorant/movement/movement.json+bin with rig rows for the agents added after the
// original 12. The Rocklan source pack (PSA curves) is not present in this checkout, so rows are
// derived from jett's baked rows: the build's reference skeleton IS jett (build_rocklan_movement.cjs),
// so jett's baked curves equal the raw converted PSA curves. For target agent X with bone rest local
// quaternion x_n and jett's j_n, the build's correction is corr(n) = j_n^-1 * x_n, giving:
//   absolute clips:  q_X(f) = q_jett(f) * corr(n)
//   additive clips:  q_X(f) = corr(n)^-1 * q_jett(f) * corr(n)
// Pelvis.position carries the native Splitter translation; it is copied verbatim when X's Splitter
// node matches jett's (verified per agent below), scaled by pelvis rest-height ratio otherwise.
// Frame-aware (the owner, 2026-11-07: "Brimstone legs look wrong while moving"): the formulas above assume X's bones
// sit in jett's parent frames at rest. Brimstone's skeleton is built 180 deg about Z from jett's (Root (0,0,1,0),
// Skeleton (-1,0,0,0)), so his Pelvis frame is turned 180 deg and q*corr applied jett's hip / knee swings about the
// wrong axes (legs kicked forward, knees crossed, feet off the floor). With P = the parent's rest world rotation and
// W = the bone's rest world rotation, the transfer keeps each bone's world-space motion:
//   absolute clips:  q_X(f) = C * (q_jett(f) * j^-1) * C^-1 * x,   C = P_X^-1 * P_jett
//   additive clips:  q_X(f) = D^-1 * q_jett(f) * D,               D = W_jett^-1 * W_X
// which equal q*corr / corr^-1*q*corr whenever the frames match (every other added agent: <= 0.4 deg at the
// hips and knees; Clove 11 deg / Gekko 27 deg only at a toe / foot).
// Run: node work/extend_movement_rigs.cjs   (new agents)
//      node work/extend_movement_rigs.cjs --redo brimstone   (re-derive existing rows in place; then update the
//      XRM.assets bytes / sha256 in index.html by hand - never regenerate index.html wholesale)
'use strict';
const fs=require('fs'),path=require('path');
const {T,parse}=require('./valorant_rigs');
const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'models/valorant/movement');
const NEW=['astra','brimstone','viper','harbor','clove','miks','iso','neon','yoru','waylay','hush','fade','gekko','kayo','tejo','deadlock','vyse','veto'];
const EPS=1e-6;
function bones(scene){scene.updateMatrixWorld(true);const m={};scene.traverse(o=>{if(o.isBone)m[o.name]={q:o.quaternion.clone(),p:o.position.clone(),P:o.parent?o.parent.getWorldQuaternion(new T.Quaternion()):new T.Quaternion(),W:o.getWorldQuaternion(new T.Quaternion())};});return m;}
const REDO=(()=>{const i=process.argv.indexOf('--redo');return i>=0?String(process.argv[i+1]||'').split(',').filter(Boolean):[];})();
(async()=>{
 const header=JSON.parse(fs.readFileSync(path.join(OUT,'movement.json'),'utf8'));
 const bin=fs.readFileSync(path.join(OUT,'movement.bin'));
 const floats=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.length));
 const extra=[];let at=floats.length;
 const append=a=>{const b=Buffer.from(Float32Array.from(a).buffer);const start=at;extra.push(b);at+=a.length;return start;};
 const jettScene=(await parse(path.join(ROOT,'models/valorant/agents/jett.glb'))).scene;
 jettScene.updateMatrixWorld(true);
 const jettB=bones(jettScene),jettSplit=jettScene.getObjectByName('Splitter');
 if(!header.agents.jett)throw Error('jett row missing from movement.json');
 const src=header.agents.jett.clips;
 const q=new T.Quaternion(),corr=new T.Quaternion();
 for(const slug of NEW){
  const redo=REDO.includes(slug),old=redo&&header.agents[slug];
  if(header.agents[slug]&&!redo){console.log(slug+': already present, skipped');continue;}
  const scene=(await parse(path.join(ROOT,'models/valorant/agents',slug+'.glb'))).scene;
  const B=bones(scene),split=scene.getObjectByName('Splitter');
  // Pelvis.position values are world root-motion deltas expressed in the Splitter frame (rest local is zero).
  // World delta = splitQuat * v, so the faithful transfer is v_X = (splitQuatX^-1 * splitQuatJett) * v.
  scene.updateMatrixWorld(true);
  const splitRot=split&&jettSplit?split.getWorldQuaternion(new T.Quaternion()).invert().multiply(jettSplit.getWorldQuaternion(new T.Quaternion())).normalize():null;
  const splitMatch=!splitRot||(Math.abs(splitRot.w)>0.999999&&splitRot.x*splitRot.x+splitRot.y*splitRot.y+splitRot.z*splitRot.z<1e-10);
  const rv=new T.Vector3();
  let dropped=0;
  const clips=src.map(c=>{
   const tracks=[];
   for(const t of c.tracks){
    const bone=t.name.split('.')[0],size=t.type==='quaternion'?4:3;
    const vals=Array.from(floats.slice(t.values,t.values+t.count*size));
    if(t.type==='quaternion'){
     if(!B[bone]||!jettB[bone]){dropped++;continue;}
     const J=jettB[bone],X=B[bone],C=X.P.clone().invert().multiply(J.P).normalize(),Ci=C.clone().invert(),ji=J.q.clone().invert(),D=J.W.clone().invert().multiply(X.W).normalize(),Di=D.clone().invert();
     const out=[];let same=true;
     for(let f=0;f<t.count;f++){
      q.fromArray(vals,f*4);
      if(c.additive)q.premultiply(Di).multiply(D);else q.multiply(ji).premultiply(C).multiply(Ci).multiply(X.q);
      q.normalize();const o=q.toArray().map(v=>+v.toFixed(7));for(let k=0;k<4;k++)if(Math.abs(o[k]-vals[f*4+k])>2e-7)same=false;out.push(...o);
     }
     if(same){tracks.push({name:t.name,type:t.type,times:t.times,values:t.values,count:t.count});continue;}/* = jett's curve: share it */
     const ot=old&&old.clips.find(x=>x.name===c.name),prev=ot&&ot.tracks.find(x=>x.name===t.name&&x.type===t.type&&x.count===t.count);
     if(prev&&prev.values!==t.values){for(let k=0;k<out.length;k++)floats[prev.values+k]=out[k];tracks.push({name:t.name,type:t.type,times:t.times,values:prev.values,count:t.count});continue;}/* --redo: its own block, rewritten in place */
     tracks.push({name:t.name,type:t.type,times:t.times,values:append(out),count:t.count});
    }else{
     {const ot=old&&old.clips.find(x=>x.name===c.name),prev=ot&&ot.tracks.find(x=>x.name===t.name&&x.type===t.type);if(prev){tracks.push({name:t.name,type:t.type,times:t.times,values:prev.values,count:t.count});continue;}}/* --redo: the Splitter-frame translation is already right */
     if(splitMatch){tracks.push({name:t.name,type:t.type,times:t.times,values:t.values,count:t.count});continue;}
     const out=[];
     for(let f=0;f<t.count;f++){rv.fromArray(vals,f*3).applyQuaternion(splitRot);out.push(...rv.toArray().map(v=>+v.toFixed(7)));}
     tracks.push({name:t.name,type:t.type,times:t.times,values:append(out),count:t.count});
    }
   }
   const meta={...c,tracks};
   meta.derivation=(c.derivation||'')+' Rest-pose retarget from the baked jett row (build reference skeleton), frame-aware: '+ (c.additive?'D^-1*q*D, D=jettRestWorld^-1*agentRestWorld':'C*(q*jettRest^-1)*C^-1*agentRest, C=agentParentRestWorld^-1*jettParentRestWorld') +' per bone (= q*corr when the parent frames match); no new source curves introduced.';
   return meta;
  });
  header.agents[slug]={clips};
  console.log(slug+': '+clips.length+' clips'+(dropped?' (dropped '+dropped+' absent-bone tracks)':'')+(splitMatch?'':' [Splitter orientation differs: Pelvis.position rotated into the agent Splitter frame]'));
 }
 fs.writeFileSync(path.join(OUT,'movement.bin'),Buffer.concat([Buffer.from(floats.buffer,floats.byteOffset,floats.byteLength),...extra]));
 fs.writeFileSync(path.join(OUT,'movement.json'),JSON.stringify(header));
 const prov=JSON.parse(fs.readFileSync(path.join(OUT,'provenance.json'),'utf8'));
 if(REDO.length)prov.agentRowRedo={agents:REDO,date:'2026-11-08',reason:'frame-aware retarget (a skeleton whose parent frames differ from jett\'s, e.g. Brimstone 180 deg about Z): absolute C*(q*j^-1)*C^-1*x, C=P_X^-1*P_jett; additive D^-1*q*D, D=W_jett^-1*W_X; Pelvis.position kept (already in the agent Splitter frame)'};
 else prov.agentRowExtension={agents:NEW.filter(s=>!prov.agentRowExtension||!prov.agentRowExtension.agents.includes(s)),method:'Derived from the baked jett rows (identity correction at the build reference) by per-bone rest-pose correction computed from each game-path agent GLB (models/valorant/agents/, the rigs the runtime animates): absolute q*corr, additive corr^-1*q*corr. Pelvis.position copied when the Splitter node matches jett, otherwise rotated into the agent Splitter frame via qX^-1*qJett (world-delta transfer; rest local translation is zero). The Rocklan pack was unavailable in this checkout; no new animation curves authored.'};
 fs.writeFileSync(path.join(OUT,'provenance.json'),JSON.stringify(prov,null,2));
 console.log('movement.json/bin extended:',Object.keys(header.agents).length,'agents');
})().catch(e=>{console.error(e);process.exit(1);});
