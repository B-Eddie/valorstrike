// Dependency-free jump-feel bench. Run from any cwd; optional argv[2] selects a saved motor.
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const M=require(path.resolve(process.argv[2]||path.join(__dirname,'../vendor/valorant-feel.js')));
const world={ground:()=>0,blocked:()=>false},hz=128,dt=1/hz;
const fresh=()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0});
const input={x:1,z:0,speed:5.4};
function run(P,I,t,rate=hz){for(let n=0;n<Math.round(t*rate);n++)M.step(P,I,1/rate,world);return P;}
function arc(speed,rate){const P=run(fresh(),{...input,speed},1,rate),start=P.x;
 let apex=0,apexTime=0,lastVy=0,land=null;
 for(let n=0;n<rate*3;n++){const before=P.vy,r=M.step(P,{...input,speed,jump:n===0},1/rate,world);
  if(P.y>apex){apex=P.y;apexTime=(n+1)/rate;}lastVy=Math.min(lastVy,before);
  if(r.landed){land={time:(n+1)/rate,distance:P.x-start,speed:P.speed,lp:P.lp,ls:P.ls,impact:P.landImpact};break;}}
 if(!land)throw Error('No landing');
 const atLand={...P};let movementMs=0,accuracyMs=0;
 for(let n=0;n<rate;n++){M.step(P,{...input,speed},1/rate,world);if(!movementMs&&P.lp===0)movementMs=(n+1)*1000/rate;if(P.ls===0){accuracyMs=(n+1)*1000/rate;break;}}
 // Release after impact, then press: no recovery lock on another jump.
 const J={...atLand};M.step(J,{...input,speed,jump:false},1/rate,world);
 const reJump=M.step(J,{...input,speed,jump:true},1/rate,world).jumped;
 return {apexM:apex,apexTimeS:apexTime,airTimeS:land.time,distanceM:land.distance,lastAirborneVyMps:lastVy,landingSpeedMps:land.speed,
  landingTimerRecoveryMs:movementMs,landingAccuracyRecoveryMs:accuracyMs,reJumpAfterReleaseMs:reJump?2000/rate:null,landImpact:land.impact};}
function steering(kind,speed=5.4){const P={...fresh(),y:1000,vx:speed,air:true,takeoffSpeed:speed},samples=[];
 const I={...input,x:kind==='reverse'?-1:kind==='coast'?0:0,z:kind==='turn'?1:0,speed};let crossed=null,reached=null;
 for(let n=1;n<=hz*5;n++){M.step(P,I,dt,world);
  if(kind==='turn'&&crossed===null&&P.vz>=P.vx)crossed=n*dt;
  if(kind==='reverse'&&crossed===null&&P.vx<=0)crossed=n*dt;
  if(reached===null&&Math.hypot(P.vx-I.x*speed,P.vz-I.z*speed)<1e-6&&kind!=='coast')reached=n*dt;
  if([16,32,64].includes(n))samples.push({timeS:n*dt,vx:P.vx,vz:P.vz,speed:P.speed,angleDeg:Math.atan2(P.vz,P.vx)*180/Math.PI});}
 return {samples,crossedS:crossed,reachedTargetS:reached};}
function standingAirStart(moveOnTakeoff=false){const P=fresh();M.step(P,{...input,x:moveOnTakeoff?1:0,jump:true},dt,world);
 const samples=[];for(let n=1;n<=64;n++){M.step(P,input,dt,world);if([16,32,64].includes(n))samples.push({timeS:n*dt,vx:P.vx,distanceM:P.x});}return samples;}
function fall(height){const P={...fresh(),y:height,air:true};let max=0;for(let n=1;n<hz*10;n++){max=Math.max(max,-P.vy);const r=M.step(P,{...input,x:0},dt,world);if(r.landed)return {heightM:height,timeS:n*dt,lastAirborneFallSpeedMps:max,dropM:r.drop};}throw Error('No fall landing');}
function camera(){const s=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),i=s.indexOf('function vfCamDip('),fn=s.slice(i,s.indexOf('\n',i));
 const P={hp:100,air:false,landImpact:arc(5.4,128).landImpact},c={player:P,VF_CAM:{y:0,v:0,air:true},Math};vm.createContext(c);vm.runInContext(fn,c);
 let peak=0,settled=null;for(let n=1;n<hz*2;n++){c.vfCamDip(dt);peak=Math.min(peak,c.VF_CAM.y);if(n>8&&settled===null&&Math.abs(c.VF_CAM.y)<.001&&Math.abs(c.VF_CAM.v)<.01)settled=n*dt;}
 return {peakDipM:peak,settleS:settled,settleDefinition:'|dip| < 1 mm and |vertical camera velocity| < 1 cm/s'};}
function bufferedHops(rate){const P=fresh();let jumps=0,landings=0,midAirRelaunches=0;
 for(let n=0;n<rate*4;n++){const wasAir=P.air,y=P.y,r=M.step(P,{...input,jump:n%2===0},1/rate,world);jumps+=+r.jumped;landings+=+r.landed;if(r.jumped&&wasAir&&!r.landed&&y>1e-5)midAirRelaunches++;}
 return {hz:rate,jumps,landings,midAirRelaunches};}
const result={method:'flat collision-free world; actual shared motor, 128 Hz unless specified; run-up 1 s; time/displacement include the landing sample; fall speed is last airborne sample; steering isolated at y=1000 m',
 constants:M.C,analytic:{apexM:M.C.jumpSpeed**2/(2*M.C.gravity),apexTimeS:M.C.jumpSpeed/M.C.gravity,airTimeS:2*M.C.jumpSpeed/M.C.gravity,
 rifleDistanceM:5.4*2*M.C.jumpSpeed/M.C.gravity,knifeDistanceM:6.75*2*M.C.jumpSpeed/M.C.gravity,impactSpeedMps:M.C.jumpSpeed},
 arcs:[30,60,128,144,240].map(rate=>({hz:rate,rifle:arc(5.4,rate),knife:arc(6.75,rate)})),
 turn90:steering('turn'),reverse:steering('reverse'),coast:steering('coast'),standingAirStart:standingAirStart(),moveAndJumpFromRest:standingAirStart(true),falls:[fall(10),fall(20)],camera:camera(),bufferedHops:[30,60,128,144,240].map(bufferedHops)};
console.log(JSON.stringify(result,null,2));
