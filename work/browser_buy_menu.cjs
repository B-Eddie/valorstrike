// Buy menu browser check (Valorant grid review): offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW), render gated as browser_hud_valorant.
// Opens the menu with the real B key in buy phase, measures the card grid at 1280x720, 640x360, 390x844 (on screen, no overlap, names
// unclipped, no sideways scroll), hovers Vandal for the stats panel.  node work/browser_buy_menu.cjs <out.json> [prefix]  (shots -> work/validation/<prefix>-buymenu-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/buy.json',PRE=process.argv[3]||'hud',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));
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
  log(`buymenu ${w}x${h}`,m);
  check(`buy menu ${w}x${h}: all cards on screen, none overlapping, names unclipped, no sideways scroll`,m.n>=17&&!m.hscroll&&!m.over.length&&!m.ov.length&&!m.clip.length,JSON.stringify({n:m.n,hs:m.hscroll,over:m.over,ov:m.ov.slice(0,5),clip:m.clip}));
  check(`buy menu ${w}x${h}: hovering Vandal fills the stats panel`,/vandal/i.test(m.stats),m.stats);
  await page.screenshot({path:`${SHOT}${PRE}-buymenu-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});}
 log('done',1);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
