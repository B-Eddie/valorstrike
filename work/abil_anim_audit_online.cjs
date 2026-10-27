// ONLINE half of work/abil_anim_audit.cjs: the real page (audit.js fake DOM) against the in-process game server
// (server/tools/local-cluster.mjs), booted as test_client_online_abilities.cjs does. Per agent the page joins as that agent
// with a scripted remote human of the SAME agent; each key is pressed through the page's keydown handler (FIRE for an
// equipped ability); then the remote human casts the same key on the server (sim command), and the page's per-frame
// record shows what its first-person layer did and what its third-person view of the remote human was asked to play.
const fs=require('fs'),path=require('path'),vm=require('vm');
async function online(REC,summarise,ONLY){
 const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
 const log=console.log;console.log=()=>{};const proc=Object.create(process,{env:{value:{...process.env,REAL3:'1',REAL3_DIR:process.env.REAL3_DIR||'/workspace/work/qa'}}});const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,proc,module);console.log=log;
 const xe=code=>vm.runInContext('__xe',H.context)(code),e0=H.errors.length;/* boot-time harness notes (external scripts) are not page errors */
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 const codes=new Set();let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 H.win.getComputedStyle=el=>{const st=(el&&el.style)||{},d=st.display||(el&&el.hidden?'none':(el&&el.id==='result'?'none':'block'));return new Proxy({},{get:(t,k)=>k==='display'?d:k==='visibility'?(st.visibility||'visible'):k==='getPropertyValue'?(n=>st[n]||''):(st[k]||'')});};/* as page_harness.cjs: the page's rAF loop runs its ticks */
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const key=(code,down)=>H.dispatch(H.win,H.mkEvent(down?'keydown':'keyup',{code,key:code.replace(/^Key|^Digit/,'').toLowerCase()}));
 const mouse=(b,down)=>{const cv=xe('renderer.domElement');H.dispatch(down?cv:H.win,H.mkEvent(down?'mousedown':'mouseup',{button:b}));};
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(cond,ms)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}return false;};
 const tap=async(code,ms=100)=>{key(code,true);await step(ms);key(code,false);};const click=async(b=0)=>{mouse(b,true);await step(100);mouse(b,false);};
 const humans=[];const join=(code,name,agent)=>{const h=new ScriptedHuman({name,agent,world,target:null});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 const kits=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server','src','kits.json'),'utf8'));const out={};
 xe(REC);
 for(const agent of Object.keys(kits).filter(a=>!ONLY||ONLY.includes(a))){
  xe(`J.pick=${JSON.stringify(agent)};MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
  if(!await until(()=>xe('MP.st')==='room',8000)){out[agent]={err:'room'};break;}const code=xe('MP.code');
  join(code,'FoeB',agent);await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000);xe('mpStart()');
  if(!await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000)){out[agent]={err:'start'};break;}
  const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name==='PageQA'),foe=()=>sim.units.find(u=>u.name==='FoeB');
  sim.buy=0;await step(400);out[agent]={};
  for(const kc of ['KeyC','KeyQ','KeyE','KeyX']){const k=kc[3].toLowerCase(),u=me(),f=foe();if(!u)break;
   for(const v of [u,f]){if(!v)continue;const A=v.ability,M=kits[agent].mx;A.c=Math.max(A.c|0,M.c||1);A.q=Math.max(A.q|0,M.q||1);A.e=Math.max(A.e|0,M.e||1);A.ult=kits[agent].u;A.cool={};v.hp=100;v.alive=true;}
   if(sim.roundState){const rs=sim.roundState(u);room.send([...room.sessions].find(([w,s])=>s.u===u)[0],{t:'ao',k:'c',ok:true,rs});}
   await step(300);xe('window.__aa.on=1;window.__aa.fr=[];window.__aa.tp=[];true');
   await tap(kc,100);await step(400);let equip=false;if(xe('!!(J.eq&&J.eq.st!=="rec")')){equip=true;await step(250);await click(0);}await step(900);
   const fr1=xe('window.__aa.fr.slice()');await click(0);await step(400);
   // the remote human casts the same key (server command; the page sees it through cast events / rows)
   xe('window.__aa.tp=[];true');let ok=false;if(f){f.look=u.look+Math.PI;try{ok=!!sim.command(f,{t:'ab',k,...(agent==='Omen'&&k==='x'?{p:[f.x+3,f.z]}:{})});}catch(e){ok='err '+e.message;}}
   await step(1200);const fr=xe('window.__aa.fr.slice()'),tp=xe('window.__aa.tp.slice()');xe('window.__aa.on=0;true');
   out[agent][k]={equip,press:summarise(fr1),all:summarise(fr),foeCast:ok,tp:[...new Set(tp.filter(x=>x.n==='FoeB').map(x=>x.k))]};
   await tap('Digit1',60);await step(300);}
  for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('mpReset()');await step(500);xe('try{toLobby()}catch(e){}');await step(200);}
 out.__err=xe('window.__aa.err||null');out.__pageErrors=H.errors.slice(e0,e0+5).map(e=>String(e&&e.stack||e&&e.message||JSON.stringify(e)).slice(0,300));return out;
}
module.exports={online};
