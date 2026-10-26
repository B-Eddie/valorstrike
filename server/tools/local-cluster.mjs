// Runs the real worker module (default fetch, GameRoom, Directory) in-process on a virtual clock, with in-memory
// Durable Object storage and WebSocket pairs. Lets acceptance scenarios exercise the full room/directory path
// (connect, auth, ticks, leave/rejoin, result persistence) in a deterministic `npm test` without wrangler.
import fs from 'node:fs';import vm from 'node:vm';import {loadWorld} from '../src/world.js';import {Simulation} from '../src/simulation.js';import {SpikeSimulation} from '../src/spike.js';

class Storage{constructor(){this.m=new Map();}
 async get(k){return structuredClone(this.m.get(k));}
 async put(k,v){if(typeof k==='object'){for(const [a,b]of Object.entries(k))this.m.set(a,structuredClone(b));}else this.m.set(k,structuredClone(v));}
 async list({prefix='',limit=1000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
 async transaction(f){return f(this);}}

// prod: also hand the worker the modules its imports bring in production that the vm context otherwise lacks - fog.js
// fogView / fogCast (fog of war: GameRoom.view / castEvents) and skins.js cleanSkins. Without them worker.js's typeof guards
// fall back to whole frames, so a room here sends every enemy's position (hk-33: the browser bridge's fog check saw a
// hidden enemy drawn at its true spot). Off by default: the acceptance tests here script whole-frame rooms.
export async function localCluster({env:vars={},assetsRoot=new URL('../public',import.meta.url),prod=false}={}){
 let now=1_700_000_000_000;const timers=new Map();let nextTimer=1;
 const clock={now:()=>now};
 const FakeDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const setI=(f,ms)=>{const id=nextTimer++;timers.set(id,{f,ms,at:now+ms,repeat:true});return id;},setT=(f,ms=0)=>{const id=nextTimer++;timers.set(id,{f,ms,at:now+ms,repeat:false});return id;},clear=id=>timers.delete(id);
 class Pair{constructor(){const a=new End(),b=new End();a.peer=b;b.peer=a;this[0]=a;this[1]=b;}}
 class End{constructor(){this.listeners={};this.readyState=1;}accept(){}addEventListener(t,f){(this.listeners[t]??=[]).push(f);}on(t,f){this.addEventListener(t,f);}
  emit(t,e){for(const f of this.listeners[t]||[])f(e);}
  send(data){if(this.readyState!==1)throw Error('closed');const p=this.peer;queueMicrotask(()=>p.readyState===1&&p.emit('message',{data}));}
  close(code,reason){if(this.readyState!==1)return;this.readyState=3;const p=this.peer;queueMicrotask(()=>{p.readyState=3;p.emit('close',{code,reason});this.emit('close',{code,reason});});}}
 class Resp extends Response{constructor(body,init={}){if(init.status===101){super(null,{status:200});this.webSocket=init.webSocket;this.upgraded=true;}else super(body,init);}}
 const src=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export default','const handler=').replace(/export class/g,'class')+';globalThis.__mod={handler,GameRoom,Directory};';
 const ctxGlobals={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},loadWorld,Simulation,SpikeSimulation,kits:JSON.parse(fs.readFileSync(new URL('../src/kits.json',import.meta.url),'utf8')),
  ...(prod?{fogView:(await import('../src/fog.js')).fogView,fogCast:(await import('../src/fog.js')).fogCast,cleanSkins:(await import('../src/skins.js')).cleanSkins}:{}),
  WebSocketPair:Pair,Response:Resp,Request,Headers,URL,URLSearchParams,TextEncoder,crypto:globalThis.crypto,performance,Date:FakeDate,setInterval:setI,clearInterval:clear,setTimeout:setT,clearTimeout:clear,console,Map,Set,JSON,Math,Number,Object,Array,Promise,Error,Uint8Array,structuredClone,queueMicrotask};
 const c=vm.createContext(ctxGlobals);vm.runInContext(src,c);const {handler,GameRoom,Directory}=c.__mod;
 const assets={async fetch(r){try{return new Response(fs.readFileSync(new URL('.'+new URL(r.url).pathname,assetsRoot.href.endsWith('/')?assetsRoot:assetsRoot+'/')));}catch(e){return new Response('',{status:404});}}};
 const objects=new Map(),ns=(cls,tag)=>({idFromName:n=>tag+':'+n,get:id=>{if(!objects.has(id))objects.set(id,new cls({storage:new Storage(),waitUntil:p=>p&&p.catch?.(()=>{})},env));const o=objects.get(id);return {fetch:(r,init)=>o.fetch(typeof r==='string'?new Request(r,init):r),object:o};}});
 const env={...vars,ASSETS:assets};env.ROOMS=ns(GameRoom,'room');env.DIRECTORY=ns(Directory,'dir');
 const fetchW=(url,init={})=>handler.fetch(new Request('https://local'+url,init),env);
 const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
 async function advance(ms){const end=now+ms;for(;;){let next=null;for(const [id,t]of timers)if(t.at<=end&&(!next||t.at<next[1].at))next=[id,t];if(!next)break;const [id,t]=next;now=Math.max(now,t.at);if(t.repeat)t.at+=t.ms;else timers.delete(id);t.f();await flush();}now=end;await flush();}
 function connect(q){const pending=[];let sock=null;const listeners={};const api={send:m=>sock&&sock.readyState===1&&sock.send(m),close:()=>sock&&sock.close(1000,'client'),on:(t,f)=>{(listeners[t]??=[]).push(f);}};
  fetchW('/connect?'+new URLSearchParams(q),{headers:{Upgrade:'websocket'}}).then(async r=>{if(!r.upgraded){const body=await r.text();for(const f of listeners.error||[])f(Error(body));return;}sock=r.webSocket;sock.addEventListener('message',e=>{for(const f of listeners.message||[])f(JSON.parse(e.data));});sock.addEventListener('close',e=>{for(const f of listeners.close||[])f(e);});for(const f of listeners.open||[])f();});return api;}
 const room=code=>objects.get('room:'+code);
 return {GameRoom,Directory,env,clock,advance,connect,fetch:fetchW,room,flush,
  profile:async()=>(await fetchW('/profile?qa=1')).json(),stats:async token=>(await fetchW('/stats',{headers:{Authorization:'Bearer '+token}})).json()};
}
