// hk-39: Blade Storm in THIRD PERSON in the browser (offline 5v5 Ascent). A Jett unit stands 3.2 m in front of the camera facing it;
// its Blade Storm is switched on (offline: the FEEL bot ult XU.b + 5 knives; 'remote' = an online-style unit with row [24] knives),
// then one throw (a shot sound from it = xUbShot) and, for the remote one, a burst (3 shots in one frame, knives 3 -> 0).
// Shots work/validation/bladestorm-tp-<TAG>-<idle|throw|remote|burst>.jpg (1280x720). TAG=before on main shows the gun (no TP Blade Storm).
//   ROOT=<worktree> TAG=after node work/browser_bladestorm_tp.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/bstp.json',SHOT=(process.env.SHOT||ROOT+'/work/validation/'),TAG=process.env.TAG||'after';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={tag:TAG,steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:300}).catch(()=>{});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';J.pick='Sova';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 // frame gate + a pre-render hook that pins the stage units every frame (their AI keeps running; xUbAnim sees them standing)
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;window.__pin=[];const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;for(const q of window.__pin){q.u.g.position.set(q.x,q.y,q.z);q.u.g.rotation.y=q.r;q.u.cd=9;q.u.xaimOn=false;q.u.xTt=null;q.u.xTg=null;}}return r0.call(this,sc,c);};}1`);
 await frames(2);
 await X(`for(let k=0;k<16;k++){let ok=true;for(let r=.5;r<=6;r+=.5)for(const a of [-.25,0,.25])if(blocked(player.x-Math.sin(yaw+a)*r,player.z-Math.cos(yaw+a)*r,.3,player.y))ok=false;if(ok)break;yaw+=Math.PI/8;}pitch=-0.12;1`);
 // two Jett units: A offline (bot ult path) dead ahead, B remote-style (row [24]) beside it
 const st=await XJ(`(()=>{const L=bots.concat(allies).filter(u=>u&&u.alive&&u.g);const pick=(i)=>{const u=L[i];u.agent='Jett';XBA[u.name]='Jett';if(u.xm){try{u.g.remove(u.xm.m);}catch(e){}u.xm=null;u.xd=0;}return u;};
   const A=pick(0),B=pick(1),f=camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(),o=camera.getWorldPosition(new THREE.Vector3()),rt=new THREE.Vector3(-f.z,0,f.x),face=Math.atan2(-f.x,-f.z);
   window.__pin=[{u:A,x:o.x+f.x*3.2-rt.x*0.55,y:player.y,z:o.z+f.z*3.2-rt.z*0.55,r:face+0.35},{u:B,x:o.x+f.x*3.6+rt.x*0.85,y:player.y,z:o.z+f.z*3.6+rt.z*0.85,r:face-0.35}];window.__A=A;window.__B=B;B.nt=1;B.np=0;
   return {A:A.name,B:B.name,face};})()`);
 log('stage',st);await X('window.__allow=1e9;1');
 // the game keeps running between page calls (slow box: a screenshot can take minutes), so throws / flying daggers are recorded when they happen
 await X(`window.__th=[];window.__fly=0;if(typeof xUbOnce==='function'&&!window.__thH){window.__thH=1;const f=xUbOnce;xUbOnce=function(X,n,set,dur){try{if(n==='throw')for(const u of [__A,__B])if(u.xm&&u.xm.sx===X)__th.push([u===__A?'A':'B',dur]);}catch(e){}return f.apply(this,arguments);};}if(typeof xBtpFly==='function'&&!window.__flH){window.__flH=1;const g=xBtpFly;xBtpFly=function(M,a,b,n){window.__fly+=n||1;return g.apply(this,arguments);};}1`);
 const mk=await page.waitForFunction(()=>window.__xe('!!(__A.xm&&__A.xm.sx&&__B.xm&&__B.xm.sx)'),null,{timeout:400000,polling:2000}).then(()=>1).catch(()=>0);
 log('models',{mk,info:await XJ('{A:!!__A.xm,As:!!(__A.xm&&__A.xm.sx),B:!!__B.xm,Bs:!!(__B.xm&&__B.xm.sx),frame:renderer.info.render.frame,kit:Object.keys(XVA.kits||{}),fail:XV.failures}')});await frames(2);
 await page.screenshot({path:SHOT+`bladestorm-tp-${TAG}-gun.jpg`,quality:75,type:'jpeg'}).catch(e=>log('shot',String(e)));
 // Blade Storm on: offline bot ult (5 knives) on A, row [24] = 3 knives on B
 await X(`(()=>{const A=__A,B=__B;if(window.xBotUB){xBotUB[A.name]=1.3;}A.bsK=5;A.bsEnd=0;A.bsSn=A.xsh||0;B.bsK=3;return 1;})()`);
 await frames(4);
 const s1=await XJ(`(()=>{const f=(u)=>{const M=u.xm,R=M&&M.btp;return {w:M&&M.w,gun:M&&M.gun&&M.gun.visible,btp:!!R,on:R&&R.on,knives:R?R.k.filter(k=>k.visible).length:0,shown:R&&R.g.visible,knife:M&&M.sx&&+(M.sx.w.knife||0).toFixed(2),aim:M&&M.sx&&+(M.sx.w.aim||0).toFixed(2)};};return {A:f(__A),B:f(__B),err:window.xBladeTP&&window.xBladeTP.XBTP.err||null};})()`);
 log('knives out',s1);
 await page.screenshot({path:SHOT+`bladestorm-tp-${TAG}-idle.jpg`,quality:75,type:'jpeg'}).catch(e=>log('shot',String(e)));
 if(TAG!=='before'){check('offline bot Jett: knife hands, gun hidden, 5 daggers',s1.A.on&&s1.A.w==='Knife'&&s1.A.gun===false&&s1.A.knives===5&&s1.A.knife>0.5,s1.A);
  check('remote Jett (row [24] = 3): knife hands, gun hidden, 3 daggers',s1.B.on&&s1.B.w==='Knife'&&s1.B.gun===false&&s1.B.knives===3,s1.B);}
 else check('before: no TP Blade Storm (gun still drawn)',s1.A.gun!==false,s1.A);
 // one throw from A (a shot sound from its position = the bot's knife), then grab mid-throw
 await X(`window.__ts=0.35;window.__snd0=window.xBladeTP?xBladeTP.XBTP.snd||0:0;SFX.at(__A.g.position,${TAG==='before'?"'Vandal'":"'Blade Storm'"});1`);await frames(2);
 const s2=await XJ(`(()=>{const M=__A.xm,X=M.sx,a=X.a.throw;return {uo:X.uo,t:a?+(a.time/a.getClip().duration).toFixed(2):null,bsK:__A.bsK,knives:M.btp?M.btp.k.filter(k=>k.visible).length:0,fly:window.xBladeTP?xBladeTP.XBTP.live.length:0,gun:M.gun.visible,snd:window.xBladeTP?(xBladeTP.XBTP.snd||0)-__snd0:0,th:window.__th.slice(),flown:window.__fly};})()`);
 log('throw',s2);await page.screenshot({path:SHOT+`bladestorm-tp-${TAG}-throw.jpg`,quality:75,type:'jpeg'}).catch(e=>log('shot',String(e)));
 if(TAG!=='before')check('throw: OverhandThrow on the upper body, 4 knives left, gun still hidden, knife-throw sound',s2.th.some(t=>t[0]==='A'&&t[1]===0.42)&&s2.bsK===4&&s2.knives===4&&s2.gun===false&&s2.snd===1&&s2.flown>=1,s2);
 // remote burst: knives 3 -> 0 in one step with 3 shot sounds
 await X(`__B.bsK=0;for(let i=0;i<3;i++)SFX.at(__B.g.position,${TAG==='before'?"'Vandal'":"'Blade Storm'"});1`);await frames(2);
 const s3=await XJ(`(()=>{const M=__B.xm,X=M.sx,R=M.btp;return {uo:X.uo,burst:R?R.burst:0,fly:window.xBladeTP?xBladeTP.XBTP.live.length:0,gun:M.gun.visible,w:M.w,th:window.__th.slice(),flown:window.__fly};})()`);
 log('burst',s3);await page.screenshot({path:SHOT+`bladestorm-tp-${TAG}-burst.jpg`,quality:75,type:'jpeg'}).catch(e=>log('shot',String(e)));
 if(TAG!=='before'){check('remote burst: one faster throw, every dagger flies (3 + the earlier 1)',s3.th.filter(t=>t[0]==='B').length===1&&s3.th.some(t=>t[0]==='B'&&t[1]===0.62)&&s3.burst===1&&s3.flown>=4,s3);
  await X('window.__ts=1;1');await frames(8);const s4=await XJ(`(()=>{const M=__B.xm;return {gun:M.gun.visible,w:M.w,shown:M.btp.g.visible};})()`);log('after tail',s4);
  check('after the burst tail: the gun is back on the remote Jett',s4.gun===true&&s4.w!=='Knife'&&!s4.shown,s4);}
 check('no page errors',!R.errors.some(e=>/pageerror/.test(e)),R.errors.filter(e=>/pageerror/.test(e)).slice(0,5));
 log('done',1);await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,500));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
