// Online Chamber Trademark: module body (chxTrademarkPlace) built at the row's age, replaced by chxSlowField (at the remaining time) on the server's fp, ended with the row. Real netSyncDevices source; THREE/chx are stubs (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncDevices(rows){'),dA=html.indexOf('function netDevDrop(id){'),dB=html.indexOf('\n',dA),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a&&dA>0);
const V=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},setScalar(){return this;},x:0,y:0,z:0});
const mk=()=>({position:V(),scale:V(),rotation:{x:0,y:0,z:0},visible:true,userData:{},raycast:null});
const log=[];
const ctx=vm.createContext({Math,Number,Array,Object,MP:{me:7,team:0},allies:[],netAbDn:new Set(),netDevs:new Map(),netOwnDevs:new Map(),NET_DEV:{trademark:null},netDevPart:()=>mk(),netDevFree:()=>{},netOwnGone(){},THREE:{Mesh:function(){return mk();}},slowGeo:{},fireMat:()=>({}),XTMK:{r:6},scene:{add(){}},
 chxTrademarkPlace:p=>{log.push(['body',p.x]);return {fx:{age:0}};},chxSlowField:(p,r,s)=>{log.push(['field',p.x,r,s]);return {fx:{age:0}};},chxEnd:h=>log.push(['end',h.fx.age])});
vm.runInContext(html.slice(a,b)+'\n'+html.slice(dA,dB)+';this.sync=netSyncDevices;',ctx);
const row=(o={})=>[{kind:'dev',d:'trademark',id:5,o:3,tm:1,p:[1,0,2],hp:20,age:1.5,...o}];
ctx.sync(row());ctx.sync(row({age:1.6}));assert.deepEqual(log,[['body',1]],'body once');assert.equal(ctx.netDevs.get(5).jx.fx.age,1.5,'built at the row age (late join: no 2 s growth replay)');
log.length=0;ctx.sync(row({hp:0,fp:[4,0,4],fl:3.2}));assert.deepEqual(log,[['end',1.5],['field',4,6,4]],'trap body ends, slow field starts on fp');assert.ok(Math.abs(ctx.netDevs.get(5).fld.fx.age-0.8)<1e-9,'field rebuilt at its current age (4 - 3.2 s left)');
log.length=0;ctx.sync(row({hp:0,fp:[4,0,4],fl:3.1}));assert.equal(log.length,0,'one field per row');
ctx.sync([]);assert.equal(log[log.length-1][0],'end','field ended with the row');
console.log('net trademark module ok (real sync source, stub THREE/chx, not rendered)');
