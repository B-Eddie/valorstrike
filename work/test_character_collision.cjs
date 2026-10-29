// Character collision on the page (work/collide_runtime.js = the CHARACTER COLLISION block of the generated index.html, the
// shared motor's bodies / bodySteer in vendor/valorant-feel.js; server side: server/test-bodies.js).
// User: "there's supposed to be collisions between characters" - the player and bots walked through each other.
//  1. wiring: the block is the generated copy and the last block; moveP calls xcPlayer right after the motor / dash step and
//     before the online wrapper records the predicted path (so the reconcile compares a pushed prediction with the pushed
//     server); tick / fiveTick / duelTick and xSmV are wrapped; locomotion animation functions are not touched.
//  2. player: walking into a bot stops at 2 x bodyR (the bot is not shoved), off-centre slides past, dead / online-driven off the trusted server
//     (nt) / fog-parked units and Reyna's Dismiss do not block, the aim range has no collision.
//  3. prediction = server: the page's player step (Motor.step + xcPlayer against the drawn unit) = the server Simulation's
//     human (Motor.step + bodies) tick by tick, so an online walk into a unit does not rubber-band.
//  4. offline bots: a bot walking into the player or another bot stops at the contact (the sim-step wrapper), two bots
//     walking head-on through the real xSmV (steer wrapper) pass each other, in the open and in a 2 m corridor; respawned /
//     teleported bots (> 2 m since the last resolve) are eased apart, not snapped.
//  5. online (trusted server): remote units are never moved by the page; the P2P host resolves its own bots, not remote humans.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'collide_runtime.js'),'utf8');
const A='// ---- CHARACTER COLLISION ----',Z='// ---- END CHARACTER COLLISION ----',i0=html.indexOf(A),i1=html.indexOf(Z,i0);assert(i0>0&&i1>i0,'character collision block in index.html');
const block=html.slice(i0,i1+Z.length);assert.equal(block,src.trimEnd(),'generated block == work/collide_runtime.js');assert.equal(html.split(A).length,2,'one block');
assert(html.indexOf('// ---- END ROPE ASCENDERS ----')<i0&&html.indexOf('xReady = true; // every mode')>i1,'collision block is the last block');
const vendor=fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8');assert.equal(vendor,fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'motor pair identical');
// 1. moveP wiring
{const a=html.indexOf('moveP=function(dt,run,hold){'),b=html.indexOf('\n};',a),mp=html.slice(a,b);assert(a>0,'feel moveP');
 const st=mp.indexOf('VF.model.step(P,'),ds=mp.indexOf('VF.model.dashStep(P,J.dash,dt,world)'),xc=mp.indexOf("xcPlayer(P,dt,world,bx0,bz0)"),ff=mp.indexOf('VF.model.footfall(');
 assert(st>0&&ds>st&&xc>ds&&ff>xc,'moveP: xcPlayer after the motor + dash step, before footfalls');assert(mp.indexOf('bx0=P.x,bz0=P.z')<st,'moveP: position before the step');
 const w=html.indexOf('{const move0=moveP;moveP=function(){if(NET.socket)netCorrect(arguments[0]);const r=move0.apply(this,arguments);if(NET.socket&&player){');assert(w>a,'online path recorded after the whole feel moveP (collision included)');}
for(const g of ['xUbAnim','xUbLoco','xUbW','xVisB','xBotAnim','xTpGait'])assert(!new RegExp('\\b'+g+'\\s*=').test(block),'block does not touch '+g);
for(const f of ['tick','fiveTick','duelTick','xSmV'])assert(new RegExp('\\b'+f+' = function').test(block),f+' wrapped');
// sandbox: the real xSmV (shared-motor acceleration), the block, stub world / units
const fn=name=>{const a=html.indexOf('function '+name+'(');assert(a>=0,name);const lines=html.slice(a).split('\n'),out=[];let d=0;for(const l of lines){out.push(l);for(const ch of l){if(ch==='{')d++;else if(ch==='}')d--;}if(d<=0)break;}return out.join('\n');};
const Motor=require(path.join(root,'vendor/valorant-feel.js')),R2=2*Motor.C.bodyR,MIN=R2-1e-6;
const mk=()=>{const ctx={window:{},console,Math,Number,Array,Object,performance:{now:()=>0}};ctx.window.ValorantFeel=Motor;ctx.window.window=ctx.window;vm.createContext(ctx);
 vm.runInContext(`var running=true,mode='five',paused=false,player=null,bots=[],allies=[],J={dis:0},MP={on:false,role:null},WALL=null,steps=[];const XS_V=[0,0];
 function blocked(x,z,r,y){return WALL?WALL(x,z,r):false;}function botRun(){return 5.4;}
 function tick(dt){for(const f of steps)f(dt);}function fiveTick(dt){for(const f of steps)f(dt);}function duelTick(dt){for(const f of steps)f(dt);}
 ${fn('xSmV')}
 ${block}`,ctx);return ctx;};
