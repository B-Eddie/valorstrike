// Online hit tagging on the local player (user 2026-10-28: "there's still a lot of lag ... when bots' shots hit me").
// The server slows a hit player for 0.5 s (server/src/simulation.js tagHit / tagMul: x0.275, a soft ramp for far
// shotgun pellets) and moves humans with that multiplier (Motor.step tag). The online client never tagged its own
// prediction, so for every hit it kept running at full speed while the server held it back: the predicted path ran
// up to ~2 m ahead of the server and netReconcile snapped the player back (> 1 m) - a rubber-band on every hit taken.
//  (1) model, shared motor (vendor/valorant-feel.js = server/src/motor.cjs): a runner hit 0.2 s into a sprint at
//      100 ms RTT; client prediction vs the server, without and with the client mirroring the tag on the 'h' event
//  (2) the real page code (work/hit_feedback_runtime.js in a VM): an 'h' event naming me tags the local player for the
//      part of the server's 0.5 s window still ahead of the prediction (soft ramp for far shotgun pellets, never weaker
//      than a hard tag already on, nothing for others' hits / dead player / bad events)
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../vendor/valorant-feel.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),runtime=fs.readFileSync(path.join(__dirname,'hit_feedback_runtime.js'),'utf8');
assert(html.includes(runtime.trim()),'index.html carries work/hit_feedback_runtime.js (rerun python3 work/install_valorant.py)');
// server tagMul (server/src/simulation.js), copied verbatim so a change there shows up here
const srv=fs.readFileSync(path.join(__dirname,'..','server','src','simulation.js'),'utf8');
const tm=srv.match(/export const tagMul=(\(u,now\)=>[^\n;]*);/);assert(tm,'server tagMul');const tagMul=eval(tm[1]);
// ---------- 1. model ----------
const flat={ground:()=>0,blocked:()=>false};
function run(client){ // 60 Hz inputs, run forward 1.2 s; the server tags at t=0.2 s; the event reaches the client one RTT later
 const dt=1/60,RTT=.1,hitAt=.2,S={x:0,y:0,z:0,vx:0,vy:0,vz:0,on:true},C={x:0,y:0,z:0,vx:0,vy:0,vz:0,on:true};let tagUntil=-1,ctag=null,maxErr=0;
 const inp=k=>({x:0,z:-1,f:1,speed:6.75*.8,tag:k});
 for(let i=0;i<72;i++){const t=i*dt;if(Math.abs(t-hitAt)<dt/2)tagUntil=t+.5;
  M.step(S,inp(tagMul({tagUntil,tagSoft:0},t)),dt,flat);
  if(client&&Math.abs(t-(hitAt+RTT))<dt/2)ctag={until:hitAt+.5};/* mirrored on receipt: the window's remaining part */
  const k=ctag&&t<ctag.until?.275:1;M.step(C,inp(k),dt,flat);
  maxErr=Math.max(maxErr,Math.hypot(C.x-S.x,C.z-S.z));}
 return {maxErr,end:Math.hypot(C.x-S.x,C.z-S.z)};}
const before=run(false),after=run(true);
console.log('reconcile error, hit while sprinting @100 ms RTT: before max',before.maxErr.toFixed(2),'m end',before.end.toFixed(2),'m | after max',after.maxErr.toFixed(2),'m end',after.end.toFixed(2),'m');
assert(before.maxErr>1,'model sanity: an untagged prediction runs > 1 m ahead (netReconcile snaps) ('+before.maxErr.toFixed(2)+')');
assert(after.maxErr<.5&&after.end<.5,'mirrored tag keeps the residual under 0.5 m, eased by netCorrect, never a snap ('+after.maxErr.toFixed(2)+')');
// ---------- 2. real page code ----------
const player={hp:100,armor:50,x:0,y:0,z:0,g:null};
const shooter=(nid,w,x,z)=>({name:'Bot '+nid,nid,hp:100,armor:0,alive:true,w,g:{position:{x,y:0,z}},xm:null});
const near=shooter(5,'Vandal',0,8),shotgun=shooter(6,'Judge',0,15),closeSg=shooter(7,'Judge',0,6);
let now=10000;
const c={window:{},THREE:{Vector3:class{constructor(){this.x=this.y=this.z=0;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}},BFX:{low:false},scene:{},camera:{},XHV:null,running:true,
 document:{createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){}}),getElementById:()=>null,head:{appendChild(){}},body:{appendChild(){}}},console,
 NET:{socket:{},inLog:[]},MP:{st:'game',me:1,nc:false,name:'me'},bots:[near,shotgun,closeSg],allies:[],player,mode:'five',WEAP:{Vandal:{pel:1},Judge:{pel:12}},
 S:{hm:false,dn:false,muted:true,vol:80},XDN:[],$:()=>null,xRestart(){},sbDmg(){},hurt(){},armAbs:()=>0,xKLm(){},xKLReset(){},xKLDie(){},vmHit(){},xKLog(){},flash(){},xDeathFlash(){},
 bfxInit(){},bfxTick(){},xKiReset(){},mpCliSnap(){},vmKill(){},xKiAdd(){},mpIn:n=>n,setTimeout(){},requestIdleCallback:null,performance:{now:()=>now}};
