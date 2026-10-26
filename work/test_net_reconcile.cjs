// Online movement reconciliation (server_runtime.js): the page compares each snapshot with its own predicted path at the
// moment the server's position describes (last applied input seq row[19] + seconds applied row[20]), not with where it is
// now. Runs the shared motor on both sides with 40 ms each way, 20 Hz inputs and snapshots, the real reconciliation code
// lifted from server_runtime.js, and a player who runs and jump-spams: the server and page agree, so no snapshot snaps
// and the predicted jump arc is never pulled down. The legacy rule (compare with the current position) is replayed on the
// same run and must snap the jump (the jarring online jump), so this test fails on the old code.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const M=require('../server/src/motor.cjs'),src=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const a=src.indexOf('NET.inLog=[];',src.indexOf('// Movement reconciliation:')),b=src.indexOf('const netSelf0=mpCliSelf;');assert.ok(a>0&&b>a,'reconciliation block present');
const ctx={NET:{socket:{},seq:0},player:null,performance:{now:()=>ctx.clock},clock:0,moveP:function(){if(ctx.mv)return ctx.mv();M.step(ctx.player,ctx.cur,ctx.dt,W);}};vm.createContext(ctx);
vm.runInContext(src.slice(a,b),ctx);assert.ok(src.includes('log.push({seq,t:performance.now()})'),'inputs logged at send time');
assert.ok(/u\.human\?Math\.max\(0,u\.lastSeq\|0\)/.test(fs.readFileSync(path.join(__dirname,'../server/src/simulation.js'),'utf8')),'server rows echo the last applied input');
const W={ground:()=>0,blocked:()=>false};
function run(mode){ctx.clock=0;ctx.NET.inLog=[];ctx.NET.path=[];ctx.NET.seq=0;ctx.player={x:0,y:0,z:0};const S={x:0,y:0,z:0,lastSeq:0,input:null,inputAt:0,time:0};
 const toServer=[],toClient=[];let snaps=0,snapsFixed=0,maxDrop=0,maxFix=0;const OWD=40;
 for(let ms=0;ms<6000;ms++){ctx.clock=ms;
  const jump=ms>500&&(Math.floor(ms/200)%4===0),key={x:Math.cos(ms/700),z:Math.sin(ms/700),speed:5.4,jump};
  if(ms%50===0){const seq=++ctx.NET.seq;ctx.NET.inLog.push({seq,t:ms});if(ctx.NET.inLog.length>60)ctx.NET.inLog.shift();toServer.push({at:ms+OWD,seq,key});}
  if(ms%8===0){ctx.cur=key;ctx.dt=.008;vm.runInContext('moveP(dt)',ctx);}
  while(toServer.length&&toServer[0].at<=ms){const m=toServer.shift();S.lastSeq=m.seq;S.input=m.key;S.inputAt=S.time;}
  if(ms%16===0&&S.input){M.step(S,S.input,.016,W);S.time+=.016;}
  if(ms%50===25&&S.lastSeq)toClient.push({at:ms+OWD,e:[0,0,'',' ',+S.x.toFixed(3),+S.y.toFixed(3),+S.z.toFixed(3),0,0,0,1,'',1,0,1,0,0,0,0,S.lastSeq,+(S.time-S.inputAt).toFixed(3)]});
  while(toClient.length&&toClient[0].at<=ms){const {e}=toClient.shift(),P=ctx.player,before={x:P.x,y:P.y,z:P.z};snaps++;
   if(mode==='new'){const ref=ctx.netPredicted(e[19],e[20]);assert.ok(ref,'prediction found for seq '+e[19]);const r=ctx.netReconcile(e,ref);if(r==='snap')snapsFixed++;}
   else{const err=Math.hypot(P.x-e[4],P.z-e[6]);if(err>.75){P.x=e[4];P.y=e[5];P.z=e[6];snapsFixed++;}else{P.x+=(e[4]-P.x)*.25;P.z+=(e[6]-P.z)*.25;if(Math.abs(P.y-e[5])>.35){P.y=e[5];snapsFixed++;}}}
   maxDrop=Math.max(maxDrop,before.y-P.y);maxFix=Math.max(maxFix,Math.hypot(P.x-before.x,P.z-before.z));}}
 return {snaps,snapsFixed,maxDrop,maxFix};}
