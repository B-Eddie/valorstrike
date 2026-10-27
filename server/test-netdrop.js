// Mid-round drops (queue 1e, user 21:32 2026-10-26: "Connection to the game server was interrupted. Try rejoining room 38XU4E."
// while playing online). The room must survive its own faults and a player's network hiccups:
//  (a) an exception from a client message or from the simulation tick during a live round is caught, logged and counted; the
//      room keeps ticking, nobody is disconnected and the other players keep receiving state;
//  (b) a player whose socket dropped keeps the seat for GameRoom.RESUME (90 s) and resumes into the same unit / room / state;
//      the backlog a stalled network delivers at once (inputs queued for ~20 s) is shed, not answered with a 1008 close;
//  (c) a brief stall (5-10 s with no messages, foreground or background) never disconnects an active player.
// Virtual clock + the GameRoom class sliced out of worker.js (as test-network.js), plus the real worker via local-cluster.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';

let now=1_000_000;
const FakeDate=class extends Date{static now(){return now;}};
const logged=[];const fakeConsole={error:(...a)=>logged.push(a.map(String).join(' ')),warn:(...a)=>logged.push(a.map(String).join(' ')),log(){}};
const source=fs.readFileSync('src/worker.js','utf8');
const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval:()=>1,clearInterval(){},Map,JSON,Number,Object,console:fakeConsole,kits:JSON.parse(fs.readFileSync('src/kits.json','utf8'))};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',context);
const {GameRoom}=context;
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
function fresh(){const room=new GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}',{status:401})})}});room.advertise=()=>{};room.saveResults=async()=>{};room.sim=new Simulation(W);room.sim.start(false);room.last=now;room.code='38XU4E';return room;}
function seat(room,name='Agent',extra={}){const ws={frames:[],closed:null,send(data){this.frames.push(JSON.parse(data));},close(code,reason){this.closed={code,reason};}},u=room.sim.add(name);u.loading=false;room.sessions.set(ws,{id:name,u,window:now,count:0,last:now,ready:true,resume:'resume-'+name,...extra});return ws;}
function pending(room){const ws={frames:[],closed:null,send(data){this.frames.push(JSON.parse(data));},close(code,reason){this.closed={code,reason};}};room.sessions.set(ws,{id:'new',u:null,last:now,ready:false});return ws;}
const msg=(room,ws,m)=>room.message(ws,JSON.stringify(m));
const advance=(room,ms,keep=[])=>{const end=now+ms;while(now<end){now=Math.min(end,now+50);for(const ws of keep){const s=room.sessions.get(ws);if(s)s.last=now;}room.tick();}};
const states=ws=>ws.frames.filter(m=>m.t==='s').length;

// (a) A throwing message handler (an ability / bot / NaN edge case inside sim.command) neither rejects message() nor drops anyone.
{const room=fresh(),a=seat(room,'A'),b=seat(room,'B');const command=room.sim.command.bind(room.sim);
 room.sim.command=(u,m)=>{if(m.t==='ab')throw new TypeError("Cannot read properties of undefined (reading 'x')");return command(u,m);};
 logged.length=0;await assert.doesNotReject(()=>msg(room,a,{t:'ab',k:'q'}),'a handler exception must be caught per message');
 assert.equal(a.closed,null);assert.equal(b.closed,null);assert.equal(room.sessions.size,2);assert(room.sim.units.includes(room.sessions.get(a).u));
 assert(logged.some(l=>/38XU4E/.test(l)&&/ab/.test(l)&&/reading 'x'/.test(l)),'the fault is logged with room, message type and error: '+logged.join(' / '));
 assert.equal(room.metrics.errors,1,'faults are counted');
 const n=states(b);advance(room,500,[a,b]);assert(states(b)>n,'the room keeps sending state after a message fault');
 await msg(room,a,{t:'in',seq:1,r:0,p:0,f:1});assert.equal(room.sessions.get(a).u.lastSeq,1,'later messages from the same player still apply');}
// (a) A throwing simulation step (live round) is caught; the room keeps ticking, nobody is dropped, state keeps flowing.
{const room=fresh(),a=seat(room,'A'),b=seat(room,'B');const step=room.sim.step.bind(room.sim);let bad=3,steps=0;
 room.sim.step=dt=>{steps++;if(bad>0){bad--;throw new RangeError('NaN position in bot path');}return step(dt);};
 logged.length=0;assert.doesNotThrow(()=>advance(room,1000,[a,b]),'a tick exception must not escape the room timer');
 assert.equal(a.closed,null);assert.equal(b.closed,null);assert.equal(room.sessions.size,2);assert.equal(room.sim.phase,'game');
 assert(steps>=19,'the simulation keeps stepping after the fault ('+steps+')');assert(states(a)>=15&&states(b)>=15,'state keeps flowing: '+states(a)+' / '+states(b));
 assert(logged.some(l=>/38XU4E/.test(l)&&/NaN position/.test(l)),'tick fault logged: '+logged.join(' / '));assert.equal(room.metrics.errors,3);
 // A fault that repeats every tick is logged with a bound, not 20 lines a second forever.
 room.sim.step=()=>{throw new Error('stuck');};logged.length=0;advance(room,20000,[a,b]);assert(logged.length<=25,'repeating faults are rate limited in the log ('+logged.length+')');assert.equal(a.closed,null);
 // A snapshot / fog fault for one tick does not stop the next one.
 room.sim.step=step;const snap=room.sim.snapshot.bind(room.sim);let once=true;room.sim.snapshot=()=>{if(once){once=false;throw new Error('snapshot fault');}return snap();};
 const before=states(b);assert.doesNotThrow(()=>advance(room,500,[a,b]));assert(states(b)>before);}
