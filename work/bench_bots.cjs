// Bot cost bench (botlag lane 2026-11-16, user: "fix all the lag ... Only work on bots rn"). Boots the real page as
// work/bench_combat.cjs does (work/page_harness.cjs native Ascent nav + collision, real agent rigs, WebGL stubbed,
// work/perf_render_emu.js for the renderer's CPU work), starts an offline match (MODE=five: 5v5 spike, MODE=tdm: Team
// Deathmatch), kills the player so every unit is a bot (9 bots), cuts the buy phase and plays FRAMES frames of 17 ms.
// Prints frame wall ms p50 / p95 / p99 / max, GC ms (total, per frame max), and a sampling profile: self ms per function
// and per page owner (the first index.html frame on the stack), all frames and the worst 5 % frames, plus the summed
// owner time of the bot entry points (BOT_FNS) per frame.
//   node --expose-gc work/bench_bots.cjs [--frames 1800] [--json out.json]   SEED=7 MODE=five|tdm PROF=0 IDX=<index.html>
// Frame ms are node wall times; compare runs on the same box / load only.
const fs=require('fs'),path=require('path');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
if(process.env.IDX){const rf=fs.readFileSync,want=path.join(__dirname,'..','index.html');fs.readFileSync=function(f,...a){if(typeof f==='string'&&path.resolve(f)===want)return rf.call(fs,process.env.IDX,...a);return rf.call(fs,f,...a);};}
const {boot,lsStore}=require('./page_harness.cjs');
const NF=+(arg('--frames')||1800),OUT=arg('--json'),SEED=+(process.env.SEED||7),PROF=process.env.PROF!=='0',MODE=process.env.MODE||'five',WARM=+(process.env.WARM||300);
const H=boot({real3:true,seed:SEED,native:true,fastGlobal:true,ls:lsStore([['vs.gq','medium']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
if(process.env.INJ){require('vm').runInContext('globalThis',H.context).__rnow=()=>Number(process.hrtime.bigint())/1e6;xe(fs.readFileSync(process.env.INJ,'utf8')+';true');}
const emu=()=>xe('__PS.endFrame(),1');
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
const {PerformanceObserver,performance:PF}=require('perf_hooks');const GCE=[];new PerformanceObserver(l=>{for(const e of l.getEntries())GCE.push([e.startTime,e.duration]);}).observe({entryTypes:['gc']});
const pct=(s,q)=>s[Math.min(s.length-1,Math.floor(s.length*q))];
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>b.dataset.a==='Jett'&&!b.disabled)||tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
function prof(cp,TP,fr){const byId=new Map(cp.nodes.map(x=>[x.id,x])),key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
 const thr=[...fr].sort((a,b)=>a-b)[Math.floor(fr.length*.95)],worstW=TP.filter((w,i)=>fr[i]>=thr);
 const parent=new Map();for(const x of cp.nodes)for(const c of x.children||[])parent.set(c,x.id);
 const own=new Map(),owner=n=>{let c=own.get(n.id);if(c)return c;let x=n;while(x&&!/index\.html$/.test(x.callFrame.url))x=byId.get(parent.get(x.id));c=x?key(x):'(no page frame) '+key(n);own.set(n.id,c);return c;};
 // incl: inclusive ms per page function name (any depth), so the bot entry points' totals can be read
 const inc=new Map(),incl=(n)=>{const seen=new Set();let x=n;while(x){if(/index\.html$/.test(x.callFrame.url)){const f=x.callFrame.functionName;if(f&&!seen.has(f)){seen.add(f);}}x=byId.get(parent.get(x.id));}return seen;};
 const all=new Map(),wst=new Map(),oAll=new Map(),oW=new Map(),iW=new Map();let t=cp.startTime;
 for(let i=0;i<cp.samples.length;i++){t+=cp.timeDeltas[i]||0;const dt=(cp.timeDeltas[i+1]||0)/1000,n=byId.get(cp.samples[i]),k=key(n);if(/^\((idle|program|root)\)/.test(k))continue;
  const o=owner(n),w=worstW.some(([a,b])=>t>=a&&t<=b);all.set(k,(all.get(k)||0)+dt);oAll.set(o,(oAll.get(o)||0)+dt);
  for(const f of incl(n)){inc.set(f,(inc.get(f)||0)+dt);if(w)iW.set(f,(iW.get(f)||0)+dt);}
  if(w){wst.set(k,(wst.get(k)||0)+dt);oW.set(o,(oW.get(o)||0)+dt);}}
 const top=(m,n)=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>[+v.toFixed(1),k]);
 return {self:top(all,40),worstSelf:top(wst,25),owner:top(oAll,40),worstOwner:top(oW,25),incl:top(inc,60),worstIncl:top(iW,40),worstFrames:worstW.length,thr:+thr.toFixed(1)};}
(async()=>{
 const T0=Date.now();
 if(MODE==='tdm'){xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startTDM();true');for(let i=0;i<300&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);}
 else {xe(`FV.pick="ascent";true`);H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');}
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
 xe('xPC=false;if(typeof window.xWarmShaders==="function")window.xWarmShaders();true');
 const info={mode:MODE,seed:SEED,rigs:xe('bots.concat(allies).filter(b=>b&&b.xm&&b.xm.valorant).length'),units:xe('bots.concat(allies).filter(b=>b).length'),nav:xe('!!(typeof nmActive==="function"&&nmActive())')};
 console.log('INFO',JSON.stringify(info));
 // the player dead: every unit is a bot. buy phase cut to 1 s; warm-up frames (not measured)
 const keep=`if(player&&player.hp>0&&typeof pDie==="function")pDie(null,"Vandal");if(FV.buy>1)FV.buy=1;true`;
 for(let i=0;i<WARM;i++){xe(keep);H.advance(17);emu();if(i%10===9)await tick();}
 if(global.gc)global.gc();
 if(PROF){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:200});await post('Profiler.start');}
 const fr=[],cpu=[],T=[],TP=[],alive=[];
 for(let i=0;i<NF;i++){xe(keep);
  const pa=PF.now(),c0=process.threadCpuUsage(),a=process.hrtime.bigint();H.advance(17);emu();const b=process.hrtime.bigint(),cu=process.threadCpuUsage(c0);
  fr.push(Number(b-a)/1e6);cpu.push((cu.user+cu.system)/1000);T.push([pa,PF.now()]);TP.push([Number(a/1000n),Number(b/1000n)]);
  if(i%60===0)alive.push(xe('bots.concat(allies).filter(b=>b&&b.alive).length'));
  if(i%10===9)await tick();}
 let P=null;if(PROF){const CP=(await post('Profiler.stop')).profile;if(process.env.CPUPROF){const ids=[...new Set(CP.nodes.filter(n=>/index\.html$/.test(n.callFrame.url)).map(n=>n.callFrame.scriptId))],src={};await post('Debugger.enable');for(const id of ids){try{src[id]=(await post('Debugger.getScriptSource',{scriptId:id})).scriptSource;}catch(e){}}fs.writeFileSync(process.env.CPUPROF,JSON.stringify({CP,TP,cpu}));fs.writeFileSync(process.env.CPUPROF+'.src.json',JSON.stringify(src));}P=prof(CP,TP,cpu);}
 await new Promise(r=>setTimeout(r,5));const gcF=T.map(([a,b])=>GCE.filter(g=>g[0]<b&&g[0]+g[1]>a).reduce((t,g)=>t+g[1],0));
 const s=[...fr].sort((x,y)=>x-y),cs=[...cpu].sort((x,y)=>x-y);
 const row={...info,frames:NF,p50:+pct(s,.5).toFixed(2),p95:+pct(s,.95).toFixed(2),p99:+pct(s,.99).toFixed(2),max:+s[s.length-1].toFixed(2),mean:+(fr.reduce((a,b)=>a+b,0)/NF).toFixed(2),
  cpuP50:+pct(cs,.5).toFixed(2),cpuP99:+pct(cs,.99).toFixed(2),cpuMax:+cs[cs.length-1].toFixed(2),long25:fr.filter(x=>x>25).length,long50:fr.filter(x=>x>50).length,
  gcms:+gcF.reduce((a,b)=>a+b,0).toFixed(1),gcPerFrame:+(gcF.reduce((a,b)=>a+b,0)/NF).toFixed(3),gcMax:+Math.max(...gcF).toFixed(1),aliveAvg:+(alive.reduce((a,b)=>a+b,0)/alive.length).toFixed(1),
  worst:[...fr.keys()].sort((x,y)=>fr[y]-fr[x]).slice(0,8).map(i=>({i,ms:+fr[i].toFixed(1),cpu:+cpu[i].toFixed(1),gc:+gcF[i].toFixed(1)})),errors:H.errors.length,errs:H.errors.slice(0,3).map(e=>String(e.msg||e).slice(0,200)),secs:Math.round((Date.now()-T0)/1000)};
 console.log('RUN',JSON.stringify(row));if(process.env.INJ)console.log('INJ',xe('JSON.stringify(typeof __INJ==="function"?__INJ():null)'));
 if(P){const pr=(t,a)=>{console.log('  '+t);a.forEach(x=>console.log('    ',x[0],x[1]));};
  pr('all-frame self ms:',P.self.slice(0,30));pr('all-frame page owners:',P.owner.slice(0,30));pr('all-frame inclusive (page fn):',P.incl.slice(0,45));
  pr('worst-frame (>= p95 '+P.thr+' ms, '+P.worstFrames+' frames) owners:',P.worstOwner.slice(0,20));pr('worst-frame inclusive:',P.worstIncl.slice(0,30));}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify({row,prof:P},null,1));
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
