// Online Trapwire: module look (cyxTrapwire) created once per row, plain parts hidden, ended when the row drops. THREE/cyx are stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncDevices(rows){'),dA=html.indexOf('function netDevDrop(id){'),dB=html.indexOf('\n',dA),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a&&dA>0);
const V=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},setScalar(){return this;},x:0,y:0,z:0});
const mk=()=>({position:V(),scale:V(),rotation:{x:0,y:0,z:0},visible:true,userData:{},raycast:null});
const log=[];const ctx=vm.createContext({Math,Number,Array,Object,MP:{me:7,team:0},allies:[],netAbDn:new Set(),netDevs:new Map(),netOwnDevs:new Map(),NET_DEV:{trapwire:1},netDevPart:()=>mk(),netDevFree:()=>{},netOwnGone(){},THREE:{Mesh:function(){return mk();},BoxGeometry:function(){}},okMat:()=>({}),scene:{add(){}},cyxTrapwire:(A,B)=>{log.push(['new',A.x,B.x]);return {id:1};},cyxEnd:()=>log.push(['end'])});
vm.runInContext(html.slice(a,b)+'\n'+html.slice(dA,dB)+';this.sync=netSyncDevices;',ctx);
const row=(x)=>[{kind:'dev',d:'trapwire',id:5,o:3,tm:1,p:[x,0,0],q:[x+4,0,0]}];
ctx.sync(row(0));ctx.sync(row(0));assert.deepEqual(log,[['new',0,4]],'module created once');
assert.ok([...ctx.netDevs.get(5).parts].every(p=>p.visible===false),'plain parts hidden under the module');
ctx.sync([]);assert.deepEqual(log[log.length-1],['end']);
console.log('net trapwire module overlay ok (stub)');
