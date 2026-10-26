// hk-33: browser check of the recent ability parity changes (qa-26 0b21ca6 / qa-27 8ab8e89) in the real page, offline 5v5 on
// Ascent, headless Chromium (SwiftShader, LOW, 640x360). Bots' AI off (u.nt) so nothing moves unless the script says so; the
// player is immortal (__god). Waits are in GAME time (xSimStep wrapped); taps / clicks run at time dilation __ts 0.05 so a
// ~1 s SwiftShader frame does not carry a whole ability window. Screenshots work/validation/qa-recent-*.jpg.
//  A. Cypher Trapwire (v11.08 / v13.00): real C key sets a wire (mesh + 2 anchors drawn); an enemy standing on it after the
//     1.5 s deploy is tripped (slowed at once), zapped 5 and revealed after the 0.7 s windup; out of 4 m the wire lets go
//     with a 1.25 s slow left; the wire is not used up (still listed, re-arms).
//  B. Chamber Headhunter: real Q key -> held (BC.eq 'hp', 0.3 s equip), one click = one round, 159 / 55 / 46 damage.
//     Tour De Force: real X key -> held (5 rounds, 2.3 s equip); a click kills the bot in front -> a 6 m slow field drawn
//     under it (50 % inside, gone after 4 s).
//  C. Sage Barrier Orb: real C key -> 4 segments drawn and in solids; one segment broken -> hidden, the other 3 stay.
//     Resurrection: a dead ally in front, real X key -> crystal rises (2 s windup + 1.3 s), ally alive at 3.3 s, not before.
//  D. Raze Blast Pack: real Q key -> pack thrown and drawn; left alone it goes off by itself at 5 s (armed after 1.5 s): an
//     enemy 1 m from it takes 50.
//   node work/browser_qa_recent.cjs <out.json>   (ROOT=<tree>, default /workspace/work/valorstrike)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/qa-recent.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
const ONLY=(process.env.PARTS||'A,B,C,D').split(',');
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
 const shot=async n=>{await frames(2);await page.screenshot({path:`${SHOT}qa-recent-${n}-640x360.jpg`,type:'jpeg',quality:80,timeout:300000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
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
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}if(!window.__simH){window.__simH=1;window.__sim=0;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;return r;};}1`);
  await X('window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=Math.min(FV.buy,0.2);1');
  await page.waitForFunction(()=>window.__xe('FV.buy<=0'),null,{timeout:900000,polling:1000}).catch(e=>log('buy end wait',String(e).slice(0,80)));
  // everyone else far away, the player on open floor facing its own forward
  await X(`bots.concat(allies).forEach((u,i)=>{u.g.position.set(player.x+200+i*3,player.y-50,player.z+200);});J.cd={c:0,q:0,e:0,x:0};1`);
  await frames(2);log(agent+' match',await XJ(`{pick:J.pick,buy:FV.buy,p:[player.x,player.y,player.z].map(v=>+v.toFixed(2)),yaw:+yaw.toFixed(2)}`));};
 // a spot d m straight ahead of the camera on the player's floor (null when a wall is in between)
 const ahead=d=>XJ(`(()=>{const fx=-Math.sin(yaw),fz=-Math.cos(yaw),x=player.x+fx*${d},z=player.z+fz*${d};let ok=true;for(let r=.5;r<=${d};r+=.5)if(blocked(player.x+fx*r,player.z+fz*r,.3,player.y))ok=false;return {x,z,ok};})()`);
 const faceOpen=async d=>{for(let k=0;k<16;k++){const a=await ahead(d);if(a.ok)return a;await X(`yaw+=Math.PI/8;1`);}return await ahead(d);};

 if(ONLY.includes('A'))try{
  await go('Cypher');await X('J.c=2;1');const sp=await faceOpen(7);log('A open lane',sp);
  const n0=await X('BC.cw.length');await cast('KeyC',0.8);await frames(1);
  const w=await XJ(`(()=>{const W=BC.cw[BC.cw.length-1];if(!W)return null;window.__W=W;const vis=o=>!!o&&o.parent===scene&&o.visible;return {n:BC.cw.length,wire:vis(W.m),anchors:W.an.map(vis),len:+Math.hypot(W.a.x-W.b.x,W.a.z-W.b.z).toFixed(2),py:+player.y.toFixed(2),a:[W.a.x,W.a.z].map(v=>+v.toFixed(2)),b:[W.b.x,W.b.z].map(v=>+v.toFixed(2)),c:J.c};})()`);
  log('A wire',w);check('Trapwire: C key sets a wire, drawn (wire + both anchors in the scene)',w&&w.n===n0+1&&w.wire&&w.anchors.every(Boolean),{n0,w});
  check('Trapwire: the wire spans the lane between walls (> 1 m; the legacy blocked(x, z, r, 0) probes ask y 0 on native maps)',w&&w.len>1,w);
  if(w){
  // the enemy stands on the wire's middle from the start; trip only after the 1.5 s deploy
  await X(`(()=>{const W=window.__W,b=bots.filter(b=>b.alive)[0];window.__tb=b;b.hp=100;b.armor=0;b.chs=0;b.g.position.set((W.a.x+W.b.x)/2,player.y,(W.a.z+W.b.z)/2);W.ck=1e9;})();1`);
  // hk-33: qa_recent2 read the deploy at fixed waits after placing the enemy, but the cast's own release / logging had
  // already used game time (tripped + zapped by the first read). Follow the wire's own timer (W.arm) at time dilation 0.1.
  await X('window.__ts=0.1;1');const T0=[];for(let k=0;k<40;k++){const r=await XJ(`{arm:+window.__W.arm.toFixed(2),trip:window.__W.trip===window.__tb,hp:window.__tb.hp,chs:+(window.__tb.chs||0).toFixed(2),fire:window.__W.fire==null?null:+window.__W.fire.toFixed(2)}`);T0.push(r);if(r.hp<100)break;await simWait(0.12,'wire tick');}
  await X('window.__ts=1;1');log('A wire timeline',T0);const armed=T0.filter(r=>r.arm>0),first=T0.find(r=>r.trip);
  const t={pre:armed.map(r=>r.trip)},t2=first||{};
  check('Trapwire: not armed during the deploy (W.arm > 0: no trip), then the enemy on it is tripped and slowed at once (no damage yet)',(armed.length===0||armed.every(r=>!r.trip))&&!!first&&first.chs>0&&first.hp===100,{t,t2,n:T0.length});
  await simWait(0.8,'windup');const z=await XJ(`{hp:window.__tb.hp,rv:J.rv.indexOf(window.__tb)>=0,trip:window.__W.trip===window.__tb}`);log('A after windup',z);await shot('trapwire-tripped');
  check('Trapwire: after the 0.7 s windup the tripped enemy is zapped 5 and revealed',z.hp===95&&z.rv,z);
  await X(`(()=>{const W=window.__W,b=window.__tb,ax=W.b.x-W.a.x,az=W.b.z-W.a.z,l=Math.hypot(ax,az)||1;b.g.position.set((W.a.x+W.b.x)/2-az/l*4.6,player.y,(W.a.z+W.b.z)/2+ax/l*4.6);})();1`);
  await X('window.__ts=0.05;1');await frames(1);await simWait(0.05,'break free');await X('window.__ts=1;1');const f=await XJ(`{trip:window.__W.trip,chs:+(window.__tb.chs||0).toFixed(2),listed:BC.cw.indexOf(window.__W)>=0,inScene:window.__W.m.parent===scene}`);log('A broke free',f);
  check('Trapwire: beyond 4 m the enemy breaks free with a ~1.25 s slow left; the wire is not used up (still set and drawn)',f.trip===null&&f.chs>0.9&&f.chs<=1.25&&f.listed&&f.inScene,f);
  }
 }catch(e){R.errors.push('part A '+String(e).slice(0,300));log('part A error',String(e).slice(0,300));}
 if(ONLY.includes('B'))try{
  await go('Chamber');const sp=await faceOpen(10);log('B open lane',sp);
  const place=async(hp)=>X(`(()=>{const b=bots.filter(b=>b.alive)[0];window.__cb=b;b.hp=${hp};b.armor=0;b.g.position.set(${sp.x},player.y,${sp.z});if(b.g.updateMatrixWorld)b.g.updateMatrixWorld(true);return 1;})()`);
  await X('J.q=2;BC.eq="";BC.cd=0;1');await key('KeyQ');const e=await XJ(`{eq:BC.eq,cd:+BC.cd.toFixed(2),q:J.q}`);log('B Headhunter equip',e);
  check('Headhunter: Q holds it (BC.eq hp; equip cd logged, <= 0.3 s)',e.eq==='hp'&&e.cd<=0.3,e);await simWait(0.4,'hh equip');
  await place(300);await shot('headhunter-held');await click(0.05);await simWait(0.1,'shot');
  const h=await XJ(`{hp:window.__cb.hp,q:J.q,eq:BC.eq}`);log('B Headhunter shot',h);
  check('Headhunter: one click fires one round (Q charge spent) for 159 head / 55 body / 46 legs, no falloff at 10 m',h.q===1&&[159,55,46].includes(300-h.hp),h);
  await X('BC.eq="";J.ult=K().u;BC.td=0;BC.cd=0;BC.sf.length=0;1');await key('KeyX');const u=await XJ(`{eq:BC.eq,td:BC.td,cd:+BC.cd.toFixed(2)}`);log('B TDF equip',u);
  check('Tour De Force: X holds it (5 rounds, 2.3 s equip)',u.eq==='sn'&&u.td===5&&u.cd>2&&u.cd<=2.31,u);await simWait(2.5,'tdf equip');
  await place(100);await X('window.__h0=window.__cb.hp;1');await click(0.05);await simWait(0.15,'tdf shot');
  const f=await XJ(`(()=>{const b=window.__cb,s=BC.sf[BC.sf.length-1];return {alive:b.alive,hp:b.hp,pos:[b.g.position.x,b.g.position.y,b.g.position.z].map(v=>+v.toFixed(2)),scope:typeof ads!=='undefined'?ads:null,td:BC.td,n:BC.sf.length,r:s&&s.r,t:s&&+s.t.toFixed(2),drawn:!!(s&&s.m.parent===scene&&s.m.visible),d:s?+Math.hypot(s.p.x-b.g.position.x,s.p.z-b.g.position.z).toFixed(2):null,slowIn:s?sgSlow(new THREE.Vector3(s.p.x+2,0,s.p.z)):null,slowOut:s?sgSlow(new THREE.Vector3(s.p.x+7,0,s.p.z)):null};})()`);
  log('B TDF kill',f);await shot('tdf-field');
  check('Tour De Force: a kill leaves a 6 m slow field drawn under the victim (50 % inside, none outside)',!f.alive&&f.td===4&&f.n>=1&&f.r===6&&f.drawn&&f.d<1.5&&f.slowIn===0.5&&f.slowOut===1,f);
  await simWait(4.2,'field life');const g=await XJ(`{n:BC.sf.length}`);log('B TDF field after 4.2 s',g);check('Tour De Force: the field is gone after 4 s',g.n===0,g);
 }catch(e){R.errors.push('part B '+String(e).slice(0,300));log('part B error',String(e).slice(0,300));}
 if(ONLY.includes('C'))try{
  await go('Sage');await X('J.c=1;J.cd.c=0;1');await faceOpen(6);await cast('KeyC',0.8);await frames(1);
  const b=await XJ(`(()=>{const w=J.sw;if(!w)return null;return {segs:w.sm.length,drawn:w.sm.map(m=>m.visible&&!!m.parent),inSolids:w.sm.map(m=>solids.indexOf(m)>=0),hp:w.seg.slice()};})()`);log('C barrier',b);
  check('Barrier Orb: C raises 4 segments, all drawn and solid',b&&b.segs===4&&b.drawn.every(Boolean)&&b.inSolids.every(Boolean),b);
  await X('xBarHit(J.sw,1,99999);1');await frames(1);
  const b2=await XJ(`(()=>{const w=J.sw;if(!w)return {gone:true};return {drawn:w.sm.map(m=>m.visible&&!!m.parent),inSolids:w.sm.map(m=>solids.indexOf(m)>=0),hp:w.seg.map(v=>Math.round(v))};})()`);log('C one segment broken',b2);await shot('barrier-segment');
  check('Barrier Orb: one broken segment disappears (not solid), the other 3 stay up',!b2.gone&&!b2.drawn[1]&&!b2.inSolids[1]&&[0,2,3].every(i=>b2.drawn[i]&&b2.inSolids[i]),b2);
  // Resurrection: a dead ally 5 m in front
  const sp=await faceOpen(5);await X(`(()=>{const a=allies.filter(a=>a.alive)[0];window.__ra=a;a.g.position.set(${sp.x},player.y,${sp.z});allyDie(a,'QA','Vandal');J.ult=K().u;J.rz=null;})();1`);
  await simWait(0.6,'corpse');await cast('KeyX',0.8);const r0=await XJ(`{rz:!!J.rz,t:J.rz?+J.rz.t.toFixed(2):null,crystal:!!(J.rz&&J.rz.m.parent===scene),alive:window.__ra.alive}`);log('C rez cast',r0);
  check('Resurrection: X (equip + click) on a dead ally in front starts the 3.3 s channel with the crystal drawn',r0.rz&&r0.t>2.2&&r0.t<=3.3&&r0.crystal&&!r0.alive,r0);
  await X('window.__rzT=J.rz?J.rz.t:0;1');await simWait(Math.max(0,(r0.t||3.3)-1.45),'windup');const r1=await XJ(`{alive:window.__ra.alive,cy:J.rz?+J.rz.m.position.y.toFixed(2):null}`);log('C rez at 2 s',r1);await shot('resurrection-rise');
  await simWait(1.5,'rise');const r2=await XJ(`{alive:window.__ra.alive,hp:window.__ra.hp,rz:!!J.rz}`);log('C rez at 3.5 s',r2);
  check('Resurrection: the ally is still down after the 2 s windup and stands (100 HP) by 3.5 s',!r1.alive&&r2.alive&&r2.hp===100&&!r2.rz,{r1,r2});
 }catch(e){R.errors.push('part C '+String(e).slice(0,300));log('part C error',String(e).slice(0,300));}
 if(ONLY.includes('D'))try{
  await go('Raze');await X('J.q=1;J.cd.q=0;RS.pk.length=0;1');await faceOpen(8);await cast('KeyQ',0.8);await frames(1);
  const p=await XJ(`(()=>{const o=RS.pk[0];if(!o)return {none:true,q:J.q,eq:J.eq?{k:J.eq.k,st:J.eq.st}:null,cdq:J.cd.q};window.__pk=o;return {n:RS.pk.length,drawn:o.m.parent===scene&&o.m.visible,t:+o.t.toFixed(2)};})()`);log('D pack thrown',p);
  check('Blast Pack: Q throws a pack, drawn in the scene',p&&p.n===1&&p.drawn,p);if(!p||p.none)throw Error('no pack '+JSON.stringify(p));
  await simWait(1.8,'land + arm');const q=await XJ(`(()=>{const o=window.__pk,P=o.m.position,b=bots.filter(b=>b.alive)[0];window.__pb=b;b.hp=500;b.armor=0;b.g.position.set(P.x+1,player.y,P.z);return {t:+o.t.toFixed(2),p:[P.x,P.y,P.z].map(v=>+v.toFixed(2)),stuck:!!o.stuck,n:RS.pk.length};})()`);log('D pack at 1.8 s',q);await shot('blastpack');
  await simWait(3.6,'auto detonation');const d=await XJ(`{n:RS.pk.length,hp:Math.round(window.__pb.hp*10)/10}`);log('D after 5.4 s',d);
  check('Blast Pack: left alone it goes off by itself at 5 s (armed): an enemy 1 m away takes 50',q.n===1&&d.n===0&&d.hp===450,{q,d});
 }catch(e){R.errors.push('part D '+String(e).slice(0,300));log('part D error',String(e).slice(0,300));}
 check('no page errors',!R.errors.length,{errors:R.errors.slice(0,5)});
 await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