// (b) The seat is kept for the grace period: a mid-round drop resumes 60 s later into the same unit, inventory and score.
{const room=fresh(),a=seat(room,'A',{ackMode:true,sent:0,acked:0}),b=seat(room,'B');assert(GameRoom.RESUME>=90000,'seat grace >= 90 s (was 30 s): '+GameRoom.RESUME);
 const u=room.sessions.get(a).u;Object.assign(u,{hp:64,ammo:11,kills:3,credits:2100,lastSeq:77});room.drop(a,true);assert.equal(room.detached.size,1);
 advance(room,60000,[b]);assert(room.sim.units.includes(u),'unit still in the round after 60 s');assert.equal(room.detached.size,1);
 const back=pending(room);await msg(room,back,{t:'hi',resume:'resume-A',batch:1,ack:1});assert.equal(back.closed,null);const w=back.frames.find(m=>m.t==='welcome');assert.equal(w?.you,u.id);assert.equal(w.resumed,1);
 assert.equal(back.frames.find(m=>m.t==='start')?.resumed,1,'resumes straight into the running match');await msg(room,back,{t:'ready'});
 for(const [k,v]of Object.entries({hp:64,ammo:11,kills:3,credits:2100,lastSeq:77}))assert.equal(u[k],v,'resume keeps '+k);
 advance(room,200,[back,b]);assert(states(back)>0,'resumed player receives state');}
// (b) After a ~20 s network stall the client's queued inputs arrive at once (20 Hz inputs + heartbeats ~ 420 messages): the
// excess is shed without a 1008 close (the page treats 1008 as final). A sustained flood is still closed.
{const room=fresh(),a=seat(room,'A');for(let i=1;i<=420;i++)await msg(room,a,{t:'in',seq:i,r:0,p:0,f:1});
 assert.equal(a.closed,null,'a stall backlog must not close the socket: '+JSON.stringify(a.closed));
 now+=1000;await msg(room,a,{t:'in',seq:999,r:0,p:0,f:0});assert.equal(room.sessions.get(a).u.lastSeq,999,'inputs apply again once the burst has passed');
 for(let i=0;i<2000&&!a.closed;i++)await msg(room,a,{t:'hb'});assert.equal(a.closed?.code,1008,'sustained abuse is still closed');}
// (c) A brief stall never disconnects an active player: 10 s of silence (long frame / mobile throttling) foreground, and a
// 10 s background with the 'vis' signal; heartbeats afterwards are answered.
{const room=fresh(),a=seat(room,'A'),b=seat(room,'B');advance(room,10000,[b]);assert.equal(a.closed,null);assert.equal(room.sessions.size,2);
 await msg(room,a,{t:'hb',c:1});assert.deepEqual(a.frames.at(-1),{t:'po',c:1,h:1});
 await msg(room,a,{t:'vis',h:1});advance(room,10000,[b]);assert.equal(a.closed,null);await msg(room,a,{t:'vis',h:0});await msg(room,a,{t:'in',seq:5,r:0,p:0,f:1});assert.equal(room.sessions.get(a).u.lastSeq,5);
 advance(room,5000,[b]);assert.equal(a.closed,null);}
console.log('Net drop: message + tick faults caught/logged/rate-limited (room and players kept), 90 s seat grace resumes same unit/state, stall backlog shed without 1008, 10 s stalls tolerated');

// Real worker module (local-cluster): a simulation fault mid-round keeps both real sockets open and the room ticking.
{const {localCluster}=await import('./tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',QA_TEST_HOOKS:'true',QA_BOTS:'2'},prod:true}),code='DRPQAX';
 const connect=(name,query={})=>{const c={frames:[],welcome:null,close:null,socket:null,states:0};c.socket=cluster.connect({code,...query});c.socket.on('open',()=>c.socket.send(JSON.stringify({t:'hi',n:name,ag:'Jett',batch:1,ack:1})));c.socket.on('close',e=>c.close=e);c.socket.on('message',m=>{if(m.t==='welcome')c.welcome=m;if(m.t==='s'){c.states++;if(m.q)c.socket.send(JSON.stringify({t:'hb',q:m.q}));}if(m.t==='start')c.socket.send(JSON.stringify({t:'ready'}));});return c;};
 const settle=async p=>{for(let i=0;i<400&&!p();i++)await cluster.flush();assert(p(),'settled');};
 const a=connect('RealA',{create:1,mode:'tdm',map:'ascent'});await settle(()=>a.welcome);const b=connect('RealB');await settle(()=>b.welcome);
 const room=cluster.room(code);a.socket.send(JSON.stringify({t:'start'}));await settle(()=>[...room.sessions.values()].every(s=>s.ready));
 const step=room.sim.step.bind(room.sim);let bad=2;room.sim.step=dt=>{if(bad>0){bad--;throw new TypeError('live-round fault');}return step(dt);};
 const before=b.states;await cluster.advance?.(2000);for(let i=0;i<60;i++)await cluster.flush();
 assert.equal(a.close,null,'real socket A kept');assert.equal(b.close,null,'real socket B kept');assert.equal(room.sessions.size,2);assert(b.states>before,'real room keeps sending state');
 for(const c of [a,b])c.socket.send(JSON.stringify({t:'bye'}));await cluster.flush();
 console.log('Net drop (real worker): a live-round simulation fault keeps both sockets and the room running');}
