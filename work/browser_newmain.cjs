// New-on-main features in the rendered page, headless Chromium (SwiftShader, LOW), offline 5v5 Bind at 1280x720, real keys / mouse.
// World rendering skipped between captures (window.__allow); the game loop runs. Agents are switched in the match (jRound).
// A. Bind rock bump (7add113, map-notes browser item 12): node (-53.25, 7.55, 21) on a 0.65 m bump over the 6.9 m floor.
//    Walking off it NW / NNW / WNW stops at the rim like a wall (no drop into the crevice, no wedge: walks straight back out
//    >= 0.7 m without jumping); off it east / south still works (leaves the bump, lands on the floor); from the floor to the
//    south-east it walks up onto the bump.
// B. FP ability arms (f95aa9e): Killjoy C / Raze E / Sova Q equipped with the real key -> the ability viewmodel is the agent's own
//    native FP rig (XAF.last.rig, a SkinnedMesh under the camera, item in the hand), no legacy primitive hand (xCaHand / XEQV gone);
//    FIRE throws it and the gun rig comes back.
// C. Sova Hunter's Fury manual fire (ede3341): X then FIRE = cast + first blast (2 charges left); no automatic blasts while waiting;
//    FIRE again after the 2.125 s cycle shoots the next; FIRE inside the cycle does nothing; unfired charges are lost 6 s after the cast.
// D. Knife combo (61c6259): knife out (real 3), light swings ~0.55 s apart play attack 1 -> 2 -> 3 -> 1 (Attack 1 ends right,
//    2 slashes left, 3 returns right: sides are asserted on the rig by test_knife_combo), a pause past 0.65 s restarts at attack 1,
//    the montage returns to idle by XVK.light (1.0 s).
//   node work/browser_newmain.cjs <out.json>   (screenshots work/validation/newmain-*.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),PORT=process.env.PORT||'8876',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/newmain.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const ONLY=(process.env.ONLY||'A,B,C,D').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=s=>X('JSON.stringify('+s+')').then(JSON.parse);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async(n)=>{await frames(2);await page.screenshot({path:`${SHOT}newmain-${n}-1280x720.jpg`,type:'jpeg',quality:82,timeout:150000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
 const until=async(expr,ms,step=100)=>{const t=Date.now();while(Date.now()-t<ms){if(await X(expr))return true;await page.waitForTimeout(step);}return false;};
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='bind';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await frames(2);log('loaded',await XJ('{map:FV.map,bots:bots.length}'));await page.mouse.move(640,360);
 const keep=()=>X('window.__god=1;if(typeof timeLeft!=="undefined")timeLeft=900;player.hp=100;1');
 const pick=a=>X(`J.pick=${JSON.stringify(a)};jRound(false);J.c=K().mx.c||1;J.q=K().mx.q||1;J.e=Math.max(1,K().mx.e||1);J.cd={c:0,q:0,e:0,x:0};player.hp=100;J.eq=null;BC.fq=[];J.cbs=[];1`);

 // A. Bind rock bump
 if(ONLY.includes('A')){
  const N=[-53.25,7.55,21];
  const place=(p,yw)=>X(`player.x=${p[0]};player.y=${p[1]};player.z=${p[2]};player.vx=player.vz=0;player.vy=0;yaw=${yw};pitch=0;keys.KeyW=false;keys.Space=false;keys.ControlLeft=false;1`);
  const pos=()=>XJ('[+player.x.toFixed(2),+player.y.toFixed(2),+player.z.toFixed(2)]');
  const yawTo=(dx,dz)=>Math.atan2(-dx,-dz);
  const walk=async(ms)=>{const S=[await pos()];await X('keys.KeyW=true;1');const t=Date.now();while(Date.now()-t<ms){await page.waitForTimeout(150);S.push(await pos());}await X('keys.KeyW=false;1');await page.waitForTimeout(250);S.push(await pos());return S;};
  const along=(S,o,d)=>S.map(p=>(p[0]-o[0])*d[0]+(p[2]-o[2])*d[1]);
  await keep();await place(N,0);await page.waitForTimeout(600);const settle=await pos();log('bump node settle',settle);
  check('Bind bump: the node stands on the bump (y >= 7.4 after settling)',settle[1]>=7.4&&Math.hypot(settle[0]-N[0],settle[2]-N[2])<0.3,JSON.stringify(settle));
  for(const d0 of [[-0.71,0.71],[-0.38,0.92],[-0.92,0.38]]){const l=Math.hypot(...d0),d=[d0[0]/l,d0[1]/l];await keep();await place(N,yawTo(d[0],d[1]));await page.waitForTimeout(400);
   const S=await walk(1400),a=along(S,N,d),end=S[S.length-1],minY=Math.min(...S.map(p=>p[1]));
   if(d0[0]===-0.71)await shot('bind-bump-rim');
   await X(`yaw=${yawTo(-d[0],-d[1])};1`);const B=await walk(1000),back=Math.max(...along(B,end,[-d[0],-d[1]]));
   const wedge=Math.hypot(end[0]+53.49,end[2]-21.32)<0.12&&end[1]<7.48;
   log('bump walk '+d0,{a:a.map(v=>+v.toFixed(2)),end,minY,back:+back.toFixed(2),B:B[B.length-1]});
   check(`Bind bump: walking off toward (${d0}) - no wedge in the crevice (not stuck at -53.49, 21.32) and walks straight back out >= 0.7 m without jumping`,!wedge&&back>=0.7,JSON.stringify({end,minY,back,wedge}));
   check(`Bind bump: walking toward (${d0}) the rim stops you like a wall or you step down to the floor - never sunk into the crevice (y >= 6.8, ends on bump >= 7.4 or the floor <= 7.1 clear of the clip box)`,minY>=6.8&&(end[1]>=7.4||!(end[0]>-53.9&&end[0]<-53.2&&end[2]>21.35&&end[2]<21.75)),JSON.stringify({end,minY}));}
  for(const [nm,d] of [['east',[1,0]],['south',[0,-1]]]){await keep();await place(N,yawTo(d[0],d[1]));await page.waitForTimeout(400);const S=await walk(1200),a=along(S,N,d),end=S[S.length-1];
   log('bump off '+nm,{a:a.map(v=>+v.toFixed(2)),end});check(`Bind bump: walks off ${nm} (>= 1 m, ends below the bump top)`,Math.max(...a)>=1&&end[1]<7.45,JSON.stringify({max:Math.max(...a),end}));}
  {const F0=[N[0]+1.6,7.3,N[2]-1.6];await keep();await place(F0,yawTo(-0.71,0.71));await page.waitForTimeout(700);const f0=await pos();const S=await walk(1500),maxY=Math.max(...S.map(p=>p[1])),end=S[S.length-1];
   log('bump up from SE floor',{f0,end,maxY,S});check('Bind bump: from the floor to the south-east walks up onto the bump (reaches y >= 7.4)',f0[1]<7.2&&maxY>=7.4,JSON.stringify({f0,end,maxY}));}
 }

 // B. FP ability arms
 if(ONLY.includes('B')){
  await X('player.x=-53.25+6;player.z=21-6;player.y=7.3;1').catch(()=>{});
  for(const [ag,key] of [['Killjoy','KeyC'],['Raze','KeyE'],['Sova','KeyQ']]){
   await keep();await pick(ag);await frames(1);await page.keyboard.press('Digit1').catch(()=>{});await page.waitForTimeout(400);
   await page.keyboard.press(key);const ok=await until('typeof XAF!=="undefined"&&XAF.on&&XAF.last&&XAF.last.rig===true&&J.eq&&(J.eq.st==="ready"||J.eq.st==="hold")',45000,200);
   const st=await XJ(`(()=>{const R=XAF.cur;let sk=0,vis=0;if(R&&R.root)R.root.traverse(o=>{if(o.isSkinnedMesh)sk++;});vis=!!(R&&R.root&&R.root.visible&&R.root.parent===camera);
     const it=XAF.last;return {on:XAF.on,mode:XAF.mode,last:it,eq:J.eq&&J.eq.st,sk,vis,err:XAF.err,legacy:typeof xCaHand!=='undefined'||typeof XEQV!=='undefined'||typeof xEqItem!=='undefined',gunFP:!!(XV.fp&&XV.fp.root.visible)};})()`);
   const ti=Date.now(),itemOk=ok&&await until('XAF.on&&XAF.last&&XAF.last.item===true',30000,200);st.itemWaitMs=Date.now()-ti;st.itemNow=await X('!!(XAF.last&&XAF.last.item)');
   log(ag+' '+key+' equipped',st);await shot('arms-'+ag.toLowerCase()+'-'+key[3].toLowerCase());
   check(`${ag} ${key[3]}: ability drawn by the agent's own native FP arms (rig loaded, SkinnedMesh under the camera, item in hand within 30 s of the prop glb load, gun rig hidden, no legacy box hand)`,ok&&itemOk&&st.last&&st.last.ag===ag&&st.sk>0&&st.vis&&!st.gunFP&&!st.legacy&&!st.err,JSON.stringify(st));
   await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();
   const off=await until('!XAF.on&&!J.eq',8000,200);const tg=Date.now();await until('!!(XV.fp&&XV.fp.root.visible)',30000,200);const st2=await XJ('{on:XAF.on,eq:J.eq&&J.eq.st,gunFP:!!(XV.fp&&XV.fp.root.visible),err:XAF.err}');st2.gunWaitMs=Date.now()-tg;log(ag+' after FIRE',st2);
   check(`${ag} ${key[3]}: FIRE throws it, the ability rig goes away and the native gun rig comes back`,off&&!st2.on&&st2.gunFP,JSON.stringify(st2));
  }
 }

 // C. Hunter's Fury
 if(ONLY.includes('C')){
  await keep();await pick('Sova');await frames(1);await X('J.ult=K().u;J.hf=0;J.cd.x=0;1');
  const hf=()=>XJ('{hf:J.hf,cd:+(J.cd.x||0).toFixed(2),T:+(J.hfT||0).toFixed(2),eq:J.eq&&J.eq.st,ult:J.ult}');
  const tab=await XJ('XHFU');log('XHFU',tab);check("Hunter's Fury table: 3 charges, 2.125 s cycle, 6 s window, 66 m x 1.76 m, 80",tab.n===3&&tab.cyc===2.125&&tab.win===6&&tab.len===66&&tab.r===1.76&&tab.dmg===80,JSON.stringify(tab));
  await page.keyboard.press('KeyX');await until('!J.eq||J.eq.st==="ready"',5000);const pre=await hf();log('HF after X',pre);
  if(pre.hf===0){await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();}
  await page.waitForTimeout(300);const c1=await hf();log('HF cast',c1);await shot('hunters-fury-cast');
  check("Hunter's Fury: X then FIRE casts with the first blast (2 charges left, cycle running, ult spent)",c1.hf===2&&c1.cd>1.5&&c1.ult===0,JSON.stringify({pre,c1}));
  await until('J.cd.x<=0',8000,100);await page.waitForTimeout(500);const c2=await hf();log('HF waited past cycle, no FIRE',c2);
  check("Hunter's Fury: no automatic blast while waiting past the 2.125 s cycle",c2.hf===2,JSON.stringify(c2));
  await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(250);const c3=await hf();log('HF FIRE 2',c3);
  check("Hunter's Fury: FIRE shoots the next blast once the cycle is up",c3.hf===1&&c3.cd>1.5,JSON.stringify(c3));
  await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(250);const c4=await hf();log('HF FIRE inside cycle',c4);
  check("Hunter's Fury: FIRE inside the cycle does nothing",c4.hf===1,JSON.stringify(c4));
  await until('J.hf===0',12000,200);const c5=await hf();log('HF expiry',c5);
  check("Hunter's Fury: the unfired charge is lost when the 6 s window ends",c5.hf===0,JSON.stringify(c5));
 }

 // D. Knife combo
 if(ONLY.includes('D')){
  await keep();await pick('Jett');await frames(1);
  await X(`if(!window.__kp){window.__kp=1;window.__kev=[];const p0=xvFPPlay;xvFPPlay=function(F,kind){try{if(F&&F.w==='Knife'&&kind!=='idle'||(F&&F.w==='Knife'&&F.kind&&/ttack/.test(F.kind)&&kind==='idle'))window.__kev.push([+(performance.now()/1000).toFixed(2),kind,F.kc||0]);}catch(e){}return p0.apply(this,arguments);};}1`);
  await page.keyboard.press('Digit3');const ok=await until('knife.visible&&XV.fp&&XV.fp.w==="Knife"&&XV.fp.root.visible',45000,200);log('knife rig',ok);
  await page.waitForTimeout(1200);await X('window.__kev=[];1');
  for(let i=0;i<4;i++){await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(470);}await shot('knife-after-combo');
  await page.waitForTimeout(1300);await page.mouse.down();await page.waitForTimeout(50);await page.mouse.up();await page.waitForTimeout(1600);
  const ev=await XJ('window.__kev');log('knife events',ev);
  const atk=ev.filter(e=>/^attack/.test(e[1])).map(e=>e[1]);
  check('Knife: four light swings ~0.53 s apart play attack 1 -> 2 -> 3 -> 1, a pause restarts at attack 1',ok&&JSON.stringify(atk)===JSON.stringify(['attack 1','attack 2','attack 3','attack 1','attack 1']),JSON.stringify(atk));
  const last=ev.filter(e=>/^attack/.test(e[1])).pop(),idle=last&&ev.find(e=>e[1]==='idle'&&e[0]>last[0]);
  check('Knife: the last swing returns to idle by ~XVK.light (1.0 s, allow 1.3 s at SwiftShader frame rates)',!!idle&&idle[0]-last[0]<=1.3,JSON.stringify({last,idle}));
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
