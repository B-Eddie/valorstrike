// Online Raze Boom Bot: module body follows the row, lock pulse on ph 0->1 (known row only), boom once on dn, deploy only when fresh, ended with the row. Real netSyncDevices source; THREE / rzx are stubs (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncDevices(rows){'),dA=html.indexOf('function netDevDrop(id){'),dB=html.indexOf('\n',dA),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a&&dA>0);
const V=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},setScalar(){return this;},x:0,y:0,z:0});
const mk=()=>({position:V(),scale:V(),rotation:{x:0,y:0,z:0},visible:true,userData:{},raycast:null});
const log=[];const grp=()=>({position:V(),rotation:{y:0}});
const ctx=vm.createContext({Math,Number,Array,Object,MP:{me:7,team:0},allies:[],netAbDn:new Set(),netDevs:new Map(),netOwnDevs:new Map(),NET_DEV:{boombot:null},netDevPart:()=>mk(),netDevFree:()=>{},netOwnGone(){},THREE:{Mesh:function(){return mk();},BoxGeometry:function(){}},okMat:()=>({}),scene:{add(){}},
 rzxBoomBot:()=>{const g=grp();log.push(['body']);return {fx:{objs:[g]},g};},rzxEnd:()=>log.push(['end']),rzxBbDeploy:p=>log.push(['deploy',p.x]),rzxBbLock:p=>log.push(['lock',p.x]),rzxBoomBotBlast:(p,r)=>log.push(['boom',p.x,r])});
vm.runInContext(html.slice(a,b)+'\n'+html.slice(dA,dB)+';this.sync=netSyncDevices;',ctx);
const row=(o={})=>[{kind:'dev',d:'boombot',id:5,o:3,tm:1,p:[1,0,2],hp:60,yaw:0,...o}];
ctx.sync(row({age:3,ph:1}));assert.deepEqual(log,[['body']],'old row first seen: body only - no deploy replay, no lock pulse (baseline)');
ctx.sync(row({age:3,ph:1}));assert.equal(log.length,1);
const g=ctx.netDevs.get(5).jx.g;assert.deepEqual([g.position.x,g.position.z],[1,2]);ctx.sync(row({p:[4,0,2],ph:1}));assert.equal(g.position.x,4,'body follows the row');
ctx.sync([]);log.length=0;ctx.sync(row({id:6,age:0.1,ph:0}));assert.deepEqual(log,[['deploy',1],['body']],'fresh placement: deploy once');
log.length=0;ctx.sync(row({id:6,ph:1}));assert.deepEqual(log,[['lock',1]],'ph 0 -> 1 on a known row: lock pulse once');ctx.sync(row({id:6,ph:1}));ctx.sync(row({id:6,ph:2}));assert.equal(log.length,1);
log.length=0;ctx.sync(row({id:6,ph:4,dn:1,hp:0}));ctx.sync(row({id:6,ph:4,dn:1,hp:0}));assert.deepEqual(log.filter(l=>l[0]==='boom'),[['boom',1,6]],'dn row: one boom');assert.ok(log.some(l=>l[0]==='end'),'the body ends at the dn row (not in the kept rows)');
ctx.sync([]);log.length=0;ctx.sync(row({id:8,age:3}));log.length=0;ctx.sync([]);assert.deepEqual(log,[['end']],'row dropped without dn (shot down / expired): body ends, no boom');
log.length=0;ctx.sync(row({id:9,o:7}));assert.equal(log.length,0,'own bot: the local cast draws it');
console.log('net boombot lifecycle ok (real sync source, stub THREE/rzx, not rendered)');
// own bot: the server's row stops without a detonation -> the local one nearest the last server point is removed (real netOwnGone source)
{const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');const i=h.indexOf('function netOwnGone(d){'),j=h.indexOf('\nconst netAbDn',i);
 const gone=[];const near={m:{position:{x:1,z:2}},wu:null},windup={m:{position:{x:1.2,z:2}},wu:0.3},far={m:{position:{x:30,z:2}},wu:null},enemy={m:{position:{x:1,z:2}},en:true,wu:null};
 const c2=vm.createContext({Math,Number,Array,RS:{bb:[far,windup,enemy,near],pk:[]},J:{},BC:{},xBbGone:o=>gone.push(o),okRm(){},scene:{remove(){}}});
 vm.runInContext(h.slice(i,j)+';this.f=netOwnGone;',c2);c2.f({k:'boombot',p:[1,0,2]});
 assert.deepEqual(gone,[near],'only our non-detonating bot within 3 m is removed (not the windup one, not far, not the enemy)');assert.equal(c2.RS.bb.length,3);
 console.log('net boombot own-gone ok (real source)');}
