// Real client snapshot/interpolation and prediction code under jitter, batching, gaps and clock skew.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),runtime=fs.readFileSync(__dirname+'/server_runtime.js','utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,a);return s.slice(i,j);};
function fixture(){
 const position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},u={nid:2,name:'Remote',agent:'Jett',g:{position,rotation:{y:0}},nb:[],alive:true,hp:100};
 const c={running:true,MP:{st:'game',me:1,DELAY:100},now:0,performance:{now:()=>c.now},bots:[u],allies:[],FV:{},XAG:{Jett:1},mpClean:s=>s,mpCliKD(){},showStats(){},scene:{remove(){}},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
 vm.createContext(c);vm.runInContext(cut(html,'function mpCliSnap(','function mpCliSelf(')+cut(html,'function mpInterp(','const MPT ='),c);
 const row=(x,seq=1)=>[2,1,'Remote','Jett',x,0,0,0,100,50,1,'Vandal',1,0,seq,25,75,0,0];
 return {c,u,row,snap(t,x,seq=1){c.mpCliSnap({serverTime:1e9+t,u:[row(x,seq)],ev:[]});}};
}
const F=fixture(),packets=[],delay=[40,95,40,70,55,125,40,40];let arrival=-1;
for(let t=0;t<=6000;t+=50){arrival=Math.max(arrival+1,t+delay[(t/50)%delay.length]);packets.push({at:arrival,t});}
let last=null,minSpeed=Infinity,maxSpeed=0,frames=0;
for(let frame=0;frame<360;frame++){
 F.c.now=frame*1000/60;
 while(packets.length&&packets[0].at<=F.c.now){const p=packets.shift();F.snap(p.t,p.t*.0054);}
 F.c.mpInterp(F.u,F.c.now);
 if(last!==null&&frame>60){const speed=(F.u.g.position.x-last)*60;minSpeed=Math.min(minSpeed,speed);maxSpeed=Math.max(maxSpeed,speed);assert(speed>4.5&&speed<6.1,'jitter must not freeze, rush or reverse a constant runner: '+speed);frames++;}
 last=F.u.g.position.x;
}
assert(frames>290);assert(F.c.MP.snapClock.delay>100,'buffer responds to observed jitter');
assert(F.u.nb.every((s,i,B)=>!i||s.t-B[i-1].t===50),'sample spacing follows server clock even when messages arrive together');
// A single missing sample is covered by the buffer; long silence projects only 50 ms, then holds.
const gap=fixture();for(let t=0;t<=500;t+=50){gap.c.now=t+40;gap.snap(t,t*.0054);gap.c.mpInterp(gap.u,gap.c.now);}
gap.c.now=640;gap.c.mpInterp(gap.u,gap.c.now);const projected=gap.u.g.position.x;
for(const now of [700,800,900])gap.c.mpInterp(gap.u,now);
assert(gap.u.g.position.x<=.0054*550+1e-9,'extrapolation is capped at 50 ms');assert(gap.u.g.position.x>=projected,'render never reverses during silence');
// Spawn IDs and teleports reset the history even if the new spawn is only a metre away.
gap.c.now=1000;gap.snap(960,.5,2);assert.equal(gap.u.nb.length,1);assert.equal(gap.u.g.position.x,.5,'spawn snaps to the new life instead of blending across lives');
const ns=gap.u.nb.length;gap.snap(960,.6,2);assert.equal(gap.u.nb.length,ns,'duplicate source timestamp replaces its pose');
// Resumed start rows have no serverTime; the next state frame switches back to the server clock.
// Mixing these domains left a local-time sample ahead of an epoch-time sample and froze movement until eviction.
const resumed=fixture();resumed.c.now=100;resumed.snap(60,.324);resumed.c.mpInterp(resumed.u,100);
resumed.c.now=200;resumed.c.mpCliSnap({u:[resumed.row(.5)],ev:[]});
assert.equal(resumed.u.nb.length,1,'resume sample replaces old server-clock history');assert.equal(resumed.u.nb[0].clock,false);assert.equal(resumed.u.g.position.x,.5);
resumed.c.now=250;resumed.snap(210,1);assert.equal(resumed.u.nb.length,1,'server clock replaces local resume history');assert.equal(resumed.u.nb[0].clock,true);assert.equal(resumed.u.g.position.x,1);
resumed.c.now=300;resumed.snap(260,1.27);resumed.c.mpInterp(resumed.u,380);assert(resumed.u.g.position.x>1.1,'normal interpolation resumes immediately after clock change');
// Real movement reconciliation: no 20 Hz socket correction jumps; residuals converge on render frames.
const start=runtime.indexOf('NET.inLog=[];',runtime.indexOf('// Movement reconciliation:')),end=runtime.indexOf('const netSelf0=',start);
const C={NET:{socket:{},seq:0},player:{x:0,y:0,z:0},clock:0,performance:{now:()=>C.clock},moveP(){}};vm.createContext(C);vm.runInContext(runtime.slice(start,end),C);
const e=[0,0,'','',.6,.3,0];assert.equal(C.netReconcile(e,{x:0,y:0,z:0}),'eased');assert.equal(C.player.x,0,'snapshot does not move camera');assert.equal(C.player.y,0);
// Bunched snapshots replace the residual; they must not multiply it before a render can run.
for(let i=0;i<8;i++)C.netReconcile(e,{x:0,y:0,z:0});assert.equal(C.NET.correction.x,.6);
let previous=0,maxCorrection=0;for(let i=0;i<180;i++){C.clock=i*1000/60;C.netCorrect(1/60);maxCorrection=Math.max(maxCorrection,C.player.x-previous);previous=C.player.x;}
assert(maxCorrection<=.75/60+1e-9,'each correction is bounded by frame time');assert(Math.abs(C.player.x-.6)<.001,'horizontal authority converges');assert(Math.abs(C.player.y-.3)<.001,'vertical authority converges');
C.NET.inLog=[{seq:1,t:100}];C.NET.path=[{t:100,x:0,y:0,z:0},{t:200,x:1,y:0,z:0}];C.clock=200;assert.equal(C.netPredicted(1,.05).x,.5,'acknowledged input uses historical prediction');
const selfStart=runtime.indexOf('const netSelf0=mpCliSelf;'),selfEnd=runtime.indexOf('const netWalls=',selfStart);
Object.assign(C,{MP:{sq:1,m5:false},mpCliSelf(){},rw:'knife',wName:()=> 'Knife',WEAP:{},slots:{knife:{}},reloading:0,ammo:0,updHud(){}});
vm.runInContext("let netEquipWant=null,netEquipUntil=0,netRec=false,netWeapon='';"+runtime.slice(selfStart,selfEnd),C);
C.NET.inLog=[];C.NET.path=[];const before={...C.player};const stale=[1,0,'Me','Jett',-5,0,0,0,100,50,1,'Knife',1,0,1,0,0,0,0,42,.05];C.mpCliSelf(stale);assert.deepEqual(C.player,before,'missing prediction history cannot pull current movement toward a stale snapshot');assert.equal(C.NET.lastFix,'waiting');
console.log(`network smoothing: ${frames} render frames under 40–125 ms ordered jitter at ${minSpeed.toFixed(2)}–${maxSpeed.toFixed(2)} m/s; source spacing, bounded extrapolation, spawn/duplicate reset, batched reconciliation, historical lookup and missing-history recovery passed (max 60 Hz correction ${(maxCorrection*100).toFixed(2)} cm)`);
