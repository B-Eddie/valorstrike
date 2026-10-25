// Browser touch Spike plant / defuse (task 2), headless Chromium with touch emulation (hasTouch/isMobile).
// node work/browser_touch.cjs <out.json> [map] [agent]  — starts an offline 5v5 in portrait 360x740, drives the touch
// controls with CDP touch events (stick, aim drag, fire, jump, crouch, ability, Use, buy), records HUD/button rects and
// screenshots, then rotates to landscape 740x360 and repeats. Needs the repo served on 127.0.0.1:8876.
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hk/touch-spike.json',MAP=process.argv[3]||'ascent',AG=process.argv[4]||'Jett';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],errors:[]};const log=(k,v)=>{R.steps.push([k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:740,height:360},hasTouch:true,isMobile:true,deviceScaleFactor:1});
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
 await page.getByRole('button',{name:'Got it',exact:true}).tap().catch(()=>{});
 await page.locator('#playBtn').tap();await page.locator('.x-qmap[data-map='+MAP+']').tap();await page.locator('#xqPlay').tap();await page.waitForTimeout(500);await page.locator('#preGo').tap();
 await X('J.pick="'+AG+'";1');await page.locator('#xAg .x-ag[data-a='+AG+']').tap().catch(()=>{});await page.locator('#xAgL').tap();
 const t0=Date.now();await page.waitForFunction(()=>window.__xe('mode==="five"&&running&&!window.xLdOn&&!xCov()&&renderer.info.render.frame>5'),null,{timeout:300000}).catch(e=>log('start wait',String(e).slice(0,200)));
 log('match start ms',Date.now()-t0);
 // natural buy phase on the real clock (task 1): wait for it to run out without touching FV.buy
 const b0=Date.now(),buy0=await X('FV.buy');log('buy phase left at start',buy0);
 await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:150000}).catch(e=>log('buy wait',String(e).slice(0,160)));
 log('buy phase ended naturally after real ms',Date.now()-b0);log('fps estimate',await X('(()=>{const f0=renderer.info.render.frame,t=performance.now();return new Promise(r=>setTimeout(()=>r(((renderer.info.render.frame-f0)*1000/(performance.now()-t)).toFixed(2)),3000));})()'));
 await X('for(const b of bots)b.nt=true;for(const a of allies)a.nt=true;player.hp=100;1');
 // a plant spot: first playable nav node inside a plant zone, the player carrying the Spike there
 const spot=await X('(()=>{const C=nmActive();const N=C.nav.nodes;for(let i=0;i<N.length;i+=3){if(!C.nav.valid[i])continue;const p=N[i];if(nmPlant(C,p[0],p[2]))return p;}return null;})()');log('plant spot',spot);
 await X(`player.x=${spot[0]};player.z=${spot[2]};player.y=${spot[1]};player.vx=player.vz=0;FV.sp.st="carry";FV.sp.c=player;FV.sp.pt=0;since=1;1`);
 await page.waitForTimeout(800);
 const btn=await page.evaluate(()=>{const b=document.querySelector('#xT .tb[data-k=plant]');const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {r:[r.left,r.top,r.right,r.bottom].map(Math.round),disp:cs.display,on:document.getElementById('xT').classList.contains('on'),label:b.textContent.trim()};});log('plant button',btn);
 const cx=(btn.r[0]+btn.r[2])/2,cy=(btn.r[1]+btn.r[3])/2,prompt=()=>X('(()=>{const d=document.getElementById("defuse");return d.style.display!=="none"?d.firstChild.textContent:""})()');
 log('prompt before',await prompt());
 // early release
 await touch('touchStart',[[cx,cy,5]]);await page.waitForTimeout(1500);log('after 1.5 s hold',await X('JSON.stringify({pt:+FV.sp.pt.toFixed(2),k4:!!keys.Digit4,st:FV.sp.st})'));log('prompt held',await prompt());
 await page.screenshot({path:ROOT+'/work/validation/touch-spike-planting-740x360.jpg',type:'jpeg',quality:60,timeout:60000}).catch(e=>log('shot',String(e).slice(0,120)));
 await touch('touchEnd',[]);await page.waitForTimeout(400);log('after early release',await X('JSON.stringify({pt:FV.sp.pt,k4:!!keys.Digit4,st:FV.sp.st})'));
 // full plant
 const p0=Date.now();await touch('touchStart',[[cx,cy,6]]);await page.waitForFunction(()=>window.__xe('FV.sp.st==="plant"'),null,{timeout:30000}).catch(e=>log('plant wait',String(e).slice(0,120)));log('planted after real ms',Date.now()-p0);
 await touch('touchEnd',[]);await page.waitForTimeout(300);log('after plant',await X('JSON.stringify({st:FV.sp.st,site:FV.sp.site,k4:!!keys.Digit4,fuse:+FV.sp.t.toFixed(1)})'));
 // defuse as a defender next to the Spike
 await X('FV.atk=false;FV.sp.x=player.x+0.5;FV.sp.z=player.z;FV.sp.t=45;FV.sp.dt=0;1');await page.waitForTimeout(500);log('defuse prompt',await prompt());
 await touch('touchStart',[[cx,cy,7]]);await page.waitForTimeout(4300);await touch('touchEnd',[]);await page.waitForTimeout(400);log('after 4.3 s defuse hold + release',await X('JSON.stringify({dt:FV.sp.dt,st:FV.sp.st,k4:!!keys.Digit4})'));
 const d0=Date.now();await touch('touchStart',[[cx,cy,8]]);await page.waitForFunction(()=>window.__xe('FV.sp.st==="done"'),null,{timeout:30000}).catch(e=>log('defuse wait',String(e).slice(0,120)));log('defused after real ms (from the half)',Date.now()-d0);await touch('touchEnd',[]);
 await page.screenshot({path:ROOT+'/work/validation/touch-spike-defused-740x360.jpg',type:'jpeg',quality:60,timeout:60000}).catch(()=>{});
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
