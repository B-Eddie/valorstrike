// Crouch-jump (VALORANT jump-crouch onto boxes): crouching in the air tucks the capsule up from the feet (the centre stays,
// as Unreal's Crouch() does while falling), so a box higher than a standing jump's 1.165 m apex is reachable; standing up
// over the box drops the feet onto it; the camera drops only half as far as a grounded crouch. Shared motor only
// (server/src/motor.cjs == vendor/valorant-feel.js), run at the server's and the page's tick rates.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),V=require('../vendor/valorant-feel.js'),S=require('../server/src/motor.cjs');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},near=(a,b,t,m)=>ok(Math.abs(a-b)<=t,`${m}: ${a} vs ${b}`);
ok(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8')===fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'motor == vendor');
// A box face at x = X0 spanning every z, top at H. ground(x,z,y): highest floor at or below y (+ the probes' 0.32 tolerance, as
// test_feel's highBox); blocked: a 0.4 m capsule (feet y, height h) overlapping the box.
const box=(H,X0=3)=>({ground:(x,z,y)=>x>=X0&&H<=y+.32?H:0,blocked:(x,z,r,y,h=1.8)=>x+r>X0&&y<H-1e-4&&y+h>0});
const RUN={x:1,z:0,speed:5.4};
// Run at the box from x = 0; jump when the capsule centre reaches X0 - d; crouch from the jump tick on (duck) or never.
// releaseAt: stop crouching once the centre passes this x (stand up over the box).
function attempt(H,d,duck,hz,releaseAt){const W=box(H),P={x:0,y:0,z:0};let jumped=false,t=0,maxFeet=0,eye=[];
 while(t<4){const pre=!jumped&&P.x>=3-d,j=pre||(jumped&&false);if(pre)jumped=true;
  const crouch=duck&&jumped&&!(releaseAt!=null&&P.x>releaseAt);
  V.step(P,{...RUN,jump:pre,duck:crouch},1/hz,W);t+=1/hz;maxFeet=Math.max(maxFeet,P.y);eye.push(P.y+1.6-(P.ch||0));
  ok(!W.blocked(P.x,P.z,.38,P.y,1.8-(P.ch||0)),'capsule never ends inside the box');if(P.x>4.5)break;}
 return {P,onTop:P.x>3.3&&Math.abs(P.y-H)<.02,maxFeet,eye};}
const sweep=(H,duck,hz,rel)=>{const r=[];for(let d=.2;d<=3;d+=.05){const a=attempt(H,d,duck,hz,rel);if(a.onTop)r.push(d);}return r;};
// 1.30 m: above the standing apex (1.165 m), below apex + the 0.225 m tuck.
const H=1.30;
for(const hz of [40,60,128,144]){
 ok(sweep(H,false,hz).length===0,`${hz} Hz: a 1.30 m box cannot be climbed with a plain jump`);
 const cj=sweep(H,true,hz);ok(cj.length>0,`${hz} Hz: a 1.30 m box is climbable with crouch-jump (jump + crouch)`);
 // stand up over the box: the feet drop onto it (the release-on-contact step of the trick)
 const rel=sweep(H,true,hz,3.45);ok(rel.length>0,`${hz} Hz: crouch-jump then release over the box lands standing on it`);
}
// Tuck height: a standing jump with crouch held from take-off peaks 0.225 m higher at the feet (centre unchanged).
{const flat={ground:()=>0,blocked:()=>false};let a=0,b=0,ca=0,cb=0;const P={x:0,y:0,z:0},Q={x:0,y:0,z:0};
 for(let n=0;n<128;n++){V.step(P,{x:0,z:0,speed:5.4,jump:n===0},1/128,flat);V.step(Q,{x:0,z:0,speed:5.4,jump:n===0,duck:n>0},1/128,flat);
  a=Math.max(a,P.y);b=Math.max(b,Q.y);ca=Math.max(ca,P.y+(1.8-(P.ch||0))/2);cb=Math.max(cb,Q.y+(1.8-(Q.ch||0))/2);}
 near(a,1.1647,.004,'plain jump apex');near(b-a,.225,.01,'air crouch lifts the feet by half the crouch (0.225 m)');near(cb,ca,.004,'capsule centre follows the same arc');
 // camera: grounded crouch drops the eye 0.45 m; an air crouch drops it 0.225 m relative to the standing jump
 let ea=0,eb=0;const P2={x:0,y:0,z:0},Q2={x:0,y:0,z:0};for(let n=0;n<40;n++){V.step(P2,{x:0,z:0,speed:5.4,jump:n===0},1/128,flat);V.step(Q2,{x:0,z:0,speed:5.4,jump:n===0,duck:n>0},1/128,flat);}
 ea=P2.y+1.6-(P2.ch||0);eb=Q2.y+1.6-(Q2.ch||0);near(ea-eb,.225,.01,'air crouch camera drop is half the grounded drop');
 // already crouched before the jump: no tuck (the capsule base was on the floor), same feet apex as standing
 const R={x:0,y:0,z:0};for(let n=0;n<64;n++)V.step(R,{x:0,z:0,speed:5.4,duck:true},1/128,flat);let c=0;for(let n=0;n<128;n++){V.step(R,{x:0,z:0,speed:5.4,duck:true,jump:n===0},1/128,flat);c=Math.max(c,R.y);}
 near(c,a,.004,'crouched before the jump: feet apex as a standing jump');
 // ... and standing up mid-air extends the legs: the feet come down 0.225 m earlier than the centre arc
 const U={x:0,y:0,z:0};for(let n=0;n<64;n++)V.step(U,{x:0,z:0,speed:5.4,duck:true},1/128,flat);let land=null;for(let n=0;n<200&&land==null;n++){const r=V.step(U,{x:0,z:0,speed:5.4,duck:n<10,jump:n===0},1/128,flat);if(r.landed)land=n;}
 ok(land!=null&&land<86,'crouched jump + stand up mid-air lands sooner ('+land+' ticks vs 86)');
 // landing on the floor with the legs tucked is a landing (drop measured on the centre: no extra fall height from the tuck)
 const F={x:0,y:0,z:0};let r0=null;for(let n=0;n<200&&!r0;n++){const r=V.step(F,{x:0,z:0,speed:5.4,duck:n>0,jump:n===0},1/128,flat);if(r.landed)r0=r;}ok(r0&&Math.abs(r0.drop-.225-a)<.01||(r0&&r0.drop<=a+.235),'tucked landing reports a sane drop');}
// Related VALORANT behaviours (crouch spam, jump-peek, counter-strafe) still hold with the air tuck.
{const flat={ground:()=>0,blocked:()=>false},sim=(P,I,sec,hz=128)=>{for(let n=0;n<Math.round(sec*hz);n++)V.step(P,typeof I==='function'?I(n):I,1/hz,flat);return P;};
 // counter-strafe stops a rifle run faster than releasing the keys (friction + acceleration vs friction)
 const stopT=(I)=>{const P=sim({x:0,y:0,z:0},RUN,1,240);let t=0;while(P.speed>1e-6&&t<1){V.step(P,I,1/240,flat);t+=1/240;if(I.x<0&&P.vx<=0)break;}return t;};
 const rel=stopT({...RUN,x:0}),cs=stopT({...RUN,x:-1});near(rel,.084,.006,'release stop 84 ms');ok(cs<rel-.01,'counter-strafe stops faster ('+cs.toFixed(3)+' s)');
 // crouch spam: toggling every 60 ms keeps working (head goes down and up) but fatigue slows each transition
 const Q=sim({x:0,y:0,z:0},n=>({x:0,z:0,speed:5.4,duck:Math.floor(n/8)%2===0}),2);ok(Q.duckFatigue>.1,'crouch spam builds fatigue');
 const F={x:0,y:0,z:0,duckFatigue:Q.duckFatigue},G={x:0,y:0,z:0};sim(F,{x:0,z:0,speed:5.4,duck:true},.1);sim(G,{x:0,z:0,speed:5.4,duck:true},.1);ok(F.ch<G.ch,'a spammed crouch is slower than a fresh one');
 // crouch spam in the air never adds height: the centre keeps the ballistic arc
 let cTop=0,cRef=0;const A={x:0,y:0,z:0},B={x:0,y:0,z:0};for(let n=0;n<90;n++){V.step(A,{x:0,z:0,speed:5.4,jump:n===0,duck:n>0&&Math.floor(n/5)%2===0},1/128,flat);V.step(B,{x:0,z:0,speed:5.4,jump:n===0},1/128,flat);cTop=Math.max(cTop,A.y+(1.8-(A.ch||0))/2);cRef=Math.max(cRef,B.y+.9);}
 ok(cTop<=cRef+1e-6,'air crouch spam: centre never above the plain arc');
 // jump-peek: eye peaks 1.165 m over the standing eye and is back on the ground in 0.675 s while strafing
 const J={x:0,y:0,z:0};let eTop=0,tLand=null;for(let n=0;n<200&&tLand==null;n++){const r=V.step(J,{x:0,z:1,speed:5.4,jump:n===0},1/240,flat);eTop=Math.max(eTop,J.y+1.6-(J.ch||0));if(r.landed)tLand=(n+1)/240;}
 near(eTop-1.6,1.165,.005,'jump-peek eye apex');near(tLand,.675,.01,'jump-peek airtime');}
// Server tick vs page prediction: the same input stream at 40 Hz (server) and 60/144 Hz (page) ends on the box within 2 cm.
{const finals=[40,60,144].map(hz=>{const d=sweep(H,true,128)[Math.floor(sweep(H,true,128).length/2)];return attempt(H,d,true,hz).P;});
 for(const f of finals)ok(Math.abs(f.y-H)<.02,'every tick rate lands on the box');}
// server copy gives the identical trajectory (byte-identical files, separately required)
{const a={x:0,y:0,z:0},b={x:0,y:0,z:0},W=box(H);for(let n=0;n<300;n++){const I={...RUN,jump:n===20,duck:n>20};V.step(a,I,1/60,W);S.step(b,I,1/60,W);}ok(a.x===b.x&&a.y===b.y&&a.ch===b.ch,'server motor = page motor');}
console.log(`test_crouch_jump: ${checks} checks PASS`);
