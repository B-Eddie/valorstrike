// hark-abil 497c6e6 / 7cc68ad in the rendered page, headless Chromium (SwiftShader, LOW), real keyboard / mouse.
// A. Offline 5v5 Ascent at 1280x720: Jett C (Cloudburst), Omen E (Dark Cover), Cypher Q (Cyber Cage) cast with real keys;
//    the new smoke's sight radius (J.smokes[].r) and its drawn sphere (geometry bounding radius x world scale) equal the
//    wiki table XSMR {Jett 3.35, Omen 4.1, Cypher 3.72} (= server abilities.js SMOKE.r), not the old shared 4 m.
//    Screenshots work/validation/smoke-<agent>-1280x720.jpg.
// B. Online 5v5 Ascent at 640x360 through the real worker (server/tools/browser-bridge.mjs on 8787, lockstep): as Raze,
//    real X equips Showstopper on the server (u.showstopper); real left clicks before the 1.4 s equip ends launch nothing
//    (no rocket effect, gun ammo unchanged, launcher still out); a click after it launches one rocket.
//   bash hk_out/start.sh http; bash hk_out/start.sh bridge; node work/browser_smoke_raze.cjs <out.json>   (PARTS=A,B)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/smoke_raze.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const PARTS=(process.env.PARTS||'A,B').split(',');
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
// server table, read from the source so the browser check compares against what the server uses
const SRV=(()=>{const s=fs.readFileSync(ROOT+'/server/src/abilities.js','utf8'),m=s.match(/SMOKE=\{[^}]*r:\{([^}]*)\}/);const o={};if(m)for(const p of m[1].split(',')){const [k,v]=p.split(':');o[k.trim()]=+v;}return o;})();
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const mk=async(w,h)=>{const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
  await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
  await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
  const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
  const X=s=>page.evaluate(s=>window.__xe(s),s);
  await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});return {ctx,page,X};};
 log('server SMOKE.r',SRV);
 if(PARTS.includes('A')){
  const {ctx,page,X}=await mk(1280,720);log('assets A',1);
  const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
  await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;
   window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};1`);
  await frames(3);await page.mouse.move(640,360);log('match A',await X('JSON.stringify({map:FV.map,XSMR})'));
  for(const [ag,key] of [['Jett','KeyC'],['Omen','KeyE'],['Cypher','KeyQ']]){
   await X(`J.pick=${JSON.stringify(ag)};jRound(false);J.c=K().mx.c||1;J.q=K().mx.q||1;J.e=Math.max(1,K().mx.e||1);J.cd={c:0,q:0,e:0,x:0};player.hp=100;J.eq=null;J.cbs=[];for(const s of J.smokes)scene.remove(s.m);J.smokes.length=0;pitch=-0.15;1`);await frames(1);
   await page.keyboard.press(key);let n=0;
   const t0=Date.now();let nc=0; // equip-then-fire (1.1 s draw): click while the ability is out until the smoke exists (a click during the draw is ignored); <= 40 s on the ~1 frame/s box
   for(let i=0;Date.now()-t0<40000;i++){n=await X('J.smokes.length');if(n)break;if(i%15===5&&(await X('!!J.eq'))){await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();nc++;}await X('window.__allow=1;1');await page.waitForTimeout(100);}
   log(ag+' cast state',await X(`JSON.stringify({clicks:${nc},eq:J.eq,smokes:J.smokes.length,cd:J.cd,lc:typeof XNF!=='undefined'?XNF:null})`));
   const s=await X(`JSON.stringify((()=>{const s=J.smokes[J.smokes.length-1];if(!s)return null;const g=s.m.geometry;if(!g.boundingSphere)g.computeBoundingSphere();s.m.updateMatrixWorld(true);const ws=new THREE.Vector3();s.m.getWorldScale(ws);return {r:s.r,drawn:+(g.boundingSphere.radius*Math.max(ws.x,ws.y,ws.z)).toFixed(3),geo:g.boundingSphere.radius,p:[+s.p.x.toFixed(1),+s.p.y.toFixed(1),+s.p.z.toFixed(1)],t:+s.t.toFixed(2)};})())`).then(JSON.parse);
   log(ag+' smoke',s);await frames(2);await page.screenshot({path:`${SHOT}smoke-${ag.toLowerCase()}-1280x720.jpg`,type:'jpeg',quality:80,timeout:150000}).catch(e=>log('shot failed (non-fatal)',String(e).slice(0,120)));
   const want=await X(`XSMR[${JSON.stringify(ag)}]`);
   check(`${ag} ${key}: smoke radius ${want} m (sight r and drawn sphere; server SMOKE.r ${SRV[ag]}), not the old 4 m`,!!s&&Math.abs(s.r-want)<1e-6&&Math.abs(s.drawn-want)<.02&&want===SRV[ag]&&want!==4,JSON.stringify({s,want,srv:SRV[ag]}));
  }
  await ctx.close();
 }
 if(PARTS.includes('B')){
  const {ctx,page,X}=await mk(640,360);log('assets B',1);
  await X(`MP.name='RazeQA';J.pick='Raze';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
  await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
  await X('mpStart();1');
  await page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5'),null,{timeout:900000}).catch(e=>log('start wait',String(e).slice(0,200)));
  const info=await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};C.lock=true;if(s.buy>0)s.buy=Math.min(s.buy,.5);if(s.remaining!=null)s.remaining=900;const me=s.units.find(u=>u.human);me.invulnerableUntil=1e9;return {agent:me.agent,team:me.team};`);log('server',info);
  check('online: the page player is Raze on the server',info.agent==='Raze',JSON.stringify(info));
  await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:1200000}).catch(e=>log('buy end wait',String(e).slice(0,120)));
  const st=()=>qa(`const s=sim('${code}');const me=s.units.find(u=>u.human);return {t:+s.time.toFixed(3),ss:me.showstopper?{ready:+me.showstopper.ready.toFixed(3),until:+me.showstopper.until.toFixed(3)}:null,ult:me.ability&&me.ability.ult,ammo:me.ammo,weapon:me.weapon,rockets:s.effects.filter(e=>e.kind==='rocket').length,alive:me.alive};`);
  await qa(`const s=sim('${code}');const me=s.units.find(u=>u.human);me.ability.ult=9;return 1;`);await page.waitForTimeout(1500);
  await page.mouse.move(320,180);await page.keyboard.press('KeyX');let a=null;for(let i=0;i<60;i++){a=await st();if(a.ss)break;await page.waitForTimeout(250);}log('after X',a);
  check('online Raze X: server equips Showstopper (launcher out, ult spent, no rocket yet)',!!a.ss&&a.rockets===0,JSON.stringify(a));
  if(a.ss){const early=[];
   for(let i=0;i<6;i++){const b=await st();if(b.t>=a.ss.ready-.25)break;await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(150);const c=await st();early.push({b,c});if(c.t>=a.ss.ready)break;}
   log('early clicks',early);const inWin=early.filter(e=>e.c.t<a.ss.ready);
   check('online Raze: left clicks during the 1.4 s equip launch nothing (no rocket, gun ammo unchanged, launcher still out)',inWin.length>0&&inWin.every(e=>e.c.rockets===0&&e.c.ammo===a.ammo&&!!e.c.ss),JSON.stringify({n:inWin.length,clicks:inWin.map(e=>[e.b.t,e.c.t,e.c.rockets,e.c.ammo])}));
   for(let i=0;i<200;i++){const b=await st();if(b.t>=a.ss.ready+.05)break;await page.waitForTimeout(250);}
   await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();let d=null,saw=0;for(let i=0;i<40;i++){d=await st();saw=Math.max(saw,d.rockets);if(d.rockets)break;await page.waitForTimeout(250);}log('after ready click',d);
   await page.screenshot({path:`${SHOT}online-raze-showstopper-640x360.jpg`,type:'jpeg',quality:70,timeout:150000}).catch(e=>log('shot failed (non-fatal)',String(e).slice(0,120)));
   check('online Raze: a click after the equip launches the rocket (launcher put away)',!d.ss&&saw>=1&&d.ammo===a.ammo,JSON.stringify({d,saw}));
  }
  await X('try{mpLeave()}catch(e){}1');await ctx.close();
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
