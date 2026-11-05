// Skye Guiding Light remote pop (a18NetSync): one-shot burst per row id, own skipped. skxHawkFlash is a stub.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const ctx=vm.createContext({MP:{me:7},J:{},a18Net:new Map(),A18VIS:{},units:new Map(),skxHawkFlash:p=>log.push(p.x),a18NetMesh:()=>{throw new Error('generic')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const r=(id,o,x)=>({id,kind:'flash',ag:'Skye',o,p:[x,1,0],tl:1});
ctx.sync([r(5,3,1)]);ctx.sync([r(5,3,1)]);assert.deepEqual(log,[1]);
ctx.sync([r(6,7,2)]);assert.deepEqual(log,[1],'own skipped');
ctx.sync([]);ctx.sync([r(9,3,4)]);assert.deepEqual(log,[1,4]);
console.log('skye pop client ok (stub)');
