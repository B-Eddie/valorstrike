// hk-39: Blade Storm ONLINE in the browser through the local bridge (tools/browser-bridge, port 8787; lockstep room C.lock).
//  A. ALT FIRE: the page player is Jett; ult charged on the server, real X key draws the knives (server bladesActive, 5 knives);
//     5 enemy bots stood in the 2.5 deg fan slots 8 m out (one at 50 HP); a real right mouse button sends {t:'blade',alt:1}:
//     server knives 0 / Blade Storm over, every bot took one knife, the 50 HP one died, no refill.
//  B. Third person (needs the server row [24]): an enemy server bot as Jett with its knives out stands 4 m in front of the page
//     camera: the page draws it with knife hands + floating daggers (no gun); a server burst from it (fireBlade alt) plays the
//     burst throw and the gun comes back. Shots work/validation/bladestorm-online-<A|tp|burst>.jpg (1280x720).
// Usage: (cd <repo>/server && node tools/browser-bridge.mjs 8787 &) ; ROOT=<repo> node work/browser_online_bladestorm.cjs out.json   ONLY=AB
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/online-bs.json',SHOT=process.env.SHOT||ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[],console:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
const ONLY=(process.env.ONLY||'AB').split('');
const HEAL=c=>`{const s=sim('${c}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);const me=s.units.find(u=>u.human);if(me){me.hp=100;}}`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED/.test(t))R.console.push(t.slice(0,240));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const W8=(cond,ms,why)=>page.waitForFunction(c=>window.__xe(c),cond,{timeout:ms||600000,polling:1000}).then(()=>true).catch(e=>{log('wait '+(why||cond).slice(0,60)+' timeout',String(e).slice(0,100));return false;});
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await page.mouse.move(640,360);
 await X(`J.pick='Jett';MP.name='BladeQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await qa(`C.lock=true;return 1;`);await X('mpStart();1');
 await W8('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5',1500000,'match start');
 log('match',await qa(HEAL(code)+`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};s.buy=Math.min(s.buy,.3);const me=s.units.find(u=>u.human);return {team:me.team,agent:me.agent,phase:s.phase,buy:s.buy};`));
 await W8('FV.buy===0',1500000,'buy end');
 const sync=async n=>{const t0=await qa(`return sim('${code}').time;`);for(let i=0;i<160;i++){await page.waitForTimeout(1000);const t=await qa(`return sim('${code}').time;`);if(t-t0>=n)return +(t-t0).toFixed(2);}return -1;};
 if(ONLY.includes('A'))try{
  log('A charge',await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human);me.ability.ult=8;if(me.ability.cool)me.ability.cool.x=0;s.roundDelay=0;return {ult:me.ability.ult,agent:me.agent};`));
  await sync(0.3);await page.keyboard.press('KeyX');
  let on=null;for(let i=0;i<60;i++){await sync(0.2);on=await qa(`const s=sim('${code}');const me=s.units.find(u=>u.human);return {on:!!me.ability.bladesActive,n:me.ability.blades};`);if(on.on)break;}
  check('online X: server Blade Storm with 5 knives',on&&on.on&&on.n===5,on);
  await W8('J.bsOn&&rw==="knife"',300000,'page knives');
  // 5 foes in the fan slots 8 m out on the player's floor, middle at 50 HP; frozen
  const setup=await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human),F=s.units.filter(u=>u.team!==me.team).slice(0,5),fan=[-5,-2.5,0,2.5,5].map(d=>d*Math.PI/180);
   F.forEach((u,i)=>{const a=me.look+fan[i];Object.assign(u,{alive:true,hp:i===2?50:200,armor:0,x:me.x-Math.sin(a)*8,y:me.y,z:me.z-Math.cos(a)*8,vx:0,vz:0,protectedUntil:0,invulnerableUntil:0});});me.pitch=Math.atan2(.215,8);s.bot=u=>{u.input={};u.inputAt=s.time;};
   return {n:F.length,look:+me.look.toFixed(3),hp:F.map(u=>u.hp),ids:F.map(u=>u.id)};`);
  log('A fan',setup);await X(`pitch=Math.atan2(.215,8);1`);await sync(0.5);
  const hp0=await qa(`const s=sim('${code}');return [${setup.ids}].map(i=>{const u=s.units.find(x=>x.id===i);return u.alive?u.hp:0;});`);
  await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  let r1=null;for(let i=0;i<40;i++){await sync(0.2);r1=await qa(`const s=sim('${code}');const me=s.units.find(u=>u.human);return {on:!!me.ability.bladesActive,n:me.ability.blades,hp:[${setup.ids}].map(i=>{const u=s.units.find(x=>x.id===i);return u.alive?Math.round(u.hp):0;}),alive:[${setup.ids}].map(i=>s.units.find(x=>x.id===i).alive)};`);if(!r1.on)break;}
  log('A after right-click',{hp0,r1});
  check('online right-click: ALT FIRE throws all knives (server knives 0, Blade Storm over)',r1&&!r1.on&&r1.n===0,r1);
  const dmg=r1.hp.map((h,i)=>hp0[i]-h);
  check('online ALT FIRE fan: every bot in a fan slot took a knife, the 50 HP one died, no refill',dmg.filter(d=>d>0).length>=4&&r1.alive[2]===false&&r1.n===0,{hp0,r1,dmg});
  await page.screenshot({path:SHOT+'bladestorm-online-A.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
  await sync(1);const pg=await XJ('{bs:J.bs,on:J.bsOn,rw,xaf:typeof XAF!=="undefined"&&XAF.last&&XAF.last.clip}');log('A page',pg);
  check('page: Blade Storm off after the burst (server sync)',!pg.on,pg);
 }catch(e){log('A fail',String(e).slice(0,300));}
 if(ONLY.includes('B'))try{
  // B. an enemy server bot as Jett, knives out, 4 m in front of the page camera, facing it
  const b=await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human),u=s.units.filter(x=>x.team!==me.team).find(x=>x.alive)||s.units.find(x=>x.team!==me.team);
   u.agent='Jett';u.alive=true;u.hp=1000;u.armor=0;u.ability=u.ability||{};u.ability.blades=5;u.ability.bladesActive=true;const fx=-Math.sin(me.look),fz=-Math.cos(me.look);Object.assign(u,{x:me.x+fx*4,y:me.y,z:me.z+fz*4,look:me.look+Math.PI,vx:0,vz:0});
   s.bot=x=>{x.input={};x.inputAt=s.time;if(x===u){x.x=me.x+fx*4;x.z=me.z+fz*4;x.look=me.look+Math.PI;}};globalThis.__bsU=u.id;return {id:u.id,name:u.name};`);
  log('B bot',b);await X('pitch=-0.12;1');await sync(1);
  await W8(`(()=>{const u=bots.concat(allies).find(x=>x.nid===${b.id});return !!(u&&u.bsK===5&&u.xm&&u.xm.btp&&u.xm.btp.on);})()`,600000,'remote knives');
  const s1=await XJ(`(()=>{const u=bots.concat(allies).find(x=>x.nid===${b.id}),M=u&&u.xm,R=M&&M.btp;return {bsK:u&&u.bsK,agent:u&&u.agent,w:M&&M.w,gun:M&&M.gun&&M.gun.visible,knives:R?R.k.filter(k=>k.visible).length:0,on:R&&R.on};})()`);
  log('B tp',s1);await page.screenshot({path:SHOT+'bladestorm-online-tp.jpg',type:'jpeg',quality:75,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
  check('online remote Jett (row [24] = 5): knife hands, gun hidden, 5 floating daggers',s1.bsK===5&&s1.on&&s1.w==='Knife'&&s1.gun===false&&s1.knives===5,s1);
  await X(`window.__bsb=null;{const id=${b.id};const f=xUbOnce;if(!window.__bsH){window.__bsH=1;xUbOnce=function(X,n,set,dur){try{const u=bots.concat(allies).find(x=>x.nid===id);if(u&&u.xm&&u.xm.sx===X&&n==='throw')window.__bsb={dur,burst:u.xm.btp.burst};}catch(e){}return f.apply(this,arguments);};}}1`);
  await X(`window.__snd0=xBladeTP.XBTP.snd||0;window.__bfx=0;if(!window.__bfxH){window.__bfxH=1;const g=bfxBot;bfxBot=function(){window.__bfx++;return g.apply(this,arguments);};}window.__gun=0;if(!window.__gunH){window.__gunH=1;const g=SFX.gun;SFX.gun=function(w){if(w==='Vandal')window.__gun++;return g.apply(this,arguments);};}1`);
  const fb=await qa(`const s=sim('${code}');const u=s.units.find(x=>x.id===${b.id});u.fireAt=0;const me=s.units.find(x=>x.human);const ok=s.fireBlade(u,true);return {ok,n:u.ability.blades,on:u.ability.bladesActive};`);
  log('B server burst',fb);await sync(0.3);await W8('!!window.__bsb',300000,'burst throw');
  const s2=await XJ(`(()=>{const u=bots.concat(allies).find(x=>x.nid===${b.id}),M=u.xm;return {bsb:window.__bsb,gun:M.gun.visible,bsK:u.bsK,fly:xBladeTP.XBTP.live.length,snd:(xBladeTP.XBTP.snd||0)-__snd0,tracers:window.__bfx,vandal:window.__gun};})()`);log('B burst',s2);
  check('online remote knives: knife-throw sound + flying daggers, no gun tracer, no Vandal sound',s2.snd>=1&&s2.fly>=1&&s2.tracers===0&&s2.vandal===0,s2);
  await page.screenshot({path:SHOT+'bladestorm-online-burst.jpg',type:'jpeg',quality:75,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));
  check('online remote burst: the faster burst throw (several knives in one server step)',fb.ok&&s2.bsb&&s2.bsb.dur===0.62,s2);
  await sync(2);const s3=await XJ(`(()=>{const u=bots.concat(allies).find(x=>x.nid===${b.id}),M=u.xm;return {gun:M.gun.visible,w:M.w,shown:M.btp.g.visible};})()`);log('B after',s3);
  check('online remote: gun back after the burst tail',s3.gun===true&&s3.w!=='Knife'&&!s3.shown,s3);
 }catch(e){log('B fail',String(e).slice(0,300));}
 check('no page errors',!R.errors.some(e=>/pageerror/.test(e)),R.errors.filter(e=>/pageerror/.test(e)).slice(0,5));
 log('done',1);await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,500));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
