// (template: browser_hud_valorant.cjs) HUD v2 (Valorant layout) browser check: offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW). World rendering is
// skipped between captures (window.__allow gate, as browser_hitfx_check) so the game's JS runs at a usable rate.
// One match, three viewports per state (1280x720, 640x360, 390x844): buy phase (BUY PHASE label, credits), action phase with
// real kill-feed rows (player headshot kill through the real kill() path, a bot-on-ally kill), ult ready, and the round-end
// banner. Per viewport: rects of the HUD blocks, pairwise overlap check, everything inside the viewport, bundled fonts loaded.
//   node work/browser_hud_valorant.cjs <out.json> [prefix]   (screenshots -> work/validation/<prefix>-<state>-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/spec.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// Team-wipe spectate on native Lotus (raised sites), headless Chromium (SwiftShader, LOW), real map + nav:
// offline 5v5 attack, Spike planted on the highest site, enemies and two living teammates on the site floor, the player and the
// other teammates killed by an enemy -> after the killed-by card the camera is a LIVING TEAMMATE's first-person view at eye
// height (>= nav floor + 1.2, label "SPECTATING <NAME>", never an enemy), real Space key cycles to the other living teammate,
// real V key does nothing (no third-person spectate since f5846aa), last teammates dead -> "NO TEAMMATES ALIVE", no enemy
// follow and no spike orbit (removed in f5846aa: VALORANT spectates living teammates only, first person).
// Then Deathmatch on Lotus: a death never follows an enemy.   node work/browser_spectate_lotus.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async n=>{await frames(2);await page.screenshot({path:`${SHOT}spectate-lotus-${n}-1280x720.jpg`,type:'jpeg',quality:82,timeout:300000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async fn=>{await X(`FV.pick='lotus';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(${fn}),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0&&typeof nmActive==="function"&&!!nmActive()'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);};
 await go('startFive');log('match started',await X('JSON.stringify({mode,map:FV.map,bots:bots.length,allies:allies.length,atk:FV.atk})'));
 const cam=tag=>X(`JSON.stringify((()=>{const a=xKL.cur,C=nmActive(),cy=camera.position.y,lb=xKL.sn?xKL.sn.textContent:'';if(a){const q=a.g.position,f=nmHeight(C,q.x,q.z,q.y+.5);return {tag:${JSON.stringify('x')}.replace('x',${JSON.stringify(tag)}),who:a.name,enemy:bots.includes(a),ally:allies.includes(a),alive:!!a.alive,cy:+cy.toFixed(2),f:+f.toFixed(2),qy:+q.y.toFixed(2),lb,tp:!!(xKL.tp||xKL.t3),ok:!!a.alive&&cy>=f+1.2-1e-3};}
  return {tag:${JSON.stringify(tag)},none:true,cy:+cy.toFixed(2),lb,running,orbit:typeof XOB!=="undefined"&&!!XOB.orb,tp:!!(xKL.tp||xKL.t3)};})())`).then(JSON.parse);
 // set up: attack side, Spike planted on the site with the highest floor, enemies placed on nav nodes on that site floor
 const st=JSON.parse(await X(`JSON.stringify((()=>{const C=nmActive();FV.buy=0;try{buyMenu(false)}catch(e){}timeLeft=999;
  let best=null;for(const k of Object.keys(SITES)){const x0=SITES[k][0],z0=SITES[k][1],f=nmHeight(C,x0,z0,30);if(Number.isFinite(f)&&(!best||f>best.f))best={k,x0,z0,f};}
  const {k,x0,z0,f}=best;FV.sp.st="plant";FV.sp.site=k;FV.sp.x=x0;FV.sp.z=z0;FV.sp.c=null;FV.sp.t=9999;/* fuse held: SwiftShader frames take minutes of real time and the offline clock is real time, a 45 s fuse detonated and killed the enemies before the Space check */spike.position.set(x0,f+.4,z0);
  const N=C.nav.nodes.filter(n=>Math.hypot(n[0]-x0,n[2]-z0)<9&&Math.abs(n[1]-f)<.8);
  bots.forEach((b,i)=>{const n=N[(i*7)%Math.max(1,N.length)]||[x0+i,f,z0];b.alive=true;b.hp=100;b.g.position.set(n[0],n[1],n[2]);if(b.pos&&b.pos.set)b.pos.set(n[0],n[1],n[2]);b.nt=true;});
  allies.forEach((a,i)=>{a.nt=true;if(i<2){const n=N[(i*5+3)%Math.max(1,N.length)]||[x0-i,f,z0];a.alive=true;a.hp=100;a.g.position.set(n[0],n[1],n[2]);if(a.pos&&a.pos.set)a.pos.set(n[0],n[1],n[2]);}});return {site:k,x0,z0,floor:f,nodes:N.length,atk:FV.atk,running};})())`));
 log('setup',st);check('Lotus site floor is raised (>= 3 m)',st.floor>=3,JSON.stringify(st));
 await frames(2);
 const mates=JSON.parse(await X('JSON.stringify(allies.slice(0,2).map(a=>a.name))'));
 await X(`(()=>{allies.slice(2).forEach(a=>{a.hp=0;allyDie(a,bots[1].name,"Vandal")});hurt(player,500,bots[1].name);if(player.hp>0||!xKL.on)pDie(bots[1].name,"Vandal");return 1})()`);
 log('death',await X('JSON.stringify({running,php:player.hp,al:allies.filter(a=>a.alive).length,kl:xKL.on,sp:FV.sp.st})'));
 // the killed-by card holds 2 s of game time (offline real clock)
 for(let i=0;i<6;i++){await page.waitForTimeout(800);await frames(1);}
 let r=await cam('teammate');log('cam teammate',r);
 check('dead after the plant: camera is a living teammate (never an enemy), first person at eye height above the site floor',mates.includes(r.who)&&r.ally&&!r.enemy&&r.ok&&r.cy-r.f<2.2&&/^SPECTATING /.test(r.lb)&&!/ENEMY/.test(r.lb),JSON.stringify(r));await shot('teammate');
 await page.keyboard.press('Space');await frames(2);await page.waitForTimeout(400);await frames(1);const r2=await cam('space');log('cam space',r2);
 check('Space (real key) cycles to the other living teammate, still above the floor',r2.ally&&!r2.enemy&&r2.ok&&r2.who!==r.who&&mates.includes(r2.who),JSON.stringify(r2));await shot('space');
 await page.keyboard.press('KeyV');for(let i=0;i<3;i++){await page.waitForTimeout(500);await frames(1);}r=await cam('v');log('cam V',r);
 check('V (real key): no third-person spectate, same teammate first person',!r.tp&&r.who===r2.who&&r.ok&&r.cy-r.f<2.2,JSON.stringify(r));
 await X(`allies.slice(0,2).forEach(a=>{a.hp=0;allyDie(a,bots[1].name,"Vandal")});1`);for(let i=0;i<3;i++){await page.waitForTimeout(400);await frames(1);}
 r=await cam('wiped');log('cam wiped',r);check('team wiped: NO TEAMMATES ALIVE, no enemy follow, no spike orbit, no third person',r.none&&!r.orbit&&!r.tp&&/NO TEAMMATES ALIVE/.test(r.lb),JSON.stringify(r));await shot('wiped');
 // Deathmatch: a death never follows an enemy
 await X('try{leave()}catch(e){}1');await page.waitForTimeout(1500);
 await go('startDM');log('dm started',await X('JSON.stringify({mode,map:FV.map,dm:FV.dm,bots:bots.length})'));
 await X(`hurt(player,500,bots[0].name);if(player.hp>0||!xKL.on)pDie(bots[0].name,"Vandal");1`);
 const seen=[];for(let i=0;i<6;i++){await page.waitForTimeout(700);await frames(1);seen.push(await X(`JSON.stringify({cur:xKL.cur?xKL.cur.name:null,enemy:!!(xKL.cur&&bots.includes(xKL.cur)),lb:xKL.sn?xKL.sn.textContent:'',hp:player.hp})`));}
 log('dm spectate',seen);check('Deathmatch: no enemy follow after a death',seen.every(s=>{const o=JSON.parse(s);return !o.enemy&&!/ENEMY/.test(o.lb);}),seen.join(' '));await shot('dm');
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
