// Online movement reconciliation (server_runtime.js): the page compares each snapshot with its own predicted path at the
// moment the server's position describes (last applied input seq row[19] + seconds applied row[20]), not with where it is
// now. Runs the shared motor on both sides with 40 ms each way, 20 Hz inputs and snapshots, the real reconciliation code
// lifted from server_runtime.js, and a player who runs and jump-spams: the server and page agree, so no snapshot snaps
// and the predicted jump arc is never pulled down. The legacy rule (compare with the current position) is replayed on the
// same run and must snap the jump (the jarring online jump), so this test fails on the old code.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const M=require('../server/src/motor.cjs'),src=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const a=src.indexOf('NET.inLog=[];'),b=src.indexOf('const netSelf0=mpCliSelf;');assert.ok(a>0&&b>a,'reconciliation block present');
const ctx={NET:{socket:{},seq:0},player:null,performance:{now:()=>ctx.clock},clock:0,moveP:function(){M.step(ctx.player,ctx.cur,ctx.dt,W);}};vm.createContext(ctx);
vm.runInContext(src.slice(a,b),ctx);assert.ok(src.includes('log.push({seq,t:performance.now()})'),'inputs logged at send time');
assert.ok(/u\.human\?Math\.max\(0,u\.lastSeq\|0\)/.test(fs.readFileSync(path.join(__dirname,'../server/src/simulation.js'),'utf8')),'server rows echo the last applied input');
const W={ground:()=>0,blocked:()=>false};
function run(mode){ctx.clock=0;ctx.NET.inLog=[];ctx.NET.path=[];ctx.NET.seq=0;ctx.player={x:0,y:0,z:0};const S={x:0,y:0,z:0,lastSeq:0,input:null,inputAt:0,time:0};
 const toServer=[],toClient=[];let snaps=0,snapsFixed=0,maxDrop=0,maxFix=0;const OWD=40;
 for(let ms=0;ms<6000;ms++){ctx.clock=ms;
  const jump=ms>500&&(Math.floor(ms/200)%4===0),key={x:Math.cos(ms/700),z:Math.sin(ms/700),speed:5.4,jump};
  if(ms%50===0){const seq=++ctx.NET.seq;ctx.NET.inLog.push({seq,t:ms});if(ctx.NET.inLog.length>60)ctx.NET.inLog.shift();toServer.push({at:ms+OWD,seq,key});}
  if(ms%8===0){ctx.cur=key;ctx.dt=.008;vm.runInContext('moveP()',ctx);}
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
vm.runInContext('moveP()',ctx);
assert.equal(ctx.NET.path.at(-1).t,ctx.XRT.at,'catch-up prediction records the substep time');
ctx.XRT.at=null;vm.runInContext('moveP()',ctx);
assert.equal(ctx.NET.path.at(-1).t,ctx.clock,'ordinary frames record the frame time');
console.log(`net reconcile: ${n.snaps} snapshots, 0 snaps, max vertical pull ${n.maxDrop.toFixed(3)} m, max horizontal fix ${n.maxFix.toFixed(3)} m (legacy: ${o.snapsFixed} snaps, ${o.maxDrop.toFixed(2)} m drop)`);
