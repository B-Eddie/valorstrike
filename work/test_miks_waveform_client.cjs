// Remote Miks Waveform rows (netSyncWaveform): module overlay on smoke rows tagged wf:1; own skipped; ends when the row drops. mkx* are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('const netWf=new Map();'),j=html.indexOf('function netSyncEffects(rows)');assert(i>0&&j>i);
const log=[];const ctx=vm.createContext({MP:{me:7},mkxWaveformSmoke:(p,r,t)=>{log.push(['new',p.x,r,t]);return {};},mkxEnd:()=>log.push(['end'])});
vm.runInContext(html.slice(i,j)+';this.sync=netSyncWaveform;',ctx);
const row=(o,tl,wf)=>[{id:1,kind:'smoke',o,p:[2,0,3],r:4.15,tl,...(wf?{wf:1}:{})}];
ctx.sync(row(3,14,0));assert.equal(log.length,0,'plain smoke: no overlay');
ctx.sync(row(3,13,1));ctx.sync(row(3,12,1));assert.deepEqual(log,[['new',2,4.15,13]],'one overlay');
ctx.sync([]);log.length=0;ctx.sync(row(7,12,1));assert.deepEqual(log,[['new',2,4.15,12]],'own A18 intent-only cast needs authoritative Waveform overlay');
ctx.sync([]);assert.equal(log[log.length-1][0],'end');
console.log('miks waveform client: overlay on wf rows, no overlay on plain smokes, one per row, end on drop (stub module)');
