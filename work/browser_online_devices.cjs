// Online device models + foot planting in the real page (hk-31; b88a800 / 6860738). Headless Chromium plays the page online
// against the real worker module (server/tools/browser-bridge.mjs on 8787; repo on 127.0.0.1:8876), GQ=low, 640x360.
// A. Enemy bots cast Killjoy Turret / Alarmbot, Cypher Trapwire / Spycam, Sova Owl Drone, Chamber Trademark, Raze Blast Pack on
//    the server (/__qa, room held in lockstep); their snapshot 'dev' rows must become real models in the page (netDevs, parts in
//    the scene, visible, xvDevice model swapped in, red enemy tint), inside the camera frustum when placed 7 m ahead.
// B. The page player shoots the Turret (aim set on the page, real FIRE input -> server traceShot): the server device loses HP
//    and the row / model goes when it is destroyed.
// C. Foot planting ran on the online agents with no 'foot planting disabled' warning and no page error (6860738: it threw every
//    frame before). Screenshot work/validation/online-devices-640x360.jpg.
//   bash hk_out/start.sh bridge; ROOT=<tree> node work/browser_online_devices.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/online-devices.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[],console:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
const HEAL=c=>`{const s=sim('${c}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);const me=s.units.find(u=>u.human);if(me)for(const u of s.units)if(u.team===me.team&&u.alive)u.hp=100;}`;
const KINDS=[['Killjoy','e','turret'],['Killjoy','q','alarmbot'],['Cypher','c','trapwire'],['Cypher','e','spycam'],['Sova','c','owl'],['Chamber','c','trademark'],['Raze','q','blastpack']];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{const t=m.text();if(/foot planting|error|Error/.test(t))R.console.push(m.type()+' '+t.slice(0,240));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`MP.name='DevQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await qa(`C.lock=true;return 1;`);log('lockstep','on before start (a slow page is never dropped as idle while it loads)');
 await X('mpStart();1');
 await page.waitForFunction(()=>window.__xe('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5'),null,{timeout:1500000}).catch(e=>log('start wait',String(e).slice(0,200)));
 await X(`{const f=xfPose;xfPose=function(M){window.__fpN=(window.__fpN||0)+1;const r=f.apply(this,arguments);const F=M&&M.sx&&M.sx.ft;if(F&&F.ok){window.__fpOk=(window.__fpOk||0)+1;if(Math.abs(F.d[0])+Math.abs(F.d[1])>0.004)window.__fpP=(window.__fpP||0)+1;}return r;};}1`);
 log('match',await qa(`const s=sim('${code}');s.bot=u=>{u.input={};u.inputAt=s.time;};C.lock=true;s.buy=Math.min(s.buy,.3);const me=s.units.find(u=>u.human);return {team:me.team,atk:s.atk,phase:s.phase,buy:s.buy};`));
 await page.waitForFunction(()=>window.__xe('FV.buy===0'),null,{timeout:1500000}).catch(e=>log('buy end wait',String(e).slice(0,120)));
 // A. enemy bots cast the device kits; each device is then moved to a fan 7 m ahead of the page player
 const cast=await qa(HEAL(code)+`const s=sim('${code}');const me=s.units.find(u=>u.human),foes=s.units.filter(u=>u!==me&&u.team!==me.team&&u.alive),K=${JSON.stringify(KINDS)},out=[];
  const fx=-Math.sin(me.look),fz=-Math.cos(me.look),rx=-fz,rz=fx;
  K.forEach(([agent,k,kind],i)=>{const u=foes[i%foes.length];u.agent=agent;u.ability=u.ability||{};u.ability[k]=1;if(u.ability.cool)u.ability.cool[k]=0;Object.assign(u,{x:me.x+fx*12+rx*(i-3)*1.2,z:me.z+fz*12+rz*(i-3)*1.2,look:me.look+Math.PI});
   const before=s.effects.length;let ok=false;try{ok=s.command(u,{t:'ab',k});}catch(e){ok='throw '+String(e).slice(0,80);}
   const e=s.effects.slice(before).find(x=>x.kind===kind)||s.effects.find(x=>x.kind===kind&&x.owner===u.id);
   if(e&&Array.isArray(e.p)){const lat=(i-3)*1.3,y=me.y+(kind==='owl'?1.6:0);e.p=[me.x+fx*7+rx*lat,y,me.z+fz*7+rz*lat];if(kind==='trapwire')e.q=[e.p[0]+rx*.9,y,e.p[2]+rz*.9];e.until=Math.max(e.until||0,s.time+600);}
   out.push({kind,agent,k,ok,effect:!!e,hp:e?(e.hp??null):null,p:e&&e.p&&e.p.map(v=>+v.toFixed(2))});});
  return {me:[me.x,me.y,me.z,me.look].map(v=>+v.toFixed(2)),out};`);
 log('server casts',cast);
 const want=cast.out.filter(o=>o.effect).map(o=>o.kind);
 check('server: every device kind cast by an enemy bot is a live effect',want.length===KINDS.length,cast.out);
 await page.waitForFunction(n=>window.__xe(`netDevs.size>=${n}`),want.length,{timeout:900000,polling:2000}).catch(e=>log('netDevs wait',String(e).slice(0,120)));
 for(let i=0;i<60;i++){await qa(HEAL(code)+'return 1;');const n=await X('[...netDevs.values()].filter(d=>d.parts[0].userData.xvDevice&&d.parts[0].userData.xvDevice.root).length');const tot=await X('netDevs.size');log('models loaded',{n,tot,remaining:(await qa(`const s=sim(\'${code}\');return [s.remaining,s.phase,s.round];`))});if(n>=want.length-1||tot<want.length-1)break;await page.waitForTimeout(3000);}
 log('model failures',await X('JSON.stringify(XV.failures||{})'));
 await X('window.__dvYaw=yaw;1');
 const devs=JSON.parse(await X(`JSON.stringify((()=>{const fr=new THREE.Frustum(),M=new THREE.Matrix4();camera.updateMatrixWorld();M.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);fr.setFromProjectionMatrix(M);const out=[];
  for(const [id,d] of netDevs){const m=d.parts[0];let inScene=true,vis=true,x=m;while(x){if(!x.visible)vis=false;if(!x.parent&&x!==scene)inScene=false;x=x.parent;}let meshes=0,red=0,model=false;m.traverse(o=>{if(o.isMesh){meshes++;const c=o.material&&o.material.color;if(c&&c.r>c.b)red++;}if(o!==m&&(o.isMesh||o.isGroup||o.isObject3D))model=true;});
   const p=m.getWorldPosition(new THREE.Vector3()),b=new THREE.Box3().setFromObject(m);out.push({id,k:d.k,al:d.al,parts:d.parts.length,inScene,vis,meshes,red,model:!!(m.userData.xvDevice&&m.userData.xvDevice.root),inView:fr.intersectsBox(b),p:[p.x,p.y,p.z].map(v=>+v.toFixed(2)),size:+b.getSize(new THREE.Vector3()).length().toFixed(2)});}return out;})())`));
 log('page devices',devs);
 for(const kind of want){const d=devs.find(x=>x.k===kind);check(`online: enemy ${kind} drawn in the page as its real model (xvDevice root in the scene, visible, enemy side, in view 7 m ahead)`,!!d&&d.inScene&&d.vis&&!d.al&&d.model&&d.inView,d||'missing');}
 // B. shoot the Turret from the page: aim at its body (server SHOOT.turret y .45), hold FIRE in lockstep frames
 const tur=devs.find(x=>x.k==='turret');
 if(tur){await qa(HEAL(code)+'return 1;');const hp0=await qa(`const s=sim('${code}');const e=s.effects.find(x=>x.kind==='turret');return e?(e.hp??100):null;`);
  await X(`(()=>{const e=player,ey=1.6-(player.ch||0)+player.y,t=[${tur.p[0]},${tur.p[1]}+.45,${tur.p[2]}],dx=t[0]-e.x,dy=t[1]-ey,dz=t[2]-e.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));return 1;})()`);
  let hp=hp0,shots=0;for(let i=0;i<30&&hp!=null&&hp>0;i++){await qa(HEAL(code)+'return 1;');await page.mouse.move(320,180);await page.mouse.down();await page.waitForFunction(()=>window.__xe('true'),null,{timeout:60000});await page.waitForTimeout(1500);await page.mouse.up();await page.waitForTimeout(1500);shots++;
   hp=await qa(`const s=sim('${code}');const e=s.effects.find(x=>x.kind==='turret');return e?(e.hp??100):null;`);
   await X(`(()=>{const e=player,ey=1.6-(player.ch||0)+player.y,t=[${tur.p[0]},${tur.p[1]}+.45,${tur.p[2]}],dx=t[0]-e.x,dy=t[1]-ey,dz=t[2]-e.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));return 1;})()`);}
  log('turret hp',{hp0,hp,shots});check('online: the page player shoots the enemy Turret (real FIRE input -> server): HP drops / destroyed',hp0!=null&&(hp==null||hp<hp0),{hp0,hp,shots});
  if(hp==null){await page.waitForFunction(id=>window.__xe(`!netDevs.has(${id})`),tur.id,{timeout:600000,polling:2000}).catch(()=>{});check('online: destroyed Turret model removed from the page',!(await X(`netDevs.has(${tur.id})`)),{id:tur.id});}}
 await qa(HEAL(code)+'return 1;');
 await X('window.__allow=1;1');await page.screenshot({path:SHOT+'online-devices-640x360.jpg',type:'jpeg',quality:70,timeout:600000}).catch(e=>log('shot',String(e).slice(0,120)));log('screenshot','online-devices-640x360.jpg');
 // C. foot planting
 await page.waitForFunction(()=>window.__xe('(window.__fpOk||0)>20'),null,{timeout:600000,polling:2000}).catch(()=>{});
 const ft=JSON.parse(await X(`JSON.stringify({err:XFT.err,calls:window.__fpN||0,ready:window.__fpOk||0,planted:window.__fpP||0})`));
 log('foot planting',ft);
 check('foot planting runs on the online agents (xfPose called with a set-up rig) with no "foot planting disabled" warning (XFT.err 0) and no page error',ft.err===0&&ft.ready>0&&!R.console.some(t=>/foot planting/.test(t))&&!R.errors.length,{ft,console:R.console.slice(0,5),errors:R.errors.slice(0,5)});
 await X('try{mpLeave()}catch(e){}1');await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
