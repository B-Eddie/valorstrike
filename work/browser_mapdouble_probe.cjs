// vs-lane-mapdouble probe: load the game (live Vercel or a local index.html), start a match through the real lobby,
// then inventory the scene: roots named native-*, the legacy FMAP groups, visible meshes outside the active native root,
// and a few collision probes (camera ray vs. visible meshes vs. nmBlocked). Screenshot each state.
//   TARGET=live|local MAPS=ascent,bind TAB=dm FAIL=re (regex of urls to abort) node work/browser_mapdouble_probe.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mapdouble.json',SHOT=process.env.SHOT||'/workspace/work/qa/mapdouble/shots/';
const TARGET=process.env.TARGET||'live',BASE=TARGET==='live'?'https://valorstrike.vercel.app/':'http://127.0.0.1:8876/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MAPS=(process.env.MAPS||'ascent').split(','),TAB=process.env.TAB||'dm',FAIL=process.env.FAIL?new RegExp(process.env.FAIL):null,FAILN=+(process.env.FAILN||1e9);
const R={target:TARGET,tab:TAB,steps:[],inv:[],errors:[],aborted:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,proxy:(process.env.HTTPS_PROXY&&TARGET==='live')?{server:'per-context'}:undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const PX=process.env.HTTPS_PROXY||process.env.https_proxy;let proxy;if(TARGET==='live'&&PX){const u=new URL(PX);proxy={server:u.protocol+'//'+u.host,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password),bypass:'127.0.0.1,localhost'};}
 const ctx=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1,proxy,ignoreHTTPSErrors:true});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 if(TARGET!=='live')await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 const inject=h=>h.replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');
 if(TARGET==='live')await ctx.route(/^https:\/\/valorstrike\.vercel\.app\/(index\.html)?(\?.*)?$/,async r=>{const resp=await r.fetch();const h=await resp.text();R.liveIndexLen=h.length;r.fulfill({body:inject(h),contentType:'text/html'});});
 else await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>r.fulfill({body:inject(fs.readFileSync(ROOT+'/index.html','utf8')),contentType:'text/html'}));
 let nfail=0;if(FAIL)await ctx.route(FAIL,r=>{if(nfail++<FAILN&&(!process.env.FAILP||Math.random()<+process.env.FAILP)){R.aborted.push(r.request().url().slice(-80));return r.abort('failed');}return TARGET==='live'?r.continue():r.fallback();});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error'||/map load|Original map/i.test(m.text()))R.errors.push(m.type()+' '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});log('booted',1);
 const VIS=`(e=>!!(e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length))`;
 const INV=`(()=>{const out={roots:[],fmap:{},nm:NM.current?NM.current.key:null,pending:NM.pending?NM.pending.key:null,map:FV.map,mode:typeof mode!=='undefined'?mode:null,running,ld:!!window.xLdOn,overlay:(()=>{const o=document.getElementById('nmOverlay')||NM.progress;return o?{vis:${VIS}(o),txt:(o.textContent||'').slice(0,120)}:null})()};
  for(const c of scene.children){let meshes=0,vis=0,tris=0;c.traverse(o=>{if(o.isMesh){meshes++;let v=true;for(let p=o;p;p=p.parent)if(!p.visible){v=false;break;}if(v){vis++;const g=o.geometry;tris+=g&&g.index?g.index.count/3:(g&&g.attributes&&g.attributes.position?g.attributes.position.count/3:0);}}});
   if(meshes>20||/native|map/i.test(c.name||''))out.roots.push({name:c.name||c.type,uuid:c.uuid.slice(0,6),visible:c.visible,meshes,visMeshes:vis,visTris:Math.round(tris),nativeMap:c.userData&&c.userData.nativeMap||null,isCur:!!(NM.current&&NM.current.M.g===c),isFmap:Object.keys(FMAP).filter(k=>FMAP[k].g===c)});}
  for(const k in FMAP){const f=FMAP[k];out.fmap[k]={built:f.built,native:!!f.native,inScene:!!(f.g&&f.g.parent),vis:!!(f.g&&f.g.visible),solids:f.solids.length,boxes:f.boxes.length};}
  if(NM.current){const mats={};let alphaNoMap=0,alphaNoMapTris=0,opaque=0;const ex=[];NM.current.M.g.traverse(o=>{if(!o.isMesh||!o.visible)return;for(const m of [].concat(o.material||[])){if(!m||m.visible===false)continue;const cut=m.alphaTest>0||m.transparent;if(!cut)continue;const needs=!m.map&&!m.alphaMap;if(needs){alphaNoMap++;const g=o.geometry;alphaNoMapTris+=g&&g.index?g.index.count/3:0;if(ex.length<12)ex.push((o.name||'')+'|'+(m.name||'')+'|at'+m.alphaTest+'|tr'+(+m.transparent)+'|op'+m.opacity);}}});out.alphaNoMap=alphaNoMap;out.alphaNoMapTris=Math.round(alphaNoMapTris);out.alphaEx=ex;}
  out.five=MAPS.five?{native:!!MAPS.five.native,isCur:!!(NM.current&&MAPS.five===NM.current.M),solids:MAPS.five.solids.length}:null;
  try{out.cam=[camera.position.x,camera.position.y,camera.position.z].map(v=>+v.toFixed(2));}catch(e){}
  return JSON.stringify(out);})()`;
 const inv=async tag=>{const r=JSON.parse(await X(INV));R.inv.push([tag,r]);log('inv '+tag,{nm:r.nm,map:r.map,roots:r.roots.length});return r;};
 if(process.env.ONLINE){const MODE=process.env.ONLINE;for(const m of MAPS){const code='QZ'+Math.random().toString(36).slice(2,6).toUpperCase();
  await X(`try{if(running)leave()}catch(e){}J.pick='Jett';MP.name='MapQA';window.xQMap='${m}';MP.map='${m}';MP.mode='${MODE}';netConnect(true,'${code}',false);1`);
  for(let t=0;t<30&&(await X('MP.st'))!=='room';t++)await page.waitForTimeout(1000);log('room',await X('MP.st'));
  if((await X('MP.room&&MP.room.mode'))!==MODE)await X(`netSend({t:'mode',mode:'${MODE}'});1`);await page.waitForTimeout(1500);
  if((await X('MP.room&&MP.room.map'))!==m)await X(`netSend({t:'map',map:'${m}'});1`);await page.waitForTimeout(1500);log('room state',await X('JSON.stringify({mode:MP.room&&MP.room.mode,map:MP.room&&MP.room.map})'));
  await X('mpStart();1');const t0=Date.now();for(let t=0;t<150;t++){const s=await X(`JSON.stringify({st:MP.st,ready:!!NET.ready,run:running,ld:!!window.xLdOn,ag:${VIS}(document.getElementById('xAg'))})`).then(JSON.parse);if(s.st==='game'&&s.run&&!s.ld)break;if(s.ag){await X(`(()=>{const t=[...document.querySelectorAll('#xAg .x-ag')].filter(b=>!b.disabled);if(t.length)t[0].click();return 1})()`);await page.click('#xAgL',{timeout:3000}).catch(()=>{});}if(t%10===5)await inv(m+' online loading t'+t);await page.waitForTimeout(2000);}
  log(m+' online running after s',(Date.now()-t0)/1000);await page.waitForTimeout(5000);await inv(m+' online running');
  await page.screenshot({path:`${SHOT}${TARGET}-online-${MODE}-${m}.jpg`,type:'jpeg',quality:70,timeout:200000}).catch(e=>log('shot',String(e).slice(0,100)));
  await X('try{netLeave&&netLeave()}catch(e){}try{mpLost&&mpLost("qa")}catch(e){}1');await page.waitForTimeout(3000);}
  log('done',1);await browser.close();return;}
 for(const m of MAPS){
  await X('try{if(running)leave()}catch(e){}try{if(document.getElementById("result").style.display!=="none")document.getElementById("lobbyBtn").click()}catch(e){}1');await page.waitForTimeout(2000);
  if(!(await X(`${VIS}(document.getElementById('xQueue'))`)))await page.click('#playBtn',{timeout:20000}).catch(e=>log('playBtn',String(e).slice(0,120)));await page.waitForTimeout(500);
  await page.click(`#xQueue .x-qtabs [data-q="${TAB}"]`,{timeout:20000}).catch(e=>log('tab',String(e).slice(0,120)));
  await page.click(`.x-qmap[data-map="${m}"]`,{timeout:20000}).catch(e=>log('tile',String(e).slice(0,120)));
  await page.click('#xqPlay',{timeout:20000}).catch(e=>log('xqPlay',String(e).slice(0,120)));
  const t0=Date.now();for(let t=0;t<300;t++){const s=await X(`JSON.stringify({run:running&&!window.xLdOn&&!paused,pre:${VIS}(document.getElementById('pre')),ag:${VIS}(document.getElementById('xAg'))})`).then(JSON.parse);
   if(s.run)break;if(t%15===5)await inv(m+' loading t'+t);
   if(await X(`(e=>!!(e&&e.style.display!=='none'&&/Could not load/.test(e.textContent)))(document.getElementById('nativeMapLoading'))`)){await inv(m+' FAILED');R.retries=(R.retries||0)+1;if(R.retries>3)break;
    await page.click('#nativeMapLoading [data-back]',{timeout:10000}).catch(e=>log('back',String(e).slice(0,120)));await page.waitForTimeout(1500);await inv(m+' after back');
    if(!(await X(`${VIS}(document.getElementById('xQueue'))`)))await page.click('#playBtn',{timeout:20000}).catch(e=>log('playBtn2',String(e).slice(0,120)));await page.waitForTimeout(500);
    await page.click(`#xQueue .x-qtabs [data-q="${TAB}"]`,{timeout:20000}).catch(()=>{});await page.click(`.x-qmap[data-map="${m}"]`,{timeout:20000}).catch(()=>{});await page.click('#xqPlay',{timeout:20000}).catch(e=>log('xqPlay2',String(e).slice(0,120)));log('retry start',R.retries);continue;}
   if(s.pre)await page.click('#preGo',{timeout:5000}).catch(()=>{});
   else if(s.ag){await X(`(()=>{const t=[...document.querySelectorAll('#xAg .x-ag')].filter(b=>!b.disabled);if(t.length)t[0].click();return 1})()`);await page.waitForTimeout(300);await page.click('#xAgL',{timeout:5000}).catch(()=>{});}
   await page.waitForTimeout(2000);}
  log(m+' running after s',(Date.now()-t0)/1000);await page.waitForTimeout(4000);
  await inv(m+' running');
  await page.screenshot({path:`${SHOT}${TARGET}-${TAB}-${m}${FAIL?'-fail':''}.jpg`,type:'jpeg',quality:70,timeout:150000}).catch(e=>log('shot',String(e).slice(0,100)));
 }
 log('done',1);await browser.close();
})().catch(e=>{log('fatal',String(e.stack||e).slice(0,500));process.exit(1);});
