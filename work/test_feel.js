// Physical behavior checks, independent of renderer and frame rate.
const assert=require('node:assert/strict'),M=require('../vendor/valorant-feel'),stats=require('../models/valorant/weapon-calibration.json').weapons;
const world={ground:()=>0,blocked:()=>false},fresh=()=>({x:0,y:0,z:0}),input={x:1,z:0,speed:5.4};let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++;}function near(a,b,t,msg){ok(Math.abs(a-b)<t,`${msg}: ${a} vs ${b}`);}
function sim(P,I,seconds,hz=128,W=world){for(let n=0;n<Math.round(seconds*hz);n++)M.step(P,I,1/hz,W);return P;}
const runs=[];for(const hz of [30,60,128,144,240]){const P=sim(fresh(),input,2,hz);runs.push(P.x);near(P.speed,5.4,.001,'rifle speed');const stopX=P.x;sim(P,{...input,x:0},.2,hz);near(P.speed,0,.001,'release reaches rest');ok(P.x-stopX<.2,'short stopping distance');const D=sim(fresh(),{...input,z:1},2,hz);near(Math.hypot(D.x,D.z),runs.at(-1),.001,'diagonals do not accelerate');}
near(Math.max(...runs),Math.min(...runs),.001,'frame-independent displacement');
for(const [name,p]of Object.entries(stats)){const P=sim(fresh(),{...input,speed:6.75*p.runSpeedMultiplier},1);near(P.speed,6.75*p.runSpeedMultiplier,.001,name+' run');}
for(const [extra,k]of [[{walk:true},.6],[{duck:true},.45],[{walk:true,duck:true},.45],[{tag:.275},.275]])near(sim(fresh(),{...input,...extra},2).speed,5.4*k,.001,'stance/tag multiplier');
const j=fresh();let apex=0,landings=0;for(let n=0;n<256;n++){const r=M.step(j,{...input,jump:true},1/128,world);apex=Math.max(apex,j.y);landings+=r.landed?1:0;}near(apex,1.1946,.003,'jump height');ok(landings===1,'holding jump does not auto-hop');near(j.y,0,.001,'lands');
const landing=fresh();let landed=false;for(let n=0;n<120;n++){const r=M.step(landing,{...input,jump:n===0},1/128,world);if(r.landed){landed=true;break;}}ok(landed&&landing.lp>0,'landing accuracy lock');ok(M.spread(landing,'Vandal',stats.Vandal)>M.spread({sf:0},'Vandal',stats.Vandal),'landing affects accuracy');
const wall={...world,blocked:(x)=>x>.6};const slide=sim(fresh(),{...input,z:1},1,128,wall);ok(slide.x<=.6&&slide.z>3,'wall sliding');
const stairs={ground:(x,z,y)=>{const h=Math.max(0,Math.min(4,Math.floor((x+1e-7)/.6)))*.18;return h<=y+.32?h:0;},blocked:(x,z,r,y)=>{const h=Math.max(0,Math.min(4,Math.floor((x+1e-7)/.6)))*.18;return y<h-.02;}};
const climber=sim(fresh(),input,1,128,stairs);ok(climber.x>3&&Math.abs(climber.y-.72)<.02,'walk up low stairs');
const highBox={ground:(x,z,y)=>x>.6&&1<=y+.32?1:0,blocked:(x,z,r,y)=>x>.6&&y<.99};const boxStop=sim(fresh(),input,1,128,highBox);ok(boxStop.x<=.6&&boxStop.y===0,'tall box still blocks walking');
const ceiling={...world,ceiling:(_x,_z,_low,high)=>high>2.05};const c=fresh();let top=0;for(let n=0;n<80;n++){M.step(c,{...input,jump:n===0},1/128,ceiling);top=Math.max(top,c.y);}ok(top<.27,'ceiling stops ascent');
const crouched=sim(fresh(),{...input,x:0,duck:true},1);sim(crouched,{...input,x:0},1,128,{...world,ceiling:(_x,_z,low,high)=>low<1.5&&high>=1.5});near(crouched.ch,.45,.001,'ceiling prevents uncrouching');
const stand=M.spread({sf:0},'Vandal',stats.Vandal);near(stand,Math.tan(.25*Math.PI/180),1e-10,'published first shot error');near(M.spread({sf:.27},'Vandal',stats.Vandal),stand,1e-10,'27.5% deadzone');ok(M.spread({sf:.28},'Vandal',stats.Vandal)>stand,'moving inaccuracy above deadzone');ok(M.spread({sf:.16,ads:1},'Operator',stats.Operator)>0,'Operator 15% deadzone');near(M.spread({sf:0,ads:1},'Operator',stats.Operator),0,1e-10,'scoped Operator settled');
near(2*Math.atan(Math.tan(M.C.verticalFov*Math.PI/360)*16/9)*180/Math.PI,103,1e-9,'103 horizontal FOV');
const ledge={ground:()=>0,blocked:(x,z,r,y)=>x<.4&&y<.25};const settle={x:0,y:.6,z:0,vy:-2};M.step(settle,{x:0,z:0,speed:5.4},.1,ledge);ok(!ledge.blocked(settle.x,settle.z,.4,settle.y),'descending capsule never settles inside adjacent riser');ok(settle.y>=.25,'capsule finds safe vertical support');
console.log(`${checks} movement and accuracy checks passed`);
