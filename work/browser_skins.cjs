// Browser acceptance for installed original skin geometry and native rigs; collection/store at three sizes.
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/skins.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// hark-skins browser pass (skins-notes.md browser lists): headless Chromium (SwiftShader, LOW).
// 1. Lobby Collection at 1280x720, 640x360, 390x844: panel inside the viewport, no horizontal overflow, weapon page preview,
//    variant pick; Store page. Screenshots skins-<page>-<WxH>.jpg.
// 2. Offline 5v5 Ascent (Jett): Prime Vandal (variant 1) + BlastX knife given and equipped; FP weapon scene carries the skin
//    native model and matching animation set (F.skin); Y inspects the knife (project inspect window ~3.2 s) and the Classic (2.2 s); G in the buy phase drops the
//    Vandal and the floor gun keeps the skin (scene objects tagged userData.xskId).
//   node work/browser_skins.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const geo=()=>X(`JSON.stringify((()=>{const e=document.getElementById('xSk'),b=e&&e.querySelector('.xsk-body');if(!e)return null;const r=e.getBoundingClientRect();return {r:[r.left,r.top,r.right,r.bottom].map(Math.round),bodyOver:b?b.scrollWidth-b.clientWidth:null,on:getComputedStyle(e).display!=='none',tiles:e.querySelectorAll('button').length,vw:innerWidth,vh:innerHeight};})())`).then(JSON.parse);
 for(const [w,h] of [[1280,720],[640,360],[390,844]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);
  await X(`xskOpen('col');1`);await page.waitForTimeout(1500);let g=await geo();log(`collection ${w}x${h}`,g);
  check(`Collection ${w}x${h}: open, inside the viewport, no horizontal overflow`,g&&g.on&&g.r[0]>=-1&&g.r[2]<=w+1&&g.bodyOver<=1,JSON.stringify(g));
  await page.screenshot({path:`${SHOT}skins-collection-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});
  await X(`xskAct("weapon","Vandal");1`);await page.waitForTimeout(2500);g=await geo();log(`weapon page ${w}x${h}`,g);check(`Collection weapon page ${w}x${h}: no horizontal overflow`,g&&g.bodyOver<=1,JSON.stringify(g));
  await page.screenshot({path:`${SHOT}skins-weapon-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});
  await X(`xskAct("tab",null,"store");1`);await page.waitForTimeout(1500);g=await geo();log(`store ${w}x${h}`,g);check(`Store ${w}x${h}: inside the viewport, no horizontal overflow`,g&&g.on&&g.r[2]<=w+1&&g.bodyOver<=1,JSON.stringify(g));
  await page.screenshot({path:`${SHOT}skins-store-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});await X('xskClose();1');}
 await page.setViewportSize({width:1280,height:720});
 log('give',await X(`JSON.stringify([xskGive('Vandal','prime'),xskEquip('Vandal','prime.1'),xskGive('Knife','blastx'),xskEquip('Knife','blastx'),xskGet('Vandal'),xskGet('Knife')])`));
 await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());bots.concat(allies).forEach(u=>u.nt=true);FV.buy=Math.max(FV.buy,40);FV.cr=9000;1`);
 await X(`window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};1`);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const fpSk=()=>X(`JSON.stringify((()=>{const F=XV.fp;return {ids:F?[F.skin||'standard']:[],w:F&&F.w,kind:F&&F.kind,meshes:F&&F.ws.children.map(o=>o.name),native:!!(F&&F.ws&&F.am&&F.gm)};})())`).then(JSON.parse);
 log('buy',await X(`(()=>{try{fBuy("Vandal")}catch(e){return 'err '+e}return 'ok'})()`));await page.waitForTimeout(800);await frames(2);await page.waitForTimeout(2500);await frames(2);
 let f=await fpSk();log('fp vandal',f);check('Prime Vandal skin on the native first-person weapon',f.native&&f.w==='Vandal'&&f.ids.includes('prime.1'),JSON.stringify(f));
 await page.screenshot({path:`${SHOT}skins-fp-vandal-1280x720.jpg`,type:'jpeg',quality:82,timeout:300000});
 // knife + inspect
 await X('swapW("knife");VM.sw=0;1');await page.waitForTimeout(2000);await frames(2);f=await fpSk();log('fp knife',f);check('BlastX knife skin on the first-person knife',f.native&&f.w==='Knife'&&f.ids.includes('blastx'),JSON.stringify(f));
 await page.keyboard.press('KeyY');await page.waitForTimeout(300);const ki=[];for(let i=0;i<5;i++){ki.push(await X('JSON.stringify({ins:+(VM.ins||0).toFixed(2),insT:VM.insT})'));await frames(1);if(i===1)await page.screenshot({path:`${SHOT}skins-knife-inspect-1280x720.jpg`,type:'jpeg',quality:82,timeout:300000});await page.waitForTimeout(400);}
 log('knife inspect',ki);check('Y inspects the knife (project inspect window ~3.2 s)',ki.some(s=>JSON.parse(s).ins>0)&&ki.some(s=>Math.abs((JSON.parse(s).insT||0)-3.22)<.1),ki.join(' '));
 await X('VM.ins=0;swapW("pis");VM.sw=0;1');await page.waitForTimeout(1500);await page.keyboard.press('KeyY');await page.waitForTimeout(300);const gi=[await X('JSON.stringify({ins:+(VM.ins||0).toFixed(2),insT:VM.insT})')];log('gun inspect',gi);check('Y inspects the Classic (2.2 s)',gi.some(s=>JSON.parse(s).ins>0),gi.join(' '));
 // G drop keeps the skin
 await X('VM.ins=0;swapW("pri");VM.sw=0;1');await page.waitForTimeout(1500);
 const tagged=()=>X(`(()=>{const L=[];scene.traverse(o=>{if(o.userData&&o.userData.xskId&&o.userData.xskId!=='standard')L.push(o.userData.xskId+'@'+(o.parent===scene?'scene':(o.parent&&o.parent.type)));});return JSON.stringify(L);})()`).then(JSON.parse);
 const t0=await tagged();await page.keyboard.press('KeyG');await page.waitForTimeout(1000);await frames(2);const t1=await tagged();log('drop',{before:t0,after:t1,held:await X('typeof curW!=="undefined"?curW:null')});
 check('G drop: the floor Vandal keeps the Prime skin',t1.filter(s=>/prime/.test(s)).length>=1&&t1.length>=t0.length,JSON.stringify({t0,t1}));
 await page.screenshot({path:`${SHOT}skins-g-drop-1280x720.jpg`,type:'jpeg',quality:82,timeout:300000});
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
