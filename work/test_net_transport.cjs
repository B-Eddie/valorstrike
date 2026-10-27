// Exercise the production transport with a controlled clock/socket: temporary loss must recover the same scene/seat,
// silence must remain bounded, stale callbacks cannot tear down a replacement, and congestion cannot queue old inputs.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/server_runtime.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');
const production=src.slice(src.indexOf('function netConnect('),src.indexOf('mpCreate=function'));
assert(html.includes(production),'the shipped page must include the tested transport');
assert(html.includes('if (now - MP.last > mpLim && !(typeof NET!=="undefined"&&NET.socket))'),'server transport owns its watchdog');
let now=1000,id=0;const timers=new Map(),sockets=[],messages=[],events=[];
const timer=(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;};
const advance=ms=>{const end=now+ms;while(true){let next;for(const [i,t]of timers)if(t.at<=end&&(!next||t.at<next[1].at))next=[i,t];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
class Socket{
 constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];sockets.push(this);}
 send(d){if(this.failSend)throw Error('closed during send');this.sent.push(JSON.parse(d));}
 close(){this.readyState=3;if(this.onclose)this.onclose({code:1000,reason:''});}
 receive(m){this.onmessage({data:JSON.stringify(m)});}
 async open(){this.readyState=1;await this.onopen();}
 disconnect(code=1006,reason=''){this.readyState=3;this.onclose({code,reason});}
}
const c={NET:{url:'http://localhost:8787',epoch:0},MP:{map:'ascent',mode:'tdm',name:'QA'},window:{},WebSocket:Socket,URLSearchParams,performance:{now:()=>now},Date,document:{hidden:false},setTimeout:timer,clearTimeout:i=>timers.delete(i),J:{pick:'Jett'},keys:{KeyW:true},fireHeld:true,running:true,player:{x:0,y:0,z:0},WEAP:{Classic:{}},netProfileToken:async()=> 'profile-token',netHbStart(){},netVisibility(){},netReynaClear(){},netClearEffects(){},mpEl:()=>null,mpMsg:m=>messages.push(m),mpUI(){},netSyncEffects(){},mpCliMsg:m=>events.push(m.t),mpCliSnap:m=>events.push('snapshot'),mpCliRS:m=>events.push('round-state'),mpExitGame:()=>events.push('exit')};
c.mpReset=()=>{const old=c.NET.socket;c.NET.socket=null;c.NET.epoch++;timers.delete(c.NET.retryTimer);c.NET.retryTimer=0;c.NET.reconnecting=false;c.NET.resume=null;c.NET.ready=false;c.MP.on=false;c.MP.role=null;c.MP.st='idle';if(old)old.close();};
vm.createContext(c);
vm.runInContext(src.slice(src.indexOf('function netSend('),src.indexOf('\nlet netSessionToken='))+'\n'+src.slice(src.indexOf('function netClean('),src.indexOf('function netConnect('))+'\n'+production,c);
const welcome=ws=>{ws.receive({t:'welcome',name:'QA',you:7,resume:'seat-token'});ws.receive({t:'room',code:'ABCDEF',mode:'tdm',map:'ascent',st:'game',pl:[{n:'QA',h:1}]});};
const row=[7,0,'QA','Jett',4,0,5,0,83,25,1,'Classic',1,0,2];
const start={t:'start',v:2,you:7,team:0,mode:'tdm',map:'ascent',u:[row],tl:300,k:{},d:{}};
(async()=>{
 c.netConnect(true,'ABCDEF',false);let ws=sockets.at(-1);assert.match(ws.url,/^ws:\/\//);await ws.open();welcome(ws);ws.receive(start);assert.equal(events.filter(x=>x==='start').length,1);
 assert.equal(ws.sent[0].batch,1);assert.equal(ws.sent[0].ack,1);
 c.MP.st='game';c.MP.on=true;c.MP.role='client';c.NET.ready=true;c.MP.sq=2;c.NET.loadAt=0;
 ws.disconnect();assert(c.NET.reconnecting);assert.equal(c.MP.st,'game');assert(!events.includes('exit'));assert.equal(c.keys.KeyW,false);assert.equal(c.fireHeld,false);
 advance(250);const replacement=sockets.at(-1);assert.notEqual(ws,replacement);assert.equal(new URL(replacement.url).searchParams.get('create'),'0');assert.equal(new URL(replacement.url).searchParams.get('resume'),'seat-token');
 await replacement.open();assert.equal(replacement.sent[0].resume,'seat-token');welcome(replacement);replacement.receive(start);
 assert.equal(events.filter(x=>x==='start').length,1,'resuming must reuse the existing loaded scene');assert(events.includes('snapshot'));assert.equal(c.player.x,4);assert.equal(c.NET.ready,true);assert.equal(c.NET.reconnecting,false);
 ws.onclose({code:1006,reason:''});assert.equal(c.NET.socket,replacement,'stale callbacks cannot reset the recovered game');
 replacement.receive({t:'s',q:11,tl:299,u:[row],k:{},d:{},ev:[],rs:{sp:['carry',7,0,0,0,0,0,'',0],b:0,status:{slow:1e999}}});assert.equal(c.NET.ack,11);assert(events.includes('round-state'));
 c.netSend({t:'in',seq:1});assert.equal(replacement.sent.at(-1).q,11,'inputs acknowledge applied snapshots');
 replacement.bufferedAmount=20000;const n=replacement.sent.length;assert.equal(c.netSend({t:'in',seq:2,fire:1,kh:1}),false);assert.equal(replacement.sent.length,n);assert.equal(c.NET.firePend,1);assert.equal(c.NET.firePendH,1);assert.equal(c.netSend({t:'buy',n:'Classic'}),true,'reliable commands remain ordered');replacement.bufferedAmount=0;replacement.failSend=true;assert.doesNotThrow(()=>c.netSend({t:'in'}));replacement.failSend=false;
 // The first callback after a frozen event loop must allow queued packets to run, in foreground and hidden tabs.
 c.NET.watchAt=now;c.NET.lastSeen=now;now+=35000;c.netTransportTick();assert(!c.NET.reconnecting);replacement.receive({t:'hb'});advance(1000);c.netTransportTick();assert(!c.NET.reconnecting);
 c.document.hidden=true;c.NET.watchAt=now;now+=160000;c.netTransportTick();assert(!c.NET.reconnecting);replacement.receive({t:'hb'});c.document.hidden=false;
 // Genuine visible silence with normally running timers starts recovery, and it cannot retry forever.
 c.NET.lastSeen=now;for(let i=0;i<31;i++){advance(1000);c.netTransportTick();}assert(c.NET.reconnecting);
 for(let i=0;i<91;i++){advance(1000);c.netTransportTick();}assert(events.includes('exit'));/* 90 s window = server seat grace (queue 1e) */assert.equal(c.NET.reconnecting,false);
 // Explicit leave invalidates pending retry timers; policy/expired-session closes do not reconnect.
 c.netConnect(false,'ABCDEF',false);ws=sockets.at(-1);await ws.open();welcome(ws);c.MP.st='game';c.NET.ready=true;ws.disconnect();assert(c.NET.retryTimer);c.mpReset();const before=sockets.length;advance(5000);assert.equal(sockets.length,before);
 c.netConnect(false,'ABCDEF',false);ws=sockets.at(-1);await ws.open();welcome(ws);ws.disconnect(1008,'Room full');assert.equal(c.NET.reconnecting,false);c.mpReset();/* 1008 'Rate or size limit' now resumes (queue 1e, test_net_drop.cjs) */
 for(const code of [4001,4003]){c.netConnect(false,'ABCDEF',false);ws=sockets.at(-1);await ws.open();welcome(ws);ws.disconnect(code,'Resume expired');assert.equal(c.NET.reconnecting,false,'terminal resume close '+code);}
 // A lobby also resumes without creating a second seat or accidentally loading a match.
 c.NET.loadAt=123;c.NET.lpAt=321;c.NET.recoverGame=c.NET.recoverLoading=true;c.netConnect(false,'ABCDEF',false);assert.equal(c.NET.loadAt,0);assert.equal(c.NET.recoverLoading,false);ws=sockets.at(-1);await ws.open();welcome(ws);c.MP.st='room';ws.disconnect();advance(250);const lobby=sockets.at(-1);await lobby.open();welcome(lobby);assert.equal(c.MP.st,'room');assert.equal(c.NET.reconnecting,false);
 console.log('Online transport: same-seat recovery without scene reload, stale callbacks ignored, bounded retries/cancellation, wake-up grace, snapshot acknowledgments/batched round-state, congestion coalescing and send-race handling');
})().catch(e=>{console.error(e);process.exitCode=1;});
