// (template: browser_hud_valorant.cjs) HUD v2 (Valorant layout) browser check: offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW). World rendering is
// skipped between captures (window.__allow gate, as browser_hitfx_check) so the game's JS runs at a usable rate.
// One match, three viewports per state (1280x720, 640x360, 390x844): buy phase (BUY PHASE label, credits), action phase with
// real kill-feed rows (player headshot kill through the real kill() path, a bot-on-ally kill), ult ready, and the round-end
// banner. Per viewport: rects of the HUD blocks, pairwise overlap check, everything inside the viewport, bundled fonts loaded.
//   node work/browser_hud_valorant.cjs <out.json> [prefix]   (screenshots -> work/validation/<prefix>-<state>-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/perfcull.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));

// hark-perf browser pass (762e33c agent frustum cull, d71a3f3 bot variety), headless Chromium (SwiftShader, LOW):
// A. Ascent 5v5, a bot 1-3 m from a probe camera at eye height; the camera turns through 360 deg in 10 deg steps and renders
//    with the real renderer and scene. Per step and per bot mesh: expected = any skinned vertex of the mesh (sampled, current pose) projects inside the view
//    (in front of the camera, NDC within +-1.05); drawn = the mesh's onBeforeRender fired. A pop = expected but not drawn.
// B. The bot is killed (real kill path): the ragdolling corpse, kept in view, must be drawn every frame until its fade.
// C. Bot spread: Ascent and Bind, the attacking side's bots (allies when the player attacks, else the enemy bots), bot AI running, attacker positions sampled over ~30 s of game
//    time; reports per-attacker paths, final pairwise distances and how many distinct sites/lanes they ended near.
//   node work/browser_perf_cull.cjs <out.json>
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 const go=async(map)=>{await X(`FV.pick='${map}';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1200000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;window.__god=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}
   if(!window.__rp){window.__rp=1;window.__r0=renderer.render;renderer.render=function(sc,c){if(sc===scene&&!window.__probe)return;return window.__r0.call(this,sc,c);};}1`);};
 await go('ascent');log('match',await X('JSON.stringify({map:FV.map,bots:bots.length,atk:FV.atk})'));
 // probe helpers (page side)
 await X(`window.__pc=new THREE.PerspectiveCamera(camera.fov||70,640/360,.05,500);window.__drawn=new Set();
  window.__hook=b=>{const L=[];b.g.traverse(o=>{if(o.isSkinnedMesh&&!o.__hk){o.__hk=1;const f=o.onBeforeRender;o.onBeforeRender=function(){window.__drawn.add(this.uuid);if(f)return f.apply(this,arguments);};}if(o.isSkinnedMesh)L.push(o);});return L;};
  window.__shot=(b)=>{const L=window.__hook(b);window.__drawn.clear();window.__probe=1;try{renderer.render(scene,window.__pc);}finally{window.__probe=0;}const v=new THREE.Vector3(),r=[];
   const inV=w=>{const cs=w.clone().applyMatrix4(window.__pc.matrixWorldInverse);if(cs.z>=-.05)return false;const q=w.clone().project(window.__pc);return Math.abs(q.x)<=1.05&&Math.abs(q.y)<=1.05;};
   for(const m of L){if(!m.visible){r.push({hid:1});continue;}let expB=false;const bs=m.skeleton?m.skeleton.bones:[];for(const bn of bs){bn.getWorldPosition(v);if(inV(v)){expB=true;break;}}
    // expected = a skinned vertex of this mesh in view (the skeleton is shared by every mesh of the rig, so a bone in view says nothing about this mesh's own vertices)
    let exp=false;const pos=m.geometry&&m.geometry.attributes.position,bt=m.applyBoneTransform||m.boneTransform;if(pos&&bt){const n=pos.count,st=Math.max(1,Math.floor(n/600));for(let i=0;i<n&&!exp;i+=st){v.fromBufferAttribute(pos,i);bt.call(m,i,v);v.applyMatrix4(m.matrixWorld);if(Number.isFinite(v.x+v.y+v.z)&&inV(v))exp=true;}}
    r.push({exp,expB,drawn:window.__drawn.has(m.uuid),fc:m.frustumCulled,nm:m.name||m.parent&&m.parent.name||''});}return r;};1`);
 // A. turn past bots at 1, 2, 3 m
 const A=[];
 for(const d of [1,2,3]){
  const r=JSON.parse(await X(`JSON.stringify((()=>{const b=bots.find(x=>x.alive)||bots[0];b.nt=true;b.alive=true;const p=player,y=(p.y||0);b.g.position.set(p.x+${d},b.g.position.y,p.z);b.g.updateMatrixWorld(true);
   const out=[];for(let a=0;a<360;a+=10){const t=a*Math.PI/180;window.__pc.position.set(p.x,b.g.position.y+1.6,p.z);window.__pc.rotation.set(0,t,0,'YXZ');window.__pc.updateMatrixWorld(true);
    const s=window.__shot(b);out.push({a,pop:s.filter(x=>x.exp&&!x.drawn).length,popNm:s.filter(x=>x.exp&&!x.drawn).map(x=>x.nm),boneOnly:s.filter(x=>x.expB&&!x.exp&&!x.drawn).length,exp:s.filter(x=>x.exp).length,drawn:s.filter(x=>x.drawn).length,n:s.length});}
   return {bot:b.name,d:${d},steps:out};})())`));
  const pops=r.steps.filter(s=>s.pop>0);A.push({d,bot:r.bot,pops:pops.map(s=>s.a+':'+s.popNm.join('/')),boneOnlyUndrawn:r.steps.filter(s=>s.boneOnly>0).map(s=>s.a),visibleSteps:r.steps.filter(s=>s.exp>0).length,meshes:r.steps[0].n});log('turn '+d+' m',A[A.length-1]);
  check(`turning past a bot at ${d} m: no culling pop (every mesh with a skinned vertex in view is drawn)`,!pops.length&&r.steps.some(s=>s.exp>0),JSON.stringify(A[A.length-1]));
 }
 // a still of the closest case, camera facing the bot at its edge of view
 await X(`(()=>{const b=bots.find(x=>x.nt);const p=player;window.__pc.position.set(p.x,b.g.position.y+1.6,p.z);window.__pc.rotation.set(0,-Math.PI/2+0.9,0,'YXZ');window.__pc.updateMatrixWorld(true);window.__probe=1;renderer.render(scene,window.__pc);window.__probe=0;return 1})()`);
 await page.screenshot({path:SHOT+'perf-cull-edge-640x360.jpg',type:'jpeg',quality:82,timeout:300000});
 // B. corpse stays drawn through the ragdoll
 const B=JSON.parse(await X(`JSON.stringify((()=>{const b=bots.find(x=>x.nt);b.hp=1;kill(b,false);window.__cb=b;return {name:b.name,alive:b.alive};})())`));log('killed',B);
 const C=[];for(let i=0;i<8;i++){await page.waitForTimeout(500);
  C.push(JSON.parse(await X(`JSON.stringify((()=>{const b=window.__cb,v=new THREE.Vector3();let sp=null;b.g.traverse(o=>{if(!sp&&o.isBone&&/pelvis|hips/i.test(o.name))sp=o;});(sp||b.g).getWorldPosition(v);const p=player;window.__pc.position.set(p.x-1.5,v.y+1.2,p.z);window.__pc.lookAt(v);window.__pc.updateMatrixWorld(true);
   const s=window.__shot(b);return {t:${i*0.5},inScene:!!b.g.parent,vis:b.g.visible,meshes:s.length,exp:s.filter(x=>x.exp).length,drawn:s.filter(x=>x.drawn).length,hid:s.filter(x=>x.hid).length,pelvisY:+v.y.toFixed(2)};})())`)));}
 log('corpse',C);await page.screenshot({path:SHOT+'perf-corpse-640x360.jpg',type:'jpeg',quality:82,timeout:300000});
 check('corpse drawn every probe frame while it is in the scene and visible (no vanish from the cull sphere)',C.filter(c=>c.inScene&&c.vis).every(c=>c.drawn>=c.exp&&c.exp>0)&&C.slice(0,4).every(c=>c.inScene&&c.vis),JSON.stringify(C));
 // C. bot spread
 for(const map of ['ascent','bind']){
  if(map!=='ascent'){await X('try{leave()}catch(e){}1');await page.waitForTimeout(1500);await go(map);}
  else{await X('try{leave()}catch(e){}1');await page.waitForTimeout(1500);await go(map);}
  const atkSide=await X(`JSON.stringify({atk:FV.atk,bots:bots.length})`);log(map+' side',atkSide);
  await X('FV.buy=Math.min(FV.buy,0.2);bots.concat(allies).forEach(u=>u.nt=false);1');
  const P=[];let last=0;
  for(let i=0;i<40;i++){await page.waitForTimeout(1500);const s=JSON.parse(await X(`JSON.stringify({atk:FV.atk,rt:typeof timeLeft!=='undefined'?timeLeft:null,b:(FV.atk?allies:bots).map(b=>b.alive?[+b.g.position.x.toFixed(1),+b.g.position.z.toFixed(1)]:null),running})`));P.push(s);if(!s.running)break;}
  const fin=P[P.length-1].b.filter(Boolean),start=P[0].b.filter(Boolean);let md=1e9,sum=0,n=0;for(let i=0;i<fin.length;i++)for(let j=i+1;j<fin.length;j++){const d=Math.hypot(fin[i][0]-fin[j][0],fin[i][1]-fin[j][1]);md=Math.min(md,d);sum+=d;n++;}
  const sites=await X(`JSON.stringify(Object.fromEntries(Object.entries(SITES).map(([k,v])=>[k,[v[0],v[1]]])))`).then(JSON.parse);
  const near=fin.map(p=>{let bk=null,bd=1e9;for(const k in sites){const d=Math.hypot(p[0]-sites[k][0],p[1]-sites[k][1]);if(d<bd){bd=d;bk=k;}}return bk;});
  const moved=start.map((p,i)=>fin[i]?+Math.hypot(fin[i][0]-p[0],fin[i][1]-p[1]).toFixed(1):null);
  const res={map,samples:P.length,rtStart:P[0].rt,rtEnd:P[P.length-1].rt,moved,meanPair:n?+(sum/n).toFixed(1):null,minPair:+md.toFixed(1),nearestSite:near};log(map+' spread',res);
  check(`${map}: attacking bots spread (mean pairwise distance >= 8 m after moving, not one file)`,n>0&&sum/n>=8&&moved.filter(m=>m>5).length>=3,JSON.stringify(res));
 }
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
