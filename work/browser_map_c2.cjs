// Map pass C2 in the rendered page (hark-map 55bb06a / 2d79dfc / 79a9b48; map-notes.md browser items 9 and 2),
// headless Chromium (SwiftShader, LOW) at 640x360, offline 5v5, real game loop, world rendering skipped between captures.
// A. Load time: nmOptimizeScene ms (wrapped) and xGo -> running wall time per map, on this page (ROOT/index.html) and, when
//    PREV is set, on the page before the C2 optimizer change (same browser, same box load, optimizer ms is CPU-bound).
// B. Breeze item 9: the three leaning walls (6.56,8.04,-34.75) / (17.0,4.25,36.0) / (17.8,9.19,7.59): run into the wall 1 s,
//    walk straight back out without jumping (>= 0.7 m) and without a sideways push-out pop (max lateral jump between samples);
//    12 m platform SE edge toward the crate stack (x 7.3..10.45, z -24.45): the walk stops at the edge, feet stay at 12 m;
//    east of the stack (x > 10.45) the same walk still drops to the 8 m floor; walking on the 8 m floor under the stack is free.
//   node work/browser_map_c2.cjs <out.json>   env: PREV=<old index.html>  MAPS=breeze,ascent (load-time maps)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/map_c2.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const MAPS=(process.env.MAPS||'breeze,ascent').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const open=async(idx)=>{const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
  await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
  await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
  await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(idx,'utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
  const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
  const X=s=>page.evaluate(s=>window.__xe(s),s);
  await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  await X(`if(!window.__ow&&typeof nmOptimizeScene==='function'){window.__ow=1;window.__opt=[];const f=nmOptimizeScene;nmOptimizeScene=function(){const t=performance.now();const r=f.apply(this,arguments);window.__opt.push(+(performance.now()-t).toFixed(0));return r;};}1`);
  return {ctx,page,X};};
 const start=async(P,map)=>{const t=Date.now();await P.X(`window.__opt.length=0;FV.pick='${map}';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await P.page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:1000});const wall=Date.now()-t;
  const opt=await P.X('JSON.stringify(window.__opt)').then(JSON.parse);
  await P.X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};}bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;
   if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
  return {wall,opt};};
 const leave=async P=>{await P.X('try{leave()}catch(e){}1');await P.page.waitForTimeout(2000);};
 // A. load time
 const LT={};
 for(const [tag,idx] of [['new',ROOT+'/index.html']].concat(process.env.PREV?[['prev',process.env.PREV]]:[])){
  const P=await open(idx);LT[tag]={};
  for(const map of MAPS){const r=await start(P,map);LT[tag][map]=r;log(`load ${tag} ${map}`,r);await leave(P);}
  await P.ctx.close();}
 log('load time',LT);
 if(LT.prev)for(const map of MAPS){const a=LT.prev[map].opt[0],b=LT.new[map].opt[0];check(`${map}: nmOptimizeScene faster than before C2 (prev ${a} ms -> new ${b} ms)`,a>0&&b>0&&b<a,JSON.stringify({prev:LT.prev[map],new:LT.new[map]}));}
 else for(const map of MAPS)check(`${map}: map loads (optimizer ran, ${LT.new[map].opt[0]} ms)`,LT.new[map].opt.length>0,JSON.stringify(LT.new[map]));
 // B. Breeze item 9
 const P=await open(ROOT+'/index.html');const {page,X}=P;await start(P,'breeze');
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 await frames(2);await page.mouse.move(320,180);
 const place=(p,yw)=>X(`player.x=${p[0]};player.y=${p[1]};player.z=${p[2]};player.vx=player.vz=0;player.vy=0;yaw=${yw};pitch=0;keys.KeyW=false;keys.Space=false;1`);
 const pos=()=>X('JSON.stringify([+player.x.toFixed(3),+player.y.toFixed(3),+player.z.toFixed(3)])').then(JSON.parse);
 const yawTo=(dx,dz)=>Math.atan2(-dx,-dz);
 const walk=async ms=>{const S=[await pos()];await X('keys.KeyW=true;1');const t=Date.now();while(Date.now()-t<ms){await page.waitForTimeout(120);S.push(await pos());}await X('keys.KeyW=false;1');await page.waitForTimeout(200);S.push(await pos());return S;};
 const jumps=()=>X('typeof jumps!=="undefined"?jumps:0');
 const along=(S,o,d)=>S.map(p=>(p[0]-o[0])*d[0]+(p[2]-o[2])*d[1]);
 // leaning walls: start = fixture node, walk into the wall (fixture direction), then straight back
 const LEAN=[[[7,8.04,-34.75],[-1,0],'(6.56, 8.04, -34.75)'],[[16,4.14,35],[0.71,0.71],'(17.0, 4.25, 36.0)'],[[16.75,8.49,8],[0.71,-0.71],'(17.8, 9.19, 7.59)']];
 for(const [f,dir,nm] of LEAN){const l=Math.hypot(dir[0],dir[1]),d=[dir[0]/l,dir[1]/l];await place(f,yawTo(d[0],d[1]));await page.waitForTimeout(250);const In=await walk(1000);const p1=In[In.length-1];
  await X(`yaw=${yawTo(-d[0],-d[1])};player.vy=0;1`);const vy0=await X('player.vy');const S=await walk(900);const back=along(S,p1,[-d[0],-d[1]]);
  let lat=0;for(let i=1;i<S.length;i++){const dx=S[i][0]-S[i-1][0],dz=S[i][2]-S[i-1][2];lat=Math.max(lat,Math.abs(dx*-d[1]+dz*d[0]));}
  const r={into:p1,back:+Math.max(...back).toFixed(2),maxLateralStep:+lat.toFixed(3),yIn:p1[1],yEnd:S[S.length-1][1]};log('lean '+nm,r);
  if(nm.startsWith('(6.56')){await frames(2);await page.screenshot({path:SHOT+'mapc2-breeze-leanwall-640x360.jpg',type:'jpeg',quality:70,timeout:300000}).catch(e=>log('shot',String(e).slice(0,100)));}
  check(`Breeze leaning wall ${nm}: into the wall, then walks straight back out without a jump (>= 0.7 m, no sideways pop > 0.15 m)`,r.back>=0.7&&r.maxLateralStep<=0.15&&Math.abs(r.yEnd-r.yIn)<0.5,JSON.stringify(r));}
 // 12 m platform SE edge -> crate stack: walk +z from (9.25, 12, -25)
 {await place([9.25,12,-25],yawTo(0,1));await page.waitForTimeout(250);const S=await walk(1800);const e=S[S.length-1],minY=Math.min(...S.map(p=>p[1]));const r={end:e,minY,maxZ:Math.max(...S.map(p=>p[2]))};log('platform edge over the stack',r);
  await frames(2);await page.screenshot({path:SHOT+'mapc2-breeze-platform-edge-640x360.jpg',type:'jpeg',quality:70,timeout:300000}).catch(x=>log('shot',String(x).slice(0,100)));
  check('Breeze 12 m platform SE edge toward the crate stack: the walk stops at the edge, feet stay on the 12 m platform',minY>11.5&&r.maxZ<-24.0,JSON.stringify(r));}
 // east of the stack: same walk at x 11 should still drop to the 8 m floor (if the platform extends there)
 {await place([11,12,-25],yawTo(0,1));await page.waitForTimeout(250);const y0=await X('player.y');const S=await walk(2200);const e=S[S.length-1],r={y0,end:e,minY:Math.min(...S.map(p=>p[1]))};log('platform edge east of the stack (x 11)',r);
  check('Breeze 12 m platform edge east of the stack (x 11): walking off still drops toward the 8 m floor (clip limited to the stack)',y0>11.5?r.minY<10.5:true,JSON.stringify(r));}
 // 8 m floor under the stack: walk +x along z -23 at y 8
 {await place([4,8.1,-23],yawTo(1,0));await page.waitForTimeout(400);const y0=await X('player.y');const S=await walk(2500);const a=along(S,[4,0,-23],[1,0]);const r={y0,end:S[S.length-1],max:+Math.max(...a).toFixed(2)};log('8 m floor under the stack',r);
  check('Breeze 8 m floor under the crate stack: walk along x at z -23 is not stopped by the 12 m clip (>= 3 m progress, or blocked by the real stack only)',Math.abs(y0-8)<1.5?r.max>=3||r.end[0]>=7.0:true,JSON.stringify(r));}
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
