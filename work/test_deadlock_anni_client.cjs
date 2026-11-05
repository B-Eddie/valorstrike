// Deadlock Annihilation cocoon rows (a18NetSync): module follows the captive, ends when the row drops; own row drawn unless the local cast's cocoon is live. dlx* are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const J={};const ctx=vm.createContext({MP:{me:7},J,a18Net:new Map(),A18VIS:{anni:['orb',1]},units:new Map(),dlxAnniCocoon:(p,t)=>{log.push(['new',p.x,t]);return {setPos(q){log.push(['pos',q.x])}};},dlxEnd:()=>log.push(['end']),a18NetMesh:()=>{throw new Error('generic mesh used')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const row=(o,x,tl)=>[{id:8,kind:'anni',o,p:[x,0,0],tl}];
ctx.sync(row(3,1,7));ctx.sync(row(3,2,6.5));assert.deepEqual(log,[['new',1,7],['pos',1],['pos',2]]);
ctx.sync([]);assert.equal(log[log.length-1][0],'end','row dropped (detain end, snap, kill): module ends');
log.length=0;ctx.sync(row(7,1,7));assert.equal(log[0][0],'new','own caster: no local cocoon -> drawn from the row');ctx.sync([]);
log.length=0;J.a18fx=[{kind:'anni',jx:{}}];ctx.sync(row(7,1,7));ctx.sync(row(7,2,6));ctx.sync([]);assert.equal(log.length,0,'own caster with a live local cocoon: not drawn twice');
console.log('deadlock anni client: follow, end on drop, own dedupe by live local cocoon (stub module)');
