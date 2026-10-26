// hk-34: browser check of qa-28's offline changes (e843356 Tailwind / Alarmbot, c464ca5 Outlaw 13.01 bloom) and the
// native-map kit heights (hk-34 xFy), offline 5v5 on Ascent (floor 7.05), headless Chromium (SwiftShader, LOW, 640x360).
// Bots' AI off (u.nt), player immortal (__god); waits in GAME time; key taps at __ts 0.05; shots scheduled INSIDE the sim
// (window.__q: xSimStep runs them at exact game times) so a slow box frame cannot move them.
//  E. Jett Tailwind (wiki v7.04): E arms it (charge spent, HUD WINDUP), E in the 1 s windup is refused (no dash), after
//     the windup HUD shows the window seconds and E dashes (> 5 m, window used); unused, it fades after 7.5 s.
//  F. Killjoy Alarmbot (wiki: 1.85 s deploy, 40 m): Q (equip + click) places it ON the floor (y = player floor + 0.225,
//     not under the map); an enemy 2.5 m away is not chased while deploying; with Killjoy 45 m away it stays idle (no
//     target, not moved); Killjoy back within 40 m -> it goes for the enemy (Vulnerable or chasing).
//  G. Outlaw (13.01): scoped, the first shot's spread ~0, a second scoped shot 0.37 s later ~2.14 deg (2.25 held 0.15 s,
//     easing).
//   node work/browser_qa28.cjs <out.json>   (ROOT=<tree>, default /workspace/work/valorstrike; PARTS=E,F,G)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/qa28.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
const ONLY=(process.env.PARTS||'E,F,G').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const simWait=async(sec,why)=>{const t=+(await X('window.__sim||0'));await page.waitForFunction(t=>window.__xe('window.__sim||0')>=t,t+sec,{timeout:900000,polling:200}).catch(e=>log('simWait '+(why||sec)+' timeout',String(e).slice(0,80)));};
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000}).catch(()=>{});};
 const shot=async n=>{await frames(2);await page.screenshot({path:`${SHOT}qa28-${n}-640x360.jpg`,type:'jpeg',quality:80,timeout:300000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
 const key=async(k)=>{await X('window.__ts=0.05;1');await page.keyboard.down(k);await simWait(0.02,k);await page.keyboard.up(k);await X('window.__ts=1;1');};
 // equip-then-fire abilities (XAB_EQ: Cypher C, Sage C / X, Raze Q): the key draws it (XAB_EQT s), a click casts it
 const cast=async(k,draw)=>{await key(k);await simWait((draw||0.8)+0.25,'draw '+k);const e=await XJ(`J.eq?{k:J.eq.k,st:J.eq.st}:null`);log('equipped '+k,e);await click(0.05);await X('window.__ts=0.05;1');await simWait(0.7,'release '+k);await X('window.__ts=1;1');return e;};
 // hk-34: the 0.7 s release wait ran at __ts 1: one ~1-4 s box frame could carry the cast past short windows (qa_recent2: no Blast Pack left by the read, armed 1.5 s / goes off at 5 s). Released at __ts 0.05.
 const click=async(hold)=>{await X('window.__ts=0.05;1');await frames(1);await page.mouse.down();await simWait(hold||0.05,'click');await page.mouse.up();await X('window.__ts=1;1');};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async(agent)=>{await X(`try{leave()}catch(e){}1`);await page.waitForTimeout(1500);
  await X(`FV.pick='ascent';J.pick=${JSON.stringify(agent)};window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}if(!window.__simH){window.__simH=1;window.__sim=0;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;const Q=window.__q;if(Q&&Q.length){for(let i=0;i<Q.length;)if(window.__sim>=Q[i][0]){const c=Q.splice(i,1)[0];try{c[1]();}catch(e){window.__qe=String(e);}}else i++;}return r;};}1`);
  await X('window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=Math.min(FV.buy,0.2);1');
  await page.waitForFunction(()=>window.__xe('FV.buy<=0'),null,{timeout:900000,polling:1000}).catch(e=>log('buy end wait',String(e).slice(0,80)));
  // everyone else far away, the player on open floor facing its own forward
  await X(`bots.concat(allies).forEach((u,i)=>{u.g.position.set(player.x+200+i*3,player.y-50,player.z+200);});J.cd={c:0,q:0,e:0,x:0};1`);
  await frames(2);log(agent+' match',await XJ(`{pick:J.pick,buy:FV.buy,p:[player.x,player.y,player.z].map(v=>+v.toFixed(2)),yaw:+yaw.toFixed(2)}`));};
 // a spot d m straight ahead of the camera on the player's floor (null when a wall is in between)
 const ahead=d=>XJ(`(()=>{const fx=-Math.sin(yaw),fz=-Math.cos(yaw),x=player.x+fx*${d},z=player.z+fz*${d};let ok=true;for(let r=.5;r<=${d};r+=.5)if(blocked(player.x+fx*r,player.z+fz*r,.3,player.y))ok=false;return {x,z,ok};})()`);
 const faceOpen=async d=>{for(let k=0;k<16;k++){const a=await ahead(d);if(a.ok)return a;await X(`yaw+=Math.PI/8;1`);}return await ahead(d);};


 if(ONLY.includes('E'))try{
  await go('Jett');const sp=await faceOpen(12);log('E open lane',sp);
  const hud=()=>XJ(`(()=>{const el=document.getElementById('jE');const em=el&&el.querySelector('em');return {txt:em?em.textContent:null,off:el?el.classList.contains('off'):null,tw:J.tw?{arm:+J.tw.arm.toFixed(2),t:+J.tw.t.toFixed(2)}:null,e:J.e,p:[player.x,player.z].map(v=>+v.toFixed(2))};})()`);
  // hk-35: qa28_1 read arm -4.06 - key() put __ts back to 1 and frames(1) ran one ~4 s box frame at full speed. The windup reads
  // (a, b, c) now stay at __ts 0.05 (keyD: key press without restoring the dilation) until the window read.
  const keyD=async(k)=>{await X('window.__ts=0.05;1');await page.keyboard.down(k);await simWait(0.02,k);await page.keyboard.up(k);};
  await X('J.e=1;J.tw=null;J.cd.e=0;1');await keyD('KeyE');await frames(1);const a=await hud();log('E armed',a);
  check('Tailwind: E arms it (charge spent, J.tw windup <= 1 s, HUD WINDUP)',a.e===0&&!!a.tw&&a.tw.arm>0.5&&a.tw.arm<=1&&a.txt==='WINDUP',a);
  await keyD('KeyE');const b=await hud();log('E during windup',b);
  check('Tailwind: E during the windup is refused (still armed, no dash)',!!b.tw&&b.tw.arm>0&&Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1])<0.5,{a,b});
  await simWait(Math.max(0.1,(b.tw?b.tw.arm:1)+0.15),'windup');await frames(1);const c=await hud();await X('window.__ts=1;1');log('E window',c);
  check('Tailwind: after the windup the HUD shows the window seconds (7 / 8 s)',!!c.tw&&c.tw.arm<=0&&/^[78] s$/.test(c.txt||''),c);
  await key('KeyE');await simWait(0.6,'dash');await frames(1);const d=await hud();log('E dashed',d);
  check('Tailwind: E in the window dashes (> 5 m) and uses the window',!d.tw&&Math.hypot(d.p[0]-c.p[0],d.p[1]-c.p[1])>5,{c,d});
  await X('J.e=1;J.tw=null;J.cd.e=0;1');await key('KeyE');await simWait(9,'window life');await frames(1);const f=await hud();log('E faded',f);
  check('Tailwind: unused, the empowered window fades after 7.5 s (charge gone)',!f.tw&&f.e===0,f);
 }catch(e){R.errors.push('part E '+String(e).slice(0,300));log('part E error',String(e).slice(0,300));}
 if(ONLY.includes('F'))try{
  await go('Killjoy');await X('J.q=2;J.cd.q=0;J.ab=null;1');await faceOpen(4);const P0=await XJ(`[player.x,player.y,player.z]`);
  await cast('KeyQ',0.85);await X('window.__ts=0.05;1');await frames(1);/* hk-35: qa28_1 - the frame after the cast ran at 1x and the 1.85 s deploy was over (dep 0) by the 'deploying' read; dilated until then */
  const a=await XJ(`(()=>{const A=J.ab;if(!A)return null;window.__A=A;const b=bots.filter(b=>b.alive)[0];window.__ab=b;b.vul=0;b.g.position.set(A.p.x+2.5,player.y,A.p.z);return {p:[A.p.x,A.p.y,A.p.z].map(v=>+v.toFixed(2)),py:+player.y.toFixed(2),dep:+A.dep.toFixed(2),drawn:A.m.parent===scene&&A.m.visible,tg:!!A.tg};})()`);log('F alarmbot placed',a);
  check('Alarmbot: Q (equip + click) places it ON the floor (y = player floor + 0.225; on native Ascent it sat at 0.225, under the map), drawn',!!a&&a.drawn&&Math.abs(a.p[1]-(a.py+0.225))<0.15,a);
  if(!a)throw Error('no Alarmbot');
  await simWait(0.6,'deploying');const b=await XJ(`{dep:+window.__A.dep.toFixed(2),tg:!!window.__A.tg,moved:+Math.hypot(window.__A.p.x-${a.p[0]},window.__A.p.z-${a.p[2]}).toFixed(2),vul:window.__ab.vul||0}`);await X('window.__ts=1;1');log('F deploying',b);
  check('Alarmbot: while deploying (1.85 s) it does not go for an enemy 2.5 m away',b.dep>0&&!b.tg&&b.moved<0.05&&!(b.vul>0),b);
  const far=await XJ(`(()=>{const A=window.__A;let best=null;const C=NM.current,N=C&&C.nav?C.nav.nodes:[];for(let i=0;i<N.length;i++){const n=N[i];if(C.playable&&!C.playable[i])continue;const d=Math.hypot(n[0]-A.p.x,n[2]-A.p.z);if(d>45&&d<60&&(!best||d<best[3]))best=[n[0],n[1],n[2],d];}return best;})()`);log('F far spot',far);
  if(far){await X(`player.x=${far[0]};player.y=${far[1]};player.z=${far[2]};player.vy=0;1`);
   await X('window.__ts=0.2;1');await simWait(2.2,'idle');const c=await XJ(`{dep:+window.__A.dep.toFixed(2),tg:!!window.__A.tg,ab:!!J.ab,moved:+Math.hypot(window.__A.p.x-${a.p[0]},window.__A.p.z-${a.p[2]}).toFixed(2),vul:window.__ab.vul||0,d:+Math.hypot(player.x-window.__A.p.x,player.z-window.__A.p.z).toFixed(1)}`);await X('window.__ts=1;1');log('F Killjoy far',c);
   check('Alarmbot: deployed, with Killjoy past 40 m it stays idle (no target, not moved, nobody Vulnerable)',c.ab&&c.dep<=0&&c.d>40&&!c.tg&&c.moved<0.05&&!(c.vul>0),c);
   await X(`player.x=${P0[0]};player.y=${P0[1]};player.z=${P0[2]};player.vy=0;1`);await X('window.__ts=0.2;1');await simWait(1.5,'active');const d=await XJ(`{ab:!!J.ab,tg:!!(J.ab&&J.ab.tg),moved:J.ab?+Math.hypot(J.ab.p.x-${a.p[0]},J.ab.p.z-${a.p[2]}).toFixed(2):null,vul:+(window.__ab.vul||0).toFixed(2)}`);await X('window.__ts=1;1');log('F Killjoy back',d);
   check('Alarmbot: Killjoy back within 40 m -> it goes for the enemy (target / moved / popped: Vulnerable)',d.vul>0||d.tg||(d.moved>0.3),d);await shot('alarmbot');
  }else check('Alarmbot: a nav floor point 45..60 m away for the 40 m check',false,{far});
 }catch(e){R.errors.push('part F '+String(e).slice(0,300));log('part F error',String(e).slice(0,300));}
 if(ONLY.includes('G'))try{
  await go('Jett');await faceOpen(15);
  await X(`if(!window.__gsH){window.__gsH=1;window.__gs=[];const s0=gSpread;gSpread=function(w,W,B){const r=s0.apply(this,arguments);if(window.__inF&&!B)window.__gs.push([+window.__sim.toFixed(3),w,ads,+(r*180/Math.PI).toFixed(3)]);return r;};const f0=gFire;gFire=function(){window.__inF=1;try{return f0.apply(this,arguments);}finally{window.__inF=0;}};}1`);
  await X(`FV.pri='Outlaw';rw='pri';ammo=WEAP.Outlaw.mag;reloading=0;fcd=0;VM.sw=0;try{onSkin();}catch(e){}1`);await simWait(1.2,'equip');
  await X(`VM.sw=0;fcd=0;reloading=0;ammo=WEAP.Outlaw.mag;setScope(true);1`);await simWait(0.5,'scope');
  const st=await XJ(`{w:wName(),ads,ammo,fcd:+fcd.toFixed(2)}`);log('G Outlaw scoped',st);
  await X(`window.__gs.length=0;{const t=window.__sim;window.__q=[[t+0.05,()=>{setScope(true);fireHeld=true;shoot();fireHeld=false;}],[t+0.42,()=>{setScope(true);fireHeld=true;shoot();fireHeld=false;}]];}1`);
  await page.waitForFunction(()=>window.__xe('!window.__q.length'),null,{timeout:600000,polling:200});await simWait(0.1,'shots');
  const g=await XJ(`{gs:window.__gs.slice(),qe:window.__qe||null,ammo}`);log('G Outlaw shots',g);
  const s1=g.gs[0],s2=g.gs[1];
  check('Outlaw: scoped first shot spread ~0 (< 0.3 deg)',!!s1&&s1[1]==='Outlaw'&&s1[2]===2&&s1[3]<0.3,g);
  check('Outlaw: a second scoped shot 0.37 s later carries the 13.01 bloom (~2.14 deg, 1.9..2.3)',!!s2&&s2[2]===2&&s2[3]>=1.9&&s2[3]<=2.3,g);
 }catch(e){R.errors.push('part G '+String(e).slice(0,300));log('part G error',String(e).slice(0,300));}
 check('no page errors',!R.errors.length,{errors:R.errors.slice(0,5)});
 await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