const V=(x,y,z)=>({x,y,z});const bot=(x,z,o={})=>Object.assign({g:{position:V(x,0,z)},alive:true,hp:100,cr:false},o);
const pl=(x,z)=>({x,y:0,z,vx:0,vy:0,vz:0,ch:0,hp:100,air:false});
const W0={ground:()=>0,blocked:()=>false,leash:null,ceiling:null,ropes:null};
const stepP=(c,P,dirX,dirZ,dt=1/60,speed=6.75*.8)=>{const ox=P.x,oz=P.z;Motor.step(P,{x:dirX,z:dirZ,speed},dt,W0);c.xcPlayer(P,dt,W0,ox,oz);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// 2. player
{const c=mk(),P=pl(0,0),b=bot(3,0);c.player=P;c.bots=[b];vm.runInContext('player=globalThis.__p;bots=globalThis.__b;',Object.assign(c,{__p:P,__b:[b]}));let min=1e9;
 for(let k=0;k<120;k++){stepP(c,P,1,0);min=Math.min(min,dist(P,b.g.position));}
 assert(min>=MIN,`player walking into a bot stops at the contact (min ${min.toFixed(3)})`);assert(P.x>3-R2-.02,`reaches it (${P.x.toFixed(3)})`);assert.deepEqual([b.g.position.x,b.g.position.z],[3,0],'the bot is not shoved');
 Object.assign(P,pl(0,.3));min=1e9;for(let k=0;k<120;k++){stepP(c,P,1,0);min=Math.min(min,dist(P,b.g.position));}assert(min>=MIN&&P.x>4,`off-centre: slides past (min ${min.toFixed(3)}, x ${P.x.toFixed(2)})`);
 for(const [label,set,undo] of [['dead bot',()=>{b.alive=false;},()=>{b.alive=true;}],['online-driven unit (nt) off the server',()=>{b.nt=true;},()=>{b.nt=false;}],['fog-parked unit',()=>{b.fog=1;},()=>{b.fog=0;}],['player in Dismiss',()=>{vm.runInContext('J.dis=1',c);},()=>{vm.runInContext('J.dis=0',c);}],['aim range',()=>{vm.runInContext("mode='aim'",c);},()=>{vm.runInContext("mode='five'",c);}]]){
  Object.assign(P,pl(0,0));set();for(let k=0;k<120;k++)stepP(c,P,1,0);undo();assert(P.x>4,`${label}: no collision (x ${P.x.toFixed(2)})`);}}
// 3. prediction = server
(async()=>{
const {Simulation,weapons}=await import(path.join(root,'server/src/simulation.js'));
{const world={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new Simulation(world,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);const put=(u,x,z)=>Object.assign(u,{x,y:0,z,vx:0,vy:0,vz:0,ch:0,air:false,input:{}});put(a,0,.15);put(b,2.5,0);
 const c=mk(),P=pl(0,.15),B=bot(2.5,0);vm.runInContext('player=globalThis.__p;bots=globalThis.__b;',Object.assign(c,{__p:P,__b:[B]}));let worst=0,seq=1;
 for(let k=0;k<40;k++){s.command(a,{t:'in',seq:seq++,r:-Math.PI/2,p:0,f:1});s.step(.05);stepP(c,P,1,0,.05,6.75*weapons[a.weapon].runSpeedMultiplier);worst=Math.max(worst,Math.hypot(P.x-a.x,P.z-a.z));}
 assert(worst<1e-9,`page prediction = server (worst ${worst})`);assert(dist(a,b)>=MIN,'server: never inside');}
// 4. offline bots
const botScene=(wall,zA,zB)=>{const c=mk();const a=bot(0,zA),b=bot(4,zB);vm.runInContext('bots=globalThis.__b;allies=[];player=null;',Object.assign(c,{__b:[a,b]}));if(wall)vm.runInContext('WALL=globalThis.__w',Object.assign(c,{__w:wall}));
 const goal=new Map([[a,8],[b,-4]]);c.steps.push(dt=>{for(const u of [a,b]){const p=u.g.position,g=goal.get(u);let vx=Math.sign(g-p.x),vz=0;if(Math.abs(g-p.x)<.3)vx=0;const v=c.xSmV(u,dt,vx,vz,5.4),bs=5.4*dt;
  if(!c.blocked(p.x+v[0]*bs,p.z,.45,0))p.x+=v[0]*bs;else if(u.smMotor)u.smMotor.vx=0;if(!c.blocked(p.x,p.z+v[1]*bs,.45,0))p.z+=v[1]*bs;else if(u.smMotor)u.smMotor.vz=0;}});
 return {c,a,b};};
for(const [label,wall,zA,zB] of [['open, head-on',null,0,0],['open, off-centre',null,.05,0],['2 m corridor, head-on',(x,z,r)=>Math.abs(z)>1-r,0,0]]){
 const {c,a,b}=botScene(wall,zA,zB);let min=1e9,t=0;const A=a.g.position,B=b.g.position;for(;t<5&&!(A.x>5&&B.x<-1);t+=1/60){c.fiveTick(1/60);min=Math.min(min,dist(A,B));}
 assert(A.x>5&&B.x<-1,`bots ${label}: pass each other within 5 s (a ${A.x.toFixed(2)},${A.z.toFixed(2)} b ${B.x.toFixed(2)},${B.z.toFixed(2)})`);
 assert(min>=R2-.12,`bots ${label}: no walking through (min ${min.toFixed(3)}; within one frame of travel)`);}
// a bot walking into the player stops at the contact; the player is not shoved
{const c=mk(),P=pl(3,0),b=bot(0,0);vm.runInContext('player=globalThis.__p;bots=globalThis.__b;',Object.assign(c,{__p:P,__b:[b]}));c.steps.push(dt=>{b.g.position.x+=5.4*dt;});let min=1e9;
 for(let k=0;k<120;k++){c.tick(1/60);min=Math.min(min,dist(P,b.g.position));}assert(min>=MIN,`bot into the player: stops at the contact (min ${min.toFixed(3)})`);assert.deepEqual([P.x,P.z],[3,0],'the player is not shoved by a bot');}
// a bot respawned onto another is eased apart (no snap)
{const c=mk(),a=bot(0,0),b=bot(.2,0);vm.runInContext('bots=globalThis.__b;player=null;',Object.assign(c,{__b:[a,b]}));a.xcO=[20,0];c.tick(.05);const moved=Math.hypot(a.g.position.x,a.g.position.z);
 assert(moved<=Motor.C.bodySep*.05+1e-9,`a teleported bot eases out (moved ${moved.toFixed(3)} in one 50 ms step)`);for(let k=0;k<10;k++)c.tick(.05);assert(dist(a.g.position,b.g.position)>=MIN,'and ends apart');}
// 5. online
{const c=mk(),a=bot(0,0),b=bot(.2,0,{hum:1});vm.runInContext("bots=globalThis.__b;player=null;MP.on=true;MP.role='client';",Object.assign(c,{__b:[a,b]}));c.tick(.05);
 assert.deepEqual([a.g.position.x,b.g.position.x],[0,.2],'online client: the server moves every other unit');
 vm.runInContext("MP.role='host'",c);a.xcO=[0,0];b.xcO=[.2,0];c.tick(.05);assert(a.g.position.x<0,'P2P host: its own bot resolves');assert.equal(b.g.position.x,.2,'P2P host: a remote human is not moved');}
console.log('test_character_collision: wiring, player stop / slide / exclusions, prediction = server, offline bots (into player, head-on open / off-centre / corridor, eased respawn), online ownership - pass');
})().catch(e=>{console.error(e);process.exit(1);});
