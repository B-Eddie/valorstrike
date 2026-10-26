// Combat / ability browser checks for the hark-combat 856c915 + hark-abil 2822983 merges: offline 5v5 on Ascent as Sova,
// headless Chromium (SwiftShader, LOW), world render gated. 1) landing spread: a real Space jump, the page's gSpread / player.ls
//    sampled every frame: +landSpread for ~0.225 s after touchdown then back to the standing cone. 2) Sova Q: equip (KeyQ), FIRE held
//    (the real xEqFire / fireHeld path) -> #xBow on, charge bar grows; ALT FIRE x2 -> 2 bounce pips; release -> bolt traced with
//    2 bounces, aimed at the nearest wall (first bounce on that wall). 3) a 1.1 s equip (Breach Flashpoint): hand / gun-down
//    curve per frame is monotone with no step, ready at ~1.1 s.  node work/browser_combat_abil.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/ca.json',PRE=process.argv[3]||'hud',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:SIZES[0][0],height:SIZES[0][1]},deviceScaleFactor:1});
 // hk-32: harness time dilation (browser_newmain2.cjs): window.__ts scales performance.now. The bow's hold timer (J.eq.h += the tick's
// real-clock dt, capped by XRT.max) advanced 5.25 s in the first ~1 s SwiftShader frame of ca2 while the script's game-time wait counted
// 0.3 s of sim steps, so the charge bar read 100% at both samples (harness, not game: at 60 fps the two clocks agree).
await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 // hk-30: the shared box runs ~0.25-1 rAF/s even with the world render gated (ca1: one vmTick in 4 s), so every wait and sample is
 // in GAME time: xSimStep (each <= 0.05 s sim step; the page's xSimRun calls it by name) is wrapped to count sim time and run a probe.
 const simWait=async(sec,why)=>{const t=+(await X('window.__sim||0'));await page.waitForFunction(t=>window.__xe('window.__sim||0')>=t,t+sec,{timeout:900000,polling:200}).catch(e=>log('simWait '+(why||sec)+' timeout',String(e).slice(0,80)));};
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';J.pick='Sova';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 await X(`{window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await X(`if(!window.__simH){window.__simH=1;window.__sim=0;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;if(window.__probe)try{window.__probe(d);}catch(e){window.__perr=String(e);}return r;};}1`);
 log('match started',await X('JSON.stringify({mode,map:FV.map,agent:J.pick,buy:FV.buy})'));
 await X('FV.buy=Math.min(FV.buy,0.2);timeLeft=999;bots.forEach(b=>{b.nt=true;});1');await frames(3);await page.waitForTimeout(1500);
 // keep enemies away and passive: park them far from the player
 await X('bots.forEach((b,i)=>{b.g.position.set(player.x+200+i*3,player.y-50,player.z+200);b.see=0;});1');
 // 1. landing spread
 await X(`window.__ls=[];window.__probe=d=>{window.__ls.push([+d.toFixed(4),player.air?1:0,+(player.ls||0).toFixed(3),gSpread('Classic',WEAP.Classic),player.y]);};1`);
 await simWait(0.4,'pre-jump');await page.keyboard.down('Space');await simWait(0.15,'space held');await page.keyboard.up('Space');await simWait(2,'jump');
 let L=JSON.parse(await X('window.__probe=null;JSON.stringify(window.__ls)'));
 if(!L.some(r=>r[1])){log('Space key did not jump; using the page jump input (keys.Space)',1);await X(`window.__ls=[];window.__probe=d=>{window.__ls.push([+d.toFixed(4),player.air?1:0,+(player.ls||0).toFixed(3),gSpread('Classic',WEAP.Classic),player.y]);};keys.Space=true;1`);await simWait(0.2,'keys.Space');await X('keys.Space=false;1');await simWait(2,'jump 2');L=JSON.parse(await X('window.__probe=null;JSON.stringify(window.__ls)'));}
 {const base=L.find(r=>!r[1])?.[3];let land=-1;for(let i=1;i<L.length;i++)if(L[i-1][1]&&!L[i][1]){land=i;break;}
  let tls=0,peak=0;if(land>=0){for(let i=land;i<L.length&&L[i][2]>0;i++){tls+=L[i][0];peak=Math.max(peak,L[i][3]);}}
  const after=land>=0?L.slice(land).find(r=>r[2]===0):null,ratio=base?peak/base:0;
  log('landing',{base,peak,ratio,tls,after:after&&after[3],frames:L.length,land});
  check('landing adds spread for ~0.225 s after touchdown, then the standing cone returns',land>=0&&peak>base*1.05&&tls>.12&&tls<.45&&after&&Math.abs(after[3]-base)<1e-6,JSON.stringify({base,peak,tls:+tls.toFixed(3),after:after&&after[3]}));}
 // 2. Sova Q: aim at the nearest wall
 const aim=JSON.parse(await X(`JSON.stringify((()=>{let best=null;for(let k=0;k<24;k++){const a=k*Math.PI/12;const d=new THREE.Vector3(-Math.sin(a),0,-Math.cos(a));ray.set(pEye(),d);ray.far=30;const h=ray.intersectObjects(solids)[0];if(h&&h.distance>4&&(!best||h.distance<best.d))best={a,d:h.distance};}if(best){yaw=best.a;pitch=0.02;}return best;})())`));log('wall',aim);
 await X(`window.__bp=null;{const p0=xBoltPath;xBoltPath=function(){const P=p0.apply(this,arguments);window.__bp={pts:P.pts,t:P.t,args:[arguments[2],arguments[3]]};return P;};}J.q=Math.max(J.q||0,1);J.cd.q=0;1`);
 await page.keyboard.down('KeyQ');await simWait(0.1,'KeyQ');await page.keyboard.up('KeyQ');
 log('equip',await X('JSON.stringify(J.eq&&{k:J.eq.k,st:J.eq.st,d0:J.eq.d0})'));
 await page.waitForFunction(()=>window.__xe('J.eq&&J.eq.st==="ready"'),null,{timeout:60000,polling:100}).catch(e=>log('ready wait',String(e).slice(0,80)));
 await X('window.__ts=0.05;1');await frames(1);/* the frame after the switch still carries 1x time */
 await X('fireHeld=true;xEqFire(false);1');await simWait(0.3,'bow hold');
 const h1=JSON.parse(await X(`JSON.stringify({st:J.eq&&J.eq.st,h:J.eq&&J.eq.h,on:$('xBow').classList.contains('on'),w:$('xBow').querySelector('b').style.width})`));
 await X('xEqFire(true);1');await simWait(0.15,'alt 1');await X('xEqFire(true);1');await simWait(0.7,'bow hold 2');
 const h2=JSON.parse(await X(`JSON.stringify({st:J.eq&&J.eq.st,h:J.eq&&J.eq.h,bn:J.eq&&J.eq.bn,on:$('xBow').classList.contains('on'),w:$('xBow').querySelector('b').style.width,pips:[...$('xBow').querySelectorAll('u')].map(u=>u.className)})`));
 await X('window.__ts=1;1');log('bow',{h1,h2});
 for(const [w,h] of SIZES){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);await frames(1);await page.screenshot({path:`${SHOT}sova-bow-hud-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:300000});}
 await page.setViewportSize({width:SIZES[0][0],height:SIZES[0][1]});
 check('Sova Q held: #xBow shown, charge bar grows while FIRE is held',h1.on&&h2.on&&parseFloat(h2.w)>parseFloat(h1.w),JSON.stringify({h1:h1.w,h2:h2.w}));
 check('ALT FIRE twice: two bounces selected',h2.bn===2,JSON.stringify(h2));
 await X('fireHeld=false;1');await page.waitForFunction(()=>window.__xe('!!window.__bp'),null,{timeout:60000,polling:200}).catch(e=>log('bolt wait',String(e).slice(0,80)));
 const bp=JSON.parse(await X('JSON.stringify(window.__bp)'));log('bolt',bp);
 if(bp&&aim){const p0=bp.pts[0],b1=bp.pts[1];const dh=b1?Math.hypot(b1[0]-p0[0],b1[2]-p0[2]):0;
  check('released bolt: 2 bounces traced, the first on the aimed wall',bp.args[1]===2&&bp.pts.length===4&&Math.abs(dh-aim.d)<1.5,JSON.stringify({nb:bp.args[1],pw:bp.args[0],pts:bp.pts.length,firstBounce:+dh.toFixed(2),wall:+aim.d.toFixed(2)}));}
 else check('released bolt: 2 bounces traced, the first on the aimed wall',false,JSON.stringify({bp,aim}));
 // 3. 1.1 s equip (Breach Flashpoint, XAB_EQT): per-frame curve
 await page.waitForFunction(()=>window.__xe('!J.eq'),null,{timeout:60000,polling:200}).catch(()=>{});
 // The FP ability viewmodel is the agent's own native rig since f95aa9e (legacy xCaHand box hand removed): its equip clip is posed at
 // u = xAfPhase(set, J.eq).u, which is sampled per sim step here; a step in u is a pop in the hand rise.
 await X(`J.pick='Breach';J.q=Math.max(J.q||0,1);J.cd.q=0;window.__eq=[];window.__probe=d=>{const q=J.eq;if(!q)return;const sp=xAfSpec('Breach',q.k),set=XAF_SET[sp.s]||XAF_SET.nade,P=xAfPhase(set,q,XABT.rel,XABT.rec);window.__eq.push([+d.toFixed(4),q.st,+q.t.toFixed(4),q.d0,P?P.ph:null,P?+P.u.toFixed(4):null]);};1`);
 await page.keyboard.down('KeyQ');await simWait(0.1,'KeyQ breach');await page.keyboard.up('KeyQ');await simWait(1.6,'breach equip');
 const E=JSON.parse(await X('window.__probe=null;JSON.stringify(window.__eq)'));
 const rig=await X('JSON.stringify({last:XAF.last,on:XAF.on,err:XAF.err})').catch(e=>String(e).slice(0,80));
 {const D=E.filter(r=>r[1]==='draw');let steps=[];for(let i=1;i<D.length;i++)steps.push(Math.abs(D[i][5]-D[i-1][5])/Math.max(1e-3,D[i][0]));
  const tReady=E.reduce((a,r)=>r[1]==='draw'?a+r[0]:a,0),mono=D.every((r,i)=>i===0||r[5]>=D[i-1][5]-1e-6),maxRate=Math.max(0,...steps),d0=D[0]&&D[0][3];
  log('equip 1.1',{frames:E.length,draw:D.length,d0,tReady,maxRate,mono,sample:E.slice(0,6),rig});
  check('Breach Q equip draws over its wiki 1.1 s (d0) and reaches ready',D.length>0&&Math.abs((d0||0)-1.1)<1e-6&&E.some(r=>r[1]==='ready')&&Math.abs(tReady-1.1)<0.12,JSON.stringify({d0,tReady:+tReady.toFixed(3),states:[...new Set(E.map(r=>r[1]))]}));
  check('equip viewmodel: ability-rig equip clip rises monotonically over d0 with no step (du/dt <= 1.5/d0)',D.length>3&&mono&&d0&&maxRate<=1.5/d0,JSON.stringify({maxRate:+maxRate.toFixed(3),limit:d0?+(1.5/d0).toFixed(3):null,frames:D.length,mono}));}
 log('done',1);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
