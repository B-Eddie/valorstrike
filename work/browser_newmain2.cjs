// More new-on-main features in the rendered page, headless Chromium (SwiftShader, LOW), offline 5v5 Bind at 1280x720, real keys / mouse.
// E. Ult guns on the agent's native FP arms (b5883a0): Raze Showstopper (X), Chamber Headhunter (Q), Tour De Force (X): XAF gun mode,
//    the agent's own FP rig (SkinnedMesh), the gun model in the hand, no legacy XVM primitives; FIRE plays the fire clip.
// F. Jett Blade Storm on the Wushu X set (4fbd1ce): equip / idle, a knife in each hand, throws play Attack01 -> 02 -> 03.
// G. Sova's real bow (46aaf26): Shock Bolt drawn -> the bow in the left fist is the Hunter_Bow mesh from agents/sova.glb (no torus primitive).
// H. Knife 2 m (31e51b4 / a5fc0b0): a light swing hits a bot ~1.6 m ahead, misses one ~2.9 m ahead; no 'kLg is not defined' (or any)
//    page error through the swings and a round reset.
// Also: after each ability / ult gun the held gun comes back (gun.visible restored, xAfShowGun).
//   node work/browser_newmain2.cjs <out.json>   (screenshots work/validation/newmain2-*.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),PORT=process.env.PORT||'8876',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/newmain2.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const ONLY=(process.env.ONLY||'E,F,G,H').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 // harness time dilation: window.__ts scales performance.now (game + viewmodel time follow it). SwiftShader renders ~1 frame/s and
 // vmTick advances by real time, so a < 1 s fire / throw clip would finish inside one frame; the fire samples run at __ts=0.1.
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=s=>X('JSON.stringify('+s+')').then(JSON.parse);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async(n)=>{await frames(2);await page.screenshot({path:`${SHOT}newmain2-${n}-1280x720.jpg`,type:'jpeg',quality:82,timeout:150000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
 const until=async(expr,ms,step=100)=>{const t=Date.now();while(Date.now()-t<ms){if(await X(expr))return true;await page.waitForTimeout(step);}return false;};
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='bind';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await frames(2);log('loaded',await XJ('{map:FV.map,bots:bots.length}'));await page.mouse.move(640,360);
 const keep=()=>X('window.__god=1;if(typeof timeLeft!=="undefined")timeLeft=900;player.hp=100;1');
 const pick=a=>X(`J.pick=${JSON.stringify(a)};jRound(false);J.c=K().mx.c||1;J.q=K().mx.q||1;J.e=Math.max(1,K().mx.e||1);J.cd={c:0,q:0,e:0,x:0};player.hp=100;J.eq=null;BC.fq=[];J.cbs=[];1`);


 const tick=async(ms)=>{const t=Date.now();while(Date.now()-t<ms){await X('window.__allow=2;1');await page.waitForTimeout(400);}};
 const untilF=async(expr,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(await X(expr))return true;await X('if(window.__keepEx)eval(window.__keepEx);window.__allow=2;1');await page.waitForTimeout(300);}return false;};
 const fireSample=async(expr)=>{await X('window.__ts=0.1;1');await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await frames(1);const r=await XJ(expr);await X('window.__ts=1;1');return r;};
 const VS=`(()=>{const R=XAF.cur;let sk=0;if(R&&R.root)R.root.traverse(o=>{if(o.isSkinnedMesh)sk++;});const G=R&&R.guns?Object.fromEntries(Object.entries(R.guns).map(([k,v])=>[k,{ok:!!v.ok,vis:v.g.visible,l:v.l?v.l.visible:null}])):null;
   return {on:XAF.on,mode:XAF.mode,last:XAF.last,gs:XAF.gs&&{k:XAF.gs.k,n:XAF.gs.n},sk,vis:!!(R&&R.root&&R.root.visible&&R.root.parent===camera),guns:G,err:XAF.err,xvm:typeof XVM!=='undefined',bcvm:typeof BC!=='undefined'?BC.vm:null,gun:gun.visible,knife:knife.visible,rw:typeof rw!=='undefined'?rw:null};})()`;
 const back=async(nm)=>{const ok=await untilF('!XAF.on&&(gun.visible||knife.visible)',20000);const s=await XJ(VS);log(nm+' after',s);check(nm+': afterwards the ability rig is gone and the held weapon is visible again',ok,JSON.stringify({on:s.on,gun:s.gun,knife:s.knife,rw:s.rw}));};
 await X('player.x=-53.25+6;player.z=21-6;player.y=7.3;1').catch(()=>{});
 if(ONLY.includes('E')){
  for(const [ag,key,k,prep] of [['Raze','KeyX','rk','J.ult=K().u'],['Chamber','KeyQ','hp','J.q=Math.max(1,J.q||0);J.cd.q=0'],['Chamber','KeyX','sn','J.ult=K().u;BC.td=0;BC.eq=""']]){
   await keep();await pick(ag);await X(prep+';window.__keepEx='+JSON.stringify(k==='rk'?'if(RS.ss)RS.sst=10':'')+';1');await tick(800);await page.keyboard.press(key);
   const ok=await untilF(`XAF.on&&XAF.last&&XAF.last.gun==="${k}"&&XAF.last.rig===true&&XAF.last.item===true`,60000);const s=await XJ(VS);log(`${ag} ${key} ${k}`,s);await shot(`ultgun-${k}`);
   check(`${ag} ${key} (${k}): ult / ability gun on the agent's own FP arms (gun mode, SkinnedMesh rig under the camera, gun model in the hand, no XVM primitives)`,ok&&s.sk>0&&s.vis&&!s.xvm&&!s.err&&s.mode.startsWith('gun-'),JSON.stringify(s));
   if(k!=='hp'){await tick(k==='sn'?2600:1600);const n0=await X('XAF.gs?XAF.gs.n:0');await X('window.__keepEx="";1');const s2=await fireSample(VS);log(k+' fired',s2);
    check(`${ag} ${key} (${k}): FIRE plays the gun's fire clip on the arms`,!!s2.gs&&s2.gs.n>n0&&/Fire/.test((s2.last&&s2.last.clip)||''),JSON.stringify(s2));}
   if(k==='rk')await back('Showstopper (rocket spent)');
   else{await X('BC.eq="";BC.td=0;1');await page.keyboard.press('Digit2');await back(`${k} put away (weapon key)`);}
  }
 }
 if(ONLY.includes('F')){
  await keep();await pick('Jett');await X('J.ult=K().u;1');await tick(800);await page.keyboard.press('KeyX');
  const ok=await untilF('XAF.on&&XAF.last&&XAF.last.gun==="bs"&&XAF.last.rig===true&&XAF.last.item===true',60000);const s=await XJ(VS);log('blade storm',s);await shot('bladestorm-idle');
  check("Jett X Blade Storm: Jett's Wushu X set on her FP arms with a knife in each hand",ok&&s.sk>0&&s.vis&&s.guns&&s.guns.bs&&s.guns.bs.vis&&s.guns.bs.l===true,JSON.stringify(s));
  await tick(1800);const clips=[];
  for(let i=0;i<3;i++){const c=await fireSample('{clip:XAF.last&&XAF.last.clip,n:XAF.gs&&XAF.gs.n,bs:J.bs}');clips.push(c);await tick(1200);}
  log('blade storm throws',clips);check('Blade Storm throws play Attack01 -> Attack02 -> Attack03 (right, left, right) and spend knives',clips.map(c=>(c.clip||'').slice(-8)).join()==='Attack01,Attack02,Attack03'&&clips[2].bs<=2,JSON.stringify(clips));
  await X('J.bs=0;J.bsOn=false;1');await page.keyboard.press('Digit2');await back('Blade Storm ended');
 }
 if(ONLY.includes('G')){
  await keep();await pick('Sova');await tick(800);await page.keyboard.press('KeyQ');
  const ok=await untilF('XAF.on&&XAF.cur&&XAF.cur.bow&&XAF.cur.bow.userData.ok&&XAF.cur.bow.visible!==false',60000);
  const b=await XJ(`(()=>{const B=XAF.cur&&XAF.cur.bow;if(!B)return null;let mats=[],torus=0,meshes=0;B.traverse(o=>{if(o.isMesh){meshes++;[].concat(o.material).forEach(m=>mats.push(m.name));if(o.geometry&&o.geometry.type==='TorusGeometry')torus++;}});
    const sz=new THREE.Box3().setFromObject(B).getSize(new THREE.Vector3());return {meshes,mats:[...new Set(mats)],torus,par:B.parent&&B.parent.name,vis:B.visible,size:[sz.x,sz.y,sz.z].map(v=>+v.toFixed(2)),last:XAF.last};})()`);
  log('sova bow',b);await shot('sova-bow');
  check("Sova Q: the bow in the left fist is his real bow (Hunter_Bow mesh from agents/sova.glb), no torus primitive",ok&&b&&b.meshes>0&&b.mats.some(m=>/^Hunter_Bow/.test(m))&&!b.torus&&/palm-L/.test(b.par||'')&&b.vis,JSON.stringify(b));
  await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();await back('Sova Shock Bolt');
 }
 if(ONLY.includes('H')){
  await keep();await pick('Jett');await tick(500);await page.keyboard.press('Digit3');await untilF('knife.visible',10000);await tick(1500);
  const e0=R.errors.length;const res={};
  for(const [nm,d] of [['near',1.6],['far',2.9]]){
   const s=await XJ(`(()=>{const b=bots.find(b=>b.alive);if(!b)return null;yaw=0;pitch=-0.05;b.nt=true;b.hp=100;b.g.position.set(player.x,player.y,player.z-${d});if('x' in b){b.x=player.x;b.z=player.z-${d};}window.__kb=b;return {hp:b.hp,p:[b.g.position.x,b.g.position.z]};})()`);
   await tick(400);await X(`(()=>{window.__ts=0.1;const b=window.__kb;b.g.position.set(player.x,player.y,player.z-${d});if('x' in b){b.x=player.x;b.z=player.z-${d};}b.g.updateMatrixWorld(true);return 1})()`); // hitboxes at the set spot before the swing (raycast uses matrixWorld)
   await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await frames(1);await X('window.__ts=1;1');await tick(500);
   res[nm]=await XJ(`(()=>{const b=window.__kb;return {d:${d},hp:b.hp,alive:b.alive,dist:+Math.hypot(b.g.position.x-player.x,b.g.position.z-player.z).toFixed(2)};})()`);log('knife '+nm,{s,r:res[nm]});
   await tick(800);}
  check('Knife: a light swing hits a bot ~1.6 m ahead',res.near&&(res.near.hp<100||!res.near.alive)&&res.near.dist<1.9,JSON.stringify(res.near));
  check('Knife: a light swing misses a bot ~2.9 m ahead (2 m reach)',res.far&&res.far.hp===100&&res.far.dist>2.6,JSON.stringify(res.far));
  await X('jRound(false);1');await tick(1500);for(let i=0;i<3;i++){await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();await tick(600);}
  const errs=R.errors.slice(e0).filter(e=>!/ERR_CONNECTION_REFUSED/.test(e));check("Knife: no 'kLg is not defined' (or any page error) through the swings and a round reset",!errs.length,JSON.stringify(errs));
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
