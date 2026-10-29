// Frame-spike sources in a live match + the many-enemies view, headless Chromium (SwiftShader: a frame takes hundreds of ms in
// software GL, so wall frame times are not the user's; what is counted here is the work a real GPU driver would also do on
// the main thread: shader program links (gl.linkProgram + the LINK_STATUS read, timed), texture uploads (texImage2D /
// texSubImage2D / texStorage, sized), buffer creations, long tasks, and per-frame JS time outside renderer.render).
// Scenario (offline 5v5, MEDIUM): spawn -> buy a Vandal -> walk to A site -> N enemies placed 5-15 m in front, firing at
// them (they fire back) -> abilities (C, Q, E) -> knife -> back to the rifle. Every event logged with the frame it hit.
// Also: draw calls by source with the N enemies in view (map / agents / FP / other) and agent draws per enemy.
//   VS_ROOT=<worktree> MAP=ascent N=8 TAG=after node work/browser_spikes.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.VS_ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/spikes.json',TAG=process.env.TAG||'run',SHOT=process.env.SHOT||'/workspace/work/qa/drawcalls/shots/';
const MAP=process.env.MAP||'ascent',N=+(process.env.N||8),GQ=process.env.GQ||'medium',PORT=+(process.env.PORT||8896),W=+(process.env.W||1280),H=+(process.env.H||720);
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const R={tag:TAG,map:MAP,n:N,gq:GQ,phases:[],errors:[]};const t00=Date.now();const log=(...a)=>console.log(((Date.now()-t00)/1000).toFixed(0)+'s',...a);
function serve(port,root,cors){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'};if(cors)h['Access-Control-Allow-Origin']='*';res.writeHead(200,h);res.end(d);});});s.on('error',()=>r(null));s.listen(port,'127.0.0.1',()=>r(s));});}
// GL instrumentation, installed before the page creates its context
const GLHOOK=()=>{const E=window.__GE=[];window.__GF=0;window.__glLive=false;const P=WebGL2RenderingContext.prototype,wrap=(n,f)=>{const o=P[n];P[n]=function(){return f.call(this,o,arguments);};};
 const put=(k,ms,x)=>{if(window.__glLive)E.push([window.__GF,k,+ms.toFixed(2),x]);};
 wrap('linkProgram',function(o,a){const t=performance.now();const r=o.apply(this,a);this.getProgramParameter(a[0],this.LINK_STATUS);put('link',performance.now()-t,window.__progName||'');return r;});
 for(const n of ['texImage2D','texSubImage2D','texImage3D','texSubImage3D','texStorage2D','texStorage3D','compressedTexImage2D'])wrap(n,function(o,a){const t=performance.now();const r=o.apply(this,a);const s=a[a.length-1];const wh=s&&s.width?s.width+'x'+s.height:(a[3]+'x'+a[4]);put(n,performance.now()-t,wh);return r;});
 wrap('bufferData',function(o,a){const t=performance.now();const r=o.apply(this,a);const b=a[1]&&a[1].byteLength;if(b>65536)put('bufferData',performance.now()-t,b);return r;});
 const raf=window.requestAnimationFrame.bind(window);const tick=()=>{window.__GF++;raf(tick);};raf(tick);
 window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(window.__glLive)window.__lt.push([window.__GF,Math.round(e.duration)]);}).observe({type:'longtask',buffered:false});}catch(e){}};
