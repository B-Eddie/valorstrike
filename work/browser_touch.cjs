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
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(110000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
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
 await page.locator('#playBtn').tap();await page.locator('.x-qmap[data-map='+MAP+']').tap();await page.locator('#xqPlay').tap();await page.waitForTimeout(500);log('pre-screen',await page.evaluate(()=>{const r=e=>{const b=document.querySelector(e);if(!b)return null;const q=b.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom].map(Math.round);};return {pre:r('#pre'),go:r('#preGo'),sw:document.getElementById('pre').scrollWidth,sh:document.getElementById('pre').scrollHeight,ch:document.getElementById('pre').clientHeight,ov:getComputedStyle(document.getElementById('pre')).overflowY};}));await page.screenshot({path:ROOT+'/work/validation/touch-pre-'+page.viewportSize().width+'x'+page.viewportSize().height+'.jpg',type:'jpeg',quality:60}).catch(()=>{});if(process.env.PROBE_PRE)throw Error('probe done');await page.locator('#preGo').tap();
 await X('J.pick="'+AG+'";1');await page.locator('#xAg .x-ag[data-a='+AG+']').tap().catch(()=>{});await page.locator('#xAgL').tap();
 const t0=Date.now();await page.waitForFunction(()=>window.__xe('mode==="five"&&running&&!window.xLdOn&&!xCov()&&renderer.info.render.frame>5'),null,{timeout:300000}).catch(e=>log('start wait',String(e).slice(0,200)));
 log('match start ms',Date.now()-t0);
 const measure=async tag=>{const m=await page.evaluate(()=>{const out={vw:innerWidth,vh:innerHeight,btn:{},hud:[]};document.querySelectorAll('#xT .tb').forEach(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);if(cs.display!=='none'&&r.width>0)out.btn[b.dataset.k]=[r.left,r.top,r.right,r.bottom].map(Math.round);});
   for(const e of document.body.querySelectorAll('*')){if(e.closest('#xT')||e.closest('canvas'))continue;const cs=getComputedStyle(e);if(cs.position!=='fixed'&&cs.position!=='absolute')continue;if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)continue;const r=e.getBoundingClientRect();if(r.width<4||r.height<4)continue;if(e.parentElement&&e.parentElement!==document.body&&getComputedStyle(e.parentElement).position==='fixed')continue;if(!(e.textContent||'').trim()&&!e.querySelector('canvas,svg,img')&&e.tagName!=='CANVAS')continue;out.hud.push([e.id||e.className||e.tagName,[r.left,r.top,r.right,r.bottom].map(Math.round),(e.textContent||'').trim().slice(0,30)]);}
   return out;});log('layout '+tag,m);await page.screenshot({path:ROOT+'/work/validation/touch-'+tag+'.jpg',type:'jpeg',quality:60,timeout:60000}).catch(e=>log('shot',String(e).slice(0,120)));return m;};
 const state=()=>X('JSON.stringify({x:+player.x.toFixed(2),z:+player.z.toFixed(2),y:+(player.y||0).toFixed(2),yaw:+yaw.toFixed(3),pitch:+pitch.toFixed(3),ammo:typeof FV!=="undefined"?FV.ammo:null,keys:{W:!!keys.KeyW,A:!!keys.KeyA,S:!!keys.KeyS,D:!!keys.KeyD,Ctrl:!!keys.ControlLeft,Sp:!!keys.Space},buy:FV.buy,menu:FV.menu,on:document.getElementById("xT").classList.contains("on")})').then(JSON.parse);
 const drive=async tag=>{const m=await measure(tag),W=m.vw,H=m.vh,c=k=>m.btn[k]&&[(m.btn[k][0]+m.btn[k][2])/2,(m.btn[k][1]+m.btn[k][3])/2];
  await page.evaluate(()=>{window.__pe=[];if(!window.__ph){window.__ph=1;for(const t of ['pointerdown','pointermove','pointerup','pointercancel','touchstart'])document.addEventListener(t,e=>{if(window.__pe.length<60)window.__pe.push(t+':'+(e.target.id||e.target.className||e.target.tagName)+':'+Math.round(e.clientX||(e.touches&&e.touches[0]&&e.touches[0].clientX)||0));},true);}});
  log(tag+' hit-test',await page.evaluate(([W,H])=>[[W*.3,H*.82],[W*.62,H*.35]].map(([x,y])=>{const e=document.elementFromPoint(x,y);return [x,y,e&&(e.id||e.className||e.tagName),e&&getComputedStyle(e).zIndex];}),[W,H]));
  const s0=await state();log(tag+' start',s0);
  // movement stick: touch in the left half (clear of buttons), push up
  const sx=W*.3,sy=H*.82;await drag(sx,sy,sx,sy-55,900,1);const s1=await state();await touch('touchEnd',[]);await page.waitForTimeout(150);const s1b=await state();log(tag+' pointer events',await X('JSON.stringify(window.__pe)'));log(tag+' stick up',{during:s1.keys,moved:Math.hypot(s1.x-s0.x,s1.z-s0.z).toFixed(2),released:s1b.keys});
  // aim drag on the right half
  const ax=W*.62,ay=H*.35;await drag(ax,ay,ax+60,ay+20,400,2);await touch('touchEnd',[]);const s2=await state();log(tag+' aim drag',{dyaw:(s2.yaw-s1b.yaw).toFixed(3),dpitch:(s2.pitch-s1b.pitch).toFixed(3)});
  log(tag+' top',await page.evaluate(()=>[[10,20],[180,20],[340,20],[180,52]].map(([x,y])=>{const e=document.elementFromPoint(x,y);const ch=[];for(let n=e;n&&n!==document.body;n=n.parentElement)ch.push(n.id||n.className||n.tagName);const r=e&&e.getBoundingClientRect();return [x,y,ch.slice(0,4).join(' < '),r&&[r.left,r.right].map(Math.round)];})));
  if(process.env.DIAG)return;
  for(const k of ['jump','duck','use','c','buy']){const p=c(k);if(!p){log(tag+' '+k,'button hidden');continue;}
   const before=await X('[keysDown=window.__kd||[] ,1][1]');await page.evaluate(()=>{window.__kd=[];if(!window.__kh){window.__kh=1;addEventListener('keydown',e=>window.__kd&&window.__kd.push('d:'+e.code),true);addEventListener('keyup',e=>window.__kd&&window.__kd.push('u:'+e.code),true);}});
   await tap(p[0],p[1],k==='use'?400:150);await page.waitForTimeout(120);const ev=await X('JSON.stringify(window.__kd)');const st=await state();log(tag+' '+k,{events:JSON.parse(ev),menu:st.menu,y:st.y});if(k==='buy'&&st.menu){await tap(p[0],p[1],150);await page.waitForTimeout(300);log(tag+' buy closed by a second tap',!(await state()).menu);}
  }
  const p=c('fire');if(p){const am=()=>page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);let n=e;for(let i=0;i<3&&n&&!/\|/.test(n.textContent);i++)n=n.parentElement;return n&&n.textContent.replace(/\s+/g,' ').trim().slice(0,40);},[W-50,H-22]);const a0=await am();await tap(p[0],p[1],350,4);await page.waitForTimeout(1500);const a1=await am();log(tag+' fire',{before:a0,after:a1});}
 };
 await drive('portrait-360x740');
 if(process.env.DIAG){log('done',true);await browser.close();return;}
 await page.setViewportSize({width:740,height:360});await page.waitForTimeout(800);
 await drive('landscape-740x360');
 log('errors',R.errors.slice(0,20));log('done',true);await browser.close();
})().catch(e=>{log('fatal',String(e).slice(0,500));process.exit(1);});
