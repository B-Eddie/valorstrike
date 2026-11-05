// Remote Skye Seekers rows (a18NetSync): create at owner, move toward row p by elapsed flight fraction, end on drop. skxSeeker is a stub.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('function a18NetSync(rows) {'),j=html.indexOf('const a18FxSync0');assert(i>0&&j>i);
const k=html.indexOf('function a18NetFree(r'),k2=html.indexOf('\n',k);
const log=[];const ctx=vm.createContext({MP:{me:7},a18Net:new Map(),A18VIS:{seeker:['orb',1]},units:new Map([[3,{g:{position:{x:0,y:0,z:0}}}]]),skxSeeker:(x,y,z)=>{log.push(['new',x,y,z]);return {move(a,b,c){log.push(['move',a,b,c]);}};},skxEnd:()=>log.push(['end']),a18NetMesh:()=>{throw new Error('generic mesh used')}});
vm.runInContext(html.slice(k,k2)+html.slice(i,j)+';this.sync=a18NetSync;',ctx);
const row=(tl,p)=>[{id:9,kind:'seeker',o:3,ag:'Skye',p,tl}];
ctx.sync(row(2,[10,1,0]));ctx.sync(row(1,[10,1,0]));
assert.deepEqual(log[0],['new',0,1,0]);assert.deepEqual(log[1].slice(1),[0,1,0]);assert.deepEqual(log[2].slice(1),[5,1,0]);
ctx.sync([]);assert.equal(log[log.length-1][0],'end');
console.log('skye seeker client: create at owner, lerp to target, end on drop (stub module)');
log.length=0;ctx.sync([{id:11,kind:'seeker',o:7,ag:'Skye',p:[1,0,1],tl:2}]);ctx.sync([{id:11,kind:'seeker',o:7,ag:'Skye',p:[1,0,1],tl:1}]);ctx.sync([]);assert.equal(log.length,0,'own Seekers row not drawn');console.log('own seekers skipped');