(async()=>{
 const s1=await serve(PORT,ROOT,false),s2=await serve(8787,path.join(ROOT,'server','public'),true);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(gq=>{try{localStorage.setItem('vs.gq',gq);localStorage.setItem('vs.gqb',gq);}catch(e){}},GQ);await ctx.addInitScript(GLHOOK);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/rooms|Failed to load resource|CORS/.test(t))R.errors.push(t.slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 try{
  await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  await X(`J.pick='Jett';FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:900000,polling:2000});
  // program names: three passes the material to getProgram; tag the link with the material being drawn
  await X(`{const P=renderer.properties;const r0=renderer.render;window.__progName='';const C=renderer.compile;renderer.compile=function(){window.__progName='compile()';try{return C.apply(this,arguments);}finally{window.__progName='';}};}1`);
  await X(`{window.__rt=[];const r0=renderer.render;renderer.render=function(s,c){const t=performance.now();const x=r0.call(this,s,c);if(s===scene&&c===camera)window.__rt.push([window.__GF,+(performance.now()-t).toFixed(1),this.info.render.calls]);return x;};}1`);
  await page.waitForTimeout(3000);await X('window.__glLive=true;window.__GE.length=0;1');
  const phase=async(name,js,ms)=>{const f0=await X('window.__GF');if(js)await X(js).catch(e=>R.errors.push(name+': '+String(e).slice(0,200)));await page.waitForTimeout(ms);const f1=await X('window.__GF');
   const ev=JSON.parse(await X(`JSON.stringify(window.__GE.splice(0))`)),lt=JSON.parse(await X('JSON.stringify(window.__lt.splice(0))')),rt=JSON.parse(await X('JSON.stringify(window.__rt.splice(0))'));
   const sum=k=>ev.filter(e=>e[1]===k);const p={name,frames:f1-f0,links:sum('link').length,linkMs:+sum('link').reduce((a,e)=>a+e[2],0).toFixed(1),linkMax:Math.max(0,...sum('link').map(e=>e[2])),uploads:ev.filter(e=>/^tex/.test(e[1])).length,uploadMs:+ev.filter(e=>/^tex/.test(e[1])).reduce((a,e)=>a+e[2],0).toFixed(1),uploadSizes:[...new Set(ev.filter(e=>/^tex/.test(e[1])).map(e=>e[3]))].slice(0,12),bigBuffers:sum('bufferData').length,longTasks:lt.length,longMax:Math.max(0,...lt.map(x=>x[1])),calls:rt.length?rt[rt.length-1][2]:null,renderMsMean:rt.length?+(rt.reduce((a,x)=>a+x[1],0)/rt.length).toFixed(1):null,events:ev.slice(0,40)};
   R.phases.push(p);log(name,JSON.stringify(Object.assign({},p,{events:undefined})));fs.writeFileSync(OUT,JSON.stringify(R,null,1));return p;};
  await phase('idle spawn',null,5000);
  await phase('buy vandal',`(()=>{try{fBuy('Vandal');}catch(e){}return 1;})()`,6000);
  const C0=JSON.parse(await X(`JSON.stringify({site:NM.current.siteGoals,b:NM.current.bounds})`));const site=C0.site.A||C0.site[Object.keys(C0.site)[0]],cx=(C0.b.x1+C0.b.x2)/2,cz=(C0.b.z1+C0.b.z2)/2,yw=Math.atan2(-(cx-site[0]),-(cz-site[1]));
  await phase('to A site',`(()=>{const C=NM.current;player.x=${site[0]};player.z=${site[1]};player.y=nmHeight(C,${site[0]},${site[1]});yaw=${yw};pitch=0;window.__pin={x:${site[0]},z:${site[1]},yaw:${yw}};(window.XHK||(window.XHK=[])).push(()=>{const q=window.__pin;if(!q||!player)return;player.x=q.x;player.z=q.z;if(player.hp<60)player.hp=100;});return 1;})()`,6000);
  const place=`(()=>{FV.buy=0;const C=NM.current,fx=-Math.sin(yaw),fz=-Math.cos(yaw);let i=0;for(const b of bots.concat(allies.slice(0,Math.max(0,${N}-bots.length)))){if(!b.g)continue;if(!b.alive&&typeof b.hp!=='undefined'){continue;}const d=5+1.4*i,s=((i%2)?1:-1)*(0.8+0.5*i);const x=player.x+fx*d+fz*s,z=player.z+fz*d-fx*s;try{b.g.position.set(x,nmHeight(C,x,z,player.y+1),z);}catch(e){}if(++i>=${N})break;}return i;})()`;
  R.placed=await X(place);
  const many=await phase('N enemies in view',`window.__fireOn=1;(window.XHK||(window.XHK=[])).push(()=>{if(window.__fireOn&&player&&player.hp>0){fireHeld=true;if(typeof ammo!=='undefined'&&ammo<3&&typeof MAG==='function'){ammo=MAG();reloading=0;}}});1`,8000);
  R.manyBy=JSON.parse(await X(`(()=>{const out={map:0,agents:0,agentMeshes:0,units:0,other:0,fp:0,perUnit:[]};const fr=new THREE.Frustum(),m4=new THREE.Matrix4(),sp=new THREE.Sphere();camera.updateMatrixWorld();m4.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);fr.setFromProjectionMatrix(m4);const root=NM.current.M.g,U=new Map();for(const b of bots.concat(allies))if(b.g)U.set(b.g,{n:0,ag:b.nm||b.ag||''});
   const cls=o=>{for(let p=o;p;p=p.parent){if(p===root)return ['map'];if(U.has(p))return ['agents',p];}return ['other'];};
   scene.traverseVisible(o=>{if(!o.isMesh&&!o.isSprite&&!o.isPoints&&!o.isLine)return;if(o.frustumCulled!==false&&!o.isSprite){const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();sp.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);if(!fr.intersectsSphere(sp))return;}const c=cls(o);if(c[0]==='agents'){out.agents++;U.get(c[1]).n++;}else out[c[0]]++;});
   for(const [g,u] of U)if(u.n)out.perUnit.push(u.n);out.units=out.perUnit.length;try{VF_VIEW.scene.traverseVisible(o=>{if(o.isMesh)out.fp++;});}catch(e){}return JSON.stringify(out);})()`));log('many by',JSON.stringify(R.manyBy));
  await page.screenshot({path:SHOT+TAG+'-many-'+MAP+'.jpg',type:'jpeg',quality:70,timeout:300000}).catch(()=>{});
  for(const k of ['KeyC','KeyQ','KeyE']){await phase('ability '+k,null,10);await page.keyboard.press(k).catch(()=>{});await page.mouse.click(W/2,H/2).catch(()=>{});await page.waitForTimeout(3500);await phase('after '+k,null,1500);}
  await phase('knife',`(()=>{try{swapW('knife');}catch(e){}return 1;})()`,4000);
  await phase('rifle again',`(()=>{try{swapW('pri');}catch(e){}window.__fireOn=0;fireHeld=false;return 1;})()`,4000);
 }catch(e){R.fail=String(e).slice(0,300);log('FAIL',R.fail);}
 fs.writeFileSync(OUT,JSON.stringify(R,null,1));await browser.close();if(s1)s1.close();if(s2)s2.close();log('done');process.exit(0);
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
