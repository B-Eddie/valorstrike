// Online Trapwire: module look (cyxTrapwire) created once per row, plain parts hidden, ended when the row drops. THREE/cyx are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncDevices(rows){'),dA=html.indexOf('function netDevDrop(id){'),dB=html.indexOf('\n',dA),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a&&dA>0);
const V=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},setScalar(){return this;},x:0,y:0,z:0});
const mk=()=>({position:V(),scale:V(),rotation:{x:0,y:0,z:0},visible:true,userData:{},raycast:null});
const log=[];const ctx=vm.createContext({Math,Number,Array,Object,MP:{me:7,team:0},allies:[],netDevs:new Map(),netOwnDevs:new Map(),NET_DEV:{alarmbot:1,turret:1},netDevPart:()=>mk(),netDevFree:()=>{},netOwnGone(){},THREE:{Mesh:function(){return mk();},BoxGeometry:function(){}},okMat:()=>({}),scene:{add(){}},kjxAlarmbotAlert:(p)=>log.push(['alert']),kjxAlarmbotBoom:(p)=>log.push(['boom',p.x]),kjxTurretFire:(o,d,l)=>log.push(['fire',+l.toFixed(2)]),netAbDn:new Set(),kjxAlarmbotPlace:(p,y)=>log.push(['ab',p.x,y]),kjxTurretDeploy:(p,y)=>log.push(['tu',p.x,y])});
vm.runInContext(html.slice(a,b)+'\n'+html.slice(dA,dB)+';this.sync=netSyncDevices;',ctx);
const row=(x)=>[{kind:'dev',d:'alarmbot',id:5,o:3,tm:1,p:[x,0,0],yaw:0,age:0.05},{kind:'dev',d:'turret',id:6,o:3,tm:1,p:[x+2,0,0],yaw:1,age:0.1}];
ctx.sync(row(0));ctx.sync(row(0));
assert.deepEqual(log.map(l=>l[0]+l[1]),['ab0','tu2'],'each deploy look plays once per new row');
assert.ok(Math.abs(log[1][2]-Math.atan2(-Math.sin(1),-Math.cos(1)))<1e-9,'turret yaw uses the page facing convention');
ctx.sync([]);
const old=row(0).map(r=>({...r,id:r.id+10,age:30}));ctx.sync(old);assert.equal(log.length,2,'an old row first seen (late join) does not replay the deploy');
const noage=row(0).map(r=>{const q={...r,id:r.id+20};delete q.age;return q;});ctx.sync(noage);assert.equal(log.length,2,'a row without age never replays');
ctx.sync([]);ctx.sync(row(0));assert.equal(log.length,4,'a fresh re-placement plays');
// lifecycle signals (explicit server fields, not row disappearance)
ctx.sync([]);log.length=0;
const R=(ph,sn,extra)=>[{kind:'dev',d:'alarmbot',id:50,o:3,tm:1,p:[0,0,0],age:99,ph,...(extra||{})},{kind:'dev',d:'turret',id:51,o:3,tm:1,p:[10,0,0],age:99,sn,ft:[10,0.8,4]}];
ctx.sync(R(1,3));assert.deepEqual(log,[],'first sight (already alert, shots already fired) is only a baseline');
ctx.sync(R(2,3));assert.deepEqual(log,[],'running: no replay');
ctx.sync(R(2,5));assert.deepEqual(log,[['fire',4]],'one tracer per sight of an increased counter (increment of 2 -> 1 tracer per snapshot)');
ctx.sync(R(0,5));ctx.sync(R(1,5));assert.equal(log.filter(l=>l[0]==='alert').length,1,'alert on a 0->1 transition');
ctx.sync([R(3,5)[1],{kind:'dev',d:'alarmbot',id:50,o:3,tm:1,p:[7,0,0],ph:4,dn:1}]);ctx.sync([R(3,5)[1],{kind:'dev',d:'alarmbot',id:50,o:3,tm:1,p:[7,0,0],ph:4,dn:1}]);
assert.deepEqual(log.filter(l=>l[0]==='boom'),[['boom',7]],'detonation plays once from the explicit dn row');
assert.ok(!ctx.netDevs.has(50),'the detonated bot body is gone');
ctx.sync([R(3,5)[1]]);
ctx.sync([{kind:'dev',d:'alarmbot',id:60,o:3,tm:1,p:[1,0,0],ph:4,dn:1}]);assert.equal(log.filter(l=>l[0]==='boom').length,2,'a dn row first seen still plays (explicit event)');
console.log('net killjoy deploy look ok (stub)');
