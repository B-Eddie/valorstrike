// Browser check of the merged hit feedback (hark-hitfx f3e6da4 on hark): offline Deathmatch on Ascent, headless Chromium
// (SwiftShader, LOW, 640x360). World rendering is skipped between captures (as browser_perf_capture NORENDER) so the
// game's JS runs at a usable rate; a few real frames are allowed before each screenshot.
//  1. Real fire: fireHeld at a bot placed 4 m in front; counts XHIT.emitted per kind [spark, body, head] from actual shots.
//  2. Anchoring: a confirmed BODY puff is anchored to the struck bone (not the world); moving the bot moves the puff.
//     A predicted SPARK has no anchor and stays put.
//  3. Size: HEAD puff core < BODY puff core (KIND table read back from rendered instance matrices).
//  4. Stills: spark / body / head puff on a bot 1.6 m away, lifetimes held open for the capture only (e.life raised after
//     emit, documented in the output), cropped 160x90 around the hit and upscaled x4 with ImageMagick.
//  5. Combat report on death: after dealing damage, the player is killed by a bot shot (player HP set to 1, bots fire
//     normally); checks .x-cbt.on, a row with DEALT>0 and the head/body/legs breakdown.
//   node work/browser_hitfx_check.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),{execFileSync}=require('child_process');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/hitfx.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';setTimeout(()=>xGo(startDM),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000});log('match started',await X('JSON.stringify({mode,map:FV.map,bots:bots.length,w:wName()})'));
 // intro modal may open after the first click attempt; player damage blocked (window.__god) until the death step
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 // render gate: world renders only while window.__allow>0 (each real world frame decrements it)
 await X(`{window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 await frames(1);
 const place=d=>`(()=>{const fx=-Math.sin(yaw),fz=-Math.cos(yaw);const b=bots.find(b=>b.alive);if(!b)return 0;b.g.position.x=camera.position.x+fx*${d};b.g.position.z=camera.position.z+fz*${d};b.g.position.y=camera.position.y-1.6;window.__tb=b;return b.name;})()`;
 if(process.env.DIAG){ // pipeline check: one BODY puff 0.6 m straight ahead, mesh state before/after real frames
  const st=()=>X(`JSON.stringify((()=>{const c=XHIT.cores,M=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),k=new THREE.Vector3();const live=XHIT.items.map((e,i)=>[e,i]).filter(([e])=>e.age<e.life);const out=live.map(([e,i])=>{c.getMatrixAt(i,M);M.decompose(v,q,k);const s=v.clone().project(camera);return {kind:e.kind,age:+e.age.toFixed(3),life:e.life,pos:[v.x,v.y,v.z].map(x=>+x.toFixed(2)),scale:+k.x.toFixed(4),scr:[Math.round((s.x+1)/2*innerWidth),Math.round((1-s.y)/2*innerHeight),+s.z.toFixed(3)]};});return {idle:XHIT.idle,vis:c.visible,inScene:c.parent===scene,layers:c.layers.mask,camLayers:camera.layers.mask,count:c.count,opacity:c.material.opacity,cam:[camera.position.x,camera.position.y,camera.position.z].map(x=>+x.toFixed(2)),live:out};})())`);
  await X(`XHIT.clear();{const fx=-Math.sin(yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);const p=new THREE.Vector3(camera.position.x+fx*.6,camera.position.y+fy*.6,camera.position.z+fz*.6);xHitImpact(p,null,false,false);for(const e of XHIT.items)if(e.age<e.life)e.life=9999;}1`);
  log('diag after emit',await st());await frames(2);log('diag after 2 frames',await st());
  await page.screenshot({path:SHOT+'hitfx-diag-640x360.jpg',type:'jpeg',quality:85,timeout:300000});log('diag shot',1);await browser.close();return;}
 // 1. real fire
 await X(`window.__hpTop=setInterval(()=>{if(player.hp>0&&player.hp<500)player.hp=1000;},50);player.hp=1000;pitch=-0.05;1`);
 const e0=await X('JSON.stringify(XHIT?XHIT.emitted.slice():null)');log('emitted before',e0);
 log('placed',await X(place(4)));await X(`window.__pin=4;(function f(){try{if(window.__pin){const b=window.__tb&&window.__tb.alive?window.__tb:bots.find(b=>b.alive);if(b){window.__tb=b;const fx=-Math.sin(yaw),fz=-Math.cos(yaw);b.g.position.set(camera.position.x+fx*window.__pin,camera.position.y-1.6,camera.position.z+fz*window.__pin);b.g.updateMatrixWorld(true);}}}catch(e){}requestAnimationFrame(f);})();fireHeld=true;1`);const tF=Date.now();let shots=0;const a0=await X('ammo');
 while(Date.now()-tF<240000){await page.waitForTimeout(3000);await X(place(4)).catch(()=>{});const e=JSON.parse(await X('JSON.stringify(XHIT.emitted)'));log('firing',e);if(e[1]+e[2]-(JSON.parse(e0)||[0,0,0])[1]>=6&&e[0]>=6)break;}
 await X('fireHeld=false;window.__pin=0;1');const e1=JSON.parse(await X('JSON.stringify(XHIT.emitted)'));const eb=JSON.parse(e0)||[0,0,0];
 const d=[e1[0]-eb[0],e1[1]-eb[1],e1[2]-eb[2]];log('emitted delta from real shots [spark,body,head]',d);
 check('real shots emit a predicted SPARK per shot and a confirmed BODY/HEAD puff per hit',d[0]>0&&d[1]+d[2]>0,JSON.stringify(d));
 // 2. anchoring (direct emits on the placed bot, evaluated in JS; no render needed)
 const anc=JSON.parse(await X(`JSON.stringify((()=>{const b=bots.find(b=>b.alive&&b.hp>0)||window.__tb;XHIT.clear();const p=b.g.position.clone();p.y+=1.2;
  xHitImpact(p.clone(),b,false,true,'body');xHitConfirm(p.clone(),b,false,false,'body',false,false);
  const it=XHIT.items.filter(e=>e.age<e.life);const sp=it.find(e=>e.kind===0),bo=it.find(e=>e.kind===1);for(const e of it)e.life=99;
  let inRig=false;for(let o=bo&&bo.anchor;o;o=o.parent)if(o===b.g)inRig=true;
  XHIT.tick(0.016,camera);const s0=sp.point.clone(),b0=bo.point.clone();b.g.position.x+=0.5;b.g.updateMatrixWorld(true);XHIT.tick(0.016,camera);
  return {sparkAnchor:!!sp.anchor,bodyAnchor:bo.anchor&&bo.anchor.name,bodyInRig:inRig,sparkMoved:+sp.point.distanceTo(s0).toFixed(3),bodyMoved:+bo.point.distanceTo(b0).toFixed(3)};})())`));
 log('anchoring',anc);
 check('confirmed BODY puff anchored to the struck bone and follows the bot; SPARK unanchored and stays put',anc.bodyInRig&&!anc.sparkAnchor&&anc.bodyMoved>0.3&&anc.sparkMoved<0.01,JSON.stringify(anc));
 // 3. size: rendered instance matrix scale of the core, kinds 1 vs 2 at the same age
 const sz=JSON.parse(await X(`JSON.stringify((()=>{const b=window.__tb||bots[0];XHIT.clear();const p=b.g.position.clone();p.y+=1.2;const h=b.g.position.clone();h.y+=1.6;
  xHitConfirm(p,b,false,false,'body',false,false);xHitConfirm(h,b,true,false,'head',false,false);XHIT.tick(0.016,camera);
  const M=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),out={};XHIT.items.forEach((e,i)=>{if(e.age<e.life){XHIT.cores.getMatrixAt(i,M);M.decompose(v,q,s);out[e.kind]=+s.x.toFixed(4);}});return out;})())`));
 log('core sizes by kind',sz);check('HEAD puff core smaller than BODY puff core',sz[2]>0&&sz[1]>0&&sz[2]<sz[1],JSON.stringify(sz));
 // 4. stills at 1.6 m, centered
 await X(`clearInterval(window.__hpTop);window.__hpTop=setInterval(()=>{if(player.hp>0&&player.hp<500)player.hp=1000;},50);1`);
 for(const [kind,name] of [[0,'spark'],[1,'body'],[2,'head']]){
  await X(place(1.6));const pos=JSON.parse(await X(`JSON.stringify((()=>{const b=window.__tb;for(const o of bots)if(o!==b&&o.alive){o.g.position.x+=40;}XHIT.clear();
   const ry=new THREE.Raycaster(),dir=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),o=camera.position.clone();o.y+=(${kind}===2?-0.05:-0.4);b.g.updateMatrixWorld(true);ry.set(o,dir);ry.far=4;const h=ry.intersectObject(b.g,true)[0];const p=h?h.point.clone():o.clone().addScaledVector(dir,1.3);window.__hitHost=!!h;if(${kind}===0)xHitImpact(p,null,false,true);else xHitConfirm(p,b,${kind}===2,false,${kind}===2?'head':'body',false,false);for(const e of XHIT.items)if(e.age<e.life)e.life=9999;
   const s=p.clone().project(camera);return {x:Math.round((s.x+1)/2*innerWidth),y:Math.round((1-s.y)/2*innerHeight),onSurface:window.__hitHost};})())`));
  await frames(2);const f=SHOT+`hitfx-${name}-640x360.jpg`;await page.screenshot({path:f,type:'jpeg',quality:80,timeout:300000});
  const cx=Math.max(0,Math.min(640-160,pos.x-80)),cy=Math.max(0,Math.min(360-90,pos.y-45)),z=SHOT+`hitfx-${name}-zoom.png`;
  try{execFileSync('convert',[f,'-crop',`160x90+${cx}+${cy}`,'+repage','-filter','point','-resize','400%',z]);}catch(e){R.errors.push('convert '+e);}log('still '+name,{full:f,zoom:z,at:pos});}
 // 5. combat report on death
 await X(`window.__cbtSeen=null;{const r0=xKLReset;xKLReset=function(){if(window.__cbtSeen)return;return r0.apply(this,arguments);};}new MutationObserver(()=>{const el=document.querySelector('.x-cbt');if(el&&el.classList.contains('on')&&!window.__cbtSeen){const r=el.getBoundingClientRect(),k=document.querySelector('.x-kb.on');const kr=k&&k.getBoundingClientRect();window.__cbtSeen={on:true,rows:[...el.querySelectorAll('tbody tr')].filter(t=>t.style.display!=='none').map(t=>t.textContent),inView:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,rect:[r.left,r.top,r.width,r.height].map(Math.round),card:kr?[kr.left,kr.top,kr.width,kr.height].map(Math.round):null,overlap:!!kr&&!(kr.right<=r.left||r.right<=kr.left||kr.bottom<=r.top||r.bottom<=kr.top)};window.__allow=Math.max(window.__allow,1);window.__pin=0;}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});1`);
 await X(`XHIT.clear();clearInterval(window.__hpTop);window.__god=0;for(const b of bots)b.hp=Math.max(b.hp,1);1`);
 log('placed',await X(place(5)));await X('fireHeld=true;1');await page.waitForTimeout(6000);await X('fireHeld=false;player.hp=1;player.armor=0;1');
 const tD=Date.now();while(Date.now()-tD<300000){await X(place(5)).catch(()=>{});const dead=await X('!!window.__cbtSeen');if(dead)break;await page.waitForTimeout(3000);}
 const cr=JSON.parse(await X(`JSON.stringify(window.__cbtSeen||(()=>{const el=document.querySelector('.x-cbt');if(!el)return null;const r=el.getBoundingClientRect();return {on:el.classList.contains('on'),rows:[...el.querySelectorAll('tbody tr')].filter(t=>t.style.display!=='none').map(t=>t.textContent),inView:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,rect:[r.left,r.top,r.width,r.height].map(Math.round),hp:player.hp};})())`));
 log('combat report',cr);
 check('combat report shown on death with a DEALT/TAKEN row and head/body/legs breakdown, not over the death card',!!cr&&cr.on&&cr.rows.length>0&&cr.rows.some(t=>/·/.test(t))&&!cr.overlap,JSON.stringify(cr));
 await frames(1);await page.screenshot({path:SHOT+'hitfx-combat-report-640x360.jpg',type:'jpeg',quality:80,timeout:300000});log('still report',SHOT+'hitfx-combat-report-640x360.jpg');
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
