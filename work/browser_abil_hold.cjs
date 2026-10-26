// Hold-to-charge / steered abilities in the rendered page (hark-abil 143e53c), headless Chromium (SwiftShader, LOW), offline
// 5v5 Ascent at 1280x720, real keyboard / mouse. World rendering skipped between captures (window.__allow), the game loop runs.
// A. Breach E (Fault Line): tap FIRE -> strip near the 8 m minimum; FIRE held ~1.2 s -> near 56 m (BC.fq L read during the windup).
// B. Jett C (Cloudburst): tap -> thrown instantly, not steered; held -> steering, the flight follows a 90 deg aim turn,
//    release ends steering; each lands as a smoke.
// C. Reyna C (Leer): equip + cast, no page or console errors through the cast and its 2 s life (the Leer crash fix).
//   node work/browser_abil_hold.cjs <out.json>   (screenshots work/validation/abilhold-*.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/abilhold.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// Ability equip-then-fire FP visuals + Deathmatch 640x360 leaderboard vs combat report, headless Chromium (SwiftShader, LOW).
// A. offline 5v5 Ascent as Phoenix, action phase, 1280x720: real Q key -> Hot Hands equipped (gun lowered, hand + item in the
//    first-person view), stays in hand while not fired; real left click -> thrown; gun comes back. Same for C (Blaze).
//    Records J.eq / XEQV state and the FP gun's lowered offset per capture; screenshots abil-*.jpg.
// B. Deathmatch Ascent at 640x360: player killed -> combat report shown and the FFA leaderboard hidden (7a58c99); after the
//    respawn the leaderboard is back.   node work/browser_abil_dm.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 // hk-32: harness time dilation (browser_newmain2.cjs). abilhold3: the Fault Line charge and the hold HUD follow the tick's real-clock
// dt (<= XRT.max per frame), so a 0.06 s tap spanning one ~1 s SwiftShader frame cast the full 56 m strip; and the script's 100 ms
// polls let ~0.3 s of game run with C still down after a Jett tap. Taps / holds run at __ts 0.05, where the clocks agree.
await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 // hk-30: every hold / wait is in GAME time (abilhold1 on 8d7b750: taps, holds and the 90 deg steer all fell between two of the box's
 // ~1 s frames, so the page saw no time pass). xSimStep is wrapped to count sim time (installed by go()).
 const simWait=async(sec,why)=>{const t=+(await X('window.__sim||0'));await page.waitForFunction(t=>window.__xe('window.__sim||0')>=t,t+sec,{timeout:900000,polling:100}).catch(e=>log('simWait '+(why||sec)+' timeout',String(e).slice(0,80)));};
 const readyWait=()=>page.waitForFunction(()=>window.__xe('J.eq&&J.eq.st==="ready"'),null,{timeout:300000,polling:100}).catch(e=>log('ready wait timeout',String(e).slice(0,80)));
 const shot=async(n,w,h)=>{await frames(2);await page.screenshot({path:`${SHOT}${n}-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:150000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async(fn,agent)=>{await X(`FV.pick='ascent';J.pick=${JSON.stringify(agent)};window.xSwift=false;setTimeout(()=>xGo(${fn}),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}if(!window.__simH){window.__simH=1;window.__sim=0;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;return r;};}1`);};

 const pick=a=>X(`FV.buy=0;J.pick=${JSON.stringify(a)};jRound(false);J.c=K().mx.c||1;J.q=K().mx.q||1;J.e=Math.max(1,K().mx.e||1);J.cd={c:0,q:0,e:0,x:0};player.hp=100;J.eq=null;BC.fq=[];J.cbs=[];1`);
 const eqSt=()=>X('J.eq?J.eq.st:null');
 const waitFq=async()=>{for(let i=0;i<80;i++){const f=await X('JSON.stringify(BC.fq.map(q=>[q.k,+(+q.L).toFixed(1)]))').then(JSON.parse);if(f.length)return f;await simWait(0.05,'fq');}return [];};
 await go('startFive','Breach');await X('window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;1');
 // hk-32: abilhold2 (777f16e) - Jett's tap DID spend a charge (2 -> 1) but projectile and its 2.5 s smoke were gone by the next poll, and no
 // Fault Line strip was ever seen in BC.fq: on the ~1 frame/s box one frame steps the game far past the script's game-time poll, so
 // "currently present" reads miss short-lived things. Count the events themselves: Fault Line casts (bcLine, with length), Cloudburst
 // throws (J.cbs grows in jKey), Cloudburst smokes spawned and the held flag of every flight tick (jCbTick). FV.buy pinned to 0
 // (a buy phase swallows ability keys: 'Abilities unlock at round start').
 await X(`if(!window.__ahk){window.__ahk=1;window.__fl=[];window.__cbT=0;window.__cbSm=0;window.__cbH=[];
  const l0=bcLine;bcLine=function(P,fx,fz,L){window.__fl.push(+(+L).toFixed(1));return l0.apply(this,arguments);};
  const k0=jKey;jKey=function(code){const n=J.cbs.length,r=k0.apply(this,arguments);if(J.cbs.length>n)window.__cbT+=J.cbs.length-n;return r;};
  const t0=jCbTick;jCbTick=function(){const b=new Set(J.smokes);for(const c of J.cbs)window.__cbH.push(!!c.st.held);if(window.__cbH.length>400)window.__cbH.splice(0,200);const r=t0.apply(this,arguments);for(const s of J.smokes)if(!b.has(s))window.__cbSm++;return r;};}1`);
 const ev=()=>X('JSON.stringify({fl:window.__fl.slice(),cbT:window.__cbT,cbSm:window.__cbSm,buy:FV.buy})').then(JSON.parse);await frames(3);await page.mouse.move(640,360);
 // A. Breach
 for(const [nm,hold] of [['tap',60],['held',1300]]){
  await pick('Breach');await frames(1);await X('window.__ts=0.05;1');await frames(1);await page.keyboard.down('KeyE');await simWait(0.05,'KeyE');await page.keyboard.up('KeyE');await readyWait();log('breach '+nm+' drawn',await eqSt());
  await page.mouse.down();await simWait(hold/1000,'hold');if(nm==='held'){log('breach held state',await eqSt());await shot('abilhold-breach-charging',1280,720);}await page.mouse.up();
  const fl0=(await ev()).fl.length;const f=await waitFq();for(let i=0;i<120&&(await ev()).fl.length===fl0;i++)await simWait(0.1,'fl cast');const fe=(await ev()).fl.slice(fl0);log('breach '+nm+' strip',{fq:f,cast:fe});if(nm==='held')await shot('abilhold-breach-released',1280,720);
  const L=fe.length?fe[0]:f.length?f[0][1]:null;
  check(nm==='tap'?'Breach E tap: Fault Line strip near the 8 m minimum (8..14 m)':'Breach E held 1.3 s: Fault Line strip near the 56 m maximum (>=50 m)',nm==='tap'?L>=8&&L<14:L>=50&&L<=56,JSON.stringify({fq:f,cast:fe}));
  await X('window.__ts=1;1');await simWait(2,'breach after');await frames(1);
 }
 // B. Jett
 await pick('Jett');await frames(1);await X('window.__ts=0.05;1');await frames(1);
 const cb=()=>X('JSON.stringify({n:J.cbs.length,c:J.c,sm:J.smokes.length,cbs:J.cbs.map(c=>({held:c.st.held,p:[+c.st.p[0].toFixed(1),+c.st.p[2].toFixed(1)],v:[+c.st.v[0].toFixed(1),+c.st.v[2].toFixed(1)]})),yaw:+yaw.toFixed(3),pp:[+player.x.toFixed(1),+player.z.toFixed(1)]})').then(JSON.parse);
 let s0=await cb(),ej0=await ev();await X('window.__cbH=[];1');await page.keyboard.down('KeyC');await simWait(0.06,'tap');await page.keyboard.up('KeyC');await simWait(0.2,'after tap');let s1=await cb();log('jett tap',s1);
 const e1=await ev(),hT=await X('JSON.stringify(window.__cbH)').then(JSON.parse);log('jett tap events',{e1,heldTicks:hT.length,heldTrue:hT.filter(Boolean).length});check('Jett C tap: thrown on the press (charge spent, no equip), not steered after release',s1.c===s0.c-1&&e1.cbT===ej0.cbT+1&&(s1.n===1?s1.cbs[0].held===false:true)&&hT.length>0&&hT.indexOf(false)>=0&&hT.lastIndexOf(true)<hT.indexOf(false)/* held only before the first released tick */,JSON.stringify({s1,e1,heldTrue:hT.filter(Boolean).length}));
 for(let i=0;i<60&&(await X('J.cbs.length'));i++)await simWait(0.1,'flight');let s2=await cb();log('jett tap landed',s2);const e2=await ev();check('Jett C tap: lands as a smoke',e2.cbSm===ej0.cbSm+1&&s2.n===0,JSON.stringify({s2,e2}));
 await simWait(0.5,'gap');s0=await cb();const e3=await ev();await page.keyboard.down('KeyC');await simWait(0.25,'hold C');s1=await cb();log('jett held',s1);
 check('Jett C held: projectile out and steering',s1.n===1&&s1.cbs[0].held===true,JSON.stringify(s1));
 await X('yaw+=Math.PI/2;1');await simWait(0.5,'steer');s2=await cb();log('jett held after 90 deg turn',s2);await shot('abilhold-jett-steer',1280,720);
 {const fx=-Math.sin(s2.yaw),fz=-Math.cos(s2.yaw),c=s2.cbs[0],vl=c?Math.hypot(c.v[0],c.v[1]):0,dot=c&&vl?(c.v[0]*fx+c.v[1]*fz)/vl:-9;
  check('Jett C held: the flight turns with the crosshair (horizontal velocity within ~45 deg of the new aim)',!!c&&c.held&&dot>0.7,JSON.stringify({dot,c}));}
 await page.keyboard.up('KeyC');await simWait(0.15,'release');let s3=await cb();log('jett released',s3);
 check('Jett C released: no more steering (or already landed)',s3.n===0||s3.cbs[0].held===false,JSON.stringify(s3));
 for(let i=0;i<60&&(await X('J.cbs.length'));i++)await simWait(0.1,'flight');s3=await cb();log('jett held landed',s3);const e4=await ev();check('Jett C held: lands as a smoke',e4.cbSm===e3.cbSm+1,JSON.stringify({s3,e4}));await shot('abilhold-jett-smoke',1280,720);
 // C. Reyna Leer
 await X('window.__ts=1;1');await pick('Reyna');await frames(1);const e0=R.errors.length;const c0=await X('J.c');
 await page.keyboard.down('KeyC');await simWait(0.05,'KeyC');await page.keyboard.up('KeyC');await readyWait();log('reyna leer drawn',await eqSt());
 await page.mouse.down();await simWait(0.08,'click');await page.mouse.up();
 for(let i=0;i<6;i++){await simWait(0.5,'leer');await frames(1);if(i===1)await shot('abilhold-reyna-leer',1280,720);}
 const lr=await X('JSON.stringify({c:J.c,leer:(J.leer||[]).length,eq:J.eq?J.eq.st:null,running})').then(JSON.parse);log('reyna after leer',lr);
 const newErr=R.errors.slice(e0).filter(e=>!/ERR_CONNECTION_REFUSED/.test(e));/* no game server in this offline row: the page's server probe is refused (not a Leer error) */check('Reyna C Leer: cast (charge spent), no page / console errors through its life, game still running',lr.c===c0-1&&!newErr.length&&lr.running,JSON.stringify({lr,newErr}));
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
