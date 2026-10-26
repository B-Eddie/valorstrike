// Mobile HUD probe (touch layout redesign): headless Chromium with touch emulation, one offline 5v5, then each landscape
// size in turn (viewport resize; the default touch layout re-fits). Per size and state (buy phase with the buy menu closed,
// live round idle) it records every visible touch control (#xT .tb, the weapon strip, the menu) and the HUD panels
// (minimap, top bar, kill feed, health, ammo, crosshair) and saves a screenshot.
//   ROOT=<repo> PORT=8893 node work/browser_mobile_hud.cjs <out.json> <shot prefix>   (repo served on 127.0.0.1:PORT)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.join(__dirname,'..'),PORT=process.env.PORT||'8893',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mobile_hud.json',SHOT=process.argv[3]||'/tmp/mobile';
const SIZES=(process.env.SIZES||'844x390,932x430,1180x820').split(',').map(s=>s.split('x').map(Number));
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],errors:[]};const log=(k,v)=>{R.steps.push([k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 try{
 const ctx=await browser.newContext({viewport:{width:SIZES[0][0],height:SIZES[0][1]},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 const re=new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$');
 await ctx.route(re,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(110000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:110000});
 log('touch device',await page.evaluate(()=>matchMedia('(pointer: coarse)').matches));
 await page.getByRole('button',{name:'Got it',exact:true}).tap().catch(()=>{});
 await page.locator('#playBtn').tap();await page.locator('.x-qmap[data-map=ascent]').tap();await page.locator('#xqPlay').tap();await page.waitForTimeout(500);
 await X('J.pick="Jett";1');
 // pre-screen / agent select, whichever shows (as test_touch_spike's through())
 for(let i=0;i<120;i++){const st=await page.evaluate(()=>{const v=id=>{const e=document.getElementById(id);return !!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;};
   if(window.__xe('running&&!window.xLdOn'))return 'run';if(v('preGo')){document.getElementById('preGo').click();return 'pre';}
   if(v('xAgL')){const t=[...document.querySelectorAll('#xAg .x-ag')].find(b=>!b.disabled&&b.dataset.a==='Jett')||[...document.querySelectorAll('#xAg .x-ag')].find(b=>!b.disabled);if(t)t.click();document.getElementById('xAgL').click();return 'ag';}return 'wait';});
  if(st==='run')break;await page.waitForTimeout(1000);}
 const t0=Date.now();await page.waitForFunction(()=>window.__xe('mode==="five"&&running&&!window.xLdOn&&!xCov()&&renderer.info.render.frame>5'),null,{timeout:300000}).catch(e=>log('start wait',String(e).slice(0,200)));
 log('match start ms',Date.now()-t0);
 const measure=()=>page.evaluate(()=>{const o={vw:innerWidth,vh:innerHeight,ctl:{},hud:{}};const r=e=>{const q=e.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};
  const vis=e=>{if(!e)return false;const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0&&e.getBoundingClientRect().width>0;};
  document.querySelectorAll('#xT .tb, #xT .tw button, .x-cmb, .x-orbUse').forEach(b=>{if(vis(b))o.ctl[(b.dataset.k||(b.dataset.w&&'w:'+b.dataset.w)||b.id||b.className)]=r(b);});
  for(const s of ['#xMap','.hud.x-top','.hud.x-fw','.hud.x-bl','.hud.x-br','.x-brs','#xCr','#crosshair','#xSub','#fps','#xTW','#xTM','.hud.x-fw'])document.querySelectorAll(s).forEach((e,i)=>{if(vis(e))o.hud[s+(i?i:'')]=r(e);});
  return o;});
 for(const [w,h] of SIZES){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(800);
  await X('FV.buy=Math.max(FV.buy,20);try{buyMenu(false)}catch(e){}true');await page.waitForTimeout(600);
  log(w+'x'+h+' buy',await measure());await page.screenshot({path:SHOT+'-'+w+'x'+h+'-buy.jpg',type:'jpeg',quality:60,timeout:90000}).catch(e=>log('shot',String(e).slice(0,120)));
  await X('FV.buy=0;try{buyMenu(false)}catch(e){}for(const b of bots)b.nt=true;true');await page.waitForTimeout(600);
  log(w+'x'+h+' live',await measure());await page.screenshot({path:SHOT+'-'+w+'x'+h+'-live.jpg',type:'jpeg',quality:60,timeout:90000}).catch(e=>log('shot',String(e).slice(0,120)));
  if(process.env.EXTRA&&w===SIZES[0][0]){ // after-only states: partial magazine (RELOAD) + menu open
   await X('ammo=Math.max(1,ammo-5);var m=document.getElementById("xT");m&&m.classList.add("mo");try{mSync()}catch(e){}true');await page.waitForTimeout(600);
   log(w+'x'+h+' menu+reload',await measure());await page.screenshot({path:SHOT+'-'+w+'x'+h+'-menu.jpg',type:'jpeg',quality:60,timeout:90000}).catch(e=>log('shot',String(e).slice(0,120)));
   await X('document.getElementById("xT").classList.remove("mo");true');}
 }
 log('errors',R.errors.slice(0,20));log('done',true);
 }finally{await browser.close();}
})().catch(e=>{log('fatal',String(e).slice(0,500));process.exit(1);});
