// Offline bot movement must share the player's stop/shoot rhythm instead of exponentially skating into idle.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('../vendor/valorant-feel.js'),html=fs.readFileSync(__dirname+'/../index.html','utf8');
const src=html.slice(html.indexOf('function xSmV('),html.indexOf('function botWalk('));
const c={window:{ValorantFeel:M},XS_V:[0,0],vRunK:w=>w==='Operator'?.76:w==='Knife'?1:.8};
vm.createContext(c);vm.runInContext(src,c);
function step(u,x,z,dt,limit=c.botRun(u,false)){const v=c.xSmV(u,dt,x,z,limit);u.x=(u.x||0)+v[0]*dt*limit;u.z=(u.z||0)+v[1]*dt*limit;u.spd=Math.hypot(u.smMotor.vx,u.smMotor.vz);return v;}
const rows=[];
for(const hz of [20,30,60,120,240]){
 const u={w:'Vandal'};for(let i=0;i<hz;i++)step(u,1,0,1/hz);
 assert(Math.abs(u.svx*5.4-5.4)<1e-8,'rifle reaches run speed');const x=u.x;
 let stop=0;while(u.svx>1e-8&&stop<.5){step(u,0,0,1/hz);stop+=1/hz;}
 assert(stop>=.08&&stop<.084+1/hz,'hard rest after release at '+hz+' Hz: '+stop);
 assert(Math.abs((u.x-x)-.2034)<.002,'same stop distance at '+hz+' Hz');
 const r={w:'Vandal'};for(let i=0;i<hz;i++)step(r,1,0,1/hz);
 let cross=0;while(r.svx>0&&cross<.5){step(r,-1,0,1/hz);cross+=1/hz;}
 assert(cross<=stop+1e-8,'counter-strafe crosses zero before release rest');
 // A 0.15 s out / 0.15 s back / 0.2 s hold jiggle finishes truly stationary and can shoot.
 const jig={w:'Vandal'};for(const [seconds,dir] of [[.15,1],[.15,-1],[.2,0]]){
  for(let left=seconds;left>1e-8;){const dt=Math.min(left,1/hz);step(jig,dir,0,dt);left-=dt;}
 }
 assert(Math.hypot(jig.svx,jig.svz)<1e-8&&c.botStopped(jig),'jiggle hold does not skate');
 rows.push(`${hz} Hz ${Math.round(stop*1000)} ms / ${(u.x-x).toFixed(4)} m`);
}
// Walking / tagging use the physical speed before integrating, just as the player does.
for(const speed of [3.24,1.485,2]){
 const u={w:'Vandal'};for(let i=0;i<240;i++)step(u,1,0,1/240,speed);
 const x=u.x,expected=M.brake(speed,0,1);let rest=0;
 while(u.spd>1e-8&&rest<.2){step(u,0,0,1/240,speed);rest+=1/240;}
 assert(Math.abs(u.x-x-expected.d)<1e-8,'actual-speed brake distance '+speed);
 assert(Math.abs(rest-expected.t)<=1/240,'actual-speed brake duration '+speed);
}
const crouched={w:'Vandal',cr:true};step(crouched,1,0,.2,2);assert(Math.abs(crouched.spd-2*.2/M.C.crouchAccelTime)<1e-9,'crouched bot has the shared slower acceleration');
// Execute the shipped enemy post-move block: a low frame-average must not authorize a fast endpoint shot.
const motion=html.slice(html.indexOf('const bx0 = p.x, bz0 = p.z;'),html.indexOf('    b.fs =',html.indexOf('const bx0 = p.x, bz0 = p.z;')));
assert(motion.includes('b.smMotor.vx'),'shipped bot loop consumes motor velocity');
const u={w:'Vandal',smMotor:{vx:-.95,vz:0}},dt=.05,v=c.xSmV(u,dt,-1,0,5.4);
Object.assign(c,{b:u,p:{x:0,y:0,z:0},vx:v[0],vz:v[1],bs:5.4*dt,dt,blocked:()=>false});vm.runInContext('{'+motion+'}',c);
assert(Math.abs(c.p.x/dt)<5.4*M.C.deadzone,'test frame-average is inside the firing deadzone');
assert(u.spd>5.4*M.C.deadzone&&!c.botStopped(u),'endpoint speed prevents inaccurate acceleration shot');
assert(u.sf>M.C.deadzone,'spread sees endpoint speed');
// A collision zeroes the blocked component before the fire gate; the bot cannot keep invisible wall momentum.
c.blocked=()=>true;vm.runInContext('{'+motion+'}',c);assert.equal(u.spd,0);assert.equal(u.smMotor.vx,0);
for(const w of ['Vandal','Operator']){
 const u={w},limit=c.botRun(u,false)*(w==='Operator'?M.C.operatorDeadzone:M.C.deadzone);
 u.spd=limit-.001;assert(c.botStopped(u),w+' can shoot inside its movement deadzone');
 u.spd=limit+.001;assert(!c.botStopped(u),w+' must stop outside its movement deadzone');
}
const diag={w:'Vandal'};for(let i=0;i<120;i++)step(diag,1,1,1/120);
assert(Math.hypot(diag.svx,diag.svz)<=1+1e-9,'diagonal directions normalized before acceleration');
assert(!html.includes('BOT_STOP'),'no fixed rifle-only fire threshold');
for(const u of ['a','b']){
 assert(html.includes(`botStopped(${u})`),'ally and enemy both use weapon stop gate');
 assert(html.includes(`${u}.sf = ${u}.spd / botRun(${u}, false); ${u}.mv = ${u}.spd > 0.25;`),'spread and animation use measured speed');
}
// Reused deathmatch bot objects must start their new life without the previous strafe velocity.
const spawn=html.slice(html.indexOf('function dmSpawnB('),html.indexOf('// a DM unit that is alive',html.indexOf('function dmSpawnB(')));
Object.assign(c,{dmSpot:()=>[10,20],FV:{tdm:false},dmBW:()=>'Vandal',performance:{now:()=>0},dmLive:()=>{},Math});
vm.runInContext(spawn,c);const reborn={g:{position:{}},smMotor:{vx:5,vz:1},svx:1,svz:1};c.dmSpawnB(reborn);assert.equal(reborn.smMotor,null);assert.equal(reborn.spd,0);
console.log('bot stop/peek rhythm: '+rows.join('; ')+'; counter-strafe, stationary jiggle holds, diagonal cap, Vandal/Operator accuracy gates passed');
