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
 // ---- 3. offline real page (behavioral) ------------------------------------------------------------------------
 {const r=cp.spawnSync(process.execPath,[path.join(__dirname,'abil_anim_audit.cjs')],{env:{...process.env,AGENTS:'Jett'},encoding:'utf8',timeout:240000});
  ok(r.status===0,'Jett audit runs ('+String(r.stderr||'').slice(-120)+')');
  if(r.status===0){const out=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));const c=out.Jett.c.press,e=out.Jett.e.press;
   ok(c.clips.includes('FP_Wushu_S0_4_Smoke_Grenade_Outro'),'Jett C requests the authored Cloudburst throw: '+c.clips.join(','));
   ok(e.clips.includes('FP_Wushu_S0_E_DashN'),'Jett E (no move keys -> forward) requests the authored dash: '+e.clips.join(','));
   ok(c.xca&&e.xca,'both casts run through the quick-cast window');}}
 // ---- 4. dash direction mapping (xCaStart wrapper formula) ------------------------------------------------------
 const dir=(f,s)=>{const i=Math.round(((Math.atan2(-s,f)/(Math.PI/2))+4)%4)%4;return ['N','W','S','E'][i];};
 ok(dir(1,0)==='N'&&dir(-1,0)==='S'&&dir(0,1)==='E'&&dir(0,-1)==='W','dash keys -> N/E/S/W ('+[dir(1,0),dir(-1,0),dir(0,1),dir(0,-1)].join(',')+')');
 ok(['N','E'].includes(dir(1,1))&&['S','E'].includes(dir(-1,1))&&['S','W'].includes(dir(-1,-1))&&['N','W'].includes(dir(1,-1)),'diagonal dashes resolve to cardinal clips');
 if(fails.length){console.error(fails.length+' FAILURES');process.exit(1);}
 console.log('PASS test_rocklan_fp ('+n+' checks)');
})().catch(e=>{console.error(e);process.exit(1);});
