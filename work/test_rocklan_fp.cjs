// Rocklan first-person donor integration (work/build_rocklan_fp.cjs -> models/valorant/animations/fp-rocklan-<agent>.glb,
// loaded by work/ability_fp_runtime.js xAfLoad). The donor is a converted copied asset: LOCAL ONLY, never committed.
//  1. donor glb parses and carries the authored Jett sets this integration uses; merged exactly like xAfLoad
//     (FP_Abilities -> donor fills gaps -> agent's own arms win), the clips play on the real jett-fp rig and move the
//     hands; the donor never overrides the agent's own clips;
//  2. without the donor (the published branch) the merged set lacks the authored clips but keeps the archetype
//     fallback the runtime falls back to (XAF_SET.nade in xAfTick);
//  3. offline real page (work/abil_anim_audit.cjs, AGENTS=Jett; behavioral - that harness serves no glbs): Cloudburst
//     requests the authored Smoke_Grenade_Outro and Tailwind the authored directional Dash clip (was: borrowed
//     flick / gaunt sets);
//  4. dash direction mapping from jDashKeys()-style input (the xCaStart wrapper formula).
//   node work/test_rocklan_fp.cjs
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');
let n=0;const fails=[];const ok=(c,m)=>{if(c)n++;else{fails.push(m);console.log('FAIL',m);}};
(async()=>{
 const {T,parse}=require('./valorant_rigs');
 const donor=path.join(root,'models/valorant/animations/fp-rocklan-jett.glb');
 const NEED=['FP_Wushu_S0_4_Smoke_Grenade_Intro','FP_Wushu_S0_4_Smoke_Loop','FP_Wushu_S0_4_Smoke_Grenade_Outro','FP_Wushu_S0_E_DashN','FP_Wushu_S0_E_DashE','FP_Wushu_S0_E_DashS','FP_Wushu_S0_E_DashW'];
 // ---- 1 + 2. rig-level merge -----------------------------------------------------------------------------------
 ok(fs.existsSync(donor),'donor glb present locally (fp-rocklan-jett.glb; local-only converted asset)');
 const [arms,don,abil]=await Promise.all([parse(path.join(root,'models/valorant/jett-fp.glb')),parse(donor),parse(path.join(root,'models/valorant/animations/FP_Abilities.glb'))]);
 const names=new Set(don.animations.map(a=>a.name));
 for(const c of NEED)ok(names.has(c),'donor clip '+c);
 const merge=withDonor=>{const clips={};(abil.animations||[]).forEach(c=>clips[c.name]=c);if(withDonor)(don.animations||[]).forEach(c=>{if(!clips[c.name])clips[c.name]=c;});(arms.animations||[]).forEach(c=>clips[c.name]=c);return clips;};
 const clips=merge(true);
 ok(clips['FP_Wushu_S0_X_Attack01']===arms.animations.find(a=>a.name==='FP_Wushu_S0_X_Attack01'),"donor never overrides the agent's own clips (X_Attack01 stays the shipped one)");
 const noDonor=merge(false);
 for(const c of NEED)ok(!noDonor[c],'donor absent: '+c+' not claimed');
 ok(!!noDonor['FP_Core_Grenade_OverhandThrow'],'donor absent: nade archetype fallback clip is present');
 // play the authored clips on the real rig: the hands must actually move, no NaN
 const play=(clip,bones)=>{const sc=clip.__scene||(clip.__scene=(()=>{const s=require('./valorant_rigs').T;return null})(),null);
  return null;};
 const scene=arms.scene;
 const travel=cname=>{const mx=new T.AnimationMixer(scene),c=clips[cname],a=mx.clipAction(c);a.play();
  const B=['R_Hand','L_Hand'].map(b=>scene.getObjectByName(b));let tr=0,prev=null,bad=0;
  for(let i=0;i<=20;i++){mx.setTime(c.duration*i/20);scene.updateMatrixWorld(true);const p=B.map(b=>{const w=b.getWorldPosition(new T.Vector3());if(!isFinite(w.x+w.y+w.z))bad++;return w.toArray();});
   if(prev)tr+=Math.max(...p.map((q,bi)=>Math.hypot(q[0]-prev[bi][0],q[1]-prev[bi][1],q[2]-prev[bi][2])));prev=p;}
  // accumulate the max per-step displacement across both hands (smoke throw is left-handed)
  mx.stopAllAction();mx.uncacheClip(c);return {tr,bad};};
 for(const c of ['FP_Wushu_S0_E_DashN','FP_Wushu_S0_E_DashE','FP_Wushu_S0_4_Smoke_Grenade_Outro','FP_Wushu_S0_4_Smoke_Grenade_Intro']){
  const {tr,bad}=travel(c);ok(tr>0.02&&bad===0,c+' plays on the jett-fp rig (hand travel '+tr.toFixed(3)+' m'+(bad?', '+bad+' NaN samples':'')+')');}
 // dash directions differ: N and E do not pose the same arm
 {const p=cname=>{const mx=new T.AnimationMixer(scene),a=mx.clipAction(clips[cname]);a.play();mx.setTime(clips[cname].duration*0.5);scene.updateMatrixWorld(true);const w=scene.getObjectByName('R_Hand').getWorldPosition(new T.Vector3()).toArray();mx.stopAllAction();mx.uncacheClip(clips[cname]);return w;};
  const dN=p('FP_Wushu_S0_E_DashN'),dE=p('FP_Wushu_S0_E_DashE');
  ok(Math.hypot(dN[0]-dE[0],dN[1]-dE[1],dN[2]-dE[2])>0.02,'dash N and E are different poses (mid-clip R_Hand '+Math.hypot(dN[0]-dE[0],dN[1]-dE[1],dN[2]-dE[2]).toFixed(3)+' m apart)');}
 // ---- 1b. the other wired agents' donors (phoenix / sage / reyna / omen) -----------------------------------------
 const AG={
  phoenix:['FP_Phoenix_S0_Q_Wall_Equip','FP_Phoenix_S0_Q_Wall_Fire','FP_Phoenix_S0_E_FlashBang_ThrowRight','FP_Phoenix_S0_E_FlashBang_ThrowLeft','FP_Phoenix_S0_4_FireBomb_Equip','FP_Phoenix_S0_4_FireBomb_Idle'],
  sage:['FP_Thorne_S0_E_Wall_Cast','FP_Thorne_S0_4_SlowGrenade_Activate','FP_Thorne_S0_Q_Self_Cast','FP_Thorne_S0_Q_Ally_Cast','FP_Thorne_S0_X_Resurrect_Activate'],
  reyna:['FP_Vampire_S0_4_Cast','FP_Vampire_S0_Q_Activate','FP_Vampire_S0_E_Escape_Activate','FP_Vampire_S0_X_Steroid_Cast'],
  omen:['FP_Wraith_S0_Q_DarkSight_Fire','FP_Wraith_4_SmokeMissile_Activate','FP_Wraith_S0_X_Teleport_Activate','FP_Wraith_S0_E_ShortTeleport_Equip'],
  killjoy:['FP_Killjoy_S0_Q_Equip','FP_Killjoy_S0_Q_Cast','FP_Killjoy_S0_E_Equip','FP_Killjoy_S0_E_Cast'],
  raze:['FP_Clay_Quickcast_C4'],
  skye:['FP_Guide_S0_4_Heal_Equip','FP_Guide_S0_4_Heal_Cast_Activate','FP_Guide_S0_X_Ult_Equip','FP_Guide_S0_X_Ult_Cast'],
  breach:['FP_Breach_S0_4_FusionBlast_Fire','FP_Breach_S0_Q_FlashBang_Fire','FP_Breach_S0_E_LineFissure_Fire','FP_Breach_S0_X_EarthShatter_Fire'],
  cypher:['FP_Gumshoe_S0_4','FP_Gumshoe_S0_Q_Equip','FP_Gumshoe_S0_Q_Fire','FP_Gumshoe_S0_X_Activate'],
 };
 const PLAY1={phoenix:'FP_Phoenix_S0_Q_Wall_Fire',sage:'FP_Thorne_S0_E_Wall_Cast',reyna:'FP_Vampire_S0_4_Cast',omen:'FP_Wraith_S0_Q_DarkSight_Fire',killjoy:'FP_Killjoy_S0_E_Cast',raze:'FP_Clay_Quickcast_C4',skye:'FP_Guide_S0_X_Ult_Cast',breach:'FP_Breach_S0_E_LineFissure_Fire',cypher:'FP_Gumshoe_S0_Q_Fire'};
 for(const ag of Object.keys(AG)){
  const dp=path.join(root,'models/valorant/animations/fp-rocklan-'+ag+'.glb');
  ok(fs.existsSync(dp),'donor glb present locally (fp-rocklan-'+ag+'.glb; local-only converted asset)');
  const [a2,d2]=await Promise.all([parse(path.join(root,'models/valorant/'+ag+'-fp.glb')),parse(dp)]);
  const dn=new Set(d2.animations.map(x=>x.name));
  for(const c of AG[ag])ok(dn.has(c),ag+' donor clip '+c);
  const merged={};(abil.animations||[]).forEach(c=>merged[c.name]=c);d2.animations.forEach(c=>{if(!merged[c.name])merged[c.name]=c;});(a2.animations||[]).forEach(c=>merged[c.name]=c);
  let kept=0,own=0;for(const c of a2.animations||[])if(dn.has(c.name)){own++;if(merged[c.name]===c)kept++;}
  ok(kept===own,ag+': donor never overrides the agent\'s own clips ('+kept+'/'+own+')');
  const sc2=a2.scene,c2=merged[PLAY1[ag]];
  const mx=new T.AnimationMixer(sc2),act=mx.clipAction(c2);act.play();
  const B=['R_Hand','L_Hand'].map(b=>sc2.getObjectByName(b));let tr=0,prev=null,bad=0;
  for(let i=0;i<=20;i++){mx.setTime(c2.duration*i/20);sc2.updateMatrixWorld(true);const p=B.map(b=>{const w=b.getWorldPosition(new T.Vector3());if(!isFinite(w.x+w.y+w.z))bad++;return w.toArray();});
   if(prev)tr+=Math.max(...p.map((q,bi)=>Math.hypot(q[0]-prev[bi][0],q[1]-prev[bi][1],q[2]-prev[bi][2])));prev=p;}
  mx.stopAllAction();mx.uncacheClip(c2);
  ok(tr>0.02&&bad===0,ag+' '+PLAY1[ag]+' plays on the real '+ag+'-fp rig (hand travel '+tr.toFixed(3)+' m)');
 }
 // ---- 3. offline real page (behavioral) ------------------------------------------------------------------------
 {const r=cp.spawnSync(process.execPath,[path.join(__dirname,'abil_anim_audit.cjs')],{env:{...process.env,AGENTS:'Jett'},encoding:'utf8',timeout:240000});
  ok(r.status===0,'Jett audit runs ('+String(r.stderr||'').slice(-120)+')');
  if(r.status===0){const out=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));const c=out.Jett.c.press,e=out.Jett.e.press;
   ok(c.clips.includes('FP_Wushu_S0_4_Smoke_Grenade_Outro'),'Jett C requests the authored Cloudburst throw: '+c.clips.join(','));
   ok(e.clips.includes('FP_Wushu_S0_E_DashN'),'Jett E (no move keys -> forward) requests the authored dash: '+e.clips.join(','));
   ok(c.xca&&e.xca,'both casts run through the quick-cast window');}}
 {const WANT={Phoenix:{c:'FP_Phoenix_S0_Q_Wall_Fire',e:'FP_Phoenix_S0_E_FlashBang_ThrowRight'},
  Sage:{c:'FP_Thorne_S0_E_Wall_Cast',q:'FP_Thorne_S0_4_SlowGrenade_Activate',e:'FP_Thorne_S0_Q_Self_Cast',x:'FP_Thorne_S0_X_Resurrect_Activate'},
  Reyna:{c:'FP_Vampire_S0_4_Cast',x:'FP_Vampire_S0_X_Steroid_Cast'}, // Devour / Dismiss need a soul orb in range: the plain audit never fires them (rig-level checks above still cover their clips)
  Omen:{q:'FP_Wraith_S0_Q_DarkSight_Fire',e:'FP_Wraith_4_SmokeMissile_Activate'},
  Killjoy:{q:'FP_Killjoy_S0_Q_Cast',e:'FP_Killjoy_S0_E_Cast'},
  Raze:{q:'FP_Clay_Quickcast_C4'},
  Skye:{c:'FP_Guide_S0_4_Heal_Cast_Activate',x:'FP_Guide_S0_X_Ult_Cast'},
  Breach:{c:'FP_Breach_S0_4_FusionBlast_Fire',q:'FP_Breach_S0_Q_FlashBang_Fire',e:'FP_Breach_S0_E_LineFissure_Fire',x:'FP_Breach_S0_X_EarthShatter_Fire'},
  Cypher:{q:'FP_Gumshoe_S0_4',e:'FP_Gumshoe_S0_Q_Fire',x:'FP_Gumshoe_S0_X_Activate'}};
  const r=cp.spawnSync(process.execPath,[path.join(__dirname,'abil_anim_audit.cjs')],{env:{...process.env,AGENTS:Object.keys(WANT).join(',')},encoding:'utf8',timeout:240000});
  ok(r.status===0,'Phoenix/Sage/Reyna/Omen audit runs ('+String(r.stderr||'').slice(-120)+')');
  if(r.status===0){const out=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
   for(const ag of Object.keys(WANT))for(const k of Object.keys(WANT[ag])){
    const rec=out[ag]&&out[ag][k]&&(out[ag][k].press||out[ag][k]);
    ok(rec&&rec.clips&&rec.clips.includes(WANT[ag][k]),ag+' '+k.toUpperCase()+' requests the authored clip '+WANT[ag][k]+': '+(rec&&rec.clips?rec.clips.join(','):'no press recorded'));}}}
 // ---- 4. dash direction mapping (xCaStart wrapper formula) ------------------------------------------------------
 const dir=(f,s)=>{const i=Math.round(((Math.atan2(-s,f)/(Math.PI/2))+4)%4)%4;return ['N','W','S','E'][i];};
 ok(dir(1,0)==='N'&&dir(-1,0)==='S'&&dir(0,1)==='E'&&dir(0,-1)==='W','dash keys -> N/E/S/W ('+[dir(1,0),dir(-1,0),dir(0,1),dir(0,-1)].join(',')+')');
 ok(['N','E'].includes(dir(1,1))&&['S','E'].includes(dir(-1,1))&&['S','W'].includes(dir(-1,-1))&&['N','W'].includes(dir(1,-1)),'diagonal dashes resolve to cardinal clips');
 if(fails.length){console.error(fails.length+' FAILURES');process.exit(1);}
 console.log('PASS test_rocklan_fp ('+n+' checks)');
})().catch(e=>{console.error(e);process.exit(1);});