c.XHV=new c.THREE.Vector3();vm.createContext(c);vm.runInContext('let ac=null,master=null;function audio(){}',c);vm.runInContext(runtime,c);
const self=(seq,age)=>{const r=new Array(22).fill(0);r[0]=1;r[19]=seq;r[20]=age;return r;};
const snap=(ev,row)=>c.mpCliSnap({u:row?[row]:[],ev});
const hit=(by,dmg=40)=>['h',by,1,0,0,dmg,0,1.2,0,0,0];
// the acknowledged input (seq 7) went out 100 ms ago and the server's position is 20 ms past it: 80 ms of the window are behind us
c.NET.inLog=[{seq:7,t:now-100}];
snap([hit(5)],self(7,.02));
assert(Math.abs(player.tagT-.42)<1e-9,'remaining window: 0.5 s minus the 80 ms already predicted ('+player.tagT+')');
assert.equal(player.tagK,.275);assert.equal(player.tagS,0,'hard rifle tag (server tagMul 0.275)');
// no acknowledged sample (startup / resume): the whole window
player.tagT=0;c.NET.inLog=[];snap([hit(5)],self(9,.01));assert.equal(player.tagT,.5);
// far shotgun pellets: soft ramp (server tagSoft), never replacing a hard tag already on
player.tagT=0;player.tagK=1;snap([hit(6,15)],null);assert.equal(player.tagS,1);assert.equal(player.tagK,.7);assert.equal(player.tagT,.5);
player.tagT=.3;player.tagK=.275;player.tagS=0;snap([hit(6,15)],null);assert.equal(player.tagK,.275,'soft pellets never weaken a hard tag');assert.equal(player.tagT,.3);
// a hard hit replaces a soft ramp (server: tagSoft 0, a fresh window)
player.tagT=.45;player.tagS=1;player.tagK=.7;c.NET.inLog=[{seq:7,t:now-100}];snap([hit(5)],self(7,.02));assert.equal(player.tagS,0);assert(Math.abs(player.tagT-.42)<1e-9);c.NET.inLog=[];
// close shotgun pellets: hard
player.tagT=0;snap([hit(7,15)],null);assert.equal(player.tagS,0);assert.equal(player.tagK,.275);
// a window wholly in the past (huge ping): nothing left to mirror
player.tagT=0;c.NET.inLog=[{seq:11,t:now-900}];snap([hit(5)],self(11,0));assert(!(player.tagT>0),'nothing left of the window');
// others' hits, my own shots on others, a dead player, malformed events: untouched
c.NET.inLog=[];player.tagT=0;snap([['h',5,2,0,0,40,0,1.2,0,0,0],['h',1,5,0,0,40,0,1.2,0,0,0],['h',5,1,0,0,NaN,0,1.2,0,0,0],['h',5,1]],null);assert(!(player.tagT>0));
player.hp=0;snap([hit(5)],null);assert(!(player.tagT>0),'a dead player is not tagged');player.hp=100;
// offline (no socket): the page's own hurt path tags, the event handler stays out of it
c.NET.socket=null;snap([hit(5)],null);assert(!(player.tagT>0));
console.log('Online hit tagging: the local prediction mirrors the server tag on hits taken (remaining window, soft far pellets), residual < 0.5 m instead of a > 1 m snap-back');
