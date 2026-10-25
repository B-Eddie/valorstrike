// Rendered online Spike round (task 3): headless Chromium at 640x360 plays the real page online against the real
// worker module served by server/tools/browser-bridge.mjs (port 8787, local ENABLE_SPIKE only, real clock), repo on
// 127.0.0.1:8876. Bots are held still through the bridge's /__qa hook so the round is decided by the page player:
// round 1 the page (attacker, Spike carrier) is placed in A and holds 4 to plant; the 45 s fuse decides the round;
// round 13 (sides swapped) a planted Spike is placed beside the page player, who holds 4 to defuse (release at the
// half checkpoint, then completes). Screenshots and HUD readings (spike timer, plant/defuse bar, banners, credits).
//   node work/browser_online_spike.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hk/online-spike.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);page.on('websocket',ws=>{log('ws open',ws.url().slice(0,80));ws.on('close',()=>log('ws closed',ws.url().slice(0,80)));});page.on('console',m=>{if(/error|warn|lost|idle|clos/i.test(m.text()))R.errors.push('console '+m.text().slice(0,200));});
 const shot=async name=>{await page.screenshot({path:SHOT+name,type:'jpeg',quality:60,timeout:300000}).catch(e=>log('shot '+name,String(e).slice(0,120)));log('screenshot',name);};
 const hud=()=>X('JSON.stringify({timer:$("timer").textContent,timerVis:$("timer").style.visibility,spkHud:($("xSpk")||{style:{}}).style.display,tmSpk:!!($("xTm")&&$("xTm").classList.contains("x-spk")),bar:$("defuse").style.display!=="none"?$("defuse").firstChild.textContent+" "+($("defuse").querySelector("i")||{style:{}}).style.width:"",ban:$("xAnn")&&$("xAnn").style.display!=="none"?$("xAnn").textContent.replace(/\\s+/g," ").trim().slice(0,120):"",annLog:(annc.log||[]).slice(-4),mode,xSpOn,cr:FV.cr,sp:[FV.sp.st,+(FV.sp.t||0).toFixed(1),+(FV.sp.pt||0).toFixed(2),+(FV.sp.dt||0).toFixed(2),FV.sp.site],atk:FV.atk,score:[FV.you,FV.them],hp:player.hp,spkIcon:($("xSpkC")||{style:{}}).style.display})');
 const fps=()=>X('(()=>{const f0=renderer.info.render.frame,t=performance.now();return new Promise(r=>setTimeout(()=>r(((renderer.info.render.frame-f0)*1000/(performance.now()-t)).toFixed(2)),20000));})()');
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:110000});
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`MP.name='SpikeQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await X('mpStart();1');const t0=Date.now();
 await page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5'),null,{timeout:400000}).catch(e=>log('start wait',String(e).slice(0,200)));
 log('match start ms',Date.now()-t0);
 // round banners last 2 s of wall clock; frames here take ~3 s, so stretch them (x25) to be on screen for the capture
 await X('{const a0=annc;annc=function(t,ms,o){return a0(t,(ms||2000)*25,o);};}1');
 // round clock held long (screenshots take up to a minute at software-rendered frame rates); bots hold still; the bridge runs the room in lockstep with the page's messages (software rendering is slow) (they would decide the round by fighting)
 const me=await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};C.lock=true;const u=s.units.find(u=>u.human);return {id:u.id,team:u.team,atk:s.atk,credits:u.credits,buy:s.buy,round:s.round,carrier:s.spike.carrier};`);log('server me',me);
 log('page net',await X('JSON.stringify({st:MP.st,rs:NET.socket&&NET.socket.readyState,ready:NET.ready})'));log('fps',await fps());log('page net after fps',await X('JSON.stringify({st:MP.st,rs:NET.socket&&NET.socket.readyState,ready:NET.ready,msg:($("mpMsg")||{}).textContent})'));log('hud buy phase',await hud());await shot('online-spike-buy-640x360.jpg');
 await qa(`const s=sim('${code}');s.buy=Math.min(s.buy,.5);return s.buy;`);
 await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:1200000}).catch(e=>log('buy end wait',String(e).slice(0,120)));
 // carrier into A
 const placed=await qa(`const s=sim('${code}'),W=s.world,u=s.units.find(u=>u.human);let p=null;for(const i of W.playable){const q=W.nav.nodes[i];if(W.plantAt(q[0],q[2])==='A'&&!W.blocked(q[0],q[2],.45,q[1],1.8)){p=q;break;}}s.remaining=900;s.spike.carrier=u.id;s.spike.st='carry';s.spike.pt=0;[u.x,u.y,u.z]=p;u.vx=u.vy=u.vz=0;const before=s.units.filter(v=>v.team===s.atk).map(v=>v.credits);return {p,before,human:u.credits};`);log('placed in A',placed);
 await page.waitForTimeout(2500);log('hud in site (not holding)',await hud());await shot('online-spike-insite-640x360.jpg');
 await X('keys.Digit4=true;1');await page.waitForTimeout(2000);log('hud after 2 s hold',await hud());log('server plant',await qa(`const s=sim('${code}');return {st:s.spike.st,pt:s.spike.pt};`));await shot('online-spike-planting-640x360.jpg');
 const p0=Date.now();await page.waitForFunction(()=>window.__xe('FV.sp.st==="plant"'),null,{timeout:1200000}).catch(e=>log('plant wait',String(e).slice(0,120)));log('planted after real ms (from 2 s)',Date.now()-p0);
 await X('keys.Digit4=false;1');await page.waitForTimeout(1500);
 log('server after plant',await qa(`const s=sim('${code}');return {st:s.spike.st,site:s.spike.site,t:s.spike.t,atkCredits:s.units.filter(v=>v.team===s.atk).map(v=>v.credits)};`));
 log('hud planted',await hud());await shot('online-spike-planted-640x360.jpg');
 // fuse: shorten to 5 s so the round ends by detonation; set up a half-time swap after it (round 12 -> 13)
 await qa(`const s=sim('${code}');s.spike.t=5;s.round=12;return 1;`);
 const sc0=await X('FV.you+FV.them');await page.waitForFunction(n=>window.__xe('FV.you+FV.them')>n,sc0,{timeout:1200000}).catch(e=>log('round end wait',String(e).slice(0,120)));
 await page.waitForTimeout(800);log('hud round end (detonation)',await hud());await shot('online-spike-detonated-640x360.jpg');
 log('server round end',await qa(`const s=sim('${code}');return {scores:s.roundScores,credits:s.units.find(u=>u.human).credits,delay:s.roundDelay};`));
 // hold round 13's clock from the server side as soon as it starts (waiting for the page first let the whole 100 s round
 // expire at software-rendered frame rates, so the defuse ran in round 14)
 for(let i=0;i<2400;i++){const r=await qa(`const s=sim('${code}');if(s.round>=13&&!(s.roundDelay>0)){s.remaining=900;s.buy=Math.max(s.buy,20);return s.round;}return 0;`);if(r)break;await new Promise(r=>setTimeout(r,250));}
 await page.waitForFunction(()=>window.__xe('FV.buy>0'),null,{timeout:1200000}).catch(e=>log('round 13 wait',String(e).slice(0,120)));
 log('server round 13',await qa(`const s=sim('${code}');const u=s.units.find(u=>u.human);return {round:s.round,atk:s.atk,team:u.team,credits:u.credits};`));
 await page.waitForTimeout(1500);log('hud round 13 buy',await hud());await shot('online-spike-halftime-640x360.jpg');
 await qa(`const s=sim('${code}');s.buy=Math.min(s.buy,.5);return 1;`);await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:1200000}).catch(()=>{});
 const sp=await qa(`const s=sim('${code}'),W=s.world,u=s.units.find(u=>u.human);let p=null;for(const i of W.playable){const q=W.nav.nodes[i];if(W.plantAt(q[0],q[2])==='B'&&!W.blocked(q[0],q[2],.45,q[1],1.8)&&!W.blocked(q[0]+.8,q[2],.45,q[1],1.8)){p=q;break;}}s.remaining=900;Object.assign(s.spike,{st:'plant',site:'B',t:45,dt:0,carrier:null,x:p[0],y:p[1],z:p[2]});[u.x,u.y,u.z]=[p[0]+.8,p[1],p[2]];u.vx=u.vy=u.vz=0;return {p,team:u.team,atk:s.atk};`);log('planted Spike beside the defender',sp);
 await page.waitForTimeout(2500);log('hud by the Spike',await hud());await shot('online-spike-defuse-prompt-640x360.jpg');
 await X('keys.Digit4=true;1');const d0=Date.now();await page.waitForFunction(()=>window.__xe('FV.sp.dt>=3.5'),null,{timeout:1200000}).catch(e=>log('half wait',String(e).slice(0,120)));
 log('half reached after real ms',Date.now()-d0);log('hud defusing',await hud());await shot('online-spike-defusing-640x360.jpg');
 await X('keys.Digit4=false;1');await page.waitForTimeout(1500);log('server after release',await qa(`const s=sim('${code}');return {dt:s.spike.dt,st:s.spike.st};`));log('hud released',await hud());
 const sc1=await X('FV.you+FV.them');await X('keys.Digit4=true;1');await page.waitForFunction(n=>window.__xe('FV.you+FV.them')>n,sc1,{timeout:1200000}).catch(e=>log('defuse wait',String(e).slice(0,120)));await X('keys.Digit4=false;1');
 await page.waitForTimeout(800);log('hud round end (defuse)',await hud());await shot('online-spike-defused-640x360.jpg');
 log('server after defuse',await qa(`const s=sim('${code}');return {scores:s.roundScores,credits:s.units.find(u=>u.human).credits};`));
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
