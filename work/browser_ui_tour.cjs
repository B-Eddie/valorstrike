// UI/UX tour (headless Chromium, real WebGL page under SwiftShader): screenshots of every main screen for the UI lane.
//   lobby (first-run popup, then plain), play panel (queue), settings, agent select, loading, buy menu, HUD, scoreboard,
//   pause menu, results. World rendering is gated (window.__nr) between captures like browser_qa_flows.cjs.
//   ROOT=<repo> PORT=<static server port> node work/browser_ui_tour.cjs <outdir> <prefix> [WxH] [map]
// A static server must serve ROOT on 127.0.0.1:PORT (python3 -m http.server PORT --bind 127.0.0.1 -d ROOT).
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),PORT=process.env.PORT||'8941',QA='/workspace/work/qa/';
const OUTD=process.argv[2]||'/tmp/ui-tour',PFX=process.argv[3]||'before',[VW,VH]=(process.argv[4]||'1280x720').split('x').map(Number),MAP=process.argv[5]||'bind';
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);
fs.mkdirSync(OUTD,{recursive:true});
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const R={size:VW+'x'+VH,steps:[],errors:[],dom:{}};const t0=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t0)/1000).toFixed(1),k,v]);fs.writeFileSync(path.join(OUTD,PFX+'-log.json'),JSON.stringify(R,null,1));console.log(((Date.now()-t0)/1000).toFixed(0),k,typeof v==='string'?v.slice(0,200):JSON.stringify(v||'').slice(0,200));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:VW,height:VH},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('qa.init')){sessionStorage.setItem('qa.init','1');localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}}catch(e){}window.__fc=0;const f=()=>{window.__fc++;requestAnimationFrame(f);};requestAnimationFrame(f);});
 // registered first: Playwright tries the newest route first, so the CDN fulfil below must come after this catch-all
 await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,200));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{const f0=await page.evaluate(()=>window.__fc);await page.waitForFunction(([f0,n])=>window.__fc>=f0+n,[f0,n],{timeout:600000,polling:300}).catch(()=>{});};
 const gate=()=>X(`{if(!window.__nrOn){window.__nrOn=1;window.__nr=0;const r0=renderer.render;renderer.render=function(sc,c){if(window.__nr&&sc===scene)return;return r0.call(this,sc,c);};}}1`);
 const shot=async(name,world)=>{if(ONLY.length&&!ONLY.includes(name))return;if(world){await X('window.__nr=0;1').catch(()=>{});await frames(2);}else await frames(1);
  const f=path.join(OUTD,`${PFX}-${name}-${VW}x${VH}.png`);await page.screenshot({path:f,timeout:600000}).catch(e=>log('shot fail '+name,String(e).slice(0,120)));if(world)await X('window.__nr=1;1').catch(()=>{});log('shot',f);};
 const click=async sel=>{try{await page.click(sel,{timeout:15000});}catch(e){log('click fallback '+sel,String(e).split('\n')[0].slice(0,120));await X(`(document.querySelector(${JSON.stringify(sel)})||{click(){}}).click();1`).catch(()=>{});}};
 // overlaps / clipping probe of visible text in a container: elements whose text overflows their box
 const clip=sel=>X(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(sel)}+' *')].filter(e=>e.offsetParent&&e.children.length===0&&e.textContent.trim()&&(e.scrollWidth>e.clientWidth+2)&&getComputedStyle(e).overflow!=='visible').map(e=>(e.id||e.className||e.tagName)+':'+e.textContent.trim().slice(0,30)).slice(0,20))`).catch(()=>'[]');
 log('goto',PORT);await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded',timeout:300000});
 await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});await page.waitForTimeout(2500);
 await shot('01-lobby-firstrun');
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>log('no Got it',''));await page.waitForTimeout(800);
 await shot('02-lobby');R.dom.lobbyClip=await clip('#lobby');
 await click('#playBtn');await page.waitForTimeout(800);await shot('03-queue');R.dom.queueClip=await clip('#xQueue');
 await click('#xqSwift');await page.waitForTimeout(400);await shot('03b-queue-swift');
 await click('#xQueue [data-q="custom"]');await page.waitForTimeout(400);await shot('03c-queue-custom');
 await click('#xQueue [data-q="unrated"]');await page.waitForTimeout(300);
 await X(`document.querySelector('#xQueue [data-map="${MAP}"]')&&document.querySelector('#xQueue [data-map="${MAP}"]').click();1`).catch(()=>{});
 await click('#setBtn');await page.waitForTimeout(600);await shot('04-settings');R.dom.setClip=await clip('#mSet');
 for(const t of ['c','v','a']){await X(`(document.querySelector('#xSTab button[data-st="${t}"]')||{click(){}}).click();1`);await page.waitForTimeout(300);await shot('04'+t+'-settings');}
 await click('#mSet [data-close]');await page.waitForTimeout(400);
 await click('#xqPlay');await page.waitForTimeout(2500);
 log('after start',await X(`JSON.stringify({pre:getComputedStyle($("pre")).display,xAg:$("xAg")&&getComputedStyle($("xAg")).display,ld:!!window.xLdOn,running})`).catch(e=>String(e)));
 await shot('05-start-1');
 // agent select (xAg) if it appeared; pick the first agent and lock in
 for(let i=0;i<40;i++){const s=await X(`JSON.stringify({ag:$("xAg")&&getComputedStyle($("xAg")).display!=='none'&&!!$("xAg").offsetParent,pre:getComputedStyle($("pre")).display!=="none",ld:!!window.xLdOn,running})`).then(JSON.parse).catch(()=>({}));
  if(s.ag){await page.waitForTimeout(1500);await shot('06-agent-select');R.dom.agClip=await clip('#xAg');
   await X(`(()=>{const b=document.querySelector('#xAgR button,#xAgR [data-ag],#xAgR > *');if(b)b.click();return 1})()`);await page.waitForTimeout(700);await shot('06b-agent-picked');
   await click('#xAgL');break;}
  if(s.pre&&!s.ld){await click('#preGo');await page.waitForTimeout(1500);}
  if(s.ld||s.running)break;await page.waitForTimeout(1000);}
 await page.waitForTimeout(3000);await shot('07-loading');
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000}).catch(e=>log('start wait',String(e).slice(0,160)));
 await gate();await X('window.__nr=1;1');await frames(3);
 log('match',await X(`JSON.stringify({mode,map:FV.map,bots:bots.length,allies:allies.length,buy:FV.buy,hp:player.hp,cr:player.credits})`).catch(e=>String(e)));
 await shot('08-buyphase-hud',true);
 await page.keyboard.press('b');await frames(3);await shot('09-buymenu',true);R.dom.buyClip=await clip('#xBuy');
 await page.keyboard.press('b');await frames(2);
 await X('FV.buy=Math.min(FV.buy,0.2);1');await frames(20);await shot('10-hud-live',true);R.dom.hudClip=await clip('#game');
 await page.keyboard.down('Tab');await frames(2);await shot('11-scoreboard',true);await page.keyboard.up('Tab');await frames(2);
 await X(`(window.xPauseOpen||window.xPause||function(){})();1`).catch(()=>{});await page.keyboard.press('Escape');await frames(3);await shot('12-pause',true);await page.keyboard.press('Escape');await frames(2);
 await X(`bots.forEach(b=>{if(b.alive)hurt(b,999,'You');});1`).catch(()=>{});await frames(30);await shot('13-round-won',true);
 await X(`hurt(player,999,bots[0].name);if(player.hp<=0)pDie(bots[0].name,xWeapOf(bots[0]));1`).catch(()=>{});await frames(20);await shot('14-dead-spectate',true);
 await X(`FV.you=12;bots.forEach(b=>{if(b.alive)hurt(b,999,allies[0]?allies[0].name:'You');});1`).catch(()=>{});
 await page.waitForFunction(()=>window.__xe('$("result").style.display==="flex"'),null,{timeout:600000,polling:1000}).catch(e=>log('result wait',String(e).slice(0,120)));
 await page.waitForTimeout(1500);await shot('15-results',true);
 log('errors',R.errors.slice(0,20));log('dom',R.dom);
 await browser.close();
})().catch(e=>{log('fatal',String(e.stack||e).slice(0,500));process.exit(1);});
