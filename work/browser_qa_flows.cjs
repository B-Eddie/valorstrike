// Browser QA of real flows (headless Chromium, real page). Two legs, one browser at a time:
//   offline: settings (change in the Settings modal, reload, values kept), offline 5v5 scoreboard (Tab), spectate after
//            death (third-person button), match end / results screen and Lobby.
//   online:  page on server/tools/browser-bridge.mjs (local ENABLE_SPIKE only, never production): buy menu card marked
//            sellable after a buy, scoreboard (Tab), spectate after death, finished room -> results -> Leave room.
// World rendering under SwiftShader at Ascent/Lotus cost is ~10-100 s per frame in this sandbox, so the world render is
// skipped between screenshots (window.__nr) and allowed for a couple of frames before each capture; the HUD/DOM under
// test runs every frame either way.
//   node work/browser_qa_flows.cjs offline|online <out.json> [WxH]
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',LEG=process.argv[2]||'offline',OUT=process.argv[3]||'/tmp/qa-flows.json',SHOT=ROOT+'/work/validation/';
const [VW,VH]=(process.argv[4]||'640x360').split('x').map(Number);const SZ=VW+'x'+VH;
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={leg:LEG,size:SZ,steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(name,ok,detail)=>{R.checks.push([name,ok?'pass':'FAIL',detail]);log('check '+name,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:VW,height:VH},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('qa.init')){sessionStorage.setItem('qa.init','1');localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}}catch(e){}window.__fc=0;const f=()=>{window.__fc++;requestAnimationFrame(f);};requestAnimationFrame(f);});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.setDefaultNavigationTimeout(300000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,200));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{const f0=await page.evaluate(()=>window.__fc);await page.waitForFunction(([f0,n])=>window.__fc>=f0+n,[f0,n],{timeout:600000,polling:500}).catch(()=>{});};
 const gate=()=>X(`{if(!window.__nrOn){window.__nrOn=1;window.__nr=0;const r0=renderer.render;renderer.render=function(sc,c){if(window.__nr&&sc===scene)return;return r0.call(this,sc,c);};}}1`);
 const shot=async name=>{await X('window.__nr=0;1').catch(()=>{});await frames(2);await page.screenshot({path:SHOT+name,type:'jpeg',quality:60,timeout:600000}).catch(e=>log('shot '+name,String(e).slice(0,120)));await X('window.__nr=1;1').catch(()=>{});log('screenshot',name);};
 const boot=async()=>{log('goto',1);await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded',timeout:300000});log('loaded',1);await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});log('booted',await X('JSON.stringify({lobby:!!$("lobby").offsetParent,set:!!$("setBtn").offsetParent})').catch(e=>String(e).slice(0,100)));};
 const vis=sel=>X(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0;})()`);
 const board=()=>X(`JSON.stringify((()=>{const b=document.getElementById('xBoard');if(!b)return null;const r=b.getBoundingClientRect();const rows=[...b.querySelectorAll('tbody tr, .x-sbrow, tr')].filter(t=>t.offsetParent);return {w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),rows:rows.length,names:rows.map(t=>t.textContent.replace(/\\s+/g,' ').trim().slice(0,40)).slice(0,12),inView:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,rowsShown:[...b.querySelectorAll('tbody tr')].filter(t=>{const q=t.getBoundingClientRect();return t.offsetParent&&q.height>0&&q.top>=r.top-1&&q.bottom<=r.bottom+1;}).length}; // rowsShown: player rows not clipped by the board's overflow:hidden})())`).then(JSON.parse);
 // real pointer click; if Playwright's actionability wait fails (something covering it), report what covers it and
 // fall back to a DOM click so the flow continues (logged)
 const click=async(sel,o={})=>{try{await page.click(sel,Object.assign({timeout:20000},o));}catch(e){const cov=await X(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return 'missing';const r=el.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return t?(t.id||t.className||t.tagName)+'':'none';})()`).catch(()=>'?');log('click fallback '+sel,{err:String(e).split('\n')[0].slice(0,120),covered:cov});if(o.button==='right')await X(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));1`).catch(()=>{});else await X(`document.querySelector(${JSON.stringify(sel)}).click();1`).catch(()=>{});}};
 await boot();
 if(LEG==='offline'){
  // ---- settings: change, reload, kept
  await click('#setBtn');await page.waitForTimeout(500);
  const before=await X(`JSON.stringify({diff:S.diff,autoReload:S.autoReload!==false,mr:!!XOB.mr,cb:(document.querySelector('#xCbH button.on')||{}).dataset?.v})`);log('settings before',before);
  await click('#mSet .seg[data-key="diff"] button[data-v="hard"]');
  await click('#xAuR');await click('#xMiniRot');await click('#xCbH button[data-v="1"]');
  await click('#xSTab button[data-st="c"]');await page.waitForTimeout(300);
  await page.$eval('#sSens',e=>{e.value='1.25';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
  await click('#xSTab button[data-st="g"]');
  const changed=await X(`JSON.stringify({diff:S.diff,autoReload:S.autoReload!==false,mr:!!XOB.mr,cb:(document.querySelector('#xCbH button.on')||{}).dataset?.v,sens:S.sens})`);log('settings changed',changed);
  await shot(`qa-settings-changed-${SZ}.jpg`);
  await click('#mSet [data-close]');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  await click('#setBtn');await page.waitForTimeout(500);
  const after=await X(`JSON.stringify({diff:S.diff,autoReload:S.autoReload!==false,mr:!!XOB.mr,cb:(document.querySelector('#xCbH button.on')||{}).dataset?.v,sens:S.sens,diffBtn:(document.querySelector('#mSet .seg[data-key="diff"] button.on')||{}).dataset?.v,auR:document.getElementById('xAuR').checked,miniRot:document.getElementById('xMiniRot').checked,sensIn:document.getElementById('sSens').value})`);log('settings after reload',after);
  const A=JSON.parse(after),C=JSON.parse(changed);
  check('settings persist across reload',A.diff==='hard'&&A.diffBtn==='hard'&&A.autoReload===false&&!A.auR&&A.mr===C.mr&&A.miniRot===C.mr&&A.cb==='1'&&Math.abs(A.sens-1.25)<1e-6&&Math.abs(+A.sensIn-1.25)<1e-6,after);
  await shot(`qa-settings-after-reload-${SZ}.jpg`);
  await click('#mSet [data-close]');
  // ---- offline 5v5 on Lotus
  await X(`FV.pick='lotus';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000}).catch(e=>log('start wait',String(e).slice(0,160)));
  await gate();await X('window.__nr=1;FV.buy=Math.min(FV.buy,0.2);1');await frames(3);
  log('match',await X(`JSON.stringify({mode,map:FV.map,bots:bots.length,allies:allies.length,buy:FV.buy,hp:player.hp})`));
  await page.keyboard.down('Tab');await frames(2);const b1=await board();log('board offline',b1);
  check('scoreboard (Tab) offline shows ten players in view',!!b1&&b1.rowsShown>=10&&b1.inView,JSON.stringify(b1));
  await shot(`qa-scoreboard-offline-${SZ}.jpg`);await page.keyboard.up('Tab');await frames(2);
  check('scoreboard hides on Tab release (offline)',!(await vis('#xBoard')),'');
  // ---- death -> spectate
  await X(`hurt(player,999,bots[0].name);if(player.hp<=0)pDie(bots[0].name,xWeapOf(bots[0]));1`); // hurt() only applies damage; the bot fire path calls pDieawait frames(4);
  await page.waitForFunction(()=>window.__xe('!!document.querySelector(".x-sp")&&document.querySelector(".x-sp").offsetParent!==null'),null,{timeout:600000,polling:1000}).catch(e=>log('spectate wait',String(e).slice(0,120)));
  const sp=await X(`JSON.stringify((()=>{const e=document.querySelector('.x-sp');if(!e)return null;const r=e.getBoundingClientRect(),b=e.querySelector('.x-sp__tp');const br=b&&b.getBoundingClientRect();return {txt:e.textContent.replace(/\\s+/g,' ').trim().slice(0,80),y:Math.round(r.y),h:Math.round(r.height),btn:!!b,btnIn:br?br.x>=0&&br.right<=innerWidth&&br.y>=0&&br.bottom<=innerHeight:false};})())`);log('spectate offline',sp);
  const SP=JSON.parse(sp);check('spectate bar after death (offline) with an in-view third-person button',!!SP&&SP.btn&&SP.btnIn,sp);
  if(SP&&SP.btn){await click('.x-sp .x-sp__tp',{timeout:20000});await frames(2);log('third person on',await X(`document.querySelector('.x-sp__tp').classList.contains('on')`));}
  await shot(`qa-spectate-offline-${SZ}.jpg`);
  // ---- match end: one round from the win, then the round goes to the player's team
  await X(`FV.you=12;bots.forEach(b=>{if(b.alive)hurt(b,999,allies[0]?allies[0].name:'You');});1`);
  await page.waitForFunction(()=>window.__xe('$("result").style.display==="flex"'),null,{timeout:900000,polling:1000}).catch(e=>log('result wait',String(e).slice(0,120)));
  const res=await X(`JSON.stringify({res:$("result").style.display,title:($("result").querySelector('h1,h2,.x-rt')||{}).textContent,again:$("againBtn").textContent,againVis:!!$("againBtn").offsetParent,lobbyVis:!!$("lobbyBtn").offsetParent,score:[FV.you,FV.them]})`);log('result offline',res);
  const RS=JSON.parse(res);check('offline match end shows the results screen with Play again and Lobby',RS.res==='flex'&&RS.againVis&&RS.lobbyVis,res);
  await shot(`qa-results-offline-${SZ}.jpg`);
  await click('#lobbyBtn');await page.waitForTimeout(1500);
  check('Lobby from the results screen returns to the lobby',await vis('#lobby')&&!(await X('running')),'');
 } else {
  // ---- online 5v5 room on the bridge
  await X(`MP.name='FlowQA';window.xQMap='lotus';MP.map='lotus';mpCreate(false,'five');1`);
  await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:600000,polling:1000});const code=await X('MP.code');log('room',code);
  await X('mpStart();1');
  await page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn'),null,{timeout:900000,polling:2000}).catch(e=>log('start wait',String(e).slice(0,160)));
  await gate();await X('window.__nr=1;1');
  await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};C.lock=true;s.buy=Math.max(s.buy,60);return 1;`);
  await page.waitForFunction(()=>window.__xe('FV.buy>0'),null,{timeout:600000,polling:1000}).catch(()=>{});
  // buy menu: buy a Sheriff, the card is marked sellable; sell it back, the mark goes
  await page.keyboard.press('b');await frames(2);
  log('buy menu open',await X('$("xBuy").classList.contains("on")'));
  const cr0=await X('FV.cr');await click('#xBuy button.xb-w[data-n="Sheriff"]',{timeout:60000});
  await page.waitForFunction(c=>window.__xe('FV.cr')<c,cr0,{timeout:600000,polling:500}).catch(e=>log('buy wait',String(e).slice(0,120)));await frames(2);
  const card=await X(`JSON.stringify((()=>{const b=document.querySelector('#xBuy button.xb-w[data-n="Sheriff"]');return b?{cls:b.className,label:b.getAttribute('aria-label'),cr:FV.cr,sec:FV.sec}:null;})())`);log('Sheriff card after buy',card);
  check('online bought card marked sellable (xb-sell)',/xb-sell/.test(JSON.parse(card)?.cls||''),card);
  await shot(`qa-buy-sellable-online-${SZ}.jpg`);
  await click('#xBuy button.xb-w[data-n="Sheriff"]',{button:'right',timeout:60000});
  await page.waitForFunction(c=>window.__xe('FV.cr')>=c,cr0,{timeout:600000,polling:500}).catch(e=>log('sell wait',String(e).slice(0,120)));await frames(2);
  const card2=await X(`JSON.stringify((()=>{const b=document.querySelector('#xBuy button.xb-w[data-n="Sheriff"]');return b?{cls:b.className,cr:FV.cr,sec:FV.sec}:null;})())`);log('Sheriff card after sell',card2);
  check('online sell refunds and clears the mark',JSON.parse(card2)?.cr===cr0&&!/xb-sell/.test(JSON.parse(card2)?.cls||''),card2);
  await page.keyboard.press('b');await frames(2);
  // scoreboard online
  await page.keyboard.down('Tab');await frames(2);const b1=await board();log('board online',b1);
  check('scoreboard (Tab) online shows ten players in view',!!b1&&b1.rowsShown>=10&&b1.inView,JSON.stringify(b1));
  await shot(`qa-scoreboard-online-${SZ}.jpg`);await page.keyboard.up('Tab');await frames(2);
  check('scoreboard hides on Tab release (online)',!(await vis('#xBoard')),'');
  // death -> spectate (server kill by an enemy bot, as the server's shot code makes it)
  await qa(`const s=sim('${code}');s.buy=0;return 1;`);await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:600000,polling:1000}).catch(()=>{});
  log('server kill',await qa(`const s=sim('${code}');const u=s.units.find(u=>u.human),k=s.units.find(v=>v.team!==u.team&&v.alive);u.hp=0;u.alive=false;u.deaths++;k.kills++;s.events.push(['k',k.name,u.name,0,k.weapon]);return {killer:k.name,victim:u.name};`));
  await page.waitForFunction(()=>window.__xe('!!document.querySelector(".x-sp")&&document.querySelector(".x-sp").offsetParent!==null'),null,{timeout:600000,polling:1000}).catch(e=>log('spectate wait',String(e).slice(0,120)));
  const sp=await X(`JSON.stringify((()=>{const e=document.querySelector('.x-sp');if(!e)return null;const r=e.getBoundingClientRect(),b=e.querySelector('.x-sp__tp');const br=b&&b.getBoundingClientRect();return {txt:e.textContent.replace(/\\s+/g,' ').trim().slice(0,80),y:Math.round(r.y),btn:!!b,btnIn:br?br.x>=0&&br.right<=innerWidth&&br.y>=0&&br.bottom<=innerHeight:false,hp:player.hp};})())`);log('spectate online',sp);
  const SP=JSON.parse(sp);check('spectate bar after death (online) with an in-view third-person button',!!SP&&SP.btn&&SP.btnIn,sp);
  if(SP&&SP.btn){await click('.x-sp .x-sp__tp',{timeout:20000});await frames(2);}
  await shot(`qa-spectate-online-${SZ}.jpg`);
  // finished room -> results -> Leave room
  log('server finish',await qa(`const s=sim('${code}');const u=s.units.find(u=>u.human);s.roundScores=[u.team===0?12:0,u.team===0?0:12];s.roundDelay=0;s.finishRound(u.team,'Elimination');return {scores:s.roundScores,delay:s.roundDelay};`));
  await page.waitForFunction(()=>window.__xe('MP.st==="post"&&$("result").style.display==="flex"'),null,{timeout:900000,polling:1000}).catch(e=>log('post wait',String(e).slice(0,120)));
  const res=await X(`JSON.stringify({st:MP.st,res:$("result").style.display,again:$("againBtn").textContent,againVis:!!$("againBtn").offsetParent,lobbyVis:!!$("lobbyBtn").offsetParent,txt:$("result").textContent.replace(/\\s+/g,' ').trim().slice(0,160)})`);log('result online',res);
  const RS=JSON.parse(res);check('finished online room shows results with Leave room',RS.res==='flex'&&RS.again==='Leave room'&&RS.againVis,res);
  await shot(`qa-results-online-${SZ}.jpg`);
  await click('#againBtn');await page.waitForTimeout(3000);
  const back=await X(`JSON.stringify({st:MP.st,running,lobby:!!$("lobby").offsetParent,res:$("result").style.display,sock:!!(NET.socket&&NET.socket.readyState<2)})`);log('after Leave room',back);
  const BK=JSON.parse(back);check('Leave room returns to the lobby and closes the room socket',BK.lobby&&!BK.running&&!BK.sock,back);
  await shot(`qa-leave-room-lobby-${SZ}.jpg`);
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
