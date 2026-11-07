// Extend models/valorant/movement/movement.json+bin with rig rows for the agents added after the
// original 12. The Rocklan source pack (PSA curves) is not present in this checkout, so rows are
// derived from jett's baked rows: the build's reference skeleton IS jett (build_rocklan_movement.cjs),
// so jett's baked curves equal the raw converted PSA curves. For target agent X with bone rest local
// quaternion x_n and jett's j_n, the build's correction is corr(n) = j_n^-1 * x_n, giving:
//   absolute clips:  q_X(f) = q_jett(f) * corr(n)
//   additive clips:  q_X(f) = corr(n)^-1 * q_jett(f) * corr(n)
// Pelvis.position carries the native Splitter translation; it is copied verbatim when X's Splitter
// node matches jett's (verified per agent below), scaled by pelvis rest-height ratio otherwise.
// Run: node work/extend_movement_rigs.cjs && python3 work/install_valorant.py
'use strict';
const fs=require('fs'),path=require('path');
const {T,parse}=require('./valorant_rigs');
const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'models/valorant/movement');
const NEW=['astra','brimstone','viper','harbor','clove','miks','iso','neon','yoru','waylay','hush','fade','gekko','kayo','tejo','deadlock','vyse','veto'];
const EPS=1e-6;
function bones(scene){const m={};scene.traverse(o=>{if(o.isBone)m[o.name]={q:o.quaternion.clone(),p:o.position.clone()};});return m;}
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
  if(header.agents[slug]){console.log(slug+': already present, skipped');continue;}
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
     corr.copy(jettB[bone].q).invert().multiply(B[bone].q);
     if(corr.length()>1+1e-4||corr.length()<1-1e-4)corr.normalize();
     const identity=Math.abs(corr.w)>1-EPS&&Math.abs(corr.x)<1e-5&&Math.abs(corr.y)<1e-5&&Math.abs(corr.z)<1e-5;
     if(identity){tracks.push({name:t.name,type:t.type,times:t.times,values:t.values,count:t.count});continue;}
     const inv=corr.clone().invert(),out=[];
     for(let f=0;f<t.count;f++){
      q.fromArray(vals,f*4);
      if(c.additive)q.premultiply(inv).multiply(corr);else q.multiply(corr);
      q.normalize();out.push(...q.toArray().map(v=>+v.toFixed(7)));
     }
     tracks.push({name:t.name,type:t.type,times:t.times,values:append(out),count:t.count});
    }else{
     if(splitMatch){tracks.push({name:t.name,type:t.type,times:t.times,values:t.values,count:t.count});continue;}
     const out=[];
     for(let f=0;f<t.count;f++){rv.fromArray(vals,f*3).applyQuaternion(splitRot);out.push(...rv.toArray().map(v=>+v.toFixed(7)));}
     tracks.push({name:t.name,type:t.type,times:t.times,values:append(out),count:t.count});
    }
   }
   const meta={...c,tracks};
   meta.derivation=(c.derivation||'')+' Rest-pose retarget from the baked jett row (build reference skeleton): '+ (c.additive?'corr^-1*q*corr':'q*corr') +' per bone, corr=jettRest^-1*agentRest; no new source curves introduced.';
   return meta;
  });
  header.agents[slug]={clips};
  console.log(slug+': '+clips.length+' clips'+(dropped?' (dropped '+dropped+' absent-bone tracks)':'')+(splitMatch?'':' [Splitter orientation differs: Pelvis.position rotated into the agent Splitter frame]'));
 }
 fs.writeFileSync(path.join(OUT,'movement.bin'),Buffer.concat([bin,...extra]));
 fs.writeFileSync(path.join(OUT,'movement.json'),JSON.stringify(header));
 const prov=JSON.parse(fs.readFileSync(path.join(OUT,'provenance.json'),'utf8'));
 prov.agentRowExtension={agents:NEW.filter(s=>!prov.agentRowExtension||!prov.agentRowExtension.agents.includes(s)),method:'Derived from the baked jett rows (identity correction at the build reference) by per-bone rest-pose correction computed from each game-path agent GLB (models/valorant/agents/, the rigs the runtime animates): absolute q*corr, additive corr^-1*q*corr. Pelvis.position copied when the Splitter node matches jett, otherwise rotated into the agent Splitter frame via qX^-1*qJett (world-delta transfer; rest local translation is zero). The Rocklan pack was unavailable in this checkout; no new animation curves authored.'};
 fs.writeFileSync(path.join(OUT,'provenance.json'),JSON.stringify(prov,null,2));
 console.log('movement.json/bin extended:',Object.keys(header.agents).length,'agents');
})().catch(e=>{console.error(e);process.exit(1);});
