// UI layout checks (headless Chromium, real page): queue tabs fit, Custom GO filled, Settings Colourblind HUD row, buy cards unclipped,
// pause Surrender note layout, results not covered by the spectate bar. Exit 0 = all pass.
//   ROOT=<repo> PORT=<port> [LEG=lobby] node work/browser_ui_layout.cjs <outdir> <prefix> [WxH] [map]
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

 const checks=[];const check=(n,ok,d)=>{checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,(ok?'pass ':'FAIL ')+JSON.stringify(d).slice(0,300));};
 const J=async s=>JSON.parse(await X('JSON.stringify('+s+')'));
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded',timeout:300000});
 await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});await page.waitForTimeout(1500);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 // L1 every queue tab is inside the tab strip (no hidden CUSTOM tab behind a scrollbar-less overflow)
 await click('#playBtn');await page.waitForTimeout(600);
 const L1=await J(`(()=>{const t=document.querySelector('#xQueue .x-qtabs'),r=t.getBoundingClientRect();return {sw:t.scrollWidth,cw:t.clientWidth,out:[...t.querySelectorAll('button')].filter(b=>{const q=b.getBoundingClientRect();return q.right>r.right+1||q.left<r.left-1;}).map(b=>b.textContent)};})()`);
 check('queue tabs all visible',L1.out.length===0&&L1.sw<=L1.cw+1,L1);
 // L2 the Custom tab's Retake GO reads as a button (filled, not text on the panel)
 await click('#xQueue [data-q="custom"]');await page.waitForTimeout(300);
 const L2=await J(`(()=>{const b=$('goBtn'),cs=getComputedStyle(b),m=cs.backgroundColor.match(/[\\d.]+/g).map(Number);return {bg:cs.backgroundColor,a:m.length>3?m[3]:1,lum:(m[0]*.3+m[1]*.59+m[2]*.11)}})()`);
 check('custom GO is a filled button',L2.a>0.8&&L2.lum>60,L2);
 await click('#xQueue [data-q="unrated"]');
 // L3 Settings > General: the Colourblind HUD segment sits inside its own row
 await click('#setBtn');await page.waitForTimeout(500);
 const L3=await J(`(()=>{const s=document.querySelector('#mSet #xCbH'),row=s.closest('.srow'),a=s.getBoundingClientRect(),b=row.getBoundingClientRect(),cs=getComputedStyle(s);return {pos:cs.position,seg:[a.top,a.bottom],row:[b.top,b.bottom],vis:a.height>0}})()`);
 check('settings Colourblind HUD control inside its row',L3.vis&&L3.pos!=='fixed'&&L3.seg[0]>=L3.row[0]-1&&L3.seg[1]<=L3.row[1]+1,L3);
 await click('#mSet [data-close]');await page.waitForTimeout(300);
 if(process.env.LEG!=='lobby'){
  await X(`FV.pick='${MAP}';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000}).catch(e=>log('start wait',String(e).slice(0,160)));
  await gate();await X('window.__nr=1;1');await frames(3);
  // M1 buy menu: no clipped (ellipsised) text on the weapon cards
  await page.keyboard.press('b');await frames(3);
  const M1=await J(`[...document.querySelectorAll('#xBuy .xb-card small,#xBuy .xb-card em,#xBuy .xb-rqb')].filter(e=>e.offsetParent&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&e.scrollWidth>e.clientWidth+1).map(e=>e.className+':'+e.textContent)`);
  check('buy cards: no clipped text',M1.length===0,M1);
  await page.keyboard.press('b');await frames(2);
  // M2 pause: the Surrender note ("Available from round 4") sits under the Surrender label, left aligned with it
  await page.keyboard.press('Escape');await frames(3);
  const M2=await J(`(()=>{const b=$('xSurr'),s=b.querySelector('small');if(b.hidden||!s)return {hidden:b.hidden,s:!!s};const a=b.getBoundingClientRect(),q=s.getBoundingClientRect(),cs=getComputedStyle(b);return {bt:a.bottom-parseFloat(cs.paddingBottom),sb:q.bottom,bl:a.left+parseFloat(cs.paddingLeft),sl:q.left}})()`);
  check('pause Surrender note under its label and aligned',!!M2.sb&&Math.abs(M2.sb-M2.bt)<=2&&Math.abs(M2.sl-M2.bl)<=2,M2);
  await page.keyboard.press('Escape');await frames(2);
  // M3 results after dying: the spectate bar must not sit on top of Play again / Lobby
  await X(`hurt(player,999,bots[0].name);if(player.hp<=0)pDie(bots[0].name,xWeapOf(bots[0]));1`).catch(()=>{});await frames(10);
  await page.waitForFunction(()=>window.__xe('!!document.querySelector(".x-sp.on")'),null,{timeout:300000,polling:1000}).catch(()=>log('no spectate bar',''));
  await X(`FV.you=12;bots.forEach(b=>{if(b.alive)hurt(b,999,allies[0]?allies[0].name:'You');});1`).catch(()=>{});
  await page.waitForFunction(()=>window.__xe('$("result").style.display==="flex"'),null,{timeout:600000,polling:1000}).catch(e=>log('result wait',String(e).slice(0,120)));await frames(3);
  const M3=await J(`(()=>{const hit=id=>{const r=$(id).getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===$(id)||$(id).contains(e)?'ok':(e&&(e.className||e.id||e.tagName))};const sp=document.querySelector('.x-sp');return {again:hit('againBtn'),lobby:hit('lobbyBtn'),sp:sp?getComputedStyle(sp).display:'none'}})()`);
  check('results: Play again and Lobby are not covered',M3.again==='ok'&&M3.lobby==='ok'&&M3.sp==='none',M3);
  if(process.env.SHOT)await shot('layout-results',true);
 }
 const bad=checks.filter(c=>c[1]!=='pass');log('summary',{pass:checks.length-bad.length,fail:bad.length});
 await browser.close();process.exit(bad.length?1:0);
})().catch(e=>{log('fatal',String(e.stack||e).slice(0,500));process.exit(2);});
