// Local QA bridge: the real worker module (tools/local-cluster.mjs: default fetch, GameRoom, Directory, real worlds)
// served on a real port for a rendered browser client, on the real clock. HTTP requests go to the worker's fetch,
// WebSocket upgrades become local-cluster connections (messages relayed both ways), and the virtual clock is pumped
// by real elapsed time. Unlike `wrangler dev` the room is reachable from the QA script: POST /__qa with a JS body
// runs it with `room(code)`/`sim(code)`/`C` in scope and returns the JSON result, so a browser scenario can hold bots
// still or place the Spike carrier. Never deployed; ENABLE_SPIKE / ALLOW_LOCAL_ORIGIN are set here, locally only.
//   node tools/browser-bridge.mjs [port=8787]
import http from 'node:http';import {WebSocketServer} from 'ws';import {localCluster} from './local-cluster.mjs';
const port=+(process.argv[2]||8787);
// prod: fog of war and skin validation as deployed (hk-33); a scenario that needs whole frames sets sim(code).fogOff=true.
const C=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true',QA_TEST_HOOKS:'true',QA_BOTS:'0'},prod:true});
// Lockstep (QA: `C.lock=true` from /__qa): software-rendered Chromium can take 5-15 s per frame, during which the page
// sends nothing (its input/heartbeat timers are starved), so the server would drop it for silence and every held key
// would go stale (inputs count for 0.3 s). With the lock on, each client message buys 250 ms of server time and the
// clock waits otherwise: the room runs in slow motion at the page's frame rate.
C.lock=false;C.budget=0;
let last=Date.now(),busy=false;setInterval(async()=>{if(busy)return;busy=true;const t=Date.now();let dt=Math.min(250,t-last);last=t;if(C.lock){dt=Math.min(dt,C.budget);C.budget-=dt;}try{if(dt>0)await C.advance(dt);}catch(e){console.error('advance',e);}busy=false;},10);
const room=code=>C.room(code),sim=code=>room(code)?.sim;
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
const server=http.createServer(async(req,res)=>{
 const body=await new Promise(r=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>r(b));});
 if(req.method==='OPTIONS'&&!req.headers['access-control-request-private-network']){res.writeHead(204,cors);return res.end();}
 if(req.url==='/__qa'){try{const v=await new Function('C','room','sim','return (async()=>{'+body+'})()')(C,room,sim);res.writeHead(200,{'content-type':'application/json',...cors});res.end(JSON.stringify(v??null));}catch(e){res.writeHead(500,cors);res.end(String(e.stack||e));}return;}
 const headers={};for(const [k,v]of Object.entries(req.headers))if(typeof v==='string'&&k!=='host'&&k!=='content-length')headers[k]=v;
 const r=await C.fetch(req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
 const h={};r.headers.forEach((v,k)=>h[k]=v);res.writeHead(r.status,h);res.end(Buffer.from(await r.arrayBuffer()));});
const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,sock,head)=>{const q=Object.fromEntries(new URL(req.url,'http://x').searchParams);wss.handleUpgrade(req,sock,head,ws=>{const pend=[];let up=false;
 const s=C.connect(q);s.on('open',()=>{up=true;for(const m of pend.splice(0))s.send(m);});s.on('message',m=>ws.readyState===1&&ws.send(JSON.stringify(m)));
 s.on('close',e=>{console.log(new Date().toISOString(),'server closed',q.code||'',e?.code,e?.reason);try{ws.close(e?.code||1000,e?.reason||'');}catch(x){}});s.on('error',e=>{try{ws.close(4000,String(e.message).slice(0,100));}catch(x){}});
 ws.on('message',d=>{const m=String(d);C.budget=250;if(up)s.send(m);else pend.push(m);});ws.on('close',(c,r)=>{console.log(new Date().toISOString(),'client closed',q.code||'',c,String(r));s.close();});});});
server.listen(port,'127.0.0.1',()=>console.log('browser bridge on http://127.0.0.1:'+port+' (local worker, ENABLE_SPIKE local only)'));
