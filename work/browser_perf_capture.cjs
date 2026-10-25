// Chromium performance capture of an offline match while firing continuously and taking damage (user report: lag when
// shooting / taking damage). Headless Chromium (SwiftShader software GL, so absolute frame times are CPU-bound and far
// slower than a real GPU; the JS share, long tasks, heap growth and renderer.info counters are what this measures).
// Offline Deathmatch on Ascent (launched through xGo, as the lobby does: a bare startDM() leaves the first-load lobby
// flag xLob0 set, so the loop treats the game as covered and neither renders nor runs the player), LOW preset, 640x360. Phases: idle baseline (no firing), then fireHeld with bots placed in
// front of the player so shots hit and they shoot back (player HP held at 500-1000 so the run continues; every hit
// still goes through hurt() and the hit feedback), until 60 shots.
// renderer.info is read from VF.worldDraw (the feel layer resets info per world render with autoReset off, so
// info.render.frame stays 0). Records rAF frame times, long tasks (>50 ms) via PerformanceObserver, performance.memory heap before/after,
// renderer.info (calls, triangles, geometries, textures, programs) before/after, and a CDP sampling CPU profile
// (self time per function, top 25) for each phase.
//   node work/browser_perf_capture.cjs <out.json> [label]
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/perf.json',LABEL=process.argv[3]||'run',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={label:LABEL,steps:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
function topSelf(profile,n=25){const by=new Map(),total=profile.samples.length;const node=new Map(profile.nodes.map(x=>[x.id,x]));const cnt=new Map();for(const s of profile.samples)cnt.set(s,(cnt.get(s)||0)+1);
 for(const [id,c] of cnt){const f=node.get(id).callFrame;const k=(f.functionName||'(anon)')+' '+(f.url.split('/').pop().slice(0,30))+':'+(f.lineNumber+1);by.set(k,(by.get(k)||0)+c);}
 return {samples:total,top:[...by].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,c])=>[k,+(100*c/total).toFixed(1)])};}