const n=run('new'),o=run('old');
assert.ok(n.snaps>100,'snapshots delivered');assert.equal(n.snapsFixed,0,'no snapshot snaps the predicted player');
assert.ok(n.maxDrop<.05,'jump arc never pulled down (max '+n.maxDrop.toFixed(3)+' m)');assert.ok(n.maxFix<.1,'horizontal corrections stay tiny (max '+n.maxFix.toFixed(3)+' m)');
assert.ok(o.snapsFixed>0&&o.maxDrop>.3,'legacy comparison snaps the jump ('+o.snapsFixed+' snaps, '+o.maxDrop.toFixed(2)+' m drop)');
ctx.XRT={at:ctx.clock-16};ctx.dt=.008;ctx.cur={x:1,z:0,speed:5.4};
vm.runInContext('moveP(dt)',ctx);
assert.equal(ctx.NET.path.at(-1).t,ctx.XRT.at,'catch-up prediction records the substep time');
ctx.XRT.at=null;vm.runInContext('moveP(dt)',ctx);
assert.equal(ctx.NET.path.at(-1).t,ctx.clock,'ordinary frames record the frame time');
// Jett Tailwind dash (qa-29 / qa-30): the page predicts the 11 m / 0.45 s dash at the E press (J.dash, shared motor dashStep inside
// moveP, NET.dashUntil = press + 0.45 s + 0.25 s); the server starts the same dash when the ab message lands (40 ms each way) and
// moves it in 50 ms ticks (Simulation.step: Motor.step with the input zeroed, then Motor.dashStep). The ticks put the server's dash a
// tick behind the prediction at the same input time; the dash hold keeps that from snapping, and after it both stand 11 m on.
// Without the hold (NET.dashUntil 0) the same run snaps, so this fails on the pre-hold reconcile.
assert.ok(src.includes("NET.dashUntil=performance.now()+XPAR2.dashTime*1000+250"),'dash hold set at the predicted press');
function runDash(hold,PRESS,jit=0){ctx.clock=0;ctx.NET.inLog=[];ctx.NET.path=[];ctx.NET.seq=0;ctx.NET.dashUntil=0;ctx.J={dash:null};ctx.player={x:0,y:0,z:0};ctx.XRT=undefined;
 const S={x:0,y:0,z:0,lastSeq:0,input:null,inputAt:0,time:0,dash:null},toServer=[],toAb=[],toClient=[],OWD=40;let snaps=0,fixed=0,maxFix=0,kinds={},maxRef=0,lastRef=0;
 ctx.mv=function(){const D=ctx.J.dash;M.step(ctx.player,D?{...ctx.cur,x:0,z:0}:ctx.cur,ctx.dt,W);if(D&&!M.dashStep(ctx.player,D,ctx.dt,W))ctx.J.dash=null;};
 for(let ms=0;ms<3000;ms++){ctx.clock=ms;const key={x:0,z:-1,speed:5.4};
  if(ms===PRESS){ctx.J.dash=M.dash(1,0,0,11,.45);if(hold)ctx.NET.dashUntil=ms+450+250;toAb.push({at:ms+OWD+jit,f:1,s:0,r:0});}
  if(ms%50===0){const seq=++ctx.NET.seq;ctx.NET.inLog.push({seq,t:ms});if(ctx.NET.inLog.length>60)ctx.NET.inLog.shift();toServer.push({at:ms+OWD,seq,key});}
  if(ms%8===0){ctx.cur=key;ctx.dt=.008;vm.runInContext('moveP(dt)',ctx);}
  while(toServer.length&&toServer[0].at<=ms){const m=toServer.shift();S.lastSeq=m.seq;S.input=m.key;S.inputAt=S.time;}
  while(toAb.length&&toAb[0].at<=ms){const m=toAb.shift();S.dash=M.dash(m.f,m.s,m.r,11,.45);}
  if(ms%50===10&&S.input){const D=S.dash;M.step(S,D?{...S.input,x:0,z:0}:S.input,.05,W);if(D&&!M.dashStep(S,D,.05,W))S.dash=null;S.time+=.05;}
  if(ms%50===25&&S.lastSeq)toClient.push({at:ms+OWD,e:[0,0,'',' ',+S.x.toFixed(3),+S.y.toFixed(3),+S.z.toFixed(3),0,0,0,1,'',1,0,1,0,0,0,0,S.lastSeq,+(S.time-S.inputAt).toFixed(3)]});
  while(toClient.length&&toClient[0].at<=ms){const {e}=toClient.shift(),P=ctx.player,before={x:P.x,z:P.z};snaps++;const ref=ctx.netPredicted(e[19],e[20]);if(!ref)continue;lastRef=Math.hypot(e[4]-ref.x,e[6]-ref.z);maxRef=Math.max(maxRef,lastRef);const r=ctx.netReconcile(e,ref);kinds[r]=(kinds[r]||0)+1;if(r==='snap')fixed++;maxFix=Math.max(maxFix,Math.hypot(P.x-before.x,P.z-before.z));}}
 return {snaps,fixed,maxFix,kinds,maxRef,lastRef,end:[ctx.player.z,S.z]};}
const sweep=[];for(let o=0;o<50;o+=7)sweep.push([runDash(true,1000+o),runDash(false,1000+o)]);const jh=runDash(true,1021,60),jn=runDash(false,1021,60);ctx.mv=null;
for(const [h,n] of sweep){assert.ok(h.snaps>50,'dash run: snapshots delivered');assert.equal(h.fixed,0,'Tailwind dash: no snapshot snaps the predicted dash '+JSON.stringify(h.kinds));assert.ok(h.kinds.dash>0,'the hold was used');
 assert.ok(h.maxRef<1&&n.maxRef<1,'server ticks keep the dash within the 1 m snap line at equal input time ('+h.maxRef.toFixed(2)+' m)');assert.equal(n.fixed,0);assert.ok(h.lastRef<.1,'after the dash the page and server agree ('+h.lastRef.toFixed(3)+' m)');assert.ok(h.maxFix<.1,'no correction jumps (max '+h.maxFix.toFixed(3)+' m)');}
assert.equal(jh.fixed,0,'60 ms extra delay on the ab: the hold still keeps the dash from snapping '+JSON.stringify(jh.kinds));assert.ok(jh.lastRef<.1);assert.ok(jn.fixed>0,'the same jittered dash snaps without the hold ('+jn.maxRef.toFixed(2)+' m off)');
const dh=sweep[0][0],dn=jn;
console.log(`net reconcile: ${n.snaps} snapshots, 0 snaps, max vertical pull ${n.maxDrop.toFixed(3)} m, max horizontal fix ${n.maxFix.toFixed(3)} m (legacy: ${o.snapsFixed} snaps, ${o.maxDrop.toFixed(2)} m drop); Tailwind dash 40 ms / 50 ms ticks: 0 snaps over 8 press phases (max ${Math.max(...sweep.map(x=>x[0].maxRef)).toFixed(2)} m off at equal input time), +60 ms ab jitter 0 snaps (no hold: ${dn.fixed} snaps)`);
