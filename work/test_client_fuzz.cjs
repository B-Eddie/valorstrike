// Client protocol fuzz: the real page (index.html in audit.js's fake DOM, booted as in test_client_online.cjs) is fed
// malformed and out-of-order server messages and must never throw, neither inside the socket handler nor later in its
// frame loop / timers, which replay stored snapshots and round state.
// 1. Record: a short real session against the in-process server (TDM, DM, Spike) captures every message type the page
//    really receives (welcome, room, start, s, rs, rd, re, ac, ao, end, po ...).
// 2. Fuzz: the page connects to a scripted socket that replays those messages in order, shuffled, duplicated, from the
//    wrong mode, mutated (fields removed / nulled / retyped / huge / negative / wrong-shaped rows and events), plus raw
//    junk frames. The page's own frames run between messages.
//   node work/test_client_fuzz.cjs              fast variant (in test_all)
//   QA_LONG=1 node work/test_client_fuzz.cjs    many more sequences, a tool
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,context,errors,xErrCalls,advance,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const LONG=!!process.env.QA_LONG,SEQS=LONG?400:70,SEED=+(process.env.SEED||1);
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 const thrown=[];
 // ---- 1. record real traffic ----
 const recorded={},byMode={tdm:{},dm:{},five:{}};let recMode='tdm';const keep=m=>{const t=typeof m.t==='string'?m.t:'?';const b=byMode[recMode];(b[t]||(b[t]=[])).length<60&&b[t].push(JSON.parse(JSON.stringify(m)));const a=recorded[t]||(recorded[t]=[]);if(a.length<40)a.push(JSON.parse(JSON.stringify(m)));else if(Math.random()<.05)a[Math.floor(Math.random()*40)]=JSON.parse(JSON.stringify(m));};
 class RealWS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;
   api.on('open',()=>{this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{keep(m);if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{this.readyState=3;this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState===1)this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 RealWS.OPEN=1;H.win.WebSocket=RealWS;
 const step=async ms=>{for(let t=0;t<ms;t+=50){await cluster.advance(50);H.advance(50);}};
 const until=async(c,ms,what)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+what);};
 for(const mode of ['tdm','dm','five']){H.setPhase('record '+mode);recMode=mode;xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}')`);await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
  const h=new ScriptedHuman({name:'FuzzR',agent:'Raze',world,target:'PageQA'});const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>h.hello());
  await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'joined');xe('mpStart()');await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'start');
  const room=cluster.room(code);if(mode==='five'){room.sim.buy=1;}
  for(let t=0;t<(mode==='five'?9000:5000);t+=500){await step(500);if(mode==='five'){const me=room.sim.units.find(u=>u.name==='PageQA');for(const u of room.sim.units)if(u.ability){u.ability.ult=9;room.sim.command(u,{t:'ab',k:['c','q','e','x'][t/500%4],p:[u.x,u.z]});}if(t===4000&&!(room.sim.roundDelay>0))room.sim.finishRound(0,'QA');}}
  if(mode==='five'){room.sim.roundScores=[12,10];room.sim.roundDelay=0;room.sim.finishRound(0,'QA');}else room.sim.remaining=1;
  await until(()=>xe('MP.st')==='post',30000,'end');await step(800);try{h.leave();}catch(e){}xe('mpReset()');await step(300);xe('try{toLobby()}catch(e){}');await step(200);}
 const types=Object.keys(recorded);for(const t of ['welcome','room','start','s','end'])assert(recorded[t]?.length,'recorded '+t+' (have '+types+')');
 // ---- 2. fuzz ----
 // Page time moves in small slices with the event loop let through, so the page's promises (match load) settle.
 const adv=async ms=>{H.advance(ms);await new Promise(r=>setImmediate(r));};
 const rnd=mulberry(SEED),pick=a=>a[Math.floor(rnd()*a.length)],chance=p=>rnd()<p;
 let live=null;class FakeWS{constructor(url){this.url=url;this.readyState=0;this.sent=[];live=this;}send(d){if(this.readyState!==1)throw Error('send on closed socket');this.sent.push(d);}close(){if(this.readyState===3)return;this.readyState=3;}}
 FakeWS.OPEN=1;H.win.WebSocket=FakeWS;
 const odd=()=>pick([null,undefined,'',' ','x',-1,0,1,1e308,-1e308,2**53,-0.5,NaN,true,false,[],[null],{},{x:1},'<img src=x onerror=alert(1)>','a'.repeat(5000),[1,2,3],{t:'s'},'__proto__',{__proto__:{polluted:1}}]);
 const mutate=(v,depth=0)=>{if(depth>6)return v;if(Array.isArray(v)){if(!v.length)return chance(.5)?odd():v;const c=v.slice();const r=rnd();if(r<.15)return odd();if(r<.25)return c.slice(0,Math.floor(rnd()*c.length));if(r<.32){c.push(odd());return c;}if(r<.38)return c.reverse();const i=Math.floor(rnd()*c.length);c[i]=mutate(c[i],depth+1);return c;}
  if(v&&typeof v==='object'){const c={...v},keys=Object.keys(c);if(!keys.length)return odd();const r=rnd(),k=pick(keys);if(r<.12)return odd();if(r<.3){delete c[k];return c;}if(r<.38){c[k]=odd();return c;}if(r<.42&&k!=='t'){c['__proto__x']=1;c.constructor=odd();return c;}c[k]=mutate(c[k],depth+1);return c;}
  const r=rnd();if(typeof v==='number')return r<.3?odd():r<.5?-v:r<.7?v*1e6:r<.85?Math.floor(rnd()*20)-5:String(v);if(typeof v==='string')return r<.3?odd():r<.5?v+'Z':r<.6?'':r<.8?pick(['Jett','Bot Sage','PageQA','Vandal','Operator','Blade Storm','Knife','A','B','five','tdm','dm','game','post','plant','carry','drop']):v.repeat(3);return odd();};
 const sample=t=>{const a=recorded[t];return a?JSON.parse(JSON.stringify(pick(a))):{t};};
 const frame=(m)=>{const ws=live;if(!ws||!ws.onmessage)return;const data=typeof m==='string'?m:JSON.stringify(m,(k,v)=>v===undefined?null:v);try{ws.onmessage({data});}catch(e){thrown.push({phase:'onmessage '+(m&&m.t),msg:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')});}};
 const junk=()=>pick(['not json','','null','[]','[1,2]','1','"s"','{}','{"t":null}','{"t":1}','{"t":{}}','{"t":"s"}','{"t":"s","u":null}','{"t":"s","u":[[]]}','{"t":"s","u":[null,1,"x"]}','{"t":"rs","sp":null}','{"t":"room","pl":null}','{"t":"room"}','{"t":"start","v":2}','{"t":"start","v":2,"mode":"five"}','{"t":"end"}','{"t":"re"}','{"t":"rd"}','{"t":"ac"}','{"t":"ao","rs":1}','{"t":"welcome"}','{"t":"po"}','{"t":"s","ev":[["k"],["k",null,null],["sp"],[]]}','{"t":"s","u":[[0,0,"PageQA","Jett",null,null,null]]}','{"t":"s","fx":[{}],"fw":[[1]]}']);
 const order=['welcome','room','start','s','rs','s','s','rd','s','ac','s','re','s','ao','s','end'];
 const stacks=[];{const x1=H.win.xErr;H.win.xErr=function(e){stacks.push(String(e&&e.stack||e).split('\n').slice(0,6).join(' | '));return x1.apply(this,arguments);};}
 const errs0=H.errors.length,x0=H.xErrCalls.length;let sent=0,games=0;const per={};
 for(let q=0;q<SEQS;q++){H.setPhase('fuzz '+q);try{xe('mpReset();try{toLobby()}catch(e){}true');}catch(e){thrown.push({phase:'reset',msg:String(e)});}await adv(50);
  xe(`MP.name='PageQA';MP.mode='${pick(['tdm','dm','five'])}';MP.map='ascent';netConnect(false,'FUZZ${q%10}',false)`);const ws=live;ws.readyState=1;try{ws.onopen&&ws.onopen({});}catch(e){thrown.push({phase:'onopen',msg:String(e)});}await adv(30);
  // Most sequences first reach a live match the regular way (welcome, room, start, valid snapshots until the page
  // reports ready) so the in-match handlers and the frame loop see the fuzz; the rest are out of order from the start.
  const mode=pick(['tdm','dm','five']),R=byMode[mode],rs=t=>R[t]?.length?JSON.parse(JSON.stringify(pick(R[t]))):sample(t);
  if(chance(.75)&&R.start?.length){for(const t of ['welcome','room'])frame(rs(t));await adv(50);frame(rs('start'));for(let k=0;k<400&&!xe('NET.ready');k++){if(R.s?.length)frame(rs('s'));if(mode==='five'&&R.rs?.length&&k%4===0)frame(rs('rs'));await adv(50);}
   if(process.env.DBGF&&q<3)console.log('seq',q,mode,xe('JSON.stringify({st:MP.st,role:MP.role,running,ld:window.xLdOn,ready:NET.ready,la:NET.loadAt,msg:MP.msg})'));if(xe('NET.ready'))games++;for(let k=0;k<25;k++){const r=rnd(),t=pick(['s','s','s','rs','rs','ac','re','rd','po','end','room','start','welcome']);let m=r<.6?rs(t):sample(t);if(rnd()<.4)m=mutate(m);else if(rnd()<.05)m=junk();frame(m);sent++;per[t]=(per[t]||0)+1;await adv(chance(.3)?250:40);}}
  const style=rnd();let seq;
  if(style<.35)seq=order.slice();else if(style<.55)seq=order.slice().sort(()=>rnd()-.5);else if(style<.7)seq=['welcome','room','start',...Array.from({length:12},()=>pick(types))];else seq=Array.from({length:14},()=>pick(types.concat(['s','s','rs'])));
  const p=style<.35?.25:.45;
  for(const t of seq){const r=rnd();let m=sample(t);if(r<p)m=mutate(m);else if(r<p+.06)m=junk();if(chance(.05))frame(m);frame(m);sent++;per[t]=(per[t]||0)+1;await adv(chance(.3)?250:40);}
  if(chance(.3)){try{ws.readyState=3;ws.onclose&&ws.onclose({code:pick([1000,1001,1006,1012,4002]),reason:pick(['Connection idle','Load timed out','Room full','',null])});}catch(e){thrown.push({phase:'onclose',msg:String(e)});}}
  await adv(300);}
 xe('mpReset();try{toLobby()}catch(e){}true');H.advance(500);
 const dropped=xe('NET.dropped||0'),drops=xe('JSON.stringify(NET.drops||[])');if(process.env.VERBOSE)console.log('handler fallbacks',dropped,drops);
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);
 assert.equal(dropped,0,'every malformed frame is caught by netClean, not the last-resort guard: '+drops);
 if(thrown.length||errors.length||xerr.length){const uniq=a=>[...new Map(a.map(e=>[String(e.msg).slice(0,160),e])).values()];console.error(JSON.stringify({thrown:uniq(thrown).slice(0,12),errors:uniq(errors).slice(0,12),xerr:uniq(xerr).slice(0,8),stacks:[...new Set(stacks)].slice(0,6),counts:{thrown:thrown.length,errors:errors.length,xerr:xerr.length}},null,1));process.exit(1);}
 console.log(`Client protocol fuzz: ${SEQS} sequences, ${sent} recorded/mutated/junk server messages (${types.length} real types: ${types.join(' ')}), in order, shuffled and cross-mode (${games} sequences reached a live match); no exceptions in the handler, frames or timers (${dropped} frames dropped by the handler's last-resort guard)`);
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
