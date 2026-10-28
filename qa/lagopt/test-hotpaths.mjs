import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {TdmSimulation} from '../../server/src/tdm.js';import {Simulation} from '../../server/src/simulation.js';
import {roomAnchor,TDM_ROOM} from '../../server/src/tdmrooms.js';import {encodeSnapshot} from '../../server/src/snapshot-codec.js';import {LagMetrics} from '../../server/src/lag-metrics.js';import {fogView} from '../../server/src/fog.js';
const nodes=[];for(let x=-25;x<=25;x++)for(let z=-25;z<=25;z++)nodes.push([x,0,z]);
let blocked=false,calls=0;
const W={map:{key:'fixture',attacker:[-20,0,0],defender:[20,0,0],sites:{A:[0,0,0]}},nav:{nodes,adj:nodes.map(()=>[])},playable:nodes.map((_,i)=>i),ground:()=>0,near:()=>0,blocked:()=>{calls++;return blocked;},ray:()=>0};
const sim=new TdmSimulation(W,'tdm','fixture',()=>.5),u=sim.add('P'),v=sim.add('V');
function reference(u){const a=roomAnchor(sim,u.team),C=W.playable.map(i=>W.nav.nodes[i]).filter(p=>Math.hypot(p[0]-a[0],p[2]-a[2])<TDM_ROOM.radius-.5&&Math.abs(p[1]-a[1])<1&&!W.blocked(p[0],p[2],.43,p[1],1.92)),L=C.filter(p=>!sim.units.some(v=>v!==u&&v.alive&&Math.hypot(v.x-p[0],v.z-p[2])<1));return (L.length?L:C)[Math.floor(sim.random()*(L.length||C.length))]||a;}
let cases=0;
for(let k=0;k<1000;k++){u.team=k%2;v.x=(k%9)-22;v.z=k%7-3;v.alive=k%4!==0;const random=((k*16807)%2147483647)/2147483647;sim.random=()=>random;assert.deepEqual(sim.teamSpawnPoint(u),reference(u));cases++;}
calls=0;for(let k=0;k<100;k++)sim.teamSpawnPoint(u);assert.equal(calls,0,'static spawn cache performs no capsule queries');
W.dynamic=true;blocked=true;assert.deepEqual(sim.teamSpawnPoint(u),roomAnchor(sim,u.team),'dynamic blocker respected');blocked=false;assert.deepEqual(sim.teamSpawnPoint(u),reference(u));W.dynamic=false;
W.blocked=()=>true;assert.deepEqual(sim.teamSpawnPoint(u),roomAnchor(sim,u.team),'replaced collision invalidates cache');W.blocked=()=>false;
W.map.attacker[0]=-18;u.team=0;assert.deepEqual(sim.teamSpawnPoint(u),reference(u),'moved anchor invalidates cache');
// Worker path with real fog, negotiated/legacy states, held events, q baselines and send failure.
let now=100000;const ctx={DurableObject:class{constructor(c,e){this.ctx=c;this.env=e;}},Date:class extends Date{static now(){return now;}},performance,crypto:globalThis.crypto,TextEncoder,encodeSnapshot,LagMetrics,fogView,console,clearInterval(){},setInterval:()=>1};vm.createContext(ctx);
const src=fs.readFileSync('server/src/worker.js','utf8');vm.runInContext(src.slice(src.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.Room=GameRoom;',ctx);
const room=new ctx.Room({},{});room.sim=new Simulation(W,'tdm','fixture',()=>.5);room.sim.start(false);room.drop=()=>{};
const a=room.sim.add('A'),b=room.sim.add('B');a.team=0;b.team=1;Object.assign(a,{x:-20,z:0,loading:false});Object.assign(b,{x:20,z:0,loading:false});
const messages=[],ws={send(d){messages.push(JSON.parse(d));},bufferedAmount:0},s={u:a,ready:true,batch:true,ackMode:true,delta:true,sent:0,acked:0};room.sessions.set(ws,s);
const send=()=>{room.sim.time+=2;room.state(ws,s,room.sim.snapshot(),now);s.acked=s.sent;return messages.at(-1);};
const first=send();assert.equal(first.t,'s');assert.equal(first.u[1][22],1);assert.equal(first.u[1][4],0,'hidden position never enters full baseline');
Object.assign(b,{x:-19,z:0});const reveal=send();assert.equal(reveal.t,'sd');assert(reveal.u.some(p=>p.includes(-19)),'visible position arrives as patch');Object.assign(b,{x:20,z:0});send();assert.equal(s.deltaBase.rows[1][4],0,'hidden again erases historical wire position');
s.acked=0;s.sent=ctx.Room.FLOW.window;room.sim.events.push(['n','held']);send();assert.equal(s.pendingEvents.length,1);s.acked=s.sent;const held=send();assert.deepEqual(Array.from(held.ev[0]),['n','held']);assert.equal(s.pendingEvents.length,0);
await room.message(ws,JSON.stringify({t:'resync'}));assert.equal(s.deltaBase,null);assert.equal(s.acked,s.sent);assert.equal(send().t,'s','explicit resync releases flow credit and emits full keyframe');
s.delta=false;assert.equal(send().t,'s','legacy full-state compatibility');s.delta=true;const base=s.deltaBase;ws.send=()=>{throw Error('closed');};send();assert.equal(s.deltaBase,base,'failed send never commits baseline');
const lag=new LagMetrics(8);for(let i=0;i<30;i++)lag.add('x',i);assert.equal(lag.series.get('x').values.length,8);assert.equal(lag.report().x.max,29);assert.equal(lag.report().x.count,30);
console.log(`Lag hot paths: ${cases} spawn selections match the original with occupancy/RNG; static queries zero, dynamic/collision/anchor invalidation; fog-safe deltas; legacy; retained events; resync; send failure; bounded diagnostics`);
// Bit-identical room queries at boundary points and random positions (native Math.hypot reference).
function blockedRef(s,u,x,z,r,y){if(!s.spawnRooms)return false;for(const team of [0,1]){if(team===u.team&&!u.roomLeft)continue;const p=roomAnchor(s,team);if(Math.abs(y-p[1])<TDM_ROOM.height&&Math.hypot(x-p[0],z-p[2])<TDM_ROOM.radius+r)return true;}return false;}
const {roomBlocked}=await import('../../server/src/tdmrooms.js');
for(let i=0;i<10000;i++){u.team=i%2;u.roomLeft=i%3===0;const x=i%53-25,z=i%19-9,y=i%9-4;assert.equal(roomBlocked(sim,u,x,z,.4,y),blockedRef(sim,u,x,z,.4,y));}
const {SpikeSimulation}=await import('../../server/src/spike.js');
const left=new TdmSimulation(W,'tdm','fixture',()=>.5),right=new TdmSimulation(W,'tdm','fixture',()=>.5),lu=left.add('Motor'),ru=right.add('Motor');
right.motor=function(u,input,dt){const w=this.world,view=Object.create(w);view.blocked=(x,z,r,y,h)=>blockedRef(this,u,x,z,r,y)||w.blocked(x,z,r,y,h);this.world=view;try{return SpikeSimulation.prototype.motor.call(this,u,input,dt);}finally{this.world=w;}};
Object.assign(lu,{x:0,y:0,z:0});Object.assign(ru,{x:0,y:0,z:0});
for(let i=0;i<3000;i++){const input={x:Math.sin(i/20),z:Math.cos(i/27),speed:6.75,jump:i%39<5,duck:i%17<4,walk:i%11<2};lu.roomLeft=ru.roomLeft=i%101<50;left.motor(lu,{...input},.016);right.motor(ru,{...input},.016);for(const k of ['x','y','z','vx','vy','vz','ch','air','rope'])assert.equal(lu[k],ru[k],`motor exact ${i}/${k}`);}
const saved=left.world;left.motorFn=()=>{throw Error('fixture');};assert.throws(()=>left.motor(lu,{},.05),/fixture/);assert.equal(left.world,saved,'world restored on exception');
console.log('Room queries: 10k native-math parity cases; motor: 3k exact paired steps with jumps/crouch/room blockers, plus exception restoration');
const diagRoom=new ctx.Room({},{LAG_DIAGNOSTICS:'true'});diagRoom.sim=new Simulation(W,'tdm','fixture',()=>.5);diagRoom.advertise=()=>{};diagRoom.sim.start(false);const du=diagRoom.sim.add('Diag');du.loading=false;diagRoom.last=now-50;
const dw={send(){},bufferedAmount:0};diagRoom.sessions.set(dw,{u:du,last:now,ready:true,pingAt:now});diagRoom.tickBody();const report=diagRoom.lag.report();assert.equal(report.tickMs.count,1);assert.equal(report.simulationMs.count,1);assert.equal(report.snapshotBuildMs.count,1);assert(report.wireBytes.max>0);assert(report.messages.max>0);assert.equal(diagRoom.metrics.errors||0,0);
const beforeBytes=diagRoom.lag.wireBytes,payload={t:'note',text:'⚡雪😀'};diagRoom.send(dw,payload);assert.equal(diagRoom.lag.wireBytes-beforeBytes,Buffer.byteLength(JSON.stringify(payload)),'diagnostic counts UTF-8 bytes, including unicode');
console.log('Opt-in server tick breakdown, simulation/snapshot/fanout, message counts and exact UTF-8 byte instrumentation execute without faults');
