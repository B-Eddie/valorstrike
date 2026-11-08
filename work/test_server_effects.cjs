const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const s=fs.readFileSync('work/server_runtime.js','utf8'),a=s.indexOf('const netWalls='),b=s.indexOf('const netShoot0=',a);
const html=fs.readFileSync('index.html','utf8'),xb=html.match(/var XBAR = (\{[^}]*\});/);assert.ok(xb,'index.html XBAR');const XBAR=vm.runInNewContext('('+xb[1]+')');
const {BARRIER}=require('vm').runInNewContext('({BARRIER:'+fs.readFileSync('server/src/abilities.js','utf8').match(/export const BARRIER=(\{[^}]*\});/)[1]+'})');assert.deepEqual({...XBAR},{...BARRIER},'client XBAR = server BARRIER');
class Resource{constructor(o){Object.assign(this,o||{})}dispose(){this.disposed=true}}
class Obj{constructor(){this.position={set:(x,y,z)=>Object.assign(this.position,{x,y,z})};this.rotation={};this.userData={};this.children=[];this.visible=true;}add(c){this.children.push(c)}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}class Group extends Obj{}
class BoxGeometry extends Resource{constructor(w,h,d){super({w,h,d})}}
const live=new Set(),c={THREE:{Mesh,Group,BoxGeometry,MeshLambertMaterial:Resource},XBAR,scene:{add:m=>live.add(m),remove:m=>live.delete(m)},J:{},NET:{socket:{}},sgBlk:()=>false,sgWallEnd:()=>{c.J.sw=null},Map,Set,Math,Array,Number,document:{getElementById:()=>null}};
c.bots=c.bots||[]/* netRevealClear walks the bots (df60c6c) */;vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.sync=netSyncEffects;globalThis.clear=netClearEffects;',c);
const W=XBAR.len/XBAR.segs,mid=i=>-XBAR.len/2+(i+.5)*W;
// a fresh wall: 4 segments of 2.6 m, 3 m tall, 0.4 m thick, laid along x (yaw 0), lifted 1.5 m to its centre
c.sync([{id:1,kind:'barrier',p:[0,5,-2.5],yaw:0,hp:1600,seg:[400,400,400,400]}]);assert.equal(live.size,1);const g=[...live][0];assert.ok(g instanceof Group);assert.equal(g.position.y,6.5);assert.equal(g.children.length,4);
g.children.forEach((q,i)=>{assert.ok(Math.abs(q.position.x-mid(i))<1e-9);assert.ok(Math.abs(q.geometry.w-W)<1e-9);assert.equal(q.geometry.h,3);assert.equal(q.geometry.d,.4);assert.equal(q.visible,true);});
for(let i=0;i<4;i++)assert.equal(c.sgBlk(mid(i),-2.5,.1,5),true,'segment '+i+' blocks');assert.equal(c.sgBlk(XBAR.len/2+.2,-2.5,.1,5),false,'past the end');assert.equal(c.sgBlk(0,-2.5,.4,0),false,'below');assert.equal(c.sgBlk(0,-1.5,.4,5),false,'beside');
// fortified (600) then segment 1 destroyed: a gap there, the others stay and keep blocking; same group (no rebuild)
c.sync([{id:1,kind:'barrier',p:[0,5,-2.5],yaw:0,hp:1800,seg:[600,0,600,600]}]);assert.equal([...live][0],g);assert.equal(g.children[1].visible,false);assert.equal(g.children[0].visible,true);assert.ok(Math.abs(g.children[0].material.opacity-.85)<1e-9);
assert.equal(c.sgBlk(mid(1),-2.5,.1,5),false,'broken segment is a gap');assert.equal(c.sgBlk(mid(0),-2.5,.1,5),true);assert.equal(c.sgBlk(mid(2),-2.5,.1,5),true);
c.sync([{id:1,kind:'barrier',p:[0,5,-2.5],yaw:0,hp:300,seg:[300,0,0,0]}]);assert.ok(Math.abs(g.children[0].material.opacity-.7)<1e-9);assert.equal(c.sgBlk(mid(3),-2.5,.1,5),false);
// an older row without seg: hp split evenly
c.sync([{id:2,kind:'barrier',p:[10,0,0],yaw:Math.PI/2,hp:1600}]);const g2=[...live].find(m=>m!==g);assert.deepEqual(g2.userData.seg,[400,400,400,400]);assert.equal(c.sgBlk(10,mid(0),.1,0),true,'rotated wall along z');
// wall gone from the snapshot: removed and every segment disposed
c.sync([{id:2,kind:'barrier',p:[10,0,0],yaw:Math.PI/2,hp:1600}]);assert.equal(live.has(g),false);g.children.forEach(q=>{assert.equal(q.geometry.disposed,true);assert.equal(q.material.disposed,true);});
// netClearEffects (leaving a match) disposes the Group's segments without touching a geometry the Group does not have
assert.doesNotThrow(()=>c.clear());assert.equal(live.size,0);g2.children.forEach(q=>{assert.equal(q.geometry.disposed,true);assert.equal(q.material.disposed,true);});
console.log('Server effect adapter: Barrier Orb = 4 segments (XBAR = server BARRIER), position/elevation, stable group across snapshots, per-segment gaps and collision, rotated wall, removal + netClearEffects dispose every segment');
