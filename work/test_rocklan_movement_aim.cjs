// The Rocklan crouch posture must not drag the gun off the aim. crouchSpine (EXTRAPOLATED: the Spine1-4 rotation difference
// between the pack's IdlePose_UB and CrouchPose_UB) also bent Spine2-4, which carry the arms, while the pack's arm/weapon curves
// that hold the gun level in that pose are (rightly) not copied: crouched, the shoulder->hand line dropped 25 deg below the standing
// aim (the native set drops 14.5 deg), so a crouching bot / remote player aimed at the floor. The crouch keeps its forward lean
// from the hips; the arms stay within 10 deg of the standing aim. Checked on three rigs, crouched still and crouch-walking.
'use strict';
const assert=require('node:assert/strict');
const {runtime,build}=require('./rocklan_movement_harness.cjs');
const pitch=R=>{const s=R.at('R_Shoulder'),d=R.at('R_Hand').sub(s);return Math.atan2(d.y,Math.hypot(d.x,d.z))*180/Math.PI;};
const lean=R=>{const t=R.at('Spine4').sub(R.at('Pelvis'));return Math.atan2(Math.hypot(t.x,t.z),t.y)*180/Math.PI;};
(async()=>{
 const c=await runtime(),rows=[];
 for(const slug of ['jett','breach','sage']){
  const R=await build(slug,c);R.advance(90);const stand=pitch(R),standLean=lean(R);
  R.advance(90,{cr:true});const crouch=pitch(R),crouchLean=lean(R);
  R.advance(90,{cr:true,speed:2});let walk=0;for(let i=0;i<30;i++){R.advance(1,{cr:true,speed:2});walk+=pitch(R)/30;}
  rows.push({slug,stand:+stand.toFixed(1),crouch:+crouch.toFixed(1),crouchWalk:+walk.toFixed(1),standLean:+standLean.toFixed(1),crouchLean:+crouchLean.toFixed(1)});
  assert(stand-crouch<=10,slug+' crouched gun drops '+(stand-crouch).toFixed(1)+' deg below the standing aim');
  assert(stand-walk<=10,slug+' crouch-walking gun drops '+(stand-walk).toFixed(1)+' deg below the standing aim');
  assert(crouchLean-standLean>=5,slug+' crouch still leans the torso forward ('+(crouchLean-standLean).toFixed(1)+' deg)');
 }
 console.log('rocklan crouch aim: '+JSON.stringify(rows));
})().catch(e=>{console.error(e);process.exitCode=1;});
