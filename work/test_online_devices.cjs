// Online device models (qa-22): the server's snapshot device rows (server/src/devices.js deviceRows) drawn by the client
// (work/server_runtime.js netSyncDevices) with the offline placeholders + their real models (xvDevice slug / height as
// xvDevicesTick offline); own rows skipped (the local cast draws them); ally / enemy colours; Trapwire = 2 anchors + wire;
// spent Trademark = its slow field; rows that stop coming are freed (own geometry + material, never shared ones).
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8'),a=s.indexOf('const netWalls='),b=s.indexOf('const netShoot0=',a);
class Res{constructor(o){Object.assign(this,o||{})}dispose(){this.disposed=(this.disposed||0)+1}clone(){return new Res(this)}}
class Obj{constructor(){const v=(o)=>Object.assign(o,{set(x,y,z){Object.assign(this,{x,y,z});return this;},setScalar(n){return this.set(n,n,n);}});this.position=v({x:0,y:0,z:0});this.scale=v({x:1,y:1,z:1});this.rotation={x:0,y:0,z:0};this.userData={};this.children=[];this.visible=true;}add(c){this.children.push(c)}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}class Group extends Obj{}
class BoxGeometry extends Res{constructor(w,h,d){super({w,h,d})}}
const shared={kjTur:new Res({n:'kjTur'}),kjBox:new Res({n:'kjBox'}),orbGeo:new Res({n:'orb'}),slowGeo:new Res({n:'slow'})},fm=new Res({n:'fireMat'});
const live=new Set(),xv=[],c={THREE:{Mesh,Group,BoxGeometry,MeshLambertMaterial:Res},...shared,okMat:col=>new Res({col}),fireMat:()=>fm,XTMK:{r:6},XBAR:{len:10.4,segs:4,h:3,th:.4,hp:400,fort:200},
 xvDevice:(m,slug,h)=>{xv.push([m.userData.netDev,slug,+h.toFixed(3)]);m.userData.xvDevice={};},xvDeviceReset:m=>{m.userData.reset=1;},
 scene:{add:m=>live.add(m),remove:m=>live.delete(m)},J:{},NET:{socket:{}},MP:{me:1},allies:[{nid:2}],sgBlk:()=>false,sgWallEnd:()=>{},netSyncCb:()=>{},Map,Set,Math,Array,Number,Object,document:{getElementById:()=>null}};
vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.sync=netSyncEffects;globalThis.clear=netClearEffects;globalThis.devs=netDevs;',c);
const row=(id,d,o,extra)=>Object.assign({id,kind:'dev',d,o,tm:0,p:[1,0,-5],hp:20},extra||{});
(async()=>{
// 1. every kind from another player: placeholder + real model (slug / height as offline)
c.sync([row(10,'turret',3,{yaw:0,hp:100}),row(11,'alarmbot',3),row(12,'trademark',3),row(13,'blastpack',3),row(14,'spycam',3),row(15,'owl',3,{p:[0,1.2,-8],hp:100}),row(16,'trapwire',3,{p:[-2,0,-6],q:[2,0,-6]})]);
assert.equal(c.devs.size,7);const slug={};for(const [k,sl,h] of xv)(slug[k]=slug[k]||[]).push([sl,h]);
assert.deepEqual(slug,{turret:[['turret',.9]],alarmbot:[['alarmbot',.45]],trademark:[['trademark',.3]],blastpack:[['blast-pack',.88]],spycam:[['spycam',.25]],owl:[['owl-drone',.7]],trapwire:[['trapwire',.2],['trapwire',.2]]},'real models (xvDevice) with the offline heights');
const T=c.devs.get(10).parts[0];assert.equal(T.geometry,shared.kjTur);assert.equal(T.position.y,.45);assert.ok(Math.abs(Math.abs(T.rotation.y)-Math.PI)<1e-9,'turret faces its yaw (rotation = atan2(fx, fz))');assert.equal(T.material.col,0xff4655,'enemy red');
const W=c.devs.get(16).parts;assert.equal(W.length,3);assert.deepEqual([W[0].position.x,W[1].position.x,W[0].position.y],[-2,2,.3]);assert.equal(W[2].scale.z,4,'wire spans the anchors');assert.equal(W[2].position.x,0);
assert.equal(c.devs.get(15).parts[0].position.y,1.2,'owl drone at its body');
// 2. own rows skipped; an ally's row in blue; updates move the same mesh
c.sync([row(10,'turret',3,{yaw:0,hp:60}),row(20,'turret',1,{yaw:0}),row(21,'alarmbot',2)]);assert.ok(!c.devs.has(20),'own device: drawn by the local cast');assert.equal(c.devs.get(21).parts[0].material.col,0x3fb4ff,'ally blue');assert.equal(c.devs.get(10).parts[0],T,'same mesh across snapshots');assert.equal(c.devs.get(10).hp,60);
// 3. rows that stopped coming are freed: own geometry + material disposed, shared geometry never; reset of the real model
const SP=[...live].find(m=>m.userData.netDev==='spycam');assert.ok(!SP,'spycam freed with the rows that stopped');assert.equal(shared.kjBox.disposed,undefined);assert.equal(shared.orbGeo.disposed,undefined);
assert.ok(W.every(m=>!live.has(m)&&m.material.disposed&&m.userData.reset!==undefined||m===W[2]),'trapwire anchors freed');assert.ok(W.every(m=>m.geometry.disposed),'trapwire own geometry disposed');
// 4. a spent Trademark: the trap hides, its 6 m field shows (shared fireMat, never disposed)
c.sync([row(30,'trademark',3),row(10,'turret',3,{yaw:0})]);c.sync([row(30,'trademark',3,{hp:0,fp:[4,0,-9]}),row(10,'turret',3,{yaw:0})]);const M=c.devs.get(30);assert.equal(M.parts[0].visible,false);assert.deepEqual([M.parts[1].position.x,M.parts[1].position.z,M.parts[1].scale.x],[4,-9,6/3.5]);
c.sync([row(10,'turret',3,{yaw:0})]);assert.equal(fm.disposed,undefined,'shared fireMat kept');assert.ok(!c.devs.has(30));
// 5. malformed rows ignored; netClearEffects (leaving a match) frees everything
c.sync([{kind:'dev',d:'turret',id:'x',p:[0,0,0]},{kind:'dev',d:'nuke',id:5,p:[0,0,0]},{kind:'dev',d:'turret',id:6,p:[0,NaN,0]},row(10,'turret',3,{yaw:0})]);assert.equal(c.devs.size,1);
c.clear();assert.equal(c.devs.size,0);assert.equal(live.size,0);
// 6. end to end: the real server's snapshot rows for each cast, as another player (MP.me 999) sees them
const {SpikeSimulation}=await import(path.join(root,'server/src/spike.js'));
const Wd={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const got=[];for(const [ag,k] of [['Killjoy','e'],['Killjoy','q'],['Cypher','c'],['Cypher','e'],['Chamber','c'],['Raze','q'],['Sova','c']]){const S=new SpikeSimulation(Wd,'five','ascent',()=>.5),u=S.add(ag,ag);S.start(false);S.buy=0;S.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0,alive:true});u.ability[k]=1;S.time+=.5;S.command(u,{t:'ab',k});
 c.MP.me=999;xv.length=0;c.sync(JSON.parse(JSON.stringify(S.snapshot().fx)));got.push(...[...c.devs.values()].map(d=>d.k));c.clear();}
assert.deepEqual(got.sort(),['alarmbot','blastpack','owl','spycam','trademark','trapwire','turret'],'every server device reaches the client as its model');
console.log('online devices: Turret / Alarmbot / Trapwire / Trademark / Blast Pack / Spycam / Owl Drone rows -> real models (xvDevice, offline heights), own skipped, ally / enemy colour, Trapwire anchors + wire, spent Trademark field, freed when gone (own geometry only), malformed rows ignored, netClearEffects; end to end from the real server snapshot');
})().catch(e=>{console.error(e);process.exit(1);});
