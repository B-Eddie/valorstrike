// (template: browser_hud_valorant.cjs) HUD v2 (Valorant layout) browser check: offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW). World rendering is
// skipped between captures (window.__allow gate, as browser_hitfx_check) so the game's JS runs at a usable rate.
// One match, three viewports per state (1280x720, 640x360, 390x844): buy phase (BUY PHASE label, credits), action phase with
// real kill-feed rows (player headshot kill through the real kill() path, a bot-on-ally kill), ult ready, and the round-end
// banner. Per viewport: rects of the HUD blocks, pairwise overlap check, everything inside the viewport, bundled fonts loaded.
//   node work/browser_hud_valorant.cjs <out.json> [prefix]   (screenshots -> work/validation/<prefix>-<state>-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/abil.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// Ability equip-then-fire FP visuals + Deathmatch 640x360 leaderboard vs combat report, headless Chromium (SwiftShader, LOW).
// A. offline 5v5 Ascent as Phoenix, action phase, 1280x720: real Q key -> Hot Hands equipped (gun lowered, hand + item in the
//    first-person view), stays in hand while not fired; real left click -> thrown; gun comes back. Same for C (Blaze).
//    Records J.eq / ability-rig (XAF, f95aa9e replaced the legacy XEQV) state and the FP gun's lowered offset per capture; screenshots abil-*.jpg.
// B. Deathmatch Ascent at 640x360: player killed -> combat report shown and the FFA leaderboard hidden (7a58c99); after the
//    respawn the leaderboard is back.   node work/browser_abil_dm.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;}); // hk-32 time dilation (browser_newmain2.cjs)
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 // hk-30: waits in GAME time (the box runs ~0.25-1 rAF/s): xSimStep is wrapped to count sim time (installed by go()).
 const simWait=async(sec,why)=>{const t=+(await X('window.__sim||0'));await page.waitForFunction(t=>window.__xe('window.__sim||0')>=t,t+sec,{timeout:900000,polling:200}).catch(e=>log('simWait '+(why||sec)+' timeout',String(e).slice(0,80)));};
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 const shot=async(n,w,h)=>{await frames(2);await page.screenshot({path:`${SHOT}${n}-${w}x${h}.jpg`,type:'jpeg',quality:82,timeout:150000}).catch(e=>log('shot '+n+' failed (non-fatal)',String(e).slice(0,120)));};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async(fn,agent)=>{await X(`FV.pick='ascent';J.pick=${JSON.stringify(agent)};window.xSwift=false;setTimeout(()=>xGo(${fn}),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}1`);
  await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}if(!window.__simH){window.__simH=1;window.__sim=0;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;return r;};}1`);};
 const st=()=>X(`JSON.stringify({eq:J.eq?{k:J.eq.k,st:J.eq.st}:null,v:{on:XAF.on,kind:XAF.mode,item:!!(XAF.last&&XAF.last.item),vis:!!(XAF.cur&&XAF.cur.root.visible),rig:!!(XAF.last&&XAF.last.rig)},q:J.q,c:J.c,ammo,pick:J.pick,buy:FV.buy})`).then(JSON.parse);
 // A. abilities
 await go('startFive','Phoenix');await X('window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=Math.min(FV.buy,0.2);1');await frames(3);
 await X('J.c=2;J.q=2;J.cd={c:0,q:0,e:0,x:0};reloading=0;1');log('agent',await st());
 await page.mouse.move(640,360);
 for(const [key,slot,name] of [['KeyQ','q','hot-hands'],['KeyC','c','blaze']]){
  await page.keyboard.down(key);await simWait(0.1,key);await page.keyboard.up(key);let s=await st();log(name+' after key',s);
  await simWait(1.2,name+' equip');await frames(1);s=await st();log(name+' equipped',s);
  check(`${name}: ${key} equips (no instant cast), FP item shown`,s.eq&&s.eq.k===slot&&s.v.on,JSON.stringify(s));await shot('abil-'+name+'-equipped',1280,720);
  const before=s[slot],a0=s.ammo;await page.mouse.down();await simWait(0.1,'click');await page.mouse.up();
  await frames(1);s=await st();log(name+' after click',s);await shot('abil-'+name+'-release',1280,720);
  await simWait(2,name+' recovery');await frames(1);s=await st();log(name+' after recovery',s);
  check(`${name}: left click casts it (charge spent, gun did not fire) and the gun is back up`,s[slot]===before-1&&s.ammo===a0&&!s.eq,JSON.stringify(s));await shot('abil-'+name+'-after',1280,720);
 }
 await X('try{leave()}catch(e){}1');await page.waitForTimeout(1500);
 // B. DM 640x360
 await page.setViewportSize({width:640,height:360});await go('startDM','Jett');log('dm',await X('JSON.stringify({mode,dm:FV.dm})'));await frames(2);
 const lb=()=>X(`JSON.stringify((()=>{const e=document.querySelector('.x-dmlb'),c=document.querySelector('.x-cbt');const vis=el=>!!el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>2;const r=el=>el?[...Object.values(el.getBoundingClientRect().toJSON())].slice(0,4).map(Math.round):null;return {lb:vis(e),lbR:r(e),cbt:vis(c),cbtR:r(c),on:document.body.classList.contains('x-cbt-on'),hp:player.hp};})())`).then(JSON.parse);
 let l=await lb();log('dm alive',l);check('DM 640x360 alive: leaderboard shown',l.lb,JSON.stringify(l));await shot('dm-lb-alive',640,360);
 await X(`window.__god=0;{const b=bots[0];hurt(player,500,b.name);if(player.hp>0)pDie(b.name,"Vandal");}1`);
 // hk-32: abil_dm3 sampled 1.5 s after the kill - DM respawns within that, so 'dead' read the respawned player (hp 100) and, with
 // __god off, a bot killed the player again before the 'respawned' sample (hp 0, report up). Time is slowed (__ts) and each
 // phase waits for its own state: dead = hp <= 0 with the report class on; then __god back on and respawned = hp > 0.
 await page.waitForFunction(()=>window.__xe('player.hp<=0'),null,{timeout:120000,polling:50}).catch(e=>log('dead wait',String(e).slice(0,80)));
 await X('window.__god=1;window.__ts=0.05;1');await frames(1);
 await page.waitForFunction(()=>window.__xe("player.hp>0||document.body.classList.contains('x-cbt-on')"),null,{timeout:300000,polling:100}).catch(e=>log('report wait',String(e).slice(0,80)));
 await frames(1);l=await lb();log('dm dead',l);
 check('DM 640x360 dead: combat report shown, leaderboard hidden (not covered)',l.cbt&&!l.lb,JSON.stringify(l));await shot('dm-lb-dead',640,360);
 await X('window.__ts=1;1');for(let i=0;i<20&&(await X('player.hp'))<=0;i++){await simWait(1,'respawn');}
 await frames(2);l=await lb();log('dm respawn',l);check('DM 640x360 respawned: leaderboard back, report gone',l.hp>0&&l.lb&&!l.on,JSON.stringify(l));await shot('dm-lb-respawn',640,360);
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
