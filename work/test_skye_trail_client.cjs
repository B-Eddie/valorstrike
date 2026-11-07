// Remote Skye Trailblazer rows (netSyncTrail): create, follow with motion-derived facing, own-skip, bad-row reject, end. skxTrailblazer is a stub.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('const netTb=new Map();'),j=html.indexOf('function netSyncEffects(rows)');assert(i>0&&j>i);
const log=[];const ctx=vm.createContext({MP:{me:7},skxTrailblazer:(x,y,z,yw)=>{log.push(['new',x,z,yw]);return {move(a,b,c,d){log.push(['move',a,c,d]);}};},skxEnd:()=>log.push(['end'])});
vm.runInContext(html.slice(i,j)+';this.sync=netSyncTrail;',ctx);
const row=(o,p)=>[{id:1,kind:'trail',o,p,yaw:0,tl:5}];
ctx.sync(row(3,[0,0,0]));ctx.sync(row(3,[3,0,0]));
assert.equal(log[0][0],'new');assert.ok(Math.abs(log[2][3]-Math.PI/2)<1e-9,'facing from motion (+x)');
ctx.sync([{id:2,kind:'trail',o:7,p:[0,0,0]}]);assert.equal(log.filter(l=>l[0]==='new').length,1,'own skipped');
ctx.sync([{id:3,kind:'trail',o:3,p:[NaN,0,0]}]);assert.equal(log.filter(l=>l[0]==='new').length,1,'bad row rejected');
ctx.sync([]);assert.equal(log[log.length-1][0],'end');
console.log('skye trail client: create, follow, own-skip, reject, end (stub module)');
