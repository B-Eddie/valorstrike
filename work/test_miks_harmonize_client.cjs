// Miks Harmonize rows (a18NetSync): buffed player gets veil+pillar, others pillar only, follows p, ends on drop, caster's live local cast not doubled. mkx* stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const J={};const ctx=vm.createContext({MP:{me:7},J,a18Net:new Map(),A18VIS:{},units:new Map(),mkxHarmonize:(p,a,t,nv)=>{log.push(['new',p.x,nv]);return {setTargets:(s)=>log.push(['pos',s.x])};},mkxEnd:()=>log.push(['end']),a18NetMesh:()=>{throw new Error('generic')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const r=(id,o,tg,x)=>({id,kind:'harmon',o,tg,p:[x,0,0],tl:7});
ctx.sync([r(1,3,4,1)]);ctx.sync([r(1,3,4,2)]);assert.deepEqual(log,[['new',1,true],['pos',1],['pos',2]],'someone else buffed: pillar only (noVeil)');
ctx.sync([]);assert.equal(log[log.length-1][0],'end');
log.length=0;ctx.sync([r(2,3,7,1)]);assert.deepEqual(log.slice(0,1),[['new',1,false]],'I am buffed by an ally: veil + pillar');ctx.sync([]);
log.length=0;J._mkH={};ctx.sync([r(3,7,7,1)]);ctx.sync([r(4,7,5,1)]);assert.deepEqual(log,[['new',1,true],['pos',1]],'caster own self row skipped while local cast live; teammate row drawn');
console.log('miks harmonize client ok (stub)');
