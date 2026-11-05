// Online Trapwire: module look (cyxTrapwire) created once per row, plain parts hidden, ended when the row drops. THREE/cyx are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncDevices(rows){'),dA=html.indexOf('function netDevDrop(id){'),dB=html.indexOf('\n',dA),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a&&dA>0);
const V=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},setScalar(){return this;},x:0,y:0,z:0});
const mk=()=>({position:V(),scale:V(),rotation:{x:0,y:0,z:0},visible:true,userData:{},raycast:null});
const log=[];const ctx=vm.createContext({Math,Number,Array,Object,MP:{me:7,team:0},allies:[],netDevs:new Map(),netOwnDevs:new Map(),NET_DEV:{alarmbot:1,turret:1},netDevPart:()=>mk(),netDevFree:()=>{},netOwnGone(){},THREE:{Mesh:function(){return mk();},BoxGeometry:function(){}},okMat:()=>({}),scene:{add(){}},kjxAlarmbotPlace:(p,y)=>log.push(['ab',p.x,y]),kjxTurretDeploy:(p,y)=>log.push(['tu',p.x,y])});
vm.runInContext(html.slice(a,b)+'\n'+html.slice(dA,dB)+';this.sync=netSyncDevices;',ctx);
const row=(x)=>[{kind:'dev',d:'alarmbot',id:5,o:3,tm:1,p:[x,0,0],yaw:0},{kind:'dev',d:'turret',id:6,o:3,tm:1,p:[x+2,0,0],yaw:1}];
ctx.sync(row(0));ctx.sync(row(0));
assert.deepEqual(log.map(l=>l[0]+l[1]),['ab0','tu2'],'each deploy look plays once per new row');
assert.ok(Math.abs(log[1][2]-Math.atan2(-Math.sin(1),-Math.cos(1)))<1e-9,'turret yaw uses the page facing convention');
ctx.sync([]);ctx.sync(row(0));assert.equal(log.length,4,'a re-created row replays');
console.log('net killjoy deploy look ok (stub)');
