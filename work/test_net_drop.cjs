// Mid-round drops (queue 1e, user 21:32 2026-10-26: "Connection to the game server was interrupted. Try rejoining room 38XU4E.").
// The production transport (server_runtime.js netConnect..netTransportTick, as installed in index.html) with a controlled
// clock and sockets:
//  1. A worker that never sends 'welcome' (the deployed worker as probed 2026-10-26 23:50 EDT: hello / room / start / s, no
//     welcome, no reply to 'hb') must not be torn down by the handshake watchdog 20 s into a live match, nor by lobby silence:
//     the page treated "no welcome after 20 s" as a dead handshake, had no resume token, and showed the catch-all error.
//  2. A mid-round 1006 drop whose reconnects keep failing (room unreachable) retries with growing backoff, keeps the match for
//     the server's 90 s seat grace, recovers the same seat when the room answers ~45 s later, and when it never does, the
//     final error names the close code and the attempts.
//  3. 1008 'Rate or size limit' (a stalled network delivering its queued inputs at once) reconnects; 'Room full' stays final.
//  4. 4003 'Resume expired' says the seat was released, with the code.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/server_runtime.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');
const production=src.slice(src.indexOf('function netConnect('),src.indexOf('mpCreate=function'));
assert(html.includes(production),'the shipped page must include the tested transport');
let now=1000,id=0;const timers=new Map(),sockets=[],messages=[],events=[];
const timer=(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;};
const advance=ms=>{const end=now+ms;while(true){let next;for(const [i,t]of timers)if(t.at<=end&&(!next||t.at<next[1].at))next=[i,t];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
let autoFail=false;
class Socket{
 constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];this.at=now;sockets.push(this);if(autoFail)timer(()=>{if(this.readyState===0){this.readyState=3;this.onclose&&this.onclose({code:1006,reason:''});}},30);}
 send(d){const m=JSON.parse(d);this.sent.push(m);if(this.legacy&&m.t==='pi')timer(()=>this.receive({t:'po',c:m.c}),40);}
 close(){this.readyState=3;if(this.onclose)this.onclose({code:1000,reason:''});}
 receive(m){this.onmessage({data:JSON.stringify(m)});}
 async open(){this.readyState=1;await this.onopen();}
 disconnect(code=1006,reason=''){this.readyState=3;this.onclose({code,reason});}
}
const c={NET:{url:'http://localhost:8787',epoch:0},MP:{map:'ascent',mode:'tdm',name:'QA'},window:{},WebSocket:Socket,URLSearchParams,performance:{now:()=>now},Date,document:{hidden:false},setTimeout:timer,clearTimeout:i=>timers.delete(i),J:{pick:'Jett'},keys:{KeyW:true},fireHeld:true,running:true,player:{x:0,y:0,z:0},WEAP:{Classic:{}},netProfileToken:async()=> 'profile-token',netHbStart(){},netVisibility(){},netReynaClear(){},netClearEffects(){},mpEl:()=>null,mpMsg:m=>messages.push(m),mpUI(){},netSyncEffects(){},mpCliMsg:m=>events.push(m.t),mpCliSnap:m=>events.push('snapshot'),mpCliRS:m=>events.push('round-state'),mpExitGame:()=>events.push('exit')};
c.mpReset=()=>{const old=c.NET.socket;c.NET.socket=null;c.NET.epoch++;timers.delete(c.NET.retryTimer);c.NET.retryTimer=0;c.NET.reconnecting=false;c.NET.resume=null;c.NET.ready=false;c.MP.on=false;c.MP.role=null;c.MP.st='idle';if(old)old.close();};
vm.createContext(c);
vm.runInContext(src.slice(src.indexOf('function netSend('),src.indexOf('\nlet netSessionToken='))+'\n'+src.slice(src.indexOf('function netClean('),src.indexOf('function netConnect('))+'\n'+production,c);
const row=[7,0,'QA','Jett',4,0,5,0,83,25,1,'Classic',1,0,2];
const start={t:'start',v:2,you:7,team:0,mode:'tdm',map:'ascent',u:[row],tl:300,k:{},d:{}};
const snap=q=>({t:'s',tl:200,u:[row],k:{},d:{},ev:[],serverTime:Date.now()});
// Run the page's timers for ms: the 1 s transport watchdog, with snapshots from the socket every 50 ms while feed() says so.
const play=(ms,feed)=>{const end=now+ms;while(now<end){advance(50);const ws=c.NET.socket;if(feed&&ws&&ws.readyState===1&&feed(ws))ws.receive(snap());if(now%1000<50)c.netTransportTick();}};
const live=()=>{c.MP.st='game';c.MP.on=true;c.MP.role='client';c.NET.ready=true;c.NET.loadAt=0;};
const lastMsg=()=>messages.at(-1)||'';
(async()=>{
 // 1. Worker without 'welcome' (deployed worker): live match with snapshots for 60 s, no watchdog teardown.
 {events.length=0;c.netConnect(false,'38XU4E',false);const ws=sockets.at(-1);ws.legacy=true;await ws.open();ws.receive({t:'hello',version:2});ws.receive({t:'room',v:2,code:'38XU4E',pub:false,mode:'tdm',map:'ascent',st:'room',pl:[{n:'QA',p:0,h:1}],bots:0});
  ws.receive(start);assert.equal(events.filter(x=>x==='start').length,1);live();c.NET.watchAt=now;
  play(60000,()=>true);
  assert(!events.includes('exit'),'a live match on a worker that sends no welcome must not be torn down: '+lastMsg());assert.equal(c.NET.socket,ws,'same socket after 60 s');assert.equal(c.NET.reconnecting,false);}
 // 1b. Same worker, waiting in the lobby for 60 s (no snapshots; it answers 'pi' but not 'hb'): kept alive.
 {events.length=0;c.netConnect(false,'38XU4E',false);const ws=sockets.at(-1);ws.legacy=true;await ws.open();ws.receive({t:'hello',version:2});ws.receive({t:'room',v:2,code:'38XU4E',pub:false,mode:'tdm',map:'ascent',st:'room',pl:[{n:'QA',p:0,h:1}],bots:0});c.NET.watchAt=now;
  play(60000,null);assert(!events.includes('exit'),'lobby on a worker without welcome / hb replies stays connected: '+lastMsg());assert.equal(c.NET.socket,ws);assert.equal(c.MP.st,'room');
  assert(ws.sent.some(m=>m.t==='pi'&&Number.isFinite(m.c)),'the transport heartbeat is one every worker answers (pi)');}
 // 2. Current worker, mid-round 1006 drop; the room is unreachable for ~45 s (each reconnect closes 1006 before opening).
 {events.length=0;messages.length=0;c.netConnect(false,'38XU4E',false);let ws=sockets.at(-1);await ws.open();ws.receive({t:'welcome',name:'QA',you:7,resume:'seat-token'});ws.receive({t:'room',code:'38XU4E',mode:'tdm',map:'ascent',st:'game',pl:[{n:'QA',h:1}]});ws.receive(start);live();c.NET.watchAt=now;
  const first=sockets.length;autoFail=true;ws.disconnect(1006,'');assert(c.NET.reconnecting);
  play(45000,null);const tries=sockets.slice(first);assert(tries.length>=5,'retries a few times with backoff ('+tries.length+')');
  const gaps=tries.slice(1,5).map((s,i)=>s.at-tries[i].at);assert(gaps[0]<gaps[3],'backoff grows: '+gaps.join(','));
  assert(!events.includes('exit'),'still recovering 45 s after the drop (server keeps the seat 90 s): '+lastMsg());assert.equal(new URL(tries.at(-1).url).searchParams.get('resume'),'seat-token');
  autoFail=false;play(5000,null);const back=sockets.at(-1);assert.equal(back.readyState,0);await back.open();assert.equal(back.sent[0].resume,'seat-token');
  back.receive({t:'welcome',name:'QA',you:7,resume:'seat-token',resumed:1});back.receive({t:'room',code:'38XU4E',mode:'tdm',map:'ascent',st:'game',pl:[{n:'QA',h:1}]});back.receive({...start,resumed:1});
  assert.equal(c.NET.reconnecting,false);assert.equal(c.NET.ready,true,'resumed into the same match');assert(!events.includes('exit'));assert.equal(events.filter(x=>x==='start').length,1,'no scene reload');
  // Never answers: after the grace window the error carries the close code and the attempts.
  autoFail=true;back.disconnect(1006,'');play(100000,null);assert(events.includes('exit'),'gives up after the grace window');
  assert.match(lastMsg(),/interrupted/);assert.match(lastMsg(),/1006/,'error text names the close code: '+lastMsg());assert.match(lastMsg(),/\d+ reconnect attempts?/,'and the attempts: '+lastMsg());assert.match(lastMsg(),/38XU4E/);autoFail=false;}
 // 3. 1008 'Rate or size limit' reconnects (stall backlog); 1008 'Room full' stays final, with its reason in the text.
 {c.netConnect(false,'38XU4E',false);let ws=sockets.at(-1);await ws.open();ws.receive({t:'welcome',name:'QA',you:7,resume:'seat-2'});live();ws.disconnect(1008,'Rate or size limit');assert(c.NET.reconnecting,'rate-limit close self-heals');
  c.mpReset();messages.length=0;c.netConnect(false,'38XU4E',false);ws=sockets.at(-1);await ws.open();ws.receive({t:'welcome',name:'QA',you:7,resume:'seat-3'});ws.disconnect(1008,'Room full');assert.equal(c.NET.reconnecting,false);assert.match(lastMsg(),/1008/);assert.match(lastMsg(),/Room full/);}
 // 4. 4003 'Resume expired': the seat is gone; say so with the code.
 {messages.length=0;c.netConnect(false,'38XU4E',false);const ws=sockets.at(-1);await ws.open();ws.receive({t:'welcome',name:'QA',you:7,resume:'seat-4'});live();ws.disconnect(4003,'Resume expired');assert.equal(c.NET.reconnecting,false);assert.match(lastMsg(),/4003/);assert.match(lastMsg(),/released|expired/i);assert.match(lastMsg(),/38XU4E/);}
 console.log('Net drop (client): no-welcome worker kept 60 s in a match and the lobby (pi heartbeat), 1006 drop retried with backoff through a 45 s outage and resumed the same seat, 90 s give-up names code + attempts, rate-limit close reconnects, Room full / Resume expired final with code');
})().catch(e=>{console.error(e);process.exitCode=1;});
