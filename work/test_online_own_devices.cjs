// Own devices destroyed by the server (qa-23): the local cast draws our own Turret / Alarmbot / Trademark / Spycam /
// Trapwire / Blast Pack / Owl Drone and never heard that the server shot one down, so it stayed drawn until round end.
// work/server_runtime.js netSyncDevices now remembers our own rows and netOwnGone takes the local device nearest a row the
// server stopped sending away; a re-placed device elsewhere, another player's device, and netClearEffects are left alone.
// End to end: a real server Turret shot to 0 HP leaves the snapshot and the owner's local turret goes with it.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8'),a=s.indexOf('const netWalls='),b=s.indexOf('const netShoot0=',a);
class Res{constructor(o){Object.assign(this,o||{})}dispose(){}clone(){return new Res(this)}}
class Obj{constructor(){const v=(o)=>Object.assign(o,{set(x,y,z){Object.assign(this,{x,y,z});return this;},setScalar(n){return this.set(n,n,n);}});this.position=v({x:0,y:0,z:0});this.scale=v({x:1,y:1,z:1});this.rotation={x:0,y:0,z:0};this.userData={};this.children=[];this.visible=true;}add(c){this.children.push(c)}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}class Group extends Obj{}
const live=new Set(),P=(x,y,z)=>({x,y,z}),m=()=>{const o=new Obj();live.add(o);return o;};
const c={bots:[]/* netRevealClear walks the bots (df60c6c) */,THREE:{Mesh,Group,BoxGeometry:Res,MeshLambertMaterial:Res},kjTur:new Res(),kjBox:new Res(),orbGeo:new Res(),slowGeo:new Res(),okMat:()=>new Res(),fireMat:()=>new Res(),XTMK:{r:6},XBAR:{len:10.4,segs:4,h:3,th:.4,hp:400,fort:200},
 xvDevice(){},xvDeviceReset(){},scene:{add:o=>live.add(o),remove:o=>live.delete(o)},NET:{socket:{}},MP:{me:1},allies:[],sgBlk:()=>false,sgWallEnd(){},netSyncCb(){},Map,Set,Math,Array,Number,Object,document:{getElementById:()=>null},
 J:{},BC:{tm:[],cw:[],cam:null,cv:false},RS:{pk:[]},drEnds:0,okRm(o){if(o&&o.m)live.delete(o.m);},cyRm(W){live.delete(W.m);W.an.forEach(o=>live.delete(o));},drEnd(){c.drEnds++;c.J.dr=null;}};
c.drEnd=c.drEnd.bind(c);vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.sync=netSyncEffects;globalThis.clear=netClearEffects;globalThis.own=netOwnDevs;',c);
const row=(id,d,p,o=1,extra)=>Object.assign({id,kind:'dev',d,o,tm:0,p,hp:20},extra||{});
const place=()=>{const T=m(),A=m(),M=m(),C=m(),WM=m(),W1=m(),W2=m(),K=m();T.position=P(5,0,5);
 c.J.tur={m:T,p:T.position,hp:100};c.J.ab={m:A,p:P(-5,0,5)};c.BC.tm=[{m:M,p:P(0,.5,9)}];c.BC.cam={m:C,p:P(3,2,-7)};c.BC.cv=true;c.BC.cw=[{m:WM,an:[W1,W2],a:{x:-8,z:0},b:{x:-6,z:0}}];K.position=P(10,1,-10);c.RS.pk=[{m:K,t:1}];c.J.dr={t:5,tb:0};
 return {T,A,M,C,WM,W1,W2,K};};
const rows=[row(10,'turret',[5.3,0,5.1],1,{hp:100}),row(11,'alarmbot',[-5,0,5.4]),row(12,'trademark',[0.2,0,9]),row(13,'spycam',[3,2,-7.5],1,{hp:1}),row(14,'trapwire',[-8,0,0],1,{q:[-6,0,0]}),row(15,'blastpack',[11.5,1,-9]),row(16,'owl',[0,3,0],1,{hp:100})];
(async()=>{
// 1. our own rows are remembered, never drawn as net devices (the local cast draws them)
let L=place();c.sync(rows);assert.equal(c.own.size,7);assert.equal(c.devs?c.devs.size:0,0);
// 2. each row the server stops sending takes the local device away
for(const [id,check] of [[10,()=>c.J.tur===null&&!live.has(L.T)],[11,()=>c.J.ab===null&&!live.has(L.A)],[12,()=>c.BC.tm.length===0&&!live.has(L.M)],[13,()=>c.BC.cam===null&&c.BC.cv===false&&!live.has(L.C)],[14,()=>c.BC.cw.length===0&&![L.WM,L.W1,L.W2].some(o=>live.has(o))],[15,()=>c.RS.pk.length===0&&!live.has(L.K)],[16,()=>c.drEnds===1&&c.J.dr===null]]){
 const left=rows.filter(r=>r.id>id);c.sync(left);assert.ok(check(),'server row '+id+' gone: local device removed');}
assert.equal(c.own.size,0);
// 3. a re-placed turret (new id, elsewhere) is not taken by the old row's end; another player's row is not ours
L=place();c.sync([row(20,'turret',[50,0,50],1,{hp:100}),row(21,'turret',[5,0,5],2,{hp:100})]);c.sync([]);assert.ok(c.J.tur&&live.has(L.T),'old turret row 50 m away: the local turret stays');
// 4. Owl Drone: its own timeout stays local (row ends with < 0.4 s left: no drEnd)
c.drEnds=0;c.J.dr={t:.2,tb:0};c.sync([row(30,'owl',[0,3,0],1,{hp:100})]);c.sync([]);assert.equal(c.drEnds,0);
// 5. netClearEffects forgets our rows (a round reset does not remove the next round's devices)
c.sync([row(40,'turret',[5,0,5],1,{hp:100})]);c.clear();assert.equal(c.own.size,0);c.sync([]);assert.ok(c.J.tur,'cleared: nothing removed');
// 6. end to end: a real server Turret shot down leaves the owner's snapshot rows, and the local turret goes
const {SpikeSimulation}=await import(path.join(root,'server/src/spike.js'));const {damageDevice}=await import(path.join(root,'server/src/devices.js'));
const Wd={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const S=new SpikeSimulation(Wd,'five','ascent',()=>.5),u=S.add('KJ','Killjoy');S.start(false);S.buy=0;S.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0,alive:true});u.ability.e=1;S.time+=.5;assert.equal(S.command(u,{t:'ab',k:'e'}),true);
const e=S.effects.find(x=>x.kind==='turret');c.MP.me=u.id;L=place();c.J.tur.p.x=e.p[0];c.J.tur.p.z=e.p[2];c.sync(JSON.parse(JSON.stringify(S.snapshot().fx)));assert.equal(c.own.size,1);assert.ok(c.J.tur);
damageDevice(S,e,1000);c.sync(JSON.parse(JSON.stringify(S.snapshot().fx)));assert.equal(c.J.tur,null,'server shot it down: the owner\'s local turret is gone');assert.ok(!live.has(L.T));
console.log('online own devices: Turret / Alarmbot / Trademark / Spycam (view closed) / Trapwire / Blast Pack / Owl Drone removed locally when the server stops their row; re-placed / others\' / timed-out / cleared left alone; end to end from a real server Turret shot down');
})().catch(e=>{console.error(e);process.exit(1);});
