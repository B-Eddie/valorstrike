// Draw calls per frame by source, headless Chromium (SwiftShader: frame times are CPU-bound software GL, compare runs on
// the same box only). Offline 5v5 (startFive through xGo, as the lobby), MEDIUM preset (the desktop default), 1280x720.
// Per map, two views: the attacker spawn (round start, buy phase) and the A site centre, facing the map centre.
// For each view: renderer.info of the whole frame (world + first-person pass), VF.worldDraw (world only), triangles,
// programs, and the world draws split by source by replaying three's culling (visible chain + frustumCulled sphere test
// + one draw per material group): native map chunks (texture-array / own material), agents (bots / allies), other;
// FP pass meshes; rAF frame time over 4 s. Screenshot per view.
//   VS_ROOT=<worktree> MAPS=ascent,bind GQ=medium TAG=after [UA=...] node work/browser_drawcalls.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.VS_ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/drawcalls.json',TAG=process.env.TAG||'run',SHOT=process.env.SHOT||'/workspace/work/qa/drawcalls/shots/';
const MAPS=(process.env.MAPS||'ascent,bind,haven,split,lotus,breeze').split(','),GQ=process.env.GQ||'medium',PORT=+(process.env.PORT||8896),W=+(process.env.W||1280),H=+(process.env.H||720);
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const R={tag:TAG,root:ROOT,gq:GQ,size:[W,H],maps:{},errors:[]};const t00=Date.now();const log=(...a)=>console.log(((Date.now()-t00)/1000).toFixed(0)+'s',...a);
fs.mkdirSync(SHOT,{recursive:true});
function serve(port,root,cors){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'};if(cors)h['Access-Control-Allow-Origin']='*';res.writeHead(200,h);res.end(d);});});s.on('error',()=>r(null));s.listen(port,'127.0.0.1',()=>r(s));});}
const BREAK=`(()=>{const out={map:{arr:0,own:0,tris:0},agents:0,agentTris:0,other:0,otherTris:0,fp:0,top:{}};const fr=new THREE.Frustum(),m4=new THREE.Matrix4(),sp=new THREE.Sphere();camera.updateMatrixWorld();m4.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);fr.setFromProjectionMatrix(m4);
 const C=NM.current,root=C&&C.M.g,units=new Set();for(const b of bots.concat(allies))if(b&&b.g)units.add(b.g);
 const cls=o=>{for(let p=o;p;p=p.parent){if(p===root)return 'map';if(units.has(p))return 'agents';}return 'other';};
 scene.traverseVisible(o=>{if(!(o.isMesh||o.isPoints||o.isLine||o.isSprite))return;if(o.frustumCulled!==false){const g=o.geometry;if(o.isSprite){}else{if(!g.boundingSphere)g.computeBoundingSphere();sp.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);if(!fr.intersectsSphere(sp))return;}}
  const ms=[].concat(o.material||[]).filter(m=>m&&m.visible!==false);const n=Array.isArray(o.material)?(o.geometry.groups.length||1):ms.length?1:0;if(!n)return;const g=o.geometry,t=g&&g.index?g.index.count/3:g&&g.attributes&&g.attributes.position?g.attributes.position.count/3:0;const c=cls(o);
  if(c==='map'){if(ms[0].nmArrTex)out.map.arr+=n;else out.map.own+=n;if(o.userData.nmChunk&&o.userData.nmChunk.small)out.map.small=(out.map.small||0)+n;out.map.tris+=t;}else if(c==='agents'){out.agents+=n;out.agentTris+=t;const k='A:'+(o.name||o.type).slice(0,22);out.atop=out.atop||{};out.atop[k]=(out.atop[k]||0)+n;}else{out.other+=n;out.otherTris+=t;const k=(o.name||o.type).slice(0,24);out.top[k]=(out.top[k]||0)+n;}});
 try{VF_VIEW.scene.traverseVisible(o=>{if(o.isMesh)out.fp++;});}catch(e){}
 if(out.atop)out.atop=Object.entries(out.atop).sort((a,b)=>b[1]-a[1]).slice(0,12);out.top=Object.entries(out.top).sort((a,b)=>b[1]-a[1]).slice(0,8);out.map.calls=out.map.arr+out.map.own;return JSON.stringify(out);})()`;
(async()=>{
 const s1=await serve(PORT,ROOT,false),s2=await serve(8787,path.join(ROOT,'server','public'),true);R.worlds=!!s2;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 for(const map of MAPS){const ctx=await browser.newContext(Object.assign({viewport:{width:W,height:H},deviceScaleFactor:1},process.env.UA?{userAgent:process.env.UA}:{}));/* UA=<user agent>: e.g. an iPhone's (the iOS WebKit map path) */
  await ctx.addInitScript(gq=>{try{localStorage.setItem('vs.gq',gq);localStorage.setItem('vs.gqb',gq);}catch(e){}window.__ft=[];let last=0;const f=t=>{if(last)window.__ft.push(t-last);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);},GQ);
  await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
  await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
  const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);
  const errs=[];page.on('pageerror',e=>errs.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{const t=m.text();if(m.type()==='error'||/shader|WebGL|GL_|texture array|Map texture/i.test(t))errs.push(m.type()+' '+t.slice(0,400));});
  const X=s=>page.evaluate(s=>window.__xe(s),s);const res={views:[],errors:errs};R.maps[map]=res;
  try{
   await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
   await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
   await X(`J.pick='Jett';FV.pick=${JSON.stringify(map)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);const tl=Date.now();
   await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&NM.current.key&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:900000,polling:2000});
   res.loadS=Math.round((Date.now()-tl)/1000);await page.waitForTimeout(6000);
   res.mem=JSON.parse(await X(`JSON.stringify((()=>{const m=NM.current.memory||{};return {opt:m.optimizer,arrays:m.arrays||0,tex:m.texture,uploadMs:m.uploadMs,prepareMs:m.prepareMs,progs:(renderer.info.programs||[]).length,gl2:renderer.capabilities.isWebGL2};})())`));log(map,'loaded',res.loadS+'s',JSON.stringify(res.mem));
   const C0=JSON.parse(await X(`JSON.stringify({p:[player.x,player.y,player.z],yaw,site:NM.current.siteGoals,b:NM.current.bounds})`));
   const cx=(C0.b.x1+C0.b.x2)/2,cz=(C0.b.z1+C0.b.z2)/2;const site=C0.site.A||C0.site[Object.keys(C0.site)[0]];
   const views=[['spawn',C0.p[0],C0.p[2]],['siteA',site[0],site[1]]];
   for(const [name,x,z] of views){const yw=Math.atan2(-(cx-x),-(cz-z));
    await X(`(()=>{const C=NM.current;player.x=${x};player.z=${z};player.y=nmHeight(C,${x},${z});yaw=${yw};pitch=0;window.__pin={x:${x},z:${z},yaw:${yw}};if(!window.__pinHook){window.__pinHook=1;(window.XHK||(window.XHK=[])).push(()=>{const q=window.__pin;if(!q)return;player.x=q.x;player.z=q.z;yaw=q.yaw;pitch=0;if(player.hp<50)player.hp=100;});}return 1;})()`);
    await page.waitForTimeout(2500);await X(`{if(!window.__rw){window.__rw=1;const r0=renderer.render;renderer.render=function(sc,c){const t=performance.now();const x=r0.call(this,sc,c);if(sc===scene&&c===camera){const n=performance.now();(window.__rt||(window.__rt=[])).push([n,n-t]);}return x;};}window.__rt=[];window.__ft.length=0;}1`);await page.waitForTimeout(4000);
    const v=JSON.parse(await X(`JSON.stringify((()=>{const rt=window.__rt||[],f=window.__ft.length?window.__ft.slice():rt.slice(1).map((e,i)=>e[0]-rt[i][0]),s=f.slice().sort((a,b)=>a-b),rr=rt.map(e=>e[1]);const i=renderer.info.render,w=VF.worldDraw||{};return {frames:f.length,meanMs:+(f.reduce((a,b)=>a+b,0)/Math.max(1,f.length)).toFixed(1),p50:+(s[Math.floor(s.length/2)]||0).toFixed(1),renderMs:+(rr.reduce((a,b)=>a+b,0)/Math.max(1,rr.length)).toFixed(1),calls:i.calls,tris:i.triangles,worldCalls:w.calls,worldTris:w.triangles,progs:(renderer.info.programs||[]).length,cam:[camera.position.x,camera.position.y,camera.position.z].map(v=>+v.toFixed(1)),alive:bots.filter(b=>b.alive).length+allies.filter(b=>b.alive).length};})())`));
    v.by=JSON.parse(await X(BREAK));v.name=name;res.views.push(v);log(map,name,JSON.stringify(v));
    await page.screenshot({path:SHOT+TAG+'-'+map+'-'+name+'.jpg',type:'jpeg',quality:70,timeout:300000}).catch(e=>errs.push('shot '+e));}
  }catch(e){res.fail=String(e).slice(0,300);log(map,'FAIL',res.fail);}
  fs.writeFileSync(OUT,JSON.stringify(R,null,1));await ctx.close();}
 await browser.close();if(s1)s1.close();if(s2)s2.close();fs.writeFileSync(OUT,JSON.stringify(R,null,1));log('done');process.exit(0);
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
