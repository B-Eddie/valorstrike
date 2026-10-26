// Online fog of war in the real page (hk-32; qa-23/24 64e9fe5 / b521262 / 04346e0 / 4a96072). Headless Chromium plays the page
// online against the real worker module (server/tools/browser-bridge.mjs on 8787; repo on 127.0.0.1:8876), GQ=low, 640x360,
// room in lockstep (C.lock). Bot brains are replaced (s.bot) so nothing moves unless the script says so; the page player's
// allies are stacked on the page player, so the team's sight is the page player's own.
// A. Sight: an enemy parked on a nav node the server's own world rays say is hidden from the page player (both ways, head /
//    chest / knee / sides) arrives as a fogged row ([22] = 1): the page parks it (u.fog = 1, model out of the scene, never at
//    its true spot). Moved to a node in plain sight, it is drawn there (u.fog = 0, model in the scene within 1 m).
// B. Hearing: the hidden enemy runs (live input, forward, turning every 0.5 s) within FOG.step 30 m -> its row is sent and the
//    page plays its footsteps (SFX.step at the unit, row [23]). Beyond 30 m, still hidden, running: fogged, no footsteps.
// C. Casts: a hidden Omen beyond FOG.cast 30 m aims Dark Cover at a floor point the page player can see -> the page gets the
//    cast fog:1 with p and without the caster's eye o / aim d, replays it at p, and the caster's model stays parked.
// The bridge runs the worker with fog.js handed in (local-cluster prod:true, hk-33); fog1 ran before that and got whole frames.
//   bash hk_out/start.sh bridge; ROOT=<tree> node work/browser_online_fog.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/online-fog.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[],console:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
// shared qa helpers: world sight (fog.js segClear / pairSees, standing units), unit placement, the scripted bot brain
const LIB=code=>`const s=sim('${code}');const W=s.baseWorld||s.world,N=W.nav.nodes,me=s.units.find(u=>u.human);
 if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);for(const u of s.units)if(u.team===me.team&&u.alive)u.hp=100;
 const clear=(o,p)=>{const q=[p[0]-o[0],p[1]-o[1],p[2]-o[2]],L=Math.hypot(q[0],q[1],q[2]);if(L<.05)return true;const t=W.ray(o,[q[0]/L,q[1]/L,q[2]/L],L);return !(Number.isFinite(t)&&t<L-.05);};
 const eye=p=>[p[0],p[1]+1.6,p[2]];const pts=(p,o)=>{let dx=p[0]-o[0],dz=p[2]-o[2];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const sx=-dz*.45,sz=dx*.45;return [[p[0],p[1]+1.65,p[2]],[p[0],p[1]+1.05,p[2]],[p[0]+sx,p[1]+1.2,p[2]+sz],[p[0]-sx,p[1]+1.2,p[2]-sz],[p[0],p[1]+.4,p[2]]];};
 const sees=(a,b)=>pts(b,eye(a)).some(q=>clear(eye(a),q))||pts(a,eye(b)).some(q=>clear(eye(b),q));
 const put=(u,p,look)=>{u.x=p[0];u.y=p[1];u.z=p[2];u.vx=u.vz=u.vy=0;if(look!=null)u.look=look;};
 const mp=[me.x,me.y,me.z];`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED/.test(t))R.console.push(t.slice(0,240));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const W8=(cond,ms,why)=>page.waitForFunction(c=>window.__xe(c),cond,{timeout:ms||600000,polling:1000}).then(()=>true).catch(e=>{log('wait '+(why||cond).slice(0,60)+' timeout',String(e).slice(0,100));return false;});
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`MP.name='FogQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await qa(`C.lock=true;return 1;`);
 await X('mpStart();1');
 await W8('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5',1500000,'match start');
 // page hooks: footsteps, fogged casts (outermost mpCastFx wrapper: sees what the fog wrapper gets), page state per unit
 await X(`window.__st=[];{const f=SFX.step;SFX.step=function(p){try{window.__st.push([+p.x.toFixed(2),+p.z.toFixed(2),Date.now()]);}catch(e){}return f.apply(this,arguments);};}
  window.__cf=[];{const f=mpCastFx;mpCastFx=function(m){const u=m&&(bots.find(x=>x&&x.nid===m.i)||allies.find(x=>x&&x.nid===m.i));const rec={fog:m&&m.fog||0,i:m&&m.i,k:m&&m.k,ag:m&&m.ag,p:m&&m.p,o:!!(m&&m.o),d:!!(m&&m.d)};let err=null;try{return f.apply(this,arguments);}catch(e){err=String(e).slice(0,160);throw e;}finally{rec.err=err;rec.after=u&&u.g?{inScene:u.g.parent===scene,pos:[u.g.position.x,u.g.position.y,u.g.position.z].map(v=>+v.toFixed(2)),fog:u.fog||0}:null;window.__cf.push(rec);}};}
  window.__ust=id=>{const u=bots.find(x=>x&&x.nid===id)||allies.find(x=>x&&x.nid===id);if(!u)return null;return {fog:u.fog||0,loud:!!u.loud,alive:!!u.alive,inScene:!!(u.g&&u.g.parent===scene),pos:u.g?[u.g.position.x,u.g.position.y,u.g.position.z].map(v=>+v.toFixed(2)):null};};1`);
 // freeze every bot (scripted brain), stack the allies on the page player, end the buy phase
 log('match',await qa(LIB(code)+`s.qaRun=null;s.bot=u=>{const r=s.qaRun&&s.qaRun.id===u.id?s.qaRun:null;if(r){if(s.time>=r.flip){r.flip=s.time+(r.every||.5);u.look+=Math.PI;}u.input={forward:1};}else u.input={};u.inputAt=s.time;};
  s.buy=Math.min(s.buy,.3);return {team:me.team,phase:s.phase,buy:s.buy,me:mp.map(v=>+v.toFixed(2))};`));
 await W8('FV.buy===0',1500000,'buy end');
 // pick the spots on the server's own world from where the page player stands now
 const spots=await qa(LIB(code)+`for(const u of s.units)if(u!==me&&u.team===me.team&&u.alive)put(u,mp,me.look);
  const foes=s.units.filter(u=>u.team!==me.team&&u.alive);if(foes.length<2)return {err:'foes '+foes.length};
  const ids=W.playable||N.map((_,i)=>i),cand=[];for(const i of ids){const n=N[i];if(!n)continue;const d=Math.hypot(n[0]-mp[0],n[2]-mp[2]);if(Math.abs(n[1]-mp[1])>3||d<6||d>60)continue;cand.push([n[0],n[1],n[2],d]);}
  let H1=null,V=null,H2=null,P=null;const fx=-Math.sin(me.look),fz=-Math.cos(me.look);
  for(let k=0;k<cand.length&&!(H1&&V);k+=Math.max(1,Math.floor(cand.length/4000))){const c=cand[k],d=c[3];
   if(!H1&&d>=8&&d<=22&&!sees(mp,c))H1=c;
   if(!V&&d>=7&&d<=16&&((c[0]-mp[0])*fx+(c[2]-mp[2])*fz)/d>.8&&sees(mp,c)&&clear(eye(mp),[c[0],c[1]+1.05,c[2]]))V=c;}
  for(let k=0;k<cand.length&&!H2;k+=Math.max(1,Math.floor(cand.length/3000))){const c=cand[k];if(c[3]<34||c[3]>55||sees(mp,c))continue;
   for(let j=0;j<cand.length;j+=3){const q=cand[j],dq=Math.hypot(q[0]-c[0],q[2]-c[2]);if(dq<8||dq>36||q[3]>38)continue;if(!clear(eye(c),[q[0],q[1]+.05,q[2]]))continue;if(!clear(eye(mp),[q[0],q[1]+1,q[2]]))continue;H2=c;P=q;break;}}
  return {me:mp.map(v=>+v.toFixed(2)),T:foes[0].id,O:foes[1].id,others:foes.slice(2).map(u=>u.id),H1,V,H2,P,cands:cand.length};`);
 log('spots',spots);
 if(!spots.H1||!spots.V){check('found hidden and visible spots from the page player (server world rays)',false,spots);await browser.close();process.exit(1);}
 // park the other enemies far behind (hidden spot H2 or back at their spawn: they are not part of the test), T at H1
 const sync=async(n)=>{const t0=await qa(`return sim('${code}').time;`);for(let i=0;i<120;i++){await page.waitForTimeout(1500);const t=await qa(`return sim('${code}').time;`);if(t-t0>=n)return t-t0;}return -1;};
 await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T}),O=s.units.find(u=>u.id===${spots.O});put(T,${JSON.stringify(spots.H1)});${spots.H2?`put(O,${JSON.stringify(spots.H2)});`:'O.x+=0;'}return 1;`);
 log('sim advanced (A hidden)',await sync(1.5));
 const sv=await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});return {T:[T.x,T.y,T.z].map(v=>+v.toFixed(2)),seen:sees(mp,[T.x,T.y,T.z]),me:mp.map(v=>+v.toFixed(2))};`);
 await W8(`(window.__ust(${spots.T})||{}).fog===1`,300000,'T fogged');
 let a=JSON.parse(await X(`JSON.stringify(window.__ust(${spots.T}))`));log('A hidden: page unit',{a,server:sv});
 const far=p=>!p||Math.hypot(p[0]-spots.H1[0],p[2]-spots.H1[2])>2;
 check('online fog: an enemy behind a wall (server rays: hidden both ways) is parked in the page - fogged, model out of the scene, never at its true spot',!sv.seen&&a&&a.fog===1&&!a.inScene&&far(a.pos),{a,sv});
 // A2: to plain sight
 await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});put(T,${JSON.stringify(spots.V)},me.look+Math.PI);return 1;`);
 await W8(`(()=>{const a=window.__ust(${spots.T});return !!a&&a.fog===0&&a.inScene&&!!a.pos&&Math.hypot(a.pos[0]-(${spots.V[0]}),a.pos[2]-(${spots.V[2]}))<1;})()`,300000,'T visible at V'); // hk-33: fog1 read the unit before the move reached the page (it was already fog 0 / in scene at H1)
 a=JSON.parse(await X(`JSON.stringify(window.__ust(${spots.T}))`));const dv=a&&a.pos?Math.hypot(a.pos[0]-spots.V[0],a.pos[2]-spots.V[2]):null;log('A visible: page unit',{a,dv});
 check('online fog: the same enemy in plain sight is drawn at its true spot (fog 0, model in the scene within 1 m)',a&&a.fog===0&&a.inScene&&dv!=null&&dv<1,{a,dv,V:spots.V});
 await X('window.__allow=1;1');await page.screenshot({path:SHOT+'online-fog-visible-640x360.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
 // B. hearing: back to H1 hidden, run (turning every 0.5 s) for ~4 s of sim time
 await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});put(T,${JSON.stringify(spots.H1)});return 1;`);await sync(1.2);await W8(`(window.__ust(${spots.T})||{}).fog===1`,300000,'T fogged again');
 await X('window.__st.length=0;1');
 // hk-33: fog2's runner turned every 0.5 s: loud ([23]) only between the turn-arounds, and the page's netSteps adds at most
 // 0.1 s per frame (dt cap) while the lockstep room moves 0.25 s per page message, so the 0.3 s first-step delay never ran out
 // on the ~1 frame/s box (row sent, fog 0, loud at the end, 0 steps). Turn every 1.2 s (~1 s loud runs); steps near the lane.
 await qa(LIB(code)+`s.qaRun={id:${spots.T},flip:s.time+.6,every:1.2};return 1;`);log('B running (near) sim',await sync(5));
 const runN=await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});return {T:[T.x,T.y,T.z].map(v=>+v.toFixed(2)),d:+Math.hypot(T.x-mp[0],T.z-mp[2]).toFixed(1),loud:s.loud(T),seen:sees(mp,[T.x,T.y,T.z])};`);
 const bN=JSON.parse(await X(`JSON.stringify({u:window.__ust(${spots.T}),steps:window.__st.slice()})`));log('B near: page',{bN,server:runN});
 const nearSteps=bN.steps.filter(p=>Math.hypot(p[0]-runN.T[0],p[1]-runN.T[2])<9||Math.hypot(p[0]-spots.H1[0],p[1]-spots.H1[2])<9);
 check('online fog: a hidden enemy running within 30 m is heard - its row is sent and the page plays its footsteps at it (SFX.step)',runN.d<30&&!runN.seen&&nearSteps.length>0,{runN,steps:bN.steps.length,nearSteps:nearSteps.length,u:bN.u});
 await qa(LIB(code)+`s.qaRun=null;return 1;`);
 if(spots.H2){
  // B2: beyond 30 m, hidden, running -> fogged, silent
  await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});put(T,${JSON.stringify(spots.H2)});return 1;`);await sync(1.5);await W8(`(window.__ust(${spots.T})||{}).fog===1`,300000,'T fogged far');
  await X('window.__st.length=0;1');await qa(LIB(code)+`s.qaRun={id:${spots.T},flip:s.time+.5};return 1;`);await sync(3);
  const runF=await qa(LIB(code)+`const T=s.units.find(u=>u.id===${spots.T});return {T:[T.x,T.y,T.z].map(v=>+v.toFixed(2)),d:+Math.hypot(T.x-mp[0],T.z-mp[2]).toFixed(1),loud:s.loud(T),seen:sees(mp,[T.x,T.y,T.z])};`);
  const bF=JSON.parse(await X(`JSON.stringify({u:window.__ust(${spots.T}),steps:window.__st.slice()})`));log('B far: page',{bF,server:runF});
  await qa(LIB(code)+`s.qaRun=null;const T=s.units.find(u=>u.id===${spots.T});put(T,${JSON.stringify(spots.H1)});return 1;`);
  if(runF.d>31&&!runF.seen)check('online fog: a hidden enemy running beyond 30 m stays fogged and silent in the page (no footsteps, model parked)',bF.u&&bF.u.fog===1&&!bF.u.inScene&&bF.steps.length===0,{runF,u:bF.u,steps:bF.steps.length});
  else log('B far skipped (runner ended within 31 m or in sight)',runF);
  // C. hidden Omen > 30 m casts Dark Cover at a floor point the page player sees
  const c0=await X('window.__cf.length');
  const cast=await qa(LIB(code)+`const O=s.units.find(u=>u.id===${spots.O}),H=${JSON.stringify(spots.H2)},P=${JSON.stringify(spots.P)};put(O,H);O.agent='Omen';O.ability=O.ability||{};O.ability.q=Math.max(1,O.ability.q||0);O.ability.e=Math.max(1,O.ability.e||0);if(O.ability.cool){O.ability.cool.q=0;O.ability.cool.e=0;}
   const o=eye(H),q=[P[0]-o[0],P[1]+.05-o[1],P[2]-o[2]],L=Math.hypot(q[0],q[1],q[2]);O.look=Math.atan2(-q[0],-q[2]);O.pitch=Math.asin(q[1]/L);const n0=s.castEvents?s.castEvents.length:0;
   let ok=false;try{ok=s.command(O,{t:'ab',k:'e'});}catch(e){ok='throw '+String(e).slice(0,100);}const ev=(s.castEvents||[]).slice(n0).find(e=>e.i===O.id)||null;
   return {ok,ev:ev&&{k:ev.k,p:ev.p&&ev.p.map(v=>+v.toFixed(2))},d:+Math.hypot(H[0]-mp[0],H[2]-mp[2]).toFixed(1),seenO:sees(mp,H),pSeen:ev&&ev.p?clear(eye(mp),[ev.p[0],ev.p[1]+1,ev.p[2]]):null};`);
  log('C server cast',cast);
  await W8(`window.__cf.length>${c0}`,300000,'fogged cast in page');await page.waitForTimeout(2000);
  const cf=JSON.parse(await X(`JSON.stringify(window.__cf.slice(${c0}))`)),mine=cf.find(r=>r.i===spots.O)||null,o=JSON.parse(await X(`JSON.stringify(window.__ust(${spots.O}))`));log('C page casts',{cf,o});
  const pOk=mine&&Array.isArray(mine.p)&&cast.ev&&cast.ev.p&&Math.hypot(mine.p[0]-cast.ev.p[0],mine.p[2]-cast.ev.p[2])<.1;
  check('online fog: a hidden Omen beyond 30 m casts at a point the page player sees - the page gets it fog:1 with p and without the eye o / aim d, replays it with no error, and the caster stays parked',cast.ok===true&&cast.d>30&&!cast.seenO&&cast.pSeen&&!!mine&&mine.fog===1&&pOk&&!mine.o&&!mine.d&&!mine.err&&o&&o.fog===1&&!o.inScene,{cast,mine,o});
  await X('window.__allow=1;1');await page.screenshot({path:SHOT+'online-fog-cast-640x360.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
 } else log('B far / C skipped: no hidden spot 34-55 m with a shared visible floor point',spots);
 check('no page errors',!R.errors.length,{errors:R.errors.slice(0,5),console:R.console.slice(0,5)});
 await X('try{mpLeave()}catch(e){}1');await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
