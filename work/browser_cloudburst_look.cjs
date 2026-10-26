// hk-41: Jett Cloudburst look in the browser (user 13:16 "jett's c ability is also wrong"), offline 5v5 Ascent as Jett, real C key.
// Slow motion (__ts) to catch the projectile in flight: throw (FP flick + the wind orb), the cloud deploying (0.6 s) and full,
// then a bot Jett's thrown Cloudburst (xCbBotThrow) landing in view. Shots work/validation/cloudburst-<TAG>-<throw|deploy|cloud|bot-throw|bot-cloud>.jpg
//   ROOT=<dir with index.html> TAG=after|before node work/browser_cloudburst_look.cjs <out.json>
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

 await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;window.__pin=[];if(!window.__rp){window.__rp=1;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene)for(const q of window.__pin){q.u.g.position.set(q.x,q.y,q.z);q.u.g.rotation.y=q.r;q.u.cd=9;}return r0.call(this,sc,c);};}1`);
 log('match',await XJ(`({pick:J.pick,c:J.c,buy:FV.buy})`));
 // face open ground: 10 m clear ahead, look slightly down so the landing is in view
 await X(`FV.buy=0;for(let k=0;k<16;k++){let ok=true;for(let r=.5;r<=12;r+=.5)for(const a of [-.2,0,.2])if(blocked(player.x-Math.sin(yaw+a)*r,player.z-Math.cos(yaw+a)*r,.3,player.y))ok=false;if(ok)break;yaw+=Math.PI/8;}pitch=0.05;J.c=2;J.cd.c=0;window.__fb=[];if(!window.__fh){window.__fh=1;const f0=feed;feed=function(t){window.__fb.push(String(t));return f0.apply(this,arguments);};}1`);
 await page.waitForTimeout(3000);
 const st=()=>XJ(`(()=>{const c=J.cbs[0],sm=J.smokes.filter(s=>s.r>3.3&&s.r<3.4);return {c:J.c,cbs:J.cbs.length,proj:c?{name:c.m.name||c.m.type,kids:c.m.children.length,held:c.st.held}:null,smokes:sm.map(s=>({t:+s.t.toFixed(2),kids:(s.m.userData.kids||[]).length,cb:!!s.cb,sc:+s.m.scale.x.toFixed(2)})),fp:window.XAF&&XAF.last?XAF.last.set+'/'+XAF.last.ph:null,feed:window.__fb.slice(-3)};})()`);
 await X('window.__ts=0.12;1');
 await page.keyboard.down('KeyC');await page.waitForTimeout(150);await page.keyboard.up('KeyC');
 await page.waitForFunction(()=>window.__xe('J.cbs.length>0&&J.cbs[0].st.t>0.12'),null,{timeout:300000,polling:100}).catch(()=>{});await X('window.__ts=0;1');
 const s1=await st();log('throw',s1);await page.screenshot({path:SHOT+`cloudburst-${TAG}-throw.jpg`,quality:82,type:'jpeg'}).catch(e=>log('shot',String(e)));
 if(TAG!=='before')check('C: thrown instantly as the wind-orb projectile (not a plain ball), one charge spent',s1.cbs===1&&s1.c===1&&s1.proj&&s1.proj.name==='xcb-proj'&&s1.proj.kids>=4,s1);
 await X('window.__ts=0.3;1');await page.waitForFunction(()=>window.__xe('J.smokes.some(s=>s.r>3.3&&s.r<3.4&&s.a>0.2)'),null,{timeout:400000,polling:100}).catch(()=>{});await X('window.__ts=0;1');
 const s2=await st();log('deploy',s2);await page.screenshot({path:SHOT+`cloudburst-${TAG}-deploy.jpg`,quality:82,type:'jpeg'}).catch(e=>log('shot',String(e)));
 await X('window.__ts=0.3;1');await page.waitForFunction(()=>window.__xe('J.smokes.some(s=>s.r>3.3&&s.r<3.4&&s.a>0.9)'),null,{timeout:400000,polling:100}).catch(()=>{});await X('window.__ts=0;1');
 const s3=await st();log('cloud',s3);await page.screenshot({path:SHOT+`cloudburst-${TAG}-cloud.jpg`,quality:82,type:'jpeg'}).catch(e=>log('shot',String(e)));
 if(TAG!=='before'){check('lands as Jett\'s puff cloud (3.35 m body + puffs + swirls), 2.5 s total, billows over the 0.6 s deploy',s2.smokes.length===1&&s2.smokes[0].cb&&s2.smokes[0].kids>=10&&s2.smokes[0].sc<0.84&&s3.smokes.length===1&&Math.abs(s3.smokes[0].sc-0.84)<0.01&&s3.smokes[0].t<1.6,{s2,s3});}
 await X('window.__ts=1;1');await page.waitForFunction(()=>window.__xe('!J.smokes.some(s=>s.r>3.3&&s.r<3.4)'),null,{timeout:300000,polling:200}).catch(()=>{});
 // a bot Jett throws one at a spot 9 m ahead of us, from 5 m to our left front
 const bt=await XJ(`(()=>{const L=bots.concat(allies).filter(u=>u&&u.alive&&u.g);const u=L[0];u.agent='Jett';XBA[u.name]='Jett';if(u.xm){try{u.g.remove(u.xm.m);}catch(e){}u.xm=null;u.xd=0;}const f=camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(),o=camera.getWorldPosition(new THREE.Vector3()),rt=new THREE.Vector3(-f.z,0,f.x);
   window.__pin=[{u,x:o.x+f.x*4-rt.x*2.5,y:player.y,z:o.z+f.z*4-rt.z*2.5,r:Math.atan2(f.x,f.z)}];window.__bq={x:o.x+f.x*10+rt.x*1.5,z:o.z+f.z*10+rt.z*1.5};return {name:u.name,fn:typeof xCbBotThrow};})()`);
 log('bot',bt);await page.waitForFunction(()=>window.__xe('!!(__pin[0].u.xm&&__pin[0].u.xm.sx)'),null,{timeout:400000,polling:2000}).catch(()=>{});
 if(bt.fn==='function'){await X('window.__ts=0.12;xCbBotThrow(__pin[0].u,__bq);1');
  await page.waitForFunction(()=>window.__xe('J.cbs.length>0&&J.cbs[0].st.t>0.2'),null,{timeout:300000,polling:100}).catch(()=>{});await X('window.__ts=0;1');
  const b1=await st();log('bot throw',b1);await page.screenshot({path:SHOT+`cloudburst-${TAG}-bot-throw.jpg`,quality:82,type:'jpeg'}).catch(e=>log('shot',String(e)));
  await X('window.__ts=0.3;1');await page.waitForFunction(()=>window.__xe('J.smokes.some(s=>s.r>3.3&&s.r<3.4&&s.a>0.9)'),null,{timeout:400000,polling:100}).catch(()=>{});await X('window.__ts=0;1');
  const b2=await XJ(`(()=>{const s=J.smokes.find(s=>s.r>3.3&&s.r<3.4);return {s:s?{x:+s.p.x.toFixed(1),z:+s.p.z.toFixed(1),kids:(s.m.userData.kids||[]).length}:null,q:__bq,feed:window.__fb.slice(-3)};})()`);log('bot cloud',b2);
  await page.screenshot({path:SHOT+`cloudburst-${TAG}-bot-cloud.jpg`,quality:82,type:'jpeg'}).catch(e=>log('shot',String(e)));
  check('bot Jett THROWS Cloudburst (projectile in flight), it lands near its target as the same cloud, feed on landing',b1.cbs===1&&b1.proj&&b1.proj.name==='xcb-proj'&&!b1.proj.held&&b2.s&&Math.hypot(b2.s.x-b2.q.x,b2.s.z-b2.q.z)<3&&b2.s.kids>=10&&b2.feed.some(t=>/Cloudburst/.test(t)),{b1,b2});}
 check('no page errors',!R.errors.some(e=>/pageerror/.test(e)),R.errors.filter(e=>/pageerror/.test(e)).slice(0,5));
 log('done',1);await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e));fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.error(e);process.exit(1);});
