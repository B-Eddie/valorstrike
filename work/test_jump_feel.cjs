// Jump feel and prediction regressions; no renderer, packages, browser, or network required.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../vendor/valorant-feel.js'),S=require('../server/src/motor.cjs');
const root=path.join(__dirname,'..'),W={ground:()=>0,blocked:()=>false};
const fresh=()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0}),I={x:1,z:0,speed:5.4};
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
function run(P,input,t,hz=128){for(let n=0;n<Math.round(t*hz);n++)M.step(P,input,1/hz,W);return P;}
assert.equal(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'client/server motor byte parity');checks++;
for(const hz of [30,60,128,144,240]){
 // A jump while movement is starting must steer like a jump from rest, rather than inherit a tiny permanent cap.
 const P=fresh();M.step(P,{...I,jump:true},1/hz,W);run(P,I,.25,hz);
 ok(P.air&&P.vx>2.8&&P.vx<3.9,`${hz} Hz: move+jump from rest builds usable air speed (${P.vx})`);
 const R=fresh();M.step(R,{...I,x:0,jump:true},1/hz,W);run(R,I,.25,hz);
 ok(Math.abs(P.vx-R.vx)<.7,`${hz} Hz: starting movement on takeoff does not suppress air control`);
 // A committed run remains ballistic when keys are released; steer a run through 45 degrees before the apex.
 const T={...fresh(),y:1000,vx:5.4,air:true,takeoffSpeed:5.4};run(T,{...I,x:0,z:1},.25,hz);
 const angle=Math.atan2(T.vz,T.vx)*180/Math.PI;
 ok(angle>30&&angle<36,`${hz} Hz: controlled perpendicular turn responds within 250 ms (${angle} degrees)`);
 run(T,{...I,x:0,z:1},.09,hz);
 ok(T.vz>T.vx,`${hz} Hz: perpendicular steer crosses 45 degrees near the apex`);
 const C={...fresh(),y:1000,vx:5.4,air:true,takeoffSpeed:5.4};run(C,{...I,x:0},.5,hz);
 ok(Math.abs(C.vx-5.4)<1e-12&&C.vz===0,`${hz} Hz: no drag when coasting in air`);
 // Exercise the actual shared server API with changing inputs, tags and stance during repeated jumps.
 const A=fresh(),B=fresh();let top=0,landings=0,jumps=0,relaunches=0;
 for(let n=0;n<hz*4;n++){
  const a=n/hz*7,input={x:Math.cos(a),z:Math.sin(a),speed:6.75,jump:n%2===0,walk:n%19===0,duck:n%23===0,tag:n%29===0?.275:1};
  const wasAir=A.air,y=A.y,out=M.step(A,input,1/hz,W);S.step(B,input,1/hz,W);top=Math.max(top,A.speed);landings+=+out.landed;jumps+=+out.jumped;
  if(wasAir&&y>1e-5&&out.jumped&&!out.landed)relaunches++;
  assert.deepEqual(A,B,`${hz} Hz: prediction and authority agree each tick`);
 }
 ok(top<=6.75+1e-9&&landings>=4,`${hz} Hz: repeated jumps stay at or below melee speed`);
 ok(relaunches===0&&landings===jumps-1,`${hz} Hz: buffered hops make contact and emit every landing`);
 // The vertical arc and landing remain independent of the air-control tuning.
 const J=run(fresh(),I,1,hz);let apex=0,land=null;
 for(let n=0;n<hz*2;n++){const out=M.step(J,{...I,jump:n===0},1/hz,W);apex=Math.max(apex,J.y);if(out.landed){land={t:(n+1)/hz,speed:J.speed,lp:J.lp,ls:J.ls};break;}}
 ok(land&&Math.abs(apex-1.165)<.004&&Math.abs(land.t-.675)<1/hz,`${hz} Hz: measured Valorant arc retained`);
 ok(Math.abs(land.speed-5.4)<1e-9&&land.lp===undefined&&land.ls>0,`${hz} Hz: landing preserves running momentum (no landing movement lock: P.lp gone) and accuracy recovery`);
}
// Stance/weapon/tag targets still constrain a newly started jump; no jump grants knife speed to a slower stance.
for(const [extra,cap] of [[{},5.4],[{walk:true},3.24],[{duck:true},2],[{tag:.275},1.485]]){
 const P={...fresh(),y:1000,air:true,takeoffSpeed:.01,ch:extra.duck?.45:0};run(P,{...I,...extra},1);
 ok(P.speed<=cap+1e-9&&P.speed>cap-.01,'air target respects current weapon, stance and tag: '+JSON.stringify(extra));
}
// A reverse input can cancel a rifle run in one jump, but is weaker than grounded braking.
const R={...fresh(),y:1000,vx:5.4,air:true,takeoffSpeed:5.4};run(R,{...I,x:-1},.4);ok(R.vx>0,'air reversal does not provide grounded counter-strafe braking');
run(R,{...I,x:-1},.1);ok(R.vx<0,'air reversal cancels a rifle run before landing');
const H=fresh();let hops=0;for(let n=0;n<256;n++)hops+=+M.step(H,{...I,jump:true},1/128,W).jumped;
ok(hops===1,'holding jump still produces one jump');
console.log(`${checks} jump-feel checks passed, including per-tick prediction/authority parity at 30/60/128/144/240 Hz`);
