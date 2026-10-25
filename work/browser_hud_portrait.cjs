// Portrait HUD probe (rows 7): rects of the top bar, subtitle, minimap, team panel and touch buttons in an offline 5v5 at 360x740; FIRE=1 also ends the buy phase (WAIT=1: waits for it to run out) and taps FIRE (magazine must drop).
// Browser touch acceptance (row 7), headless Chromium with touch emulation (hasTouch/isMobile).
// node work/browser_touch.cjs <out.json> [map] [agent]  — starts an offline 5v5 in portrait 360x740, drives the touch
// controls with CDP touch events (stick, aim drag, fire, jump, crouch, ability, Use, buy), records HUD/button rects and
// screenshots, then rotates to landscape 740x360 and repeats. Needs the repo served on 127.0.0.1:8876.
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hk/touch.json',MAP=process.argv[3]||'lotus',AG=process.argv[4]||'Jett';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],errors:[]};const log=(k,v)=>{R.steps.push([k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(110000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const cdp=await ctx.newCDPSession(page);
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:p[2]??i}))});
 const drag=async(x0,y0,x1,y1,ms=600,id=1)=>{await touch('touchStart',[[x0,y0,id]]);const n=8;for(let i=1;i<=n;i++){await touch('touchMove',[[x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,id]]);await page.waitForTimeout(ms/n);}};
 const tap=async(x,y,hold=120,id=3)=>{await touch('touchStart',[[x,y,id]]);await page.waitForTimeout(hold);await touch('touchEnd',[]);};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:110000});
 log('touch device',await page.evaluate(()=>matchMedia('(pointer: coarse)').matches));
 log('rotate notice visible (portrait)',await page.evaluate(()=>getComputedStyle(document.getElementById('rot')).display));
 await page.locator('#rotGo').tap().catch(e=>log('rotGo tap failed',String(e).slice(0,200)));
 log('rotate notice after Play in portrait',await page.evaluate(()=>getComputedStyle(document.getElementById('rot')).display));
 await page.getByRole('button',{name:'Got it',exact:true}).tap().catch(()=>{});
 await page.locator('#playBtn').tap();await page.locator('.x-qmap[data-map='+MAP+']').tap();await page.locator('#xqPlay').tap();await page.waitForTimeout(500);log('pre-screen',await page.evaluate(()=>{const r=e=>{const b=document.querySelector(e);if(!b)return null;const q=b.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};return {pre:r('#pre'),go:r('#preGo'),sw:document.getElementById('pre').scrollWidth,sh:document.getElementById('pre').scrollHeight,ch:document.getElementById('pre').clientHeight,ov:getComputedStyle(document.getElementById('pre')).overflowY};}));await page.screenshot({path:'/tmp/hk/pre-'+page.viewportSize().width+'x'+page.viewportSize().height+'.jpg',type:'jpeg',quality:60}).catch(()=>{});if(process.env.PROBE_PRE)throw Error('probe done');await page.locator('#preGo').tap();
 await X('J.pick="'+AG+'";1');await page.locator('#xAg .x-ag[data-a='+AG+']').tap().catch(()=>{});await page.locator('#xAgL').tap();
 const t0=Date.now();await page.waitForFunction(()=>window.__xe('mode==="five"&&running&&!window.xLdOn&&!xCov()&&renderer.info.render.frame>5'),null,{timeout:300000}).catch(e=>log('start wait',String(e).slice(0,200)));
 log('match start ms',Date.now()-t0);
 const rects=()=>page.evaluate(()=>{const o={};const r=e=>{const q=e.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};
  const vis=e=>{if(!e)return false;const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&e.getBoundingClientRect().width>0;};
  for(const s of ['.x-top','#xSub','#xMap','#xObs','#fps','.x-fw','#xCmB','.x-bl','.x-brs','#xCr','.x-ann','#xCo','.x-tdms'])document.querySelectorAll(s).forEach((e,i)=>{if(vis(e))o[s+(i?i:'')]=[r(e),e.textContent.replace(/\s+/g,' ').trim().slice(0,50)];});
  document.querySelectorAll('.x-top>*').forEach((e,i)=>{if(vis(e))o['top'+i]=r(e);});
  document.querySelectorAll('#xT .tb').forEach(b=>{if(vis(b))o['tb.'+b.dataset.k]=r(b);});
  // anything fixed/absolute top-left area
  return o;});
 const st=()=>X('JSON.stringify({buy:FV.buy,ammo:typeof ammo!=="undefined"?ammo:null,rl:typeof reloading!=="undefined"?reloading:null,wep:typeof curW!=="undefined"?curW:null,running})');
 log('buy rects',await rects());await page.screenshot({path:process.env.SHOT||'/tmp/hk/p-buy.jpg',type:'jpeg',quality:60});
 if(process.env.FIRE){
  if(process.env.WAIT)await page.waitForFunction(()=>window.__xe('FV.buy<=0&&running'),null,{timeout:180000});else await X('FV.buy=0;1');await page.waitForTimeout(1500);log('action rects',await rects());await page.screenshot({path:(process.env.SHOT||'/tmp/hk/p-buy.jpg').replace('.jpg','-act.jpg'),type:'jpeg',quality:60});
  const mag=()=>page.evaluate(()=>document.getElementById('xMag')&&document.getElementById('xMag').textContent);
  log('state0',await st());const m0=await mag();
  const fb=await page.evaluate(()=>{const b=document.querySelector('#xT .tb[data-k=fire]');const q=b.getBoundingClientRect();return [(q.left+q.right)/2,(q.top+q.bottom)/2];});
  await touch('touchStart',[[fb[0],fb[1],4]]);await page.waitForTimeout(700);await touch('touchEnd',[]);await page.waitForTimeout(600);
  log('fire',{mag0:m0,mag1:await mag(),state:await st()});
 }
 log('errors',R.errors.slice(0,10));log('done',true);await browser.close();
})().catch(e=>{log('fatal',String(e).slice(0,500));process.exit(1);});
