// Remote Fade Haunt rows (a18NetSync): orb flies owner -> p over 0.4 s, burst when the row drops. fdx* are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r) {'),k2=html.indexOf('\n',k);
const log=[];const ctx=vm.createContext({a18Net:new Map(),A18VIS:{haunt:['ring',1]},units:new Map([[3,{g:{position:{x:0,y:0,z:0}}}]]),fdxHauntOrb:(x,y,z)=>{log.push(['orb',x,y,z]);return {move(a,b,c){log.push(['move',a,b,c]);}};},fdxEnd:()=>log.push(['end']),fdxHauntBurst:p=>log.push(['burst',p.x,p.z]),a18NetMesh:()=>{throw new Error('generic mesh used')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const row=(tl)=>[{id:5,kind:'haunt',o:3,p:[8,0,0],tl}];
ctx.sync(row(2));ctx.sync(row(1.8));
assert.deepEqual(log[0],['orb',0,1.4,0]);assert.ok(Math.abs(log[2][1]-4)<1e-9,'halfway after 0.2 s');
ctx.sync([]);assert.deepEqual(log.slice(-2).map(l=>l[0]),['end','burst']);assert.equal(log[log.length-1][1],8);
console.log('fade haunt client: orb flight, burst on drop (stub modules)');
