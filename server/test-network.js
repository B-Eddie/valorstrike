// Virtual-clock transport regressions: bounded backpressure, burst recovery, fixed steps and same-seat resume.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Simulation} from './src/simulation.js';

let now=1_000_000;
const FakeDate=class extends Date{static now(){return now;}};
const source=fs.readFileSync('src/worker.js','utf8');
const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval:()=>1,clearInterval(){},Map,JSON,Number,Object,kits:JSON.parse(fs.readFileSync('src/kits.json','utf8'))};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',context);
const {GameRoom}=context;
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
function fresh(){const room=new GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}',{status:401})})}});room.advertise=()=>{};room.saveResults=async()=>{};room.sim=new Simulation(W);room.sim.start(false);room.last=now;return room;}
function seat(room,name='Agent',extra={}){const ws={frames:[],closed:null,send(data){this.frames.push(JSON.parse(data));},close(code,reason){this.closed={code,reason};}},u=room.sim.add(name);u.loading=false;room.sessions.set(ws,{id:name,u,window:now,count:0,last:now,ready:true,...extra});return ws;}
function pending(room){const ws={frames:[],closed:null,send(data){this.frames.push(JSON.parse(data));},close(code,reason){this.closed={code,reason};}};room.sessions.set(ws,{id:'new',u:null,last:now,ready:false});return ws;}
const msg=(room,ws,m)=>room.message(ws,JSON.stringify(m));
const advance=(room,ms)=>{const end=now+ms;while(now<end){now=Math.min(end,now+50);room.tick();}};

// A brief foreground rendering pause does not terminate a healthy session; heartbeat acknowledgement proves both ways.
{const room=fresh(),ws=seat(room);advance(room,20000);assert.equal(ws.closed,null);await msg(room,ws,{t:'hb',c:123});assert.deepEqual(ws.frames.at(-1),{t:'po',c:123,h:1});advance(room,20000);assert.equal(ws.closed,null);advance(room,26000);assert.equal(ws.closed.reason,'Connection idle');}
// Receive bursts after event-loop/network stalls are absorbed; sustained abuse is still capped.
{const room=fresh(),ws=seat(room);for(let i=0;i<170;i++)await msg(room,ws,{t:'hb'});assert.equal(ws.closed,null,'valid queued inputs must not trip a 1 s fixed window');now+=1000;for(let i=0;i<100;i++)await msg(room,ws,{t:'hb'});assert.equal(ws.closed,null);for(let i=0;i<160;i++)await msg(room,ws,{t:'hb'});assert.equal(ws.closed,null,'a burst past the credit is shed, not closed (queue 1e)');for(let i=0;i<600&&!ws.closed;i++)await msg(room,ws,{t:'hb'});assert.equal(ws.closed.reason,'Rate or size limit');}
// The application acknowledgement bounds queued state even when the runtime has no bufferedAmount property.
{const room=fresh(),ws=seat(room,'Flow',{ackMode:true,sent:0,acked:0});advance(room,1000);assert.equal(ws.frames.filter(m=>m.t==='s').length,GameRoom.FLOW.window);const s=room.sessions.get(ws);room.sim.events.push(['n','keep this event']);advance(room,50);assert.equal(s.pendingEvents.length,1);await msg(room,ws,{t:'hb',q:GameRoom.FLOW.window,c:0});advance(room,50);const frame=ws.frames.filter(m=>m.t==='s').at(-1);assert.equal(frame.q,GameRoom.FLOW.window+1);assert.deepEqual(frame.ev,[['n','keep this event']]);assert.equal(frame.serverTime,now);await msg(room,ws,{t:'hb',q:1e9});assert.equal(s.acked,GameRoom.FLOW.window,'invented future acknowledgements ignored');
 ws.bufferedAmount=100000;await msg(room,ws,{t:'hb',q:s.sent});const n=ws.frames.filter(m=>m.t==='s').length;advance(room,500);assert.equal(ws.frames.filter(m=>m.t==='s').length,n);ws.bufferedAmount=0;advance(room,50);assert.equal(ws.frames.filter(m=>m.t==='s').length,n+1);
 s.acked=s.sent;await msg(room,ws,{t:'vis',h:1});const h=ws.frames.filter(m=>m.t==='s').length;advance(room,500);assert.equal(ws.frames.filter(m=>m.t==='s').length,h);advance(room,500);assert.equal(ws.frames.filter(m=>m.t==='s').length,h+1,'hidden rendering does not consume 20 Hz state bandwidth');}
