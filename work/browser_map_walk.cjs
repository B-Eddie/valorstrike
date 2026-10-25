// Map pass C1 movement in the rendered page (shared motor riser / step-up fixes, hark-map 028dcae; map-notes.md browser item 8),
// headless Chromium (SwiftShader, LOW) at 640x360, offline 5v5, real game loop with world rendering skipped between captures.
// The page player is placed on the fixture spots (server/map-walk-fixtures.json) and walks with keys.KeyW held:
// A. Ascent attacker-spawn back paving (x 1..7, z 59..67): long straight walks (3 lanes along z) never stall on flat floor,
//    and every Ascent crack edge from the fixtures is crossed (>= 0.7 m progress, floor height kept).
// B. Breeze: every crack edge crossed; every walk-in trap: run into the wall for 1 s, then walk straight back out without jumping.
// Crates (0.6 m needs a jump) and stairs are covered by work/test_map_riser.cjs + server test-stairs / test-traversal, not here.
//   node work/browser_map_walk.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mapwalk.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// Ability equip-then-fire FP visuals + Deathmatch 640x360 leaderboard vs combat report, headless Chromium (SwiftShader, LOW).
// A. offline 5v5 Ascent as Phoenix, action phase, 1280x720: real Q key -> Hot Hands equipped (gun lowered, hand + item in the
//    first-person view), stays in hand while not fired; real left click -> thrown; gun comes back. Same for C (Blaze).
//    Records J.eq / XEQV state and the FP gun's lowered offset per capture; screenshots abil-*.jpg.
// B. Deathmatch Ascent at 640x360: player killed -> combat report shown and the FFA leaderboard hidden (7a58c99); after the
//    respawn the leaderboard is back.   node work/browser_abil_dm.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async(n,w,h)=>{await frames(2);await page.screenshot({path:`${SHOT}${n}-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async(fn,agent)=>{await X(`FV.pick='ascent';J.pick=${JSON.stringify(agent)};window.xSwift=false;setTimeout(()=>xGo(${fn}),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);};

 const FX=JSON.parse(fs.readFileSync(ROOT+'/server/map-walk-fixtures.json','utf8'));
 const place=(p,yw)=>X(`player.x=${p[0]};player.y=${p[1]};player.z=${p[2]};player.vx=player.vz=0;player.vy=0;yaw=${yw};pitch=0;keys.KeyW=false;keys.Space=false;1`);
 const pos=()=>X('JSON.stringify([+player.x.toFixed(2),+player.y.toFixed(2),+player.z.toFixed(2)])').then(JSON.parse);
 const yawTo=(dx,dz)=>Math.atan2(-dx,-dz);
 const walk=async(ms)=>{const S=[await pos()];await X('keys.KeyW=true;1');const t=Date.now();while(Date.now()-t<ms){await page.waitForTimeout(150);S.push(await pos());}await X('keys.KeyW=false;1');await page.waitForTimeout(200);S.push(await pos());return S;};
 const along=(S,o,d)=>S.map(p=>(p[0]-o[0])*d[0]+(p[2]-o[2])*d[1]);
 for(const map of (process.env.MAPS||'ascent,breeze').split(',')){
  await X(`FV.pick='${map}';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
  await frames(2);log(map+' loaded',await X('JSON.stringify({map:FV.map,bots:bots.length})'));
  if(map==='ascent'){
   for(const x of [2,4,6]){const o=[x,8.45,59];await place(o,yawTo(0,1));await page.waitForTimeout(300);const S=await walk(2500);const a=along(S,o,[0,1]);
    let stall=0;for(let i=2;i<a.length-1;i++)if(a[i]<8&&a[i]-a[i-1]<0.05&&a[i-1]-a[i-2]<0.05)stall++;
    log(`ascent paving lane x=${x}`,{a:a.map(v=>+v.toFixed(2)),end:S[S.length-1]});
    check(`Ascent attacker-spawn paving x=${x}: walk z 59 -> 67 on flat floor without stopping`,Math.max(...a)>=7.5&&!stall,JSON.stringify({max:Math.max(...a),stall,end:S[S.length-1]}));
    if(x===4){await frames(2);await page.screenshot({path:SHOT+'mapwalk-ascent-paving-640x360.jpg',type:'jpeg',quality:70,timeout:300000}).catch(e=>log('shot',String(e).slice(0,100)));}}
  }
  const E=FX[map].edges||[];let ok=0;const bad=[];
  for(const [f,t] of E){const dx=t[0]-f[0],dz=t[2]-f[2],l=Math.hypot(dx,dz),d=[dx/l,dz/l];await place(f,yawTo(d[0],d[1]));await page.waitForTimeout(250);const S=await walk(900);const a=along(S,f,d),m=Math.max(...a),end=S[S.length-1];
   if(m>=0.7&&Math.abs(end[1]-t[1])<1.0)ok++;else bad.push({f,t,m:+m.toFixed(2),end});}
  log(map+' crack edges',{n:E.length,ok,bad});check(`${map}: every fixture crack edge walks across (>= 0.7 m, floor kept)`,E.length>0&&ok===E.length,JSON.stringify({n:E.length,ok,bad}));
  const T=FX[map].traps||[];if(T.length){let ok2=0;const bad2=[];
   for(const [f,dir] of T){const l=Math.hypot(dir[0],dir[1]),d=[dir[0]/l,dir[1]/l];await place(f,yawTo(d[0],d[1]));await page.waitForTimeout(250);await walk(1000);const p1=await pos();
    await X(`yaw=${yawTo(-d[0],-d[1])};1`);const S=await walk(900);const m=Math.max(...along(S,p1,[-d[0],-d[1]]));if(m>=0.7)ok2++;else bad2.push({f,dir,into:p1,m:+m.toFixed(2)});}
   log(map+' walk-in traps',{n:T.length,ok:ok2,bad:bad2});check(`${map}: every walk-in trap - into the wall, then walks back out without jumping (>= 0.7 m)`,ok2===T.length,JSON.stringify({n:T.length,ok:ok2,bad:bad2}));}
  await X('try{leave()}catch(e){}1');await page.waitForTimeout(2000);
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
