// Mobile touch HUD (219e4fe) checks in the rendered page: headless Chromium with touch emulation (coarse pointer) at 844x390,
// offline 5v5 Ascent as Jett, real taps. Waits ~4 s per state (the touch context loop runs every 6th frame and SwiftShader
// runs at a few fps, which is why work/browser_mobile_hud.cjs saw one-step lag).
// 1. live round, full magazine, idle: <= 9 visible touch buttons (FIRE, jump, ADS, crouch, C/Q/E/X, menu), no BUY / RELOAD / PLANT / USE.
// 2. buy phase: BUY appears; 3. partial magazine: RELOAD appears, and goes after a reload; 4. weapon strip chips present;
// 5. tap FIRE (touchscreen) fires (ammo drops); 6. menu button opens the menu without pausing; 7. no controls overlap.
//   node work/browser_mobile_check.cjs <out.json>   (screenshots work/validation/mobilechk-*.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.join(__dirname,'..'),PORT=process.env.PORT||'8876',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mobile_check.json',SHOT=ROOT+'/work/validation/mobilechk-';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 try{
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=s=>X('JSON.stringify('+s+')').then(JSON.parse);
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});
 log('coarse pointer',await page.evaluate(()=>matchMedia('(pointer: coarse)').matches));
 await page.getByRole('button',{name:'Got it',exact:true}).tap({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);if(typeof timeLeft!=='undefined')timeLeft=900;1`);
 const ctl=()=>page.evaluate(()=>{const o={};const vis=e=>{const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0&&e.getBoundingClientRect().width>0;};
  document.querySelectorAll('#xT .tb, .x-cmb, .x-orbUse').forEach(b=>{if(vis(b)){const q=b.getBoundingClientRect();o[b.dataset.k||b.id||b.className]=[q.left,q.top,q.right,q.bottom].map(Math.round);}});
  const chips=[...document.querySelectorAll('#xT .tw button, #xTW button')].filter(vis).map(b=>b.textContent.trim());return {o,chips,menu:!!document.querySelector('#xTM')&&vis(document.querySelector('#xTM'))};});
 const settle=()=>page.waitForTimeout(4500);
 // 1. live idle, full magazine
 await X('FV.buy=0;try{buyMenu(false)}catch(e){}ammo=(WEAP[wName()]||{}).mag||ammo;reloading=0;1').catch(e=>log('ammo set',String(e).slice(0,100)));
 await X('FV.buy=0;reloading=0;1');await settle();let s=await ctl();log('live idle',s);await page.screenshot({path:SHOT+'live-844x390.jpg',type:'jpeg',quality:70,timeout:120000}).catch(()=>{});
 const ks=Object.keys(s.o);const ctx0=ks.filter(k=>/buy|reload|plant|use|ins|drl/i.test(k));
 check('844x390 idle live round: <= 9 touch buttons, no context buttons (buy / reload / plant / use / inspect)',ks.length<=9&&!ctx0.length,JSON.stringify({n:ks.length,ks}));
 const ov=[];for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=s.o[ks[i]],b=s.o[ks[j]];if(a[0]<b[2]-1&&b[0]<a[2]-1&&a[1]<b[3]-1&&b[1]<a[3]-1)ov.push([ks[i],ks[j]]);}
 check('844x390: no two touch buttons overlap',!ov.length,JSON.stringify(ov));
 check('844x390: weapon strip chips shown',s.chips.length>=1,JSON.stringify(s.chips));
 // 2. buy phase
 await X('FV.buy=Math.max(FV.buy,20);try{buyMenu(false)}catch(e){}1');await settle();s=await ctl();log('buy phase',s);await page.screenshot({path:SHOT+'buy-844x390.jpg',type:'jpeg',quality:70,timeout:120000}).catch(()=>{});
 check('buy phase: BUY context button appears',Object.keys(s.o).some(k=>/buy/i.test(k)),JSON.stringify(Object.keys(s.o)));
 await X('FV.buy=0;try{buyMenu(false)}catch(e){}1');await settle();s=await ctl();check('after the buy phase: BUY gone',!Object.keys(s.o).some(k=>/buy/i.test(k)),JSON.stringify(Object.keys(s.o)));
 // 3. partial magazine
 const a0=await X('ammo');await X('ammo=Math.max(1,ammo-5);1');await settle();s=await ctl();log('partial mag',{a0,s});await page.screenshot({path:SHOT+'reload-844x390.jpg',type:'jpeg',quality:70,timeout:120000}).catch(()=>{});
 check('partial magazine: RELOAD context button appears',Object.keys(s.o).some(k=>/reload|^r$/i.test(k)),JSON.stringify(Object.keys(s.o)));
 await X(`ammo=${a0};reloading=0;1`);await settle();s=await ctl();check('full magazine again: RELOAD gone',!Object.keys(s.o).some(k=>/reload|^r$/i.test(k)),JSON.stringify(Object.keys(s.o)));
 // 5. tap FIRE
 const fr=s.o.fire;if(fr){const b0=await X('ammo');const cx=(fr[0]+fr[2])/2,cy=(fr[1]+fr[3])/2;
   const cdp=await ctx.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await page.waitForTimeout(900);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForTimeout(500);const b1=await X('ammo');log('fire tap',{b0,b1});check('FIRE held by touch fires the gun (ammo drops)',b1<b0,JSON.stringify({b0,b1}));}
 else check('FIRE button present',false,JSON.stringify(Object.keys(s.o)));
 // 6. menu
 const mb=s.o.menu;if(mb){await page.touchscreen.tap((mb[0]+mb[2])/2,(mb[1]+mb[3])/2);await page.waitForTimeout(2500);const m=await XJ('{open:!!document.querySelector("#xT.mo")||(()=>{const e=document.querySelector("#xTM");return !!e&&getComputedStyle(e).display!=="none"&&e.getBoundingClientRect().height>40;})(),pa:typeof pausedAt!=="undefined"?pausedAt:null,running,ov:!!document.querySelector("#pause.on, #pauseMenu.on")}');
   log('menu tap',m);await page.screenshot({path:SHOT+'menu-844x390.jpg',type:'jpeg',quality:70,timeout:120000}).catch(()=>{});check('menu button opens the touch menu without pausing the game',m.open&&m.running&&!m.ov,JSON.stringify(m));}
 else check('menu button present',false,JSON.stringify(Object.keys(s.o)));
 log('errors',R.errors.slice(0,20));check('no page errors',!R.errors.length,JSON.stringify(R.errors.slice(0,5)));
 }finally{await browser.close();}
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
