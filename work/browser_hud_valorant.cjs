// HUD v2 (Valorant layout) browser check: offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW). World rendering is
// skipped between captures (window.__allow gate, as browser_hitfx_check) so the game's JS runs at a usable rate.
// One match, three viewports per state (1280x720, 640x360, 390x844): buy phase (BUY PHASE label, credits), action phase with
// real kill-feed rows (player headshot kill through the real kill() path, a bot-on-ally kill), ult ready, and the round-end
// banner. Per viewport: rects of the HUD blocks, pairwise overlap check, everything inside the viewport, bundled fonts loaded.
//   node work/browser_hud_valorant.cjs <out.json> [prefix]   (screenshots -> work/validation/<prefix>-<state>-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hud.json',PRE=process.argv[3]||'hud',SHOT=ROOT+'/work/validation/';
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
 const frames=async(n,ms=900000)=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:ms,polling:1000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 await X(`{window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 log('match started',await X('JSON.stringify({mode,map:FV.map,bots:bots.length,allies:allies.length,buy:FV.buy,agent:J.pick})'));
 const fonts=await X(`JSON.stringify([document.fonts.check('20px "VS Hud"'),document.fonts.check('20px "VS Title"')])`);log('fonts',fonts);
 const SEL={top:'.x-top',vitals:'.x-bl',abil:'.x-ab',ammo:'.x-br',credits:'#xCr',feed:'#feed',map:'#xMap',teamL:'.x-obc:not(.en)',teamR:'.x-obc.en'};
 const measure=()=>X(`JSON.stringify((()=>{const S=${JSON.stringify(SEL)},o={};for(const k in S){const e=document.querySelector(S[k]);if(!e)continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||!e.offsetParent&&cs.position!=='fixed')continue;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;o[k]=[r.left,r.top,r.right,r.bottom].map(Math.round);}
  o._pp=[...document.querySelectorAll('#xPA i,#xPE i')].map(i=>(i.dataset.a||'?')+(i.classList.contains('dead')?'-':'')+(i.classList.contains('ult')?'*':'')).join('');o._tm=document.getElementById('xTm').textContent;o._bp=document.querySelector('.x-top').classList.contains('x-bpo');
  o._feed=[...document.querySelectorAll('#feed .kf--k')].map(d=>d.textContent+(d.querySelector('.kf__hs')?' [HS]':'')+(d.querySelector('.kf__wb')?' [WB]':''));o._trunc=[...document.querySelectorAll('.x-obn')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);o._hpFont=getComputedStyle(document.getElementById('xHp')).fontFamily.split(',')[0];return o;})())`);
 const verify=(name,w,h,m)=>{const ks=Object.keys(m).filter(k=>k[0]!=='_'),bad=[];for(const k of ks){const r=m[k];if(r[0]<0||r[1]<0||r[2]>w||r[3]>h)bad.push(k+' off-screen '+r);}
  for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=m[ks[i]],b=m[ks[j]];if(a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3])bad.push(ks[i]+' overlaps '+ks[j]);}
  check(`${name} ${w}x${h}: HUD blocks inside the screen and not overlapping`,!bad.length,JSON.stringify(bad));};
 const capture=async(name,opt={})=>{for(const [w,h] of SIZES){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(400);await frames(2);const m=JSON.parse(await measure());log(`${name} ${w}x${h}`,m);if(!opt.noVerify)verify(name,w,h,m);
  await page.screenshot({path:`${SHOT}${PRE}-${name}-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});}await page.setViewportSize({width:SIZES[0][0],height:SIZES[0][1]});};
 // 1. buy phase
 await X('FV.buy=Math.max(FV.buy,30);1');await frames(2);await capture('buy');
 // 2. action phase: end buy, real kills, ult ready
 await X('FV.buy=Math.min(FV.buy,0.2);1');await frames(3);
 await X(`if(!window.__kfw){window.__kfw=1;const st=window.setTimeout;window.setTimeout=function(f,ms,...r){if(window.__kfHold&&(ms===4600||ms===5000||window.__kfHold>1&&ms>=1000&&ms!==7000&&ms!==2200))return 0;return st.call(window,f,ms,...r);};}window.__kfHold=1;bots.concat(allies).forEach(u=>u.nt=true);1`);
 const k=await X(`JSON.stringify((()=>{const v=bots.filter(b=>b.alive);const a=allies.filter(x=>x.alive);const out={};
  if(v[0]){v[0].hp=1;kill(v[0],true);out.hs=v[0].name;}            // player headshot kill (kill() is the real path from shoot())
  if(v[1]){xWB.on=true;xWB.t=performance.now();v[1].hp=1;kill(v[1],false);out.wb=v[1].name;} // wallbang kill (flag as shoot() sets it for a shot through a wall)
  if(a[0]&&v[2]){allyDie(a[0],v[2].name,xWeapOf(v[2]));out.ally=a[0].name;}
  try{J.ult=K().u;}catch(e){} return out;})())`);log('kills',k);
 await frames(3);await page.waitForTimeout(600);await capture('action');
 const m=JSON.parse(await measure());check('kill feed: player headshot row has the headshot mark, wallbang row has the wallbang mark',m._feed.some(t=>/\[HS\]/.test(t))&&m._feed.some(t=>/\[WB\]/.test(t)),JSON.stringify(m._feed));
 check('portraits: ten agent tiles, dead ones marked, own ult ready marked gold',m._pp.replace(/[-*]/g,'').length===10&&/-/.test(m._pp)&&/\*/.test(m._pp),m._pp);
 // 646b1f8 (#xHudNative) sets the in-match --hf to Arial on purpose, so the bundled "VS Hud" face is only used by the round-announcement subtitle (.x-ans)
 // and stays unloaded at match start (diag_hud1: face status 'unloaded', no visible element uses it) - only VS Title must be loaded here.
 check('bundled title font loaded and native HUD uses system sans (no network fonts)',JSON.parse(fonts)[1]===true&&/Arial/.test(m._hpFont),fonts+' '+m._hpFont);
 await X('window.__kfHold=0;1');
 // 3. round end (banner, its hide timer and the next-round timer held for the three captures):
 // the remaining bots die -> ROUND WIN banner
 await X('window.__kfHold=2;1');
 await X(`bots.filter(b=>b.alive).forEach(b=>{b.hp=1;kill(b,false);});1`);
 await page.waitForFunction(()=>window.__xe('document.getElementById("xAnn").classList.contains("on")'),null,{timeout:300000,polling:300}).catch(e=>log('banner wait',String(e).slice(0,100)));
 log('banner',await X('document.querySelector("#xAnn .x-ant").textContent'));
 const rs=await X(`JSON.stringify({running,paused,cov:typeof xCov==='function'?xCov():null,buy:FV.buy,ld:!!window.xLdOn,res:typeof xResUp==='function'?xResUp():null,allow:window.__allow,frame:renderer.info.render.frame})`);log('round end loop state',rs);
 // fCheck's post-round timers (7000 / 2200 ms) are never held: holding them is what froze hud_b6's round (no next round). SwiftShader here takes
 // 10-60 s per 1280x720 frame (diag_hud2: 3.4-3.6 M triangles, rAF ~0.1/s before AND after the wipe), so allow 300 s for two frames.
 const ok=await frames(2,300000).then(()=>true,()=>false);log('round end scene renders',ok);if(!ok){log('round end loop state after 120 s',await X(`JSON.stringify({running,paused,cov:typeof xCov==='function'?xCov():null,buy:FV.buy,frame:renderer.info.render.frame})`));R.checks.push(['round end: the scene keeps rendering under the ROUND WIN banner','FAIL',rs]);}
 else await capture('roundend',{noVerify:true});
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