let FIRE_CAP=900000;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1','--enable-precise-memory-info']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}
  window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask',buffered:true});}catch(e){}
  window.__ft=[];window.__fc=0;let last=0;const f=t=>{window.__fc++;if(last)window.__ft.push(+(t-last).toFixed(1));last=t;requestAnimationFrame(f);};requestAnimationFrame(f);});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const cdp=await ctx.newCDPSession(page);
 log('launch',1);await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});log('goto',1);await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';setTimeout(()=>xGo(startDM),0);1`);log('startDM called',1);
 const prog=setInterval(()=>X('JSON.stringify({running,ld:!!window.xLdOn,bots:bots.length,ft:window.__ft.length,calls:VF.worldDraw&&VF.worldDraw.calls,vis:[...document.querySelectorAll("body>div")].filter(d=>d.offsetParent&&d.id).map(d=>d.id).slice(0,12)})').then(v=>log('progress',v)).catch(()=>{}),15000);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0&&window.__ft.length>5'),null,{timeout:900000,polling:2000}).catch(e=>log('start wait',String(e).slice(0,200)));
 clearInterval(prog);log('match started',await X('JSON.stringify({mode,dm:FV.dm,map:FV.map,bots:bots.length,w:wName()})'));
 // draw calls / triangles of the last world frame (read right after renderer.render, which resets info per frame) and
 // time spent inside renderer.render per frame (window.__rt).
 // NORENDER=1: after one real frame, world renders are skipped (draw counters keep the last real frame) so the JS side
 // of firing / taking damage runs at a measurable frame rate under SwiftShader; the GPU side is then reported separately.
 await X(`{const NR=${process.env.NORENDER?1:0};window.__rt=[];let real=0;const r0=renderer.render;renderer.render=function(sc,c){if(NR&&sc===scene&&real>2)return;const t=performance.now();const x=r0.call(this,sc,c);if(sc===scene){real++;window.__rt.push(+(performance.now()-t).toFixed(1));window.__ri={calls:this.info.render.calls,triangles:this.info.render.triangles};}return x;};}1`);
 // settle: let loading/compile finish
 await page.waitForTimeout(8000);
 const snap=()=>X(`JSON.stringify({rafFrames:window.__fc||0,calls:window.__ri?window.__ri.calls:null,tris:window.__ri?window.__ri.triangles:null,geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,prog:(renderer.info.programs||[]).length,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,heapTotal:performance.memory?Math.round(performance.memory.totalJSHeapSize/1048576):null,dom:document.getElementsByTagName('*').length,sceneObjs:(()=>{let n=0;scene.traverse(()=>n++);return n;})(),hp:player.hp,shots:window.__shots||0,taken:window.__taken||0,dealt:window.__dealt||0,ammo,rsv})`).then(JSON.parse);
 const frames=async()=>JSON.parse(await X('JSON.stringify((()=>{const a=window.__ft.splice(0),l=window.__lt.splice(0),r=window.__rt.splice(0);return {a,l,r};})())'));
 const stats=({a,l,r})=>{const rs=r.slice().sort((x,y)=>x-y);const s=a.slice().sort((x,y)=>x-y),q=p=>s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:null;return {frames:a.length,meanMs:s.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null,p50:q(.5),p95:q(.95),max:s[s.length-1]||null,longTasks:l.length,longTaskMs:l.reduce((x,y)=>x+y[1],0),longTaskMax:l.reduce((x,y)=>Math.max(x,y[1]),0),renders:r.length,renderMeanMs:r.length?+(r.reduce((x,y)=>x+y,0)/r.length).toFixed(1):null,renderMax:rs[rs.length-1]||null,jsPerFrameMs:a.length&&!process.env.NORENDER?null:+((a.reduce((x,y)=>x+y,0))/Math.max(1,a.length)).toFixed(1)};};
 // count real shots per frame from the magazine (shoot() is called from the game loop's own binding, so it cannot be
 // wrapped from here); damage taken = player HP drops seen per frame (HP is topped up below 40); hits = bot HP drops
 await X(`{window.__shots=0;window.__taken=0;window.__dealt=0;let a=ammo,h=player.hp;const bh=new Map();const f=()=>{try{if(ammo<a)window.__shots+=a-ammo;a=ammo;if(player.hp<h)window.__taken+=h-player.hp;h=player.hp;for(const b of bots){const p=bh.get(b);if(p!==undefined&&b.hp<p)window.__dealt+=p-b.hp;bh.set(b,b.hp);}if(window.__fire&&!fireHeld&&player.hp>0)fireHeld=true;}catch(e){}requestAnimationFrame(f);};requestAnimationFrame(f);}1`);
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:2000});
 // phase A: idle (no firing, bots away), same duration budget
 await frames();const a0=await snap();log('idle before',a0);
 await cdp.send('Profiler.start');await page.waitForTimeout(30000);const pA=(await cdp.send('Profiler.stop')).profile;
 const fA=await frames();const a1=await snap();log('idle after',a1);log('idle frames',stats(fA));log('idle hot (self %)',topSelf(pA));
 // phase B: fire continuously at bots placed in front of the player; they fight back; HP topped up
 await X(`window.__hpTop=setInterval(()=>{if(player.hp>0&&player.hp<500)player.hp=1000;},50);player.hp=1000;1`);
 const place=`(()=>{const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let i=0;for(const b of bots){if(!b.alive)continue;const d=6+2*i,s=(i%2?1:-1)*0.6*i;b.g.position.x=camera.position.x+fx*d+fz*s;b.g.position.z=camera.position.z+fz*d-fx*s;if(++i>=3)break;}return i;})()`;
 if(process.env.FIRE_MS)FIRE_CAP=+process.env.FIRE_MS;
 log('placed bots',await X(place));
 await X(`window.__fire=1;fireHeld=true;1`);
 const b0=await snap();log('fire before',b0);
 await cdp.send('Profiler.start');const tB=Date.now();let lastPlace=0;
 while(Date.now()-tB<FIRE_CAP){const n=await X('window.__shots||0');if(n>=60)break;if(Date.now()-lastPlace>8000){await X(place).catch(()=>{});log('firing',await snap());lastPlace=Date.now();}await page.waitForTimeout(1000);}
 const pB=(await cdp.send('Profiler.stop')).profile;const fB=await frames();const b1=await snap();
 await X(`window.__fire=0;fireHeld=false;clearInterval(window.__hpTop);1`);
 log('fire after',b1);log('fire wall s',(Date.now()-tB)/1000);log('fire frames',stats(fB));log('fire hot (self %)',topSelf(pB));
 log('hurt/kills',await X(`JSON.stringify({you:FV.you,them:FV.them,hp:player.hp})`).catch(()=>null));
 await page.screenshot({path:SHOT+'perf-capture-'+LABEL+'-640x360.jpg',type:'jpeg',quality:60,timeout:300000}).catch(()=>{});
 fs.writeFileSync(OUT.replace(/\.json$/,'')+'-fire.cpuprofile',JSON.stringify(pB));
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
