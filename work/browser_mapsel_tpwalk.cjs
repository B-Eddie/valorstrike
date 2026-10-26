// Evidence for hark-mapsel (map selection always loads Ascent) and hark-anim (TP waist stretch: feet move, upper body static),
// headless Chromium (SwiftShader, LOW) at 640x360, real lobby clicks.
// A. For each MAPS (default bind,haven): #playBtn -> queue panel map tile .x-qmap[data-map=<m>] -> START (#xqPlay) -> pre
//    screen / agent select (first agent, lock) -> match. Records the tile state, FV.pick before START, the pre-screen map title,
//    and after load FV.map, the native map key (xNativeMaps.state.current), so the loaded map is known. check = loaded == picked.
// B. In the first loaded match: an ally bot walking, filmed from the side (probe camera 4 m to its right, rendering the real
//    scene) at ~6 samples; per sample the world positions of hips / spine / head / feet bones. A waist stretch shows as the
//    hips-to-head distance changing while the feet move (upper body left behind). Screenshots work/validation/tpwalk-side-<i>.jpg.
//   node work/browser_mapsel_tpwalk.cjs <out.json>   env MAPS=bind,haven
// Visibility uses computed style + client rects: #pre / #xAg are position:fixed, so offsetParent is always null (mapsel1 never clicked GO).
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/mapsel.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const MAPS=(process.env.MAPS||'bind,haven').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const vis=sel=>X(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return (e=>!!(e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length))(e);})()`);
 const st=()=>X(`JSON.stringify({pick:FV.pick,map:FV.map,nm:(()=>{try{const c=window.xNativeMaps&&window.xNativeMaps.state.current;return c?(c.key||c.meta&&c.meta.key||c.meta&&c.meta.name||null):null}catch(e){return 'err'}})(),preMh:(document.getElementById('preMh')||{}).textContent,preMt:(document.getElementById('preMt')||{}).textContent,xQPick:window.xQPick||null,running,ld:!!window.xLdOn})`).then(JSON.parse);
 let first=true;
 for(const m of MAPS){
  if(!(await vis('#xQueue')))await page.click('#playBtn',{timeout:20000}).catch(e=>log('playBtn',String(e).slice(0,120)));
  await page.waitForTimeout(500);
  await page.click(`.x-qmap[data-map="${m}"]`,{timeout:20000}).catch(e=>log('map tile',String(e).slice(0,160)));
  const tile=await X(`JSON.stringify([...document.querySelectorAll('.x-qmap')].map(b=>[b.dataset.map,b.getAttribute('aria-pressed')]))`);log(m+' tiles after click',tile);
  log(m+' before START',await st());
  await page.click('#xqPlay',{timeout:20000}).catch(e=>log('xqPlay',String(e).slice(0,120)));
  // pre screen / agent select, as a user would
  for(let t=0;t<600;t++){const s=await X(`JSON.stringify({run:running&&!window.xLdOn&&bots.length>0,pre:(e=>!!(e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length))(document.getElementById('pre')),ag:(e=>!!(e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length))(document.getElementById('xAg'))})`).then(JSON.parse);
   if(s.run)break;
   if(s.pre){if(t%10===0)log(m+' pre screen',await st());await page.click('#preGo',{timeout:5000}).catch(()=>{});}
   else if(s.ag){await X(`(()=>{const t=[...document.querySelectorAll('#xAg .x-ag')].filter(b=>!b.disabled);if(t.length)t[0].click();return 1})()`);await page.waitForTimeout(300);await page.click('#xAgL',{timeout:5000}).catch(()=>{});}
   await page.waitForTimeout(2000);}
  const s=await st();log(m+' loaded',s);
  const loaded=s.nm||s.map;
  check(`lobby queue: pick ${m}, START -> the match loads ${m} (loaded: map ${s.map}, native ${s.nm})`,String(loaded).toLowerCase().includes(m)&&s.map===m,JSON.stringify(s));
  await page.screenshot({path:`${SHOT}mapsel-${m}-640x360.jpg`,type:'jpeg',quality:60,timeout:150000}).catch(e=>log('shot',String(e).slice(0,100)));
  if(first&&s.running&&process.env.TPWALK==='1'){first=false; // B is opt-in (TPWALK=1): animation work on hold (25 Oct 20:34 EDT)
   // B. TP bot walking, side view
   await X(`bots.concat(allies).forEach(u=>u.nt=false);FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};
    window.__sc=new THREE.PerspectiveCamera(60,640/360,.05,200);const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene&&window.__side)return r0.call(this,sc,window.__sc);return r0.call(this,sc,c);};1`);
   const samp=()=>X(`JSON.stringify((()=>{const pool=allies.concat(bots).filter(u=>u.alive&&u.g);let b=window.__wb&&pool.includes(window.__wb)?window.__wb:null;if(!b){b=pool.sort((a,c)=>Math.hypot(c.vx||0,c.vz||0)-Math.hypot(a.vx||0,a.vz||0))[0];window.__wb=b;}if(!b)return null;
    const q=b.g.position,yw=b.g.rotation.y,rx=Math.cos(yw),rz=-Math.sin(yw);window.__sc.position.set(q.x+rx*4,q.y+1.1,q.z+rz*4);window.__sc.lookAt(q.x,q.y+0.95,q.z);window.__sc.updateMatrixWorld(true);window.__side=1;
    const v=new THREE.Vector3(),B={};b.g.updateMatrixWorld(true);b.g.traverse(o=>{if(!o.isBone)return;const n=o.name.toLowerCase();for(const [k,re] of [['hips',/pelvis|hips?$/],['spine',/spine.?2|spine_?03|chest/],['head',/^head$|head$/],['footL',/foot.?l|l.?foot|left.?foot/],['footR',/foot.?r|r.?foot|right.?foot/]])if(!B[k]&&re.test(n)){o.getWorldPosition(v);B[k]=[+(v.x-q.x).toFixed(3),+(v.y-q.y).toFixed(3),+(v.z-q.z).toFixed(3)];B[k+'Nm']=o.name;}});
    return {who:b.name,pos:[+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2)],speed:+Math.hypot(b.vx||0,b.vz||0).toFixed(2),B};})())`).then(JSON.parse);
   const S=[];for(let i=0;i<6;i++){const a=await samp();S.push(a);await page.screenshot({path:`${SHOT}tpwalk-side-${i}-640x360.jpg`,type:'jpeg',quality:70,timeout:150000}).catch(e=>log('shot',String(e).slice(0,100)));await page.waitForTimeout(350);}
   await X('window.__side=0;1');log('tp walk side samples',S);
   const d=(a,b)=>a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):null,hh=S.map(s=>s&&d(s.B.hips,s.B.head)),fs_=S.map(s=>s&&d(s.B.footL,s.B.footR));
   log('tp walk hips-head / foot-foot distances',{hh,fs:fs_});
   R.checks.push(['TP walk side view recorded (evidence for hark-anim; no pass rule: hips-head distance per sample, feet spread per sample)','info',JSON.stringify({hh,fs:fs_,moving:S.map(s=>s&&s.speed)})]);
  }
  await X('try{leave()}catch(e){}1');await page.waitForTimeout(3000);
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