// Exact 50 ms steps eliminate jitter-dependent motor integration and cap recovery work after a long server pause.
{const room=fresh(),ws=seat(room),steps=[];room.sim.step=dt=>steps.push(dt);for(let i=0;i<20;i++)for(const ms of [47,53,42,58]){now+=ms;room.tick();}assert.equal(steps.length,80);assert(steps.every(dt=>dt===.05));now+=10000;room.sessions.get(ws).last=now;room.tick();assert.equal(steps.length,84,'at most four catch-up steps, no runaway simulation debt');}
// Transient failures preserve the original authoritative unit and resume without granting a new spawn or inventory.
{const room=fresh(),ws=seat(room,'Back',{resume:'resume-one',ackMode:true,sent:7,acked:4});room.host='Back';const u=room.sessions.get(ws).u;Object.assign(u,{x:3.25,hp:73,ammo:8,kills:4,lastSeq:100,input:{forward:1,fire:true}});const original={x:u.x,hp:u.hp,ammo:u.ammo,kills:u.kills,lastSeq:u.lastSeq,seq:u.seq};room.drop(ws,true);assert.equal(room.detached.size,1);assert(room.sim.units.includes(u));assert.deepEqual({...u.input},{});assert.equal(room.sim.phase,'game','last player may reconnect during grace');
 const back=pending(room);await msg(room,back,{t:'hi',resume:'resume-one',batch:1,ack:1});assert.equal(room.sessions.get(back).u,u);assert.equal(room.detached.size,0);assert.equal(back.frames.find(m=>m.t==='welcome').you,u.id);assert.equal(back.frames.find(m=>m.t==='start').resumed,1);await msg(room,back,{t:'ready'});for(const [k,v]of Object.entries(original))assert.equal(u[k],v,'resume preserves '+k);assert.equal(room.sessions.get(back).sent,0);
 // Blackholed live transports can be replaced before their timeout; a late old close cannot remove the new seat.
 const latest=pending(room);await msg(room,latest,{t:'hi',resume:'resume-one',batch:1,ack:1});assert.equal(back.closed.code,4001);room.drop(back,true);assert.equal(room.sessions.get(latest).u,u);await msg(room,latest,{t:'ready'});room.drop(latest,true);advance(room,GameRoom.RESUME+50);assert.equal(room.detached.size,0);assert.equal(room.sim.phase,'closed');assert(!room.sim.units.includes(u));const expired=pending(room);await msg(room,expired,{t:'hi',resume:'resume-one'});assert.equal(expired.closed.code,4003);}
