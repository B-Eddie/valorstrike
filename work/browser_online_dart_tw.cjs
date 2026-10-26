// hk-35: online Spycam dart removal (hold 4) + Jett Tailwind HUD chip, through the local bridge (tools/browser-bridge, port 8787)
// in a lockstep room (C.lock: the server sim only moves on page input messages, so a ~1 frame/s page never loses game time).
//  A. Spycam dart in the page player (a foe Cypher's Spycam via s.command, its dart pointed at the player): the page chip reads
//     "TRACKING DART · HOLD 4 TO REMOVE"; holding Digit4 (input h4, standing still, not firing) shows "REMOVING DART n%" and
//     after the 1.85 s server channel the dart is gone (no dart effect on the player, chip cleared); letting go early resets it.
//  B. Tailwind (page player is Jett, real E key): the chip reads "TAILWIND <windup>s" during the 1 s windup, then
//     "TAILWIND READY · E TO DASH <n>s" for the 7.5 s window; a second E dashes (server tailwind cleared, the player moved).
// Usage: bash hk_out/start.sh bridge; (cd <repo> && node work/browser_online_dart_tw.cjs out.json)   ROOT=<repo> serves index.html
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/online-dart-tw.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[],console:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
const ONLY=(process.env.ONLY||'AB').split('');
const HEAL=c=>`{const s=sim('${c}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);const me=s.units.find(u=>u.human);if(me)for(const u of s.units)if(u.team===me.team&&u.alive)u.hp=100;}`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED/.test(t))R.console.push(t.slice(0,240));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const W8=(cond,ms,why)=>page.waitForFunction(c=>window.__xe(c),cond,{timeout:ms||600000,polling:1000}).then(()=>true).catch(e=>{log('wait '+(why||cond).slice(0,60)+' timeout',String(e).slice(0,100));return false;});
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await page.mouse.move(320,180); // any pointer-lock movement event starts from the centre (no aim drift)
 await X(`J.pick='Jett';MP.name='DartQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await qa(`C.lock=true;return 1;`);
 await X('mpStart();1');
 await W8('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5',1500000,'match start');
 // every status message the page handles: chips as shown (the #netSt text) with the server numbers
 await X(`window.__chips=[];{const f=netStatusChips;netStatusChips=function(st){const r=f.apply(this,arguments);try{const el=document.getElementById('netSt');window.__chips.push({t:+performance.now().toFixed(0),on:(r||[]).join(' · '),shown:!!(el&&el.style.display!=='none'),dart:st.dart,drm:+(st.drm||0).toFixed(2),twa:+(st.twa||0).toFixed(2),twu:+(st.twu||0).toFixed(2)});if(window.__chips.length>600)window.__chips.shift();}catch(e){}return r;};}1`);
 log('match',await qa(HEAL(code)+`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};s.buy=Math.min(s.buy,.3);const me=s.units.find(u=>u.human);return {team:me.team,agent:me.agent,phase:s.phase,buy:s.buy};`));
 await W8('FV.buy===0',1500000,'buy end');
 const sync=async n=>{const t0=await qa(`return sim('${code}').time;`);for(let i=0;i<160;i++){await page.waitForTimeout(1000);const t=await qa(`return sim('${code}').time;`);if(t-t0>=n)return +(t-t0).toFixed(2);}return -1;};
 const srv=()=>qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human);const d=s.effects.find(e=>e.kind==='dart'&&e.tgt===me.id&&e.until>=s.time);return {t:+s.time.toFixed(2),dart:!!d,rm:d?+(d.rm||0).toFixed(2):null,darted:(me.dartedUntil||0)>s.time,dartRm:+(me.dartRm||0).toFixed(2),tw:me.tailwind?{arm:+(me.tailwind.armAt-s.time).toFixed(2),until:+(me.tailwind.until-s.time).toFixed(2)}:null,v:+Math.hypot(me.vx||0,me.vz||0).toFixed(2),air:!!me.air,h4:!!(me.input&&me.input.interact),p:[me.x,me.y,me.z].map(v=>+v.toFixed(2))};`);
 const chipNow=()=>XJ(`(()=>{const el=document.getElementById('netSt');return {text:el?el.textContent:'',shown:!!(el&&el.style.display!=='none')};})()`);
 if(ONLY.includes('A'))try{
  // A. a foe Cypher sets a Spycam; its dart goes into the page player (tgt set once the camera exists: the stand-in pick needs sight)
  const mk=await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human),u=s.units.find(x=>x.team!==me.team&&x.alive);u.agent='Cypher';u.ability=u.ability||{};u.ability.e=1;if(u.ability.cool)u.ability.cool.e=0;
   const fx=-Math.sin(me.look),fz=-Math.cos(me.look);Object.assign(u,{x:me.x+fx*40,z:me.z+fz*40,look:me.look+Math.PI});const n0=s.effects.length;let ok=false;try{ok=s.command(u,{t:'ab',k:'e'});}catch(e){ok='throw '+String(e).slice(0,80);}
   const d=s.effects.slice(n0).find(e=>e.kind==='dart');if(d){d.tgt=me.id;d.pickAt=s.time;d.pings=[s.time+.1];d.until=Math.max(d.until,s.time+600);}return {ok,dart:!!d,every:d&&d.every,owner:u.id};`);
  log('A dart set',mk);
  await sync(1);await W8(`window.__chips.some(c=>c.dart===1)`,300000,'dart status');
  const s0=await srv(),c0=await chipNow();log('A darted',{s0,c0,chips:await XJ('window.__chips.slice(-3)')});
  check('online Spycam dart: the darted player sees "TRACKING DART · HOLD 4 TO REMOVE" (server dartedUntil, status.dart 1)',mk.dart&&s0.dart&&s0.darted&&c0.shown&&/TRACKING DART · HOLD 4 TO REMOVE/.test(c0.text),{mk,s0,c0});
  await page.screenshot({path:SHOT+'online-dart-tracking-640x360.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
  // A2: hold 4 about 1 s, let go: the channel resets (no removal)
  await X('window.__chips.length=0;1');await page.keyboard.down('Digit4');const t1=await sync(0.9);const mid=await srv(),cm=await chipNow();await page.keyboard.up('Digit4');await sync(0.6);const rs=await srv();
  log('A held ~1 s then released',{t1,mid,cm,rs,chips:await XJ('window.__chips.filter(c=>c.drm>0).slice(-4)')});
  check('online Spycam dart: holding 4 shows "REMOVING DART n%" (server rm climbing, < 1.85 s); letting go early resets it (dart kept, rm 0)',mid.dart&&mid.rm>0.3&&mid.rm<1.85&&mid.h4&&/REMOVING DART \d+%/.test(cm.text)&&rs.dart&&rs.rm===0,{mid,cm,rs});
  // A3: hold 4 for the full 1.85 s: dart gone, chip cleared
  await X('window.__chips.length=0;1');await page.keyboard.down('Digit4');const t2=await sync(2.3);const done=await srv();await page.keyboard.up('Digit4');await sync(0.5);const c3=await chipNow(),after=await srv();
  const pct=await XJ(`window.__chips.filter(c=>c.drm>0).map(c=>c.on)`);log('A held 2.3 s',{t2,done,after,c3,pct:pct.slice(-6)});
  check('online Spycam dart: holding 4 for 1.85 s removes it (no dart in the player, chip cleared; % rose to >= 50 on the way)',!done.dart&&!after.dart&&!after.darted&&!/DART/.test(c3.text)&&pct.some(t=>{const m=/REMOVING DART (\d+)%/.exec(t);return m&&+m[1]>=50;}),{done,after,c3,pct:pct.slice(-6)});
 }catch(e){R.errors.push('part A '+String(e).slice(0,300));log('part A error',String(e).slice(0,300));}
 if(ONLY.includes('B'))try{
  // B. Tailwind, page player Jett, real E key
  const me0=await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human);me.ability=me.ability||{};me.ability.e=1;if(me.ability.cool)me.ability.cool.e=0;me.tailwind=null;return {agent:me.agent,e:me.ability.e};`);
  await X(`J.e=1;J.cd.e=0;window.__chips.length=0;1`);log('B ready',me0);
  await page.keyboard.down('KeyE');await sync(0.3);await page.keyboard.up('KeyE');
  const w=await srv(),cw=await chipNow();log('B windup',{w,cw,chips:await XJ('window.__chips.slice(-3)')});
  check('online Tailwind: E starts the 1 s windup on the server and the page chip reads "TAILWIND <s>s"',me0.agent==='Jett'&&w.tw&&w.tw.arm>0&&w.tw.arm<=1&&/TAILWIND \d\.\ds/.test(cw.text),{me0,w,cw});
  await sync(1.1);const r=await srv(),cr=await chipNow();log('B window',{r,cr});
  await page.screenshot({path:SHOT+'online-tailwind-ready-640x360.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
  check('online Tailwind: after the windup the chip reads "TAILWIND READY · E TO DASH <n>s" (server window <= 7.5 s)',r.tw&&r.tw.arm<=0&&r.tw.until>0&&r.tw.until<=7.5&&/TAILWIND READY · E TO DASH \d+s/.test(cr.text),{r,cr});
  const p0=r.p;await page.keyboard.down('KeyW');await page.keyboard.down('KeyE');await sync(0.3);await page.keyboard.up('KeyE');await sync(0.4);await page.keyboard.up('KeyW');await sync(0.3);
  const d=await srv(),cd=await chipNow(),moved=Math.hypot(d.p[0]-p0[0],d.p[2]-p0[2]);log('B dash',{d,cd,moved:+moved.toFixed(2)});
  check('online Tailwind: E in the window dashes (server tailwind spent, the player moved > 3 m) and the chip clears',!d.tw&&moved>3&&!/TAILWIND/.test(cd.text),{d,cd,moved});
 }catch(e){R.errors.push('part B '+String(e).slice(0,300));log('part B error',String(e).slice(0,300));}
 check('no page errors',!R.errors.length,{errors:R.errors.slice(0,5),console:R.console.slice(0,5)});
 await browser.close();process.exit(R.checks.every(c=>c[1]==='pass')?0:1);
})().catch(e=>{R.errors.push('fatal '+String(e).slice(0,300));log('fatal',String(e).slice(0,300));process.exit(2);});
