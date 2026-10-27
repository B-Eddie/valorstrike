// The Rocklan gait cycles run at the ground speed: with the support-foot IK off, the planted foot's speed relative to the body
// during real sole contact matches the unit's ground speed (k = foot / ground = 1 means no slip; > 1 moonwalks, < 1 skates).
// Before the stride calibration (calibrate_rocklan_stride.cjs) the builder's naturalSpeed estimate gave k 1.12-1.52 (run S 1.52).
// Measured with the same witness (contact point or ankle) the calibration used for that clip.
// QA_FULL=1 checks all 12 rigs x 40 directional gait clips (~5 min); default: 3 rigs x every gait and direction.
'use strict';
const assert=require('node:assert/strict');
const {runtime}=require('./rocklan_movement_harness.cjs');
const {measure,GAITS,DIRS}=require('./calibrate_rocklan_stride.cjs');
const RIGS=process.env.QA_FULL?['jett','phoenix','sova','sage','reyna','raze','killjoy','omen','skye','chamber','breach','cypher']:['jett','breach','killjoy'];
(async()=>{
 const c=await runtime(),bad=[];let n=0,worst=0;
 for(const slug of RIGS)for(const gait of Object.keys(GAITS))for(let d=0;d<8;d++){
  const m=c.packed.movement.h.agents[slug].clips.find(x=>x.name===gait+DIRS[d]),r=await measure(c,slug,gait,d,120,m.contact.stanceWitness),k=r.foot/r.speed;n++;worst=Math.max(worst,Math.abs(k-1));
  assert(r.samples>=15,slug+' '+gait+DIRS[d]+' has real stance samples ('+r.samples+')');
  if(!(Math.abs(k-1)<=.08))bad.push(slug+' '+gait+DIRS[d]+' k='+k.toFixed(3));
 }
 assert.equal(bad.length,0,'support foot slips against the ground (|k-1| > 0.08): '+bad.join(', '));
 console.log('rocklan stride: '+n+' rig/gait/direction cycles, worst |k-1| '+worst.toFixed(3));
})().catch(e=>{console.error(e);process.exitCode=1;});