// Lobby maintenance must not confuse a player waiting for the host with a stalled match loader.
{const room=fresh(),ws=seat(room,'Waiting',{resume:'lobby-resume',ready:false,loadStarted:now});room.sim.phase='room';for(let i=0;i<110;i++){advance(room,2000);await msg(room,ws,{t:'hb'});}assert.equal(ws.closed,null,'healthy lobby stays connected beyond the 180 s loading deadline');room.drop(ws,true);const back=pending(room);await msg(room,back,{t:'hi',resume:'lobby-resume',batch:1,ack:1});assert.equal(back.frames.find(m=>m.t==='welcome').resumed,1);assert.equal(back.frames.some(m=>m.t==='start'),false,'lobby resume does not start a match');assert.equal(room.sim.phase,'room');}
// Round state batches only when negotiated, and wire rounding leaves authoritative state untouched.
{const room=fresh(),ws=seat(room,'Wire',{batch:true});room.sim.mode='five';const value={t:'rs',tm:1.249999999999973,tl:99.85000000000002,status:{blind:.299999999999998,slow:0},sp:['plant',1,1.12345678,2,42.29999999999997,0,0,'A',1]};room.sim.roundState=()=>value;room.state(ws,room.sessions.get(ws),{t:'s',u:[],ev:[]},now);assert.equal(ws.frames.length,1);assert.equal(ws.frames[0].rs.status.blind,.3);assert.equal(value.status.blind,.299999999999998);assert(JSON.stringify(ws.frames[0].rs).length<JSON.stringify(value).length*.8);const old=seat(room,'Legacy');room.state(old,room.sessions.get(old),{t:'s',u:[],ev:[]},now);assert.deepEqual(old.frames.map(m=>m.t),['s','rs']);}
console.log('Network: foreground pause + bidirectional heartbeat, burst tolerance + sustained rate limit, bounded snapshot queue + retained events, hidden bandwidth, fixed 20 Hz bounded catch-up, same-seat resume + stale-socket takeover + expiry, negotiated Spike batching + wire precision');
// Real request admission/auth/socket events: a full 10-human room must admit only the bearer of an existing resume token.
{
 const {localCluster}=await import('./tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',QA_TEST_HOOKS:'true',QA_BOTS:'0'},prod:true}),code='NETRES';
 const connect=(name,query={},token)=>{const c={frames:[],welcome:null,error:null,close:null,socket:null};c.socket=cluster.connect({code,...query});c.socket.on('open',()=>c.socket.send(JSON.stringify({t:'hi',n:name,ag:'Jett',resume:token,batch:1,ack:1})));c.socket.on('error',e=>c.error=e);c.socket.on('close',e=>c.close=e);c.socket.on('message',m=>{c.frames.push(m);if(m.t==='welcome')c.welcome=m;if(m.t==='start')c.socket.send(JSON.stringify({t:'ready'}));});return c;};
 const settle=async predicate=>{for(let i=0;i<300&&!predicate();i++)await cluster.flush();assert(predicate(),'real worker socket handshake settled');};
 const clients=[];clients.push(connect('Full0',{create:1,mode:'tdm',map:'ascent'}));await settle(()=>clients[0].welcome);
 for(let i=1;i<10;i++){clients.push(connect('Full'+i));await settle(()=>clients[i].welcome);}
 const room=cluster.room(code);assert.equal(room.sessions.size,10);clients[0].socket.send(JSON.stringify({t:'start'}));await settle(()=>[...room.sessions.values()].every(s=>s.ready));
 const first=clients[0],unit=room.sim.units.find(u=>u.id===first.welcome.you),resume=first.welcome.resume;Object.assign(unit,{hp:71,ammo:7,kills:2,lastSeq:12345});
 const replacement=connect('Full0',{resume},resume);await settle(()=>replacement.welcome);assert.equal(first.close.code,4001);assert.equal(replacement.welcome.you,unit.id);assert.equal(room.sessions.size,10);assert.equal(room.sim.units.filter(u=>u.human).length,10);assert.equal(unit.hp,71);assert.equal(unit.ammo,7);assert.equal(unit.lastSeq,12345);
 const stranger=connect('Stranger',{resume:'wrong'});await settle(()=>stranger.error);assert.equal(room.sessions.size,10);
 replacement.socket.close();await cluster.flush();assert.equal(room.detached.size,1);const recovered=connect('Full0',{resume},resume);await settle(()=>recovered.welcome);assert.equal(recovered.welcome.you,unit.id);assert.equal(unit.kills,2);assert.equal(room.sessions.size,10);assert.equal(room.detached.size,0);
 for(const c of clients.slice(1).concat(recovered))c.socket.send(JSON.stringify({t:'bye'}));await cluster.flush();assert.equal(room.sessions.size,0);
 console.log('Network admission: real worker full 10-human room accepts same-seat stale-socket takeover and detached resume, rejects invalid bearer, preserves authoritative inventory/health/stats/sequence');
}
