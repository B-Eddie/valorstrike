// Split's rope ascenders (work/rope_runtime.js) mark a climbing unit with u.rope = 1-based rope index (bots: the shared motor's
// rope state; online: snapshot row [25]); the Rocklan layer only knew the legacy fallback-link flags (b.xkr / b.xk). A unit on an
// ascender must get the copied rope traversal poses (up / down / idle), never the falling pose, the landing dip at the top, or the
// support-foot IK (rope_runtime's climb pose owns the legs after the mixer).
'use strict';
const assert=require('node:assert/strict');
const {build}=require('./rocklan_movement_harness.cjs');
(async()=>{
 const R=await build('jett'),{X,b}=R;R.advance(60);
 b.rope=1;R.advance(30,{dy:2,floor:-5});
 assert(X.rm.targets.ropeUp>.95,'climbing an ascender plays the rope climb (ropeUp '+X.rm.targets.ropeUp+', fall '+X.rm.targets.fall+')');
 assert(!(X.rm.targets.fall>0),'no falling pose on the rope');
 assert(!(X.rm.plant&&X.rm.plant.active),'support-foot IK off on the rope');
 R.advance(20,{dy:-1.5,floor:-5});assert(X.rm.targets.ropeDown>.95,'sliding down plays the rope descent');
 R.advance(20,{floor:-5});assert(X.rm.targets.ropeIdle>.95,'hanging still plays the rope idle');
 b.rope=0;R.advance(5,{floor:-5});assert(X.rm.targets.fall>.95,'letting go mid-climb falls (fall '+X.rm.targets.fall+')');
 R.advance(20,{dy:-6,floor:-5});const p=R.position;R.frame(1/60,p.x,-5,p.z,0,{floor:-5});R.advance(60,{floor:-5});
 assert(X.rm.targets.idle>.95,'lands back to idle');
 b.rope=1;R.advance(30,{dy:2,floor:-5});const q=R.position;b.rope=0;R.frame(1/60,q.x,q.y,q.z,0,{floor:q.y});R.advance(30,{floor:q.y});
 assert(X.rm.targets.idle>.95&&!(X.rm.targets.ropeUp>0),'stepping off onto the ledge returns to idle');
 console.log('rocklan movement ropes: ascender climb / descend / hang / step-off');
})().catch(e=>{console.error(e);process.exitCode=1;});
