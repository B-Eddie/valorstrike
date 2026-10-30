// Event hitch catalogue (a tool, not in test_all): user 2026-10-29 "go through every event (getting jumped by 5 people all
// shooting at you, planting the bomb, round start, ...) and check if it starts lagging ... at medium video quality".
// Boots the real page (work/page_harness.cjs, native Ascent nav + collision, real agent rigs, fastGlobal, WebGL stubbed,
// work/perf_render_emu.js modelling the renderer's CPU work and COUNTING GPU work: new shader programs = compiles, texture
// uploads, new geometry buffers) in an offline 5v5 at the MEDIUM preset and fires each event, first time and again.
// Per event window (the trigger + the frames after it): trigger ms, frame ms p50 / p99 / max, frames > 25 ms, new programs,
// texture uploads, new geometries, page THREE objects constructed (+ top call sites), DOM nodes created / innerHTML writes.
//   node work/bench_events.cjs [--json out.json] [--agent Jett] [--only ev1,ev2] [--abil-only]
// Harness frame ms are node wall times of one page frame (sim + emulated render); compare runs on the same box / load only.
const fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},OUT=arg('--json'),AGENT=arg('--agent')||'Jett',ONLY=arg('--only')?arg('--only').split(','):null,ABIL_ONLY=process.argv.includes('--abil-only'),MAP=arg('--map')||'ascent';
const SEED=+(process.env.SEED||7);
const H=boot({real3:true,seed:SEED,native:true,fastGlobal:true,ls:require('./page_harness.cjs').lsStore([['vs.gq','medium']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
// call-site recorder (page-side THREE constructors + clones) and DOM churn counters
xe(`window.__REC={on:false,n:0,sites:new Map(),dom:0,html:0,txt:0};{const site=()=>String(new Error().stack).split('\\n').slice(3).filter(l=>!/bench_events|page_harness/.test(l)).slice(0,3).map(l=>l.trim().replace(/^at /,'').replace(/ \\(eval at [^)]*\\)/,'').replace(/\\(?(?:file:\\/\\/)?[^()]*\\/([^\\/:()]+):(\\d+):\\d+\\)?/,'$1:$2').replace(/<anonymous>:(\\d+):\\d+/,'@$1')).join(' < ');
 const note=k=>{if(!__REC.on)return;__REC.n++;if(!${!!process.env.SITES})return;const s=k+' @ '+site();__REC.sites.set(s,(__REC.sites.get(s)||0)+1);};
 for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype||!/^[A-Z]/.test(k))continue;
  const W=class extends C{constructor(...a){super(...a);note('new '+k);}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}
 for(const [N,P] of [['Material',THREE.Material.prototype],['BufferGeometry',THREE.BufferGeometry.prototype],['Object3D',THREE.Object3D.prototype],['Texture',THREE.Texture.prototype]]){const c=P.clone;P.clone=function(){note(N+'.clone');return c.apply(this,arguments);};}
 const ce=document.createElement.bind(document);document.createElement=function(t){if(__REC.on)__REC.dom++;return ce(t);};
 const EP=Object.getPrototypeOf(ce('div'));let p=EP,d=null;while(p&&!(d=Object.getOwnPropertyDescriptor(p,'innerHTML')))p=Object.getPrototypeOf(p);
 if(d&&d.set)Object.defineProperty(p,'innerHTML',{get:d.get,set(v){if(__REC.on)__REC.html++;d.set.call(this,v);},configurable:true});}
 window.__recTop=(n)=>{const a=[...__REC.sites].sort((x,y)=>y[1]-x[1]).slice(0,n||8);return {total:__REC.n,dom:__REC.dom,html:__REC.html,top:a};};window.__recReset=()=>{__REC.n=0;__REC.dom=0;__REC.html=0;__REC.sites=new Map();};true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
const emu=()=>JSON.parse(xe('JSON.stringify(__PS.endFrame())'));
// page function hits per frame (which events ran in a frame)
xe(`window.__EV=[];{const wrap=(n)=>{const f=window[n];if(typeof f!=="function")return;const W=function(){__EV.push(n);return f.apply(this,arguments);};try{window[n]=W;eval(n+'=W');}catch(e){}};
 ['fRound','fCheck','kill','pDie','fDetonate','jRound','end','xHitSpark','feed','kfeed'].forEach(wrap);}true`);
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>b.dataset.a===AGENT&&!b.disabled)||tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
async function profStart(){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
async function profStop(label){const cp=(await post('Profiler.stop')).profile;const incl=new Map(),self=new Map(),key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
 const byId=new Map(cp.nodes.map(x=>[x.id,x]));const dt=new Map();cp.samples.forEach((id,i)=>dt.set(id,(dt.get(id)||0)+(cp.timeDeltas[i+1]||0)/1000));
 (function walk(x,stack){const k=key(x),own=dt.get(x.id)||0;let sum=own;self.set(k,(self.get(k)||0)+own);for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,stack.concat(k));if(!stack.includes(k))incl.set(k,(incl.get(k)||0)+sum);return sum;})(cp.nodes[0],[]);
 const o={incl:[...incl].filter(([k])=>!/^\((root|program|idle)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,45).map(([k,v])=>[+v.toFixed(1),k]),self:[...self].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,v])=>[+v.toFixed(1),k])};
 console.log(`[prof ${label}] inclusive ms:`);o.incl.forEach(r=>console.log('  ',r[0],r[1]));console.log(`[prof ${label}] self ms:`);o.self.forEach(r=>console.log('  ',r[0],r[1]));return o;}
const PROF=process.env.PROF||'',PROFN=+(process.env.PROFN||3);
const {PerformanceObserver,performance:PF}=require('perf_hooks');const GCE=[];new PerformanceObserver(l=>{for(const e of l.getEntries())GCE.push([e.startTime,e.duration]);}).observe({entryTypes:['gc']});
const pct=(s,q)=>s[Math.min(s.length-1,Math.floor(s.length*q))];
const RES={agent:AGENT,map:MAP,seed:SEED,events:[]};
// one measured window: pre() sets the scene up (not measured), trig() fires the event (measured, its ms = 'trig'),
// then n frames of 17 ms; step(i) runs before each frame (not measured; e.g. re-placing shooters). Returns the row.
async function win(name,{pre,trig,n=60,step,post}={}){
 if(ONLY&&!ONLY.some(o=>name.startsWith(o)))return null;
 if(pre)await pre();emu();xe('__recReset();__REC.on=true;__EV.length=0;true');
 const pv=PROF&&name===PROF;if(pv)await profStart();xe('__PS.live=true;__PS.progNew.length=0;true');const W0=PF.now();const FT=[],CPU=[];const tc0=process.cpuUsage();const t0=process.hrtime.bigint();if(trig)await trig();const tt=Number(process.hrtime.bigint()-t0)/1e6;const tcu=process.cpuUsage(tc0),tcpu=(tcu.user+tcu.system)/1000;
 const E={prog:0,tex:0,geo:0,calls:0},fr=[],evAt=[];let maxCalls=0;
 for(let i=0;i<n;i++){if(step)await step(i);const pa=PF.now(),c0=process.cpuUsage(),a=process.hrtime.bigint();H.advance(17);const ms=Number(process.hrtime.bigint()-a)/1e6;const cu=process.cpuUsage(c0);CPU.push((cu.user+cu.system)/1000);FT.push([pa,PF.now()]);fr.push(ms);const e=emu();E.prog+=e.prog||0;E.tex+=e.tex||0;E.geo+=e.geo||0;maxCalls=Math.max(maxCalls,e.calls||0);
  const ev=xe('__EV.splice(0).join(",")');if(ev)evAt.push(i+':'+ev);if(pv&&i===PROFN-1){RES.prof=RES.prof||{};RES.prof[name]=await profStop(name);}if(i%10===9)await tick();}
 await new Promise(r=>setTimeout(r,5));const gcF=FT.map(([a,b])=>GCE.filter(g=>g[0]<b&&g[0]+g[1]>a).reduce((t,g)=>t+g[1],0));const gcW=GCE.filter(g=>g[0]>=W0).reduce((t,g)=>t+g[1],0);
 xe('__REC.on=false;true');const PN=JSON.parse(xe('JSON.stringify(__PS.progNew.map(p=>p.obj+" | "+p.key.slice(0,60)))'));xe('__PS.live=false;true');const R=JSON.parse(xe('JSON.stringify(__recTop(6))'));
 const imax=fr.indexOf(Math.max(...fr)),frx=fr.map((x,i)=>x-gcF[i]),sx=[...frx].sort((a,b)=>a-b);const s=[...fr].sort((a,b)=>a-b),f0=fr[0]+tt;
 const row={name,trig:+tt.toFixed(1),first:+f0.toFixed(1),p50:+pct(s,.5).toFixed(1),p99:+pct(s,.99).toFixed(1),max:+Math.max(s[s.length-1],f0).toFixed(1),long25:fr.filter((x,i)=>x+(i?0:tt)>25).length,
  cpuMax:+Math.max(...CPU.slice(1),CPU[0]+tcpu).toFixed(1),cpuP50:+pct([...CPU].sort((a,b)=>a-b),.5).toFixed(1),cpuL25:CPU.filter((x,i)=>x+(i?0:tcpu)>25).length,cpuFirst:+(CPU[0]+tcpu).toFixed(1),maxNoGC:+Math.max(sx[sx.length-1],frx[0]+tt).toFixed(1),long25x:frx.filter((x,i)=>x+(i?0:tt)>25).length,gcMaxFrame:+gcF[imax].toFixed(1),gcms:+gcW.toFixed(1),prog:E.prog,progs:PN.slice(0,4),tex:E.tex,geo:E.geo,calls:maxCalls,obj:R.total,dom:R.dom,html:R.html,ev:evAt.slice(0,6).join(' '),top:R.top.map(([k,v])=>v+' '+k.slice(0,160))};
 if(post)Object.assign(row,await post());
 RES.events.push(row);console.log('EV',JSON.stringify({...row,top:row.top.slice(0,3)}));if(OUT)fs.writeFileSync(OUT,JSON.stringify(RES,null,1));return row;}
// helpers (page side)
xe(`window.__qa={
 los:(a,b)=>{try{return los(a,b);}catch(e){return true;}},
 // a spot r m from p on a ray with a clear line to p at eye height, angle a
 ring(p,r,a){for(let k=0;k<16;k++){const t=a+(k%2?1:-1)*Math.floor((k+1)/2)*0.25,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r,y=p.y||0;const gy=(typeof groundAt==="function")?groundAt(x,z,0.5,y+1):y;if(Math.abs(gy-y)>1.2)continue;
  if(!(typeof blocked==="function"&&blocked(x,z,0.45,gy))&&__qa.los(new THREE.Vector3(x,gy+1.5,z),new THREE.Vector3(p.x,y+1.4,p.z)))return [x,gy,z];}return null;},
 face(b,p){const q=b.g.position;b.g.rotation.y=Math.atan2(p.x-q.x,p.z-q.z);},
 god(){if(player){player.hp=Math.max(player.hp,1000);player.armor=50;}},
 aimAt(b){const q=b.g.position,dx=q.x-player.x,dz=q.z-player.z,dy=(q.y||0)+1.2-((player.y||0)+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));},
 stopAll(){for(const b of bots){b.cd=1e9;}for(const a of allies){a.cd=1e9;}},
};true`);
(async()=>{
 const T0=Date.now();
 xe(`FV.pick=${JSON.stringify(MAP)};true`);H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
 RES.pick=xe('J.pick');RES.gq=xe('(()=>{try{return localStorage.getItem("vs.gq")}catch(e){return "?"}})()');RES.xs=xe('JSON.stringify({prc:XS.prc,shd:XS.shd,shm:XS.shm,aa:XS.aa,lod:XS.lod,res:XS.res})');
 RES.rigs=xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length');console.log('agent',RES.pick,'rigs',RES.rigs,'preset',RES.gq,RES.xs);
 // ---- calm buy phase + buy-phase end
 await win('calm_buy',{n:90});
 await win('buy_end',{trig:()=>xe('FV.buy=0.02;true'),n:90});
 await win('calm_live',{n:120});
 const freeze=()=>xe('__qa.stopAll();true');
 if(!ABIL_ONLY){
 // ---- 5 enemies shooting the player at once (bots really aim + fire; player god mode); twice
 const jump=k=>({pre:async()=>{xe(`(()=>{const L=bots.filter(b=>b.alive);for(let i=0;i<L.length;i++){const b=L[i];b.hp=100;const s=__qa.ring(player,7+i*1.3,i*1.2566);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.face(b,player);b.cd=0;}__qa.god();window.__jmpN=L.length;})()`);},
  step:()=>xe('__qa.god();for(const b of bots){if(b.alive)b.hp=100;}true'),n:150,post:()=>({shooters:xe('window.__jmpN'),hp:xe('player.hp')})});
 await win('jumped5_first',jump());await win('jumped5_again',jump());freeze();
 // ---- fire at an enemy: first shot of the round already done above? player hits an enemy (first hit on a fresh agent)
 const hit=(hp)=>({pre:()=>{xe(`(()=>{freezeB=1;const b=bots.find(x=>x.alive);window.__qaB=b;const s=__qa.ring(player,8,0)||[player.x,player.y||0,player.z-8];b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);b.hp=${hp};__qa.aimAt(b);ammo=Math.max(ammo,10);reloading=0;fcd=0;VM.sw=0;camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(pitch,yaw,0,"YXZ");camera.updateMatrixWorld(true);})()`);},
  trig:()=>xe('shoot(false);true'),n:30});
 xe('var freezeB=0;true');freeze();
 await win('hit_enemy',hit(100));await win('hit_enemy_again',hit(100));
 // ---- killing several fast: 4 enemies at 1 hp in a row, one shot every 4 frames (kill feed, deaths, ragdolls, drops)
 const multi=()=>({pre:()=>xe(`(()=>{const L=bots.filter(b=>b.alive);window.__mk=L;for(let i=0;i<L.length;i++){const b=L[i];const s=__qa.ring(player,6+i,i*0.35-0.5)||[player.x+2*i,player.y||0,player.z-7];b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);b.hp=1;b.cd=1e9;}return L.length;})()`),
  step:i=>{if(i%4===0)xe(`(()=>{const b=(__mk||[]).find(x=>x.alive);if(!b)return 0;__qa.aimAt(b);fcd=0;ammo=Math.max(ammo,5);reloading=0;VM.sw=0;camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(pitch,yaw,0,"YXZ");camera.updateMatrixWorld(true);shoot(false);return 1;})()`);},
  n:90,post:()=>({killed:xe('(__mk||[]).filter(b=>!b.alive).length')})});
 await win('multikill',multi());
 // next round (round end -> round start); the bots all die / respawn
 await win('round_end',{trig:()=>xe('if(running){fCheck(true,"QA")}true'),n:60});
 await adv(7000);
 await win('round_start',{trig:async()=>{for(let i=0;i<200&&xe('FV.buy<=0||!running');i++){H.advance(17);if(i%10===0)await tick();}},n:90});
 await win('buy_menu_open',{trig:()=>{H.key('KeyB',true);H.key('KeyB',false);},n:30});
 await win('buy_vandal',{trig:()=>xe('(()=>{try{fBuy("Vandal")}catch(e){return String(e)}return 1})()'),n:30});
 await win('buy_menu_close',{trig:()=>{H.key('KeyB',true);H.key('KeyB',false);},n:30});
 await win('buy_end2',{trig:()=>xe('FV.buy=0.02;true'),n:60});freeze();
 // weapon swaps + first fire of each gun + reload
 for(const [k,lab] of [['Digit1','pri'],['Digit2','pis'],['Digit3','knife'],['Digit1','pri2']]){await win('swap_'+lab,{trig:()=>{H.key(k,true);H.key(k,false);},n:40});}
 const fire=(lab)=>({pre:()=>xe('(()=>{const b=bots.find(x=>x.alive);if(b){window.__qaB=b;b.hp=100;const s=__qa.ring(player,9,0.7);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);}return 1;})()'),
  trig:()=>{H.mouse(0,true);},step:i=>{if(i===20)H.mouse(0,false);xe('if(window.__qaB&&__qaB.alive)__qaB.hp=100;true');},n:40});
 await win('fire_pri_first',fire());
 await win('reload',{trig:()=>{H.key('KeyR',true);H.key('KeyR',false);},n:60});
 await win('swap_pis_fire',{trig:()=>{H.key('Digit2',true);H.key('Digit2',false);},n:30});await win('fire_pis_first',fire());
 await win('swap_back',{trig:()=>{H.key('Digit1',true);H.key('Digit1',false);},n:30});
 // scoreboard (Tab) open / close, minimap is always on
 await win('scoreboard',{trig:()=>{H.key('Tab',true);},step:i=>{if(i===30)H.key('Tab',false);},n:50});
 // drop + pick up the gun
 await win('drop_gun',{trig:()=>{H.key('KeyG',true);H.key('KeyG',false);},n:30});
 await win('pickup_gun',{trig:()=>{H.key('KeyF',true);},step:i=>{if(i===5)H.key('KeyF',false);},n:30});
 // long round: many bullet holes on walls (spray 300 shots at walls from several angles), then frame cost with all decals
 await win('decals_spray',{step:i=>xe(`(()=>{yaw+=0.07;pitch=-0.05+0.03*Math.sin(${0}+yaw*3);ammo=30;reloading=0;fcd=0;try{spray=0;rcl=0;rclH=0;}catch(e){}if(!window.__qaB||!__qaB.alive)1;shoot(false);return 1;})()`),n:300,post:()=>({decals:xe('(()=>{let n=0;scene.traverse(o=>{if(/hole|decal|xDc/i.test(o.name||""))n++;});return n;})()')})});
 await win('calm_decals',{n:120});
 // wallbang: player behind a thin wall shooting an enemy (best effort: shoot through whatever is between)
 // spike: plant (player carries, stands on a site holding 4), then detonation; defuse by an ally/bot
 const site=xe('(()=>{try{const S=xSpawn(FV.map);const st=(typeof FSITES!=="undefined"&&FSITES[FV.map])||null;return JSON.stringify(st);}catch(e){return null}})()');RES.siteInfo=site;
 await win('plant_hold',{pre:()=>xe(`(()=>{const s=FV.sp;s.st="carry";s.c=player;s.pt=0;let best=null;for(let gx=-80;gx<=80&&!best;gx+=2)for(let gz=-80;gz<=80;gz+=2){if(inSite({x:gx,z:gz})&&!blocked(gx,gz,0.5,0)){best=[gx,gz];break;}}
   if(best){player.x=best[0];player.z=best[1];player.y=groundAt(best[0],best[1],0.3,5);player.vx=player.vz=0;}keys.Digit4=true;return best;})()`),step:()=>xe('keys.Digit4=true;__qa.god();true'),n:260,post:()=>({st:xe('FV.sp.st'),planted:xe('FV.sp.st==="plant"')})});
 xe('keys.Digit4=false;true');
 await win('post_plant',{n:120});
 await win('spike_explode',{pre:()=>xe('FV.sp.t=0.03;true'),n:60});
 await adv(7000);
 for(let i=0;i<200&&xe('FV.buy<=0||!running');i++){H.advance(17);if(i%10===0)await tick();}
 xe('FV.buy=0.02;true');await adv(500);freeze();
 // defuse: spike planted next to the player's team's... (player defends after the swap only; use a bot-side defuse by forcing state)
 await win('defuse_done',{pre:()=>xe(`(()=>{const s=FV.sp;const d=FV.atk?bots.find(b=>b.alive):null;s.st="plant";s.t=30;s.x=player.x+1;s.z=player.z;s.y=player.y||0;s.dt=6.9;fsM.position.set(s.x,0.4,s.z);fsM.visible=true;
   if(d){d.g.position.set(s.x+0.5,s.y,s.z);d.g.updateMatrixWorld(true);s.du=d;d.h4=1;}return !!d;})()`),n:60});
 await adv(7000);
 for(let i=0;i<200&&xe('FV.buy<=0||!running');i++){H.advance(17);if(i%10===0)await tick();}
 xe('FV.buy=0.02;true');await adv(500);freeze();
 // player death + spectate
 await win('player_death',{trig:()=>xe('(()=>{const b=bots.find(x=>x.alive);hurt(player,999,b?b.name:"Bot");if(player.hp<=0)pDie(b?b.name:"Bot","Vandal");return player.hp;})()'),n:120});
 await win('spectate_next',{trig:()=>{H.mouse(0,true);H.mouse(0,false);},n:60});
 await adv(7000);
 for(let i=0;i<200&&xe('FV.buy<=0||!running');i++){H.advance(17);if(i%10===0)await tick();}
 xe('FV.buy=0.02;true');await adv(500);freeze();
 }
 // ---- abilities of the picked agent: C, Q, E, X (equip -> fire, follow-up clicks)
 const KEYS=['KeyC','KeyQ','KeyE','KeyX'];
 for(const rep of ['first','again']){
  for(const k of KEYS){
   xe(`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};__qa.god();J.hs="";const b=bots.find(x=>x.alive);if(b){const s=__qa.ring(player,10,0);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);pitch=-0.05;}})()`);
   await adv(100);
   await win(`abil_${k.slice(3)}_${rep}`,{trig:()=>{H.key(k,true);},step:async i=>{if(i===4)H.key(k,false);if(i===24&&xe('!!(J.eq&&J.eq.st!=="rec")'))H.mouse(0,true);if(i===28)H.mouse(0,false);if(i===60){H.mouse(0,true);}if(i===63)H.mouse(0,false);xe('__qa.god();true');},n:150,post:()=>({J:xe('JSON.stringify({c:J.c,q:J.q,e:J.e,ult:J.ult,eq:J.eq&&J.eq.st,bs:!!J.bsOn,dr:!!J.dr,sm:(J.smokes||[]).length,w:(J.walls||[]).length,z:(J.zones||[]).length,fx:(J.fx||[]).length})')})});
   H.key('Digit1',true);H.key('Digit1',false);await adv(400);
  }
  await adv(3000);
 }
 RES.errors=H.errors.slice(0,5);RES.secs=Math.round((Date.now()-T0)/1000);
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(RES,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));console.log('secs',RES.secs);process.exit(0);
})().catch(e=>{console.error(e);if(OUT)fs.writeFileSync(OUT,JSON.stringify(RES,null,1));process.exit(1);});
