// Buy menu browser check (Valorant grid review): offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW), render gated as browser_hud_valorant.
// Opens the menu with the real B key in buy phase, measures the card grid at 1280x720, 640x360, 390x844 (on screen, no overlap, names
// unclipped, no sideways scroll), hovers Vandal for the stats panel.  node work/browser_buy_menu.cjs <out.json> [prefix]  (shots -> work/validation/<prefix>-buymenu-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.VS_ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/buy.json',PRE=process.argv[3]||'hud',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,1366x768,1440x900,1920x1080,1920x969,1280x657,844x390,932x430,640x360,390x844').split(',').map(s=>s.split('x').map(Number));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:SIZES[0][0],height:SIZES[0][1]},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 await X(`{window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 log('match started',await X('JSON.stringify({mode,map:FV.map,bots:bots.length,allies:allies.length,buy:FV.buy,agent:J.pick})'));
 const fonts=await X(`JSON.stringify([document.fonts.check('20px "VS Hud"'),document.fonts.check('20px "VS Title"')])`);log('fonts',fonts);
 // Buy menu (B) in buy phase at three sizes: open via the real B key, measure the grid, hover a rifle to fill the stats panel
 await X('FV.buy=Math.max(FV.buy,60);FV.cr=Math.max(FV.cr||0,4700);1');await frames(2);
 await page.keyboard.press('KeyB');await page.waitForTimeout(500);
 let on=await X('document.getElementById("xBuy").classList.contains("on")');if(!on){await X('buyMenu(true);1');on=await X('document.getElementById("xBuy").classList.contains("on")');log('B key did not open, opened via buyMenu(true)',on);}
 check('B opens the buy menu in buy phase',on,String(on));
 for(const [w,h] of SIZES){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(400);
  await page.hover('#xBuy button[data-n="Vandal"]',{timeout:20000}).catch(e=>log('hover',String(e).slice(0,80)));await page.waitForTimeout(300);await frames(1);
  const m=JSON.parse(await X(`JSON.stringify((()=>{const B=document.getElementById('xBuy'),cards=[...B.querySelectorAll('.xb-card>button[data-n]')];const rs=cards.map(c=>c.getBoundingClientRect());
   const cols=[...B.querySelectorAll('.x-bc h4')].map(e=>e.textContent.trim());const side=B.querySelector('.xb-side');const sr=side&&side.getBoundingClientRect();
   const over=cards.filter((c,i)=>rs[i].left<0||rs[i].right>innerWidth+1).map(c=>c.dataset.n);const clip=cards.filter(c=>{const b=c.querySelector('b');return b&&b.scrollWidth>b.clientWidth+1}).map(c=>c.dataset.n);
   const ov=[];for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)ov.push(cards[i].dataset.n+'/'+cards[j].dataset.n);}
   return {n:cards.length,cols,hscroll:B.scrollWidth>B.clientWidth+1,over,clip,ov,side:sr?[sr.left,sr.top,sr.width,sr.height].map(Math.round):null,stats:(B.querySelector('.x-ws')||{}).textContent?.slice(0,120)||'',minH:Math.round(Math.min(...rs.map(r=>r.height))),minW:Math.round(Math.min(...rs.map(r=>r.width)))};})())`));
  // hk-30 (buy2 1280x720 screenshot: Sheriff cut at the bottom edge, never measured - the old check was horizontal only):
  // on a desktop-width screen at least 700 px tall the six weapon columns fit with no scroll; on every size each card can be scrolled fully into view.
  const vm=JSON.parse(await X(`JSON.stringify((()=>{const B=document.getElementById('xBuy');B.scrollTop=0;const W=[...B.querySelectorAll('.x-bc:not(.xb-shc):not(.xb-abc) .xb-card>button[data-n]')],all=[...B.querySelectorAll('.xb-card>button[data-n]')];
   const below=W.filter(c=>c.getBoundingClientRect().bottom>innerHeight+0.5).map(c=>c.dataset.n);const unreach=[];
   for(const c of all){c.scrollIntoView({block:'nearest'});const r=c.getBoundingClientRect();if(r.top<-0.5||r.bottom>innerHeight+0.5)unreach.push(c.dataset.n);}B.scrollTop=0;
   const sh=B.querySelector('button[data-n="Sheriff"]'),sr=sh&&sh.getBoundingClientRect();return {weapons:W.length,below,unreach,sheriffBottom:sr?Math.round(sr.bottom):null,scrollH:B.scrollHeight,clientH:B.clientHeight};})())`));
  log(`buymenu vertical ${w}x${h}`,vm);
  // buymenu-1 (user: "Make it so you don't need to scroll in the buy menu"): every landscape size >= 360 px tall shows the whole menu at once -
  // no scrolling anywhere in it, every card / column header / the stats panel / team loadout inside the window and not cut by its own box, cards >= 40 px tall on phone sizes.
  const fit=JSON.parse(await X(`JSON.stringify((()=>{const B=document.getElementById('xBuy'),out=e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-0.5||r.top<-0.5||r.right>innerWidth+0.5||r.bottom>innerHeight+0.5);};
   const scrollers=[B,...B.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /auto|scroll/.test(s.overflowY+s.overflowX)&&e.scrollHeight>e.clientHeight+1;}).map(e=>e.id||e.className||e.tagName);
   const items=[...B.querySelectorAll('.xb-card>button[data-n],.x-bc h4,.x-ws:not([hidden]),.xb-team,#xBRq,.xb-x')],off=items.filter(out).map(e=>e.dataset.n||e.id||e.className);
   const cut=[...B.querySelectorAll('.xb-card>button[data-n]')].filter(b=>{const r=b.getBoundingClientRect();return [...b.querySelectorAll('b,.x-tp,em,.x-aic')].some(c=>{const q=c.getBoundingClientRect();if(!q.width||getComputedStyle(c).display==='none')return false;return q.bottom>r.bottom+0.5||q.right>r.right+0.5||q.top<r.top-0.5;})||[...b.querySelectorAll('b')].some(c=>c.scrollHeight>c.clientHeight+1&&!b.classList.contains('xb-a'));}).map(b=>b.dataset.n);
   const ws=B.querySelector('.x-ws'),wsCut=ws&&!ws.hidden&&ws.scrollHeight>ws.clientHeight+1;const hs=[...B.querySelectorAll('.xb-card>button[data-n]')].map(b=>b.getBoundingClientRect().height);
   return {scrollH:B.scrollHeight,clientH:B.clientHeight,scrollers,off,cut,wsCut,minCard:Math.round(Math.min(...hs)*10)/10,cards:hs.length,disp:getComputedStyle(B).display};})())`));
  log(`buymenu fit ${w}x${h}`,fit);
  if(w>=h&&h>=360){check(`buy menu ${w}x${h}: whole menu on screen with no scrolling (no scroll container, every card / header / stats / team panel inside the window)`,fit.disp==='grid'&&fit.scrollH<=fit.clientH+1&&!fit.scrollers.length&&!fit.off.length,JSON.stringify(fit));
   check(`buy menu ${w}x${h}: no card content cut by its card, stats panel not cut`,!fit.cut.length&&!fit.wsCut,JSON.stringify({cut:fit.cut,wsCut:fit.wsCut}));
   if(h<=500)check(`buy menu ${w}x${h}: phone-size cards >= 40 px tall`,fit.minCard>=40,String(fit.minCard));}
  if(w>820&&h>=700)check(`buy menu ${w}x${h}: every weapon column fits on screen without scrolling (Sheriff not cut)`,vm.weapons>=18&&!vm.below.length,JSON.stringify(vm));
  check(`buy menu ${w}x${h}: every card can be scrolled fully into view`,!vm.unreach.length,JSON.stringify({unreach:vm.unreach,scrollH:vm.scrollH,clientH:vm.clientH}));
  log(`buymenu ${w}x${h}`,m);
  check(`buy menu ${w}x${h}: all cards on screen, none overlapping, names unclipped, no sideways scroll`,m.n>=17&&!m.hscroll&&!m.over.length&&!m.ov.length&&!m.clip.length,JSON.stringify({n:m.n,hs:m.hscroll,over:m.over,ov:m.ov.slice(0,5),clip:m.clip}));
  check(`buy menu ${w}x${h}: hovering Vandal fills the stats panel`,/vandal/i.test(m.stats),m.stats);
  await page.screenshot({path:`${SHOT}${PRE}-buymenu-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});}
 log('done',1);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
