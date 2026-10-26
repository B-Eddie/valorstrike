// Rendered online spectate (killer cam + stale label): headless Chromium at 640x360 plays the real page online against
// the real worker module (server/tools/browser-bridge.mjs on 8787, local ENABLE_SPIKE only; repo on 127.0.0.1:8876).
// Bots held still and the room run in lockstep through /__qa. 5v5: every teammate and the page player killed by the
// server (snapshot 'k' events) -> killed-by card, then the cam follows the killer ("SPECTATING <killer> · ENEMY").
// Then, in the same page, an online TDM: team dead with respawns held -> "NO ONE ALIVE", never an enemy cam (the label
// used to keep the 5v5 match's text). Browser twin of work/test_spectate_online.cjs.
//   bash hk_out/start.sh bridge; node work/browser_online_cam.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hk/online-cam.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],errors:[]};const t00=Date.now();
R.checks=[];const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);page.on('websocket',ws=>{log('ws open',ws.url().slice(0,80));ws.on('close',()=>log('ws closed',ws.url().slice(0,80)));});page.on('console',m=>{if(/error|warn|lost|idle|clos/i.test(m.text()))R.errors.push('console '+m.text().slice(0,200));});
 const shot=async name=>{await page.screenshot({path:SHOT+name,type:'jpeg',quality:60,timeout:300000}).catch(e=>log('shot '+name,String(e).slice(0,120)));log('screenshot',name);};
 const hud=()=>X('JSON.stringify({timer:$("timer").textContent,timerVis:$("timer").style.visibility,spkHud:($("xSpk")||{style:{}}).style.display,tmSpk:!!($("xTm")&&$("xTm").classList.contains("x-spk")),bar:$("defuse").style.display!=="none"?$("defuse").firstChild.textContent+" "+($("defuse").querySelector("i")||{style:{}}).style.width:"",ban:$("xAnn")&&$("xAnn").style.display!=="none"?$("xAnn").textContent.replace(/\\s+/g," ").trim().slice(0,120):"",annLog:(annc.log||[]).slice(-4),mode,xSpOn,cr:FV.cr,sp:[FV.sp.st,+(FV.sp.t||0).toFixed(1),+(FV.sp.pt||0).toFixed(2),+(FV.sp.dt||0).toFixed(2),FV.sp.site],atk:FV.atk,score:[FV.you,FV.them],hp:player.hp,spkIcon:($("xSpkC")||{style:{}}).style.display})');
 const fps=()=>X('(()=>{const f0=renderer.info.render.frame,t=performance.now();return new Promise(r=>setTimeout(()=>r(((renderer.info.render.frame-f0)*1000/(performance.now()-t)).toFixed(2)),20000));})()');
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:110000});
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});

 // stretch banners / the killed-by card are on the real clock; frames take seconds in software rendering
 const cam=()=>X('JSON.stringify({on:xKL.on,sp:xKL.sp,cur:xKL.cur?xKL.cur.name:null,enemy:!!(xKL.cur&&bots.includes(xKL.cur)),label:xKL.sn?xKL.sn.textContent:"",labelVis:!!(xKL.sn&&xKL.sn.offsetParent!==null),hp:player.hp,al:allies.filter(a=>a.alive).length,mode,m5:!!MP.m5})').then(JSON.parse);
 const KILL=`const kill=(s,v,k)=>{v.hp=0;v.alive=false;v.deaths++;v.respawnAt=1e9;if(k)k.kills++;s.events.push(['k',k?k.name:'',v.name,0,'Vandal']);};`;
 for(const mode of (process.env.MODES||'five,tdm').split(',')){
  await X(`MP.name='CamQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}');1`);
  await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log(mode+' room',code);
  await X('mpStart();1');const t0=Date.now();
  await page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5'),null,{timeout:900000}).catch(e=>log('start wait',String(e).slice(0,200)));
  log(mode+' match start ms',Date.now()-t0);
  const info=await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};C.lock=true;if(s.buy>0)s.buy=Math.min(s.buy,.5);if(s.remaining!=null)s.remaining=900;const me=s.units.find(u=>u.human);return {team:me.team,atk:s.atk,mode:s.mode};`);log(mode+' server',info);
  if(mode==='five')await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:1200000}).catch(e=>log('buy end wait',String(e).slice(0,120)));
  const k=await qa(`${KILL}const s=sim('${code}');const me=s.units.find(u=>u.human),foes=s.units.filter(u=>u!==me&&u.team!==me.team),mates=s.units.filter(u=>u!==me&&u.team===me.team),killer=foes[1]||foes[0];if(s.spike&&me.team===s.atk)Object.assign(s.spike,{st:'plant',site:'A',x:me.x,y:me.y,z:me.z,t:600,carrier:null,dt:0,pt:0});for(const a of mates)kill(s,a,killer);kill(s,me,killer);return {killer:killer.name,mates:mates.length};`);log(mode+' killed team + page player',k);
  await page.waitForFunction(()=>window.__xe('player.hp<=0&&xKL.on'),null,{timeout:900000}).catch(e=>log(mode+' death wait',String(e).slice(0,120)));
  log(mode+' cam at death',await cam());await shot(`online-cam-${mode}-death-640x360.jpg`);
  // killed-by card is 2 s of game time; wait for the spectate view (xKL.sp)
  await page.waitForFunction(()=>window.__xe('xKL.sp'),null,{timeout:900000}).catch(e=>log(mode+' spectate wait',String(e).slice(0,120)));
  await page.waitForTimeout(1500);const c=await cam();log(mode+' cam spectate',c);await shot(`online-cam-${mode}-spectate-640x360.jpg`);
  if(mode==='five')check('online 5v5 team wiped: killer cam follows the killer, a living enemy (SPECTATING <killer> · ENEMY)',c.sp&&c.enemy&&c.cur===k.killer&&/SPECTATING .* · ENEMY/.test(c.label),c);
  else check('online '+mode+' (respawn mode, team dead): label written fresh "NO ONE ALIVE", no enemy cam (was the previous match\'s stale "SPECTATING <enemy> · ENEMY")',c.sp&&!c.enemy&&c.label==='NO ONE ALIVE',c);
  await X('try{mpLeave()}catch(e){}1');await page.waitForTimeout(3000);
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
