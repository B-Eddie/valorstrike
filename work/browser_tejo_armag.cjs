// Tejo impact evidence, headless Chromium (SwiftShader, LOW) - the capture path for the Guided Salvo
// detonations and the Armageddon fire front at known camera-facing points (offline 5v5 Ascent).
// The salvo 'burst' rings and the 'armagwave' front are the offline impact visuals; before they existed
// the effects were damage+sound only. Screenshots: /tmp/tejo_salvo_impact.png, /tmp/tejo_armag_wave.png,
// /tmp/tejo_salvo_map.png. Log JSON: argv[2] || /tmp/tejo_armag.json. Needs a static server for the repo on :8876.
const PW=process.env.PWDIR||'/home/sandbox/pw/node_modules/playwright-core';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),QA=process.env.QADIR||'/home/sandbox/qa/',OUT=process.argv[2]||'/tmp/tejo_armag.json';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const R={steps:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([+((Date.now()-t00)/1000).toFixed(1),k,typeof v==='string'?v.slice(0,400):v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.log(((Date.now()-t00)/1000).toFixed(1),k,typeof v==='string'?v.slice(0,200):JSON.stringify(v).slice(0,200));};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{window.__vsLight=1;try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f]&&fs.existsSync(LOCAL[f]))return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 await ctx.route(/models\/valorant\/agents\//,r=>r.abort());
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);
 page.on('pageerror',e=>{R.errors.push(String(e).slice(0,300));log('pageerror',String(e).slice(0,200));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async n=>{await frames(2);await page.screenshot({path:'/tmp/'+n+'.png',timeout:150000}).catch(e=>log('shot '+n+' failed',String(e).slice(0,120)));};
 const cap=async n=>{await X('window.__shotHold=1;1');await X('window.__allow=1;renderer.render(scene,camera);1');
  await page.screenshot({path:'/tmp/'+n+'.png',timeout:150000}).catch(e=>log('shot '+n+' failed',String(e).slice(0,120)));await X('window.__shotHold=1;1');};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets','loaded');
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';J.pick='Tejo';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn'),null,{timeout:1200000,polling:1000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await X(`if(!window.__fxh){window.__fxh=1;const F=J.a18fx||(J.a18fx=[]),p0=F.push;F.push=function(...a){const r=p0.apply(this,a);if(a.some(f=>f&&(f.kind==='burst'||f.kind==='armagwave')))window.__ts=window.__frz||0.02;return r;};}1`);
 log('match started',await X('JSON.stringify({mode,map:FV.map,agent:J.pick,failures:(xValorantAssets.probe().failures||[]).length})'));
 // vantage: a nav node with a 13 m clear lane ahead and two open ground targets in it
 const V=await XJ(`(()=>{const C=nmActive();let best=null;
  C.nav.nodes.forEach((n,i)=>{if(best||(C.playable&&!C.playable[i]))return;
   for(let a=0;a<16;a++){const yw=a*Math.PI/8,dx=-Math.sin(yw),dz=-Math.cos(yw);
    let clr=true;for(let r=1;r<=14;r+=0.5)if(blocked(n[0]+dx*r,n[2]+dz*r,0.35,n[1])){clr=false;break;}
    if(!clr)continue;
    const p1=[n[0]+dx*9,n[2]+dz*9],p2=[n[0]+dx*12-dz*3.5,n[2]+dz*12+dx*3.5];
    if(blocked(p1[0],p1[1],0.6,n[1])||blocked(p2[0],p2[1],0.6,n[1]))continue;
    best={x:n[0],y:n[1],z:n[2],yaw:yw,p1,p2};break;}});
  return best;})()`);
 if(!V){log('FATAL','no vantage with a clear 14 m lane');process.exit(1);}
 log('vantage',JSON.stringify(V));
 await X(`player.x=${V.x};player.z=${V.z};player.y=${V.y};yaw=${V.yaw};pitch=0.12;bots.forEach(b=>{b.cd=1e9;b.g.position.x+=200;});allies.forEach(a=>{a.cd=1e9;a.g.position.x+=200;});FV.buy=0.1;1`);
 await frames(2);
 // Guided Salvo: E opens the map, two programmatic picks fire both salvos
 await X('window.__ts=8;J.e=2;J.cd.e=0;1');
 await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>window.__xe('xTac.on()&&A18TAC.mode==="salvo"'),null,{timeout:60000,polling:200});log('salvo map','open');
 await X(`xTac.st.o.confirm(${V.p1[0]},${V.p1[1]});1`);
 await X(`if(xTac.st.o.confirm(${V.p2[0]},${V.p2[1]}))xTac.close();1`);
 log('salvo fired',await X('JSON.stringify({on:xTac.on(),fx:(J.a18fx||[]).map(f=>f.kind)})'));
 await X('window.__shotHold=1;1');
 log('salvo step',await X('window.__frz=0.02;let i=0;for(;i<40&&!(J.a18fx||[]).some(f=>f.kind==="burst");i++)xSimStep(0.05);JSON.stringify({steps:i,fx:(J.a18fx||[]).map(f=>({k:f.kind,t:f.t&&+f.t.toFixed(2)}))})'));
 log('salvo impact',await X('JSON.stringify({ts:window.__ts,hooked:String(J.a18fx&&J.a18fx.push).includes("__frz"),fx:(J.a18fx||[]).map(f=>({k:f.kind,x:f.p&&+f.p.x.toFixed(1),z:f.p&&+f.p.z.toFixed(1),left:f.left}))})'));
 await cap('tejo_salvo_impact');
 await X('(J.a18fx||[]).forEach(f=>{if(f.m)try{jRel(f.m)}catch(e){}});J.a18fx.length=0;window.__ts=8;1');
 // Armageddon: X opens the map, one pick sets the origin ahead, the wave sweeps toward/past Tejo
 await X(`J.ult=K().u;J.cd.x=0;1`);
 await page.keyboard.press('KeyX');
 await page.waitForFunction(()=>window.__xe('xTac.on()&&A18TAC.mode==="armag"'),null,{timeout:60000,polling:200});log('armag map','open');
 const ax=V.x+-Math.sin(V.yaw)*7,az=V.z+-Math.cos(V.yaw)*7;
 await X(`if(xTac.st.o.confirm(${ax},${az}))xTac.close();1`);
 log('armag fired',await X('JSON.stringify({on:xTac.on(),fx:(J.a18fx||[]).map(f=>f.kind)})'));
 log('armag step',await X('let i=0;for(;i<200&&!(J.a18fx||[]).some(f=>f.kind==="armagchain");i++)xSimStep(0.05);let j=0;for(;j<80&&(J.a18fx||[]).some(f=>f.kind==="armagchain"&&f.age<1.99);j++)xSimStep(0.05);JSON.stringify({windup_steps:i,chain_steps:j,fx:(J.a18fx||[]).map(f=>({k:f.kind,age:f.age&&+f.age.toFixed(2),fired:f.fired&&f.fired.filter(Boolean).length,op:f.grp&&f.grp.segs.map(m=>+m.material.opacity.toFixed(2))}))})'));
 await cap('tejo_armag_chain');
 log('done',await X('JSON.stringify({failures:String(xValorantAssets.probe().failures).slice(0,200)})'));
 await browser.close();process.exit(0);
})().catch(e=>{log('FATAL',String(e&&e.stack||e));process.exit(1);});
