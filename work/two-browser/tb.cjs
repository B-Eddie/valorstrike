// Two rendered browsers (two Chromium contexts, real pages) in one room through the local QA bridge.
// A plays AGENT_A, B plays AGENT_B. Needs bridge :8787 (server/tools/browser-bridge.mjs) + static server :8876 at repo root.
//   SCEN=/path/scenario.cjs node tb.cjs out.json
const H=process.env.HOME;const {chromium}=require(process.env.PW||H+'/pw/node_modules/playwright-core'),fs=require('fs');
const ROOT=process.env.ROOT||H+'/vs',QA=H+'/qa/',OUT=process.argv[2]||'/tmp/tb.json',SHOT=process.env.SHOT||'/tmp/shots/';
const AA=process.env.AGENT_A||'Clove',AB=process.env.AGENT_B||'Jett',MAP=process.env.MAP||'ascent';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults','--disable-web-security','--renderer-process-limit=1','--no-zygote','--num-raster-threads=1','--js-flags=--max-old-space-size=350','--disable-site-isolation-trials']});
 let SH=null;const mk=async(name,agent)=>{const ctx=(process.env.SHARECTX&&SH)?SH:await browser.newContext({viewport:{width:480,height:270},deviceScaleFactor:1});if(process.env.SHARECTX)SH=ctx; // SHARECTX: both pages in ONE context = one renderer process; per-page in-memory session token so they are still two players

  if(!ctx.__init){ctx.__init=1;await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}window.__vsLight=1;if(window.name==='')window.__vsNoAgents=true;});}
  await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
  await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
  if(process.env.REDUCED==='1')await ctx.route(/(agents\/[a-z]+\.glb|movement\.(json|bin)|locomotion\.bin|lobby-bg)/,r=>r.abort()); // REDUCED SCOPE: no agent models / movement clips (box has 2 GB; two full pages exceed it)
  if(process.env.NOTEX&&process.env.NOTEX.includes(name))await ctx.route(/maps\/[a-z]+\/(textures\/|geometry-)/,r=>r.abort()); // REDUCED SCOPE: untextured map for this page
  const page=await ctx.newPage();await require(ROOT+'/work/pw_shot.cjs')(ctx,page);page.setDefaultTimeout(300000);
  await page.addInitScript(()=>{const m={},g=Storage.prototype.getItem,st=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return k==='vs.serverToken'?(m[k]||null):g.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='vs.serverToken'){m[k]=v;return;}return st.call(this,k,v);};});
  page.on('pageerror',e=>R.errors.push(name+' pageerror '+String(e).slice(0,300)));
  page.on('console',m=>{if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED|favicon/.test(m.text()))R.errors.push(name+' console '+m.text().slice(0,200));});
  await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
  return {name,agent,page,ctx,X,XJ};};
 const A=await mk('A',AA);log('A loaded',AA);const B=await mk('B',AB);log('B loaded',AB);
 await A.X(`J.pick='${AA}';MP.name='Alpha';window.xQMap='${MAP}';MP.map='${MAP}';mpCreate(false,'five');1`);
 await A.page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:120000});const code=await A.X('MP.code');log('room',code);
 await B.X(`J.pick='${AB}';MP.name='Bravo';mpJoin('${code}');1`);
 await B.page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:120000});
 await A.page.waitForFunction(()=>window.__xe('(MP.room&&MP.room.pl||[]).length>=2'),null,{timeout:60000});log('both in room',await A.X('JSON.stringify((MP.room.pl||[]).map(p=>p.name||p.n))'));
 await A.X('mpStart();1');
 for(const P of [A,B])await P.page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5'),null,{timeout:600000});
 log('both in game',[await A.X('MP.st'),await B.X('MP.st')]);
 const T={A,B,code,qa,log,check,R,browser,SHOT};
 if(process.env.SCEN)await require(process.env.SCEN)(T);
 await browser.close();log('done',1);
})().catch(e=>{R.errors.push('FATAL '+String(e.stack||e).slice(0,600));log('fatal',String(e).slice(0,200));process.exit(1);});
