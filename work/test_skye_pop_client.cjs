// Skye Guiding Light online: server hawk row drawn for remote casters, flash burst on the row's drop (detonation), own skipped. skx* are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const ctx=vm.createContext({MP:{me:7},J:{},a18Net:new Map(),A18VIS:{},units:new Map(),skxHawk:(x,y,z,yw)=>{log.push(['hawk',x]);return {move:(x2)=>log.push(['mv',x2])};},skxEnd:()=>log.push(['end']),skxHawkFlash:p=>log.push(['burst',p.x]),a18NetMesh:()=>{throw new Error('generic')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;this.free=a18NetFree;',ctx);
const hk=(id,o,x)=>({id,kind:'hawk',o,p:[x,1,0],hd:[0,0,-1],tl:1});
const fl=(id,o,x)=>({id,kind:'flash',ag:'Skye',o,p:[x,1,0],tl:.5,fa:.2});
ctx.sync([hk(5,3,1)]);ctx.sync([hk(5,3,2)]);assert.deepEqual(log,[['hawk',1],['mv',1],['mv',2]]);
const dn=(id,o,x)=>({...fl(id,o,x),fa:0,dn:1});
log.length=0;ctx.sync([fl(6,3,2)]);assert.deepEqual(log.map(x=>x[0]),['end'],'hawk row dropped: hawk ends; flash windup row: no burst yet');
log.length=0;ctx.sync([dn(6,3,2)]);ctx.sync([dn(6,3,2)]);assert.deepEqual(log,[['burst',2]],'burst exactly once, on the server dn:1 signal');ctx.sync([]);assert.equal(log.length,1);
log.length=0;ctx.sync([fl(10,3,3)]);ctx.sync([]);assert.equal(log.length,0,'row drop without dn (death/reset/cancel): no burst');
log.length=0;ctx.sync([dn(11,3,4)]);assert.deepEqual(log,[['burst',4]],'late first snapshot already carrying dn: still bursts once');ctx.sync([]);
log.length=0;ctx.sync([hk(8,7,1)]);ctx.sync([fl(9,7,1)]);ctx.sync([dn(9,7,1)]);ctx.sync([]);assert.equal(log.filter(x=>x[0]==='hawk'||x[0]==='burst').length,0,'own hawk/flash: local cast draws it');
console.log('skye hawk + pop client ok (stub)');
