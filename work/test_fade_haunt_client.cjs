// Remote Fade Haunt rows (a18NetSync): orb flies owner -> p over 0.4 s, burst when the row drops. fdx* are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const ctx=vm.createContext({MP:{me:7},a18Net:new Map(),A18VIS:{haunt:['ring',1]},units:new Map([[3,{g:{position:{x:0,y:0,z:0}}}]]),fdxHauntOrb:(x,y,z)=>{log.push(['orb',x,y,z]);return {move(a,b,c){log.push(['move',a,b,c]);}};},fdxEnd:()=>log.push(['end']),fdxHauntBurst:p=>log.push(['burst',p.x,p.z]),a18NetMesh:()=>{throw new Error('generic mesh used')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const row=(tl)=>[{id:5,kind:'haunt',o:3,p:[8,0,0],tl}];
ctx.sync(row(2));ctx.sync(row(1.7));
assert.deepEqual(log[0],['orb',0,1.4,0]);assert.ok(Math.abs(log[2][1]-6)<1e-9,'3/4 after 0.3 s');
ctx.sync([]);assert.deepEqual(log.slice(-2).map(l=>l[0]),['end','burst']);assert.equal(log[log.length-1][1],8);
console.log('fade haunt client: orb flight, burst on drop (stub modules)');
// natural expiry bursts; early vanish (cancel/death/reset) ends silently; own rows are not drawn and not burst
log.length=0;ctx.sync(row(2));ctx.sync(row(1.9));ctx.sync([]);assert.deepEqual(log.map(l=>l[0]),['orb','move','move','end'],'early vanish: no burst');
log.length=0;ctx.sync([{id:6,kind:'haunt',o:7,p:[1,0,1],tl:2}]);ctx.sync([{id:6,kind:'haunt',o:7,p:[1,0,1],tl:1.5}]);ctx.sync([]);assert.equal(log.length,0,'own row: nothing drawn');
log.length=0;ctx.sync(row(2));ctx.sync(row(1.7));ctx.sync([]);assert.equal(log[log.length-1][0],'burst','natural expiry bursts');
console.log('fade haunt client: own-skip, early-vanish silent, natural burst');
