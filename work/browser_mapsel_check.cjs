// hark-mapsel 8-item browser checklist (map selection must not fall back to Ascent), headless Chromium (SwiftShader, LOW),
// real lobby clicks at 640x360. Report: project work/qa/mapsel/REPORT.md ("Browser checklist").
//  1 lobby choice persists: Bind tile -> reload -> Bind tile pressed, xQMap bind, xOnMap bind
//  2 DEATHMATCH tab + Haven tile + START -> match on haven
//  3 TEAM DEATHMATCH tab + Split tile + START -> split
//  4 ESCALATION tab + Lotus tile + START -> lotus (Escalation used to ignore the tile)
//  5 SPIKE RUSH tab + Breeze tile + START -> breeze (Escalation's stale xQPick must not leak)
//  6 UNRATED tab + Bind tile + START -> pre-match card says BIND, GO + lock -> 5v5 on bind
//  7 pre-match picker RANDOM -> match on one of the 6 maps (not unresolved), lobby choice stays random, no tile selected
//  8 lobby at 640x360: map tiles + Online map select visible, inside the viewport, select follows the tile; no page errors
//   node work/browser_mapsel_check.cjs <out.json>   env ONLY=1,2,... to run a subset
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mapsel_check.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const ONLY=process.env.ONLY?process.env.ONLY.split(',').map(Number):[1,2,3,4,5,6,7,8];const want=i=>ONLY.includes(i);
const MAPS=['ascent','bind','haven','split','lotus','breeze'];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const boot=async()=>{await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});};
 const VIS=`(e=>!!(e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length))`;
 const vis=sel=>X(`${VIS}(document.querySelector(${JSON.stringify(sel)}))`);
 const st=()=>X(`JSON.stringify({pick:FV.pick,map:FV.map,mode:typeof mode!=='undefined'?mode:null,qmap:window.xQMap||null,xQPick:window.xQPick||null,preMh:(document.getElementById('preMh')||{}).textContent,running,ld:!!window.xLdOn,nb:typeof bots!=='undefined'?bots.length:-1})`).then(JSON.parse);
 const openQ=async()=>{if(!(await vis('#xQueue')))await page.click('#playBtn',{timeout:20000}).catch(e=>log('playBtn',String(e).slice(0,120)));await page.waitForTimeout(500);};
 const toLobby=async()=>{await X('try{if(running)leave()}catch(e){}try{if(document.getElementById("result").style.display!=="none")document.getElementById("lobbyBtn").click()}catch(e){}1');await page.waitForTimeout(3000);};
 // waits until the match runs; clicks GO / agent lock-in on the way like a user. Returns [state, seconds, sawPre]
 const until=async tag=>{const t0=Date.now();let pre=null;for(let t=0;t<450;t++){const s=await X(`JSON.stringify({run:running&&!window.xLdOn&&!paused,pre:${VIS}(document.getElementById('pre')),ag:${VIS}(document.getElementById('xAg'))})`).then(JSON.parse);
   if(s.run)break;
   if(s.pre){if(!pre)pre=await st();await page.click('#preGo',{timeout:5000}).catch(()=>{});}
   else if(s.ag){await X(`(()=>{const t=[...document.querySelectorAll('#xAg .x-ag')].filter(b=>!b.disabled);if(t.length)t[0].click();return 1})()`);await page.waitForTimeout(300);await page.click('#xAgL',{timeout:5000}).catch(()=>{});}
   await page.waitForTimeout(2000);}
  const s=await st();log(tag+' loaded',{s,pre,sec:(Date.now()-t0)/1000});return [s,(Date.now()-t0)/1000,pre];};
 await boot();log('assets',1);
 if(want(1)){await openQ();await page.click('.x-qmap[data-map="bind"]',{timeout:20000}).catch(e=>log('tile',String(e).slice(0,120)));
  await boot();await openQ();
  const r=await X(`JSON.stringify({ls:localStorage.getItem('vs.map'),q:window.xQMap,pressed:[...document.querySelectorAll('#xQueue .x-qmap[aria-pressed=true]')].map(b=>b.dataset.map),om:(document.getElementById('xOnMap')||{}).value})`).then(JSON.parse);
  check('1 lobby map choice survives a reload (Bind)',r.ls==='bind'&&r.q==='bind'&&r.pressed.join()==='bind'&&r.om==='bind',JSON.stringify(r));}
 const runQ=async(n,tab,m)=>{await toLobby();await openQ();await page.click(`#xQueue .x-qtabs [data-q="${tab}"]`,{timeout:20000}).catch(e=>log('tab',String(e).slice(0,120)));
  await page.click(`.x-qmap[data-map="${m}"]`,{timeout:20000}).catch(e=>log('tile',String(e).slice(0,120)));const b=await st();log(n+' before START',b);
  await page.click('#xqPlay',{timeout:20000}).catch(e=>log('xqPlay',String(e).slice(0,120)));const [s,sec,pre]=await until(n+' '+tab+' '+m);
  await page.screenshot({path:`${SHOT}mapsel-chk${n}-${tab}-${m}-640x360.jpg`,type:'jpeg',quality:60,timeout:150000}).catch(e=>log('shot',String(e).slice(0,100)));return [s,sec,pre];};
 for(const [n,tab,m] of [[2,'dm','haven'],[3,'tdm','split'],[4,'esc','lotus'],[5,'sr','breeze']])if(want(n)){const [s,sec]=await runQ(n,tab,m);
  check(`${n} ${tab.toUpperCase()} tab + ${m} tile + START -> match on ${m}`,s.running&&s.map===m,JSON.stringify({s,sec}));}
 if(want(6)){const [s,sec,pre]=await runQ(6,'unrated','bind');
  check('6 UNRATED + Bind tile -> pre-match card BIND, GO + lock -> 5v5 on bind',s.running&&s.map==='bind'&&s.mode==='five'&&!!pre&&/bind/i.test(pre.preMh||''),JSON.stringify({s,sec,preMh:pre&&pre.preMh}));}
 if(want(7)){await toLobby();await openQ();await page.click('#xQueue .x-qtabs [data-q="unrated"]').catch(()=>{});await page.click('#xqPlay').catch(e=>log('xqPlay',String(e).slice(0,120)));
  for(let t=0;t<30&&!(await vis('#pre'));t++)await page.waitForTimeout(500);
  await page.click('#xMp button[data-m="random"]',{timeout:20000}).catch(e=>log('random btn',String(e).slice(0,160)));await page.waitForTimeout(300);
  const b=await st();const tiles=await X(`[...document.querySelectorAll('#xQueue .x-qmap')].filter(b=>b.classList.contains('selected')).map(b=>b.dataset.map).join()`);log('7 after random pick',{b,tiles});
  const [s,sec]=await until('7 random');const after=await X('window.xQMap');
  await page.screenshot({path:`${SHOT}mapsel-chk7-random-640x360.jpg`,type:'jpeg',quality:60,timeout:150000}).catch(()=>{});
  check('7 pre-match RANDOM -> 5v5 on one of the 6 maps, lobby choice stays random, no tile selected',s.running&&MAPS.includes(s.map)&&b.qmap==='random'&&after==='random'&&!tiles,JSON.stringify({s,sec,qBefore:b.qmap,qAfter:after,tiles}));}
 if(want(8)){await toLobby();await openQ();await page.click('.x-qmap[data-map="haven"]').catch(()=>{});await page.waitForTimeout(300);
  const r=await X(`JSON.stringify((()=>{const W=innerWidth,H=innerHeight,box=e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)]};
   const tiles=[...document.querySelectorAll('#xQueue .x-qmap')],om=document.getElementById('xOnMap');if(om)om.scrollIntoView({block:'nearest'});
   const inX=e=>{const b=e.getBoundingClientRect();return b.left>=-1&&b.right<=W+1&&b.width>0};
   return {W,H,tilesVis:tiles.filter(e=>${VIS}(e)).length,tilesInX:tiles.filter(inX).length,omVis:!!om&&${VIS}(om),omInX:!!om&&inX(om),om:om&&om.value,omBox:om&&box(om),docW:document.documentElement.scrollWidth};})())`).then(JSON.parse);
  await page.screenshot({path:`${SHOT}mapsel-chk8-lobby-640x360.jpg`,type:'jpeg',quality:70,timeout:150000}).catch(()=>{});
  const errs=R.errors.filter(e=>/pageerror/.test(e));
  check('8 lobby 640x360: 6 tiles + Online map select visible and inside the width, select follows the Haven tile, no page errors',r.tilesVis===6&&r.tilesInX===6&&r.omVis&&r.omInX&&r.om==='haven'&&r.docW<=r.W+1&&!errs.length,JSON.stringify({r,errs:errs.slice(0,3)}));}
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
