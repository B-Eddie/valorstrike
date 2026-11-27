// Lane CPU harness (derived from qa/astra/vs_exp.cjs). Offline 5v5 match, preset GQ, map MAP.
//  ROOT=<worktree> MAP=ascent GQ=medium NOOP=1 STEPS=dump,meas node lane.cjs out.json
//  STEPS: dump (scene tree stats) | meas (NOOP GL frame timings, MEAS_S seconds x MEAS_N) | js:<file> (evaluate a file of JS in page, result logged)
const PW='/workspace/work/pw/node_modules/playwright';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.ROOT||'/workspace/work/vs-lane-cpu',QA='/workspace/work/qa/',OUT=process.argv[2]||'/workspace/work/qa/cpu/out.json';
const MAP=process.env.MAP||'ascent',GQ=process.env.GQ||'medium',W=+(process.env.W||1280),H=+(process.env.H||720),PORT=+(process.env.PORT||8951);
const NOOP=!!process.env.NOOP,SETTLE=+(process.env.SETTLE||8),MEAS_S=+(process.env.MEAS_S||10),MEAS_N=+(process.env.MEAS_N||3),STEPS=(process.env.STEPS||'dump,meas').split(',');
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.cjs':'application/javascript','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.mp3':'audio/mpeg'};
const t00=Date.now();fs.writeFileSync(OUT+'.log','');const log=(...a)=>{const s=((Date.now()-t00)/1000).toFixed(0)+'s '+a.join(' ');console.log(s);fs.appendFileSync(OUT+'.log',s+'\n');};
const R={map:MAP,gq:GQ,root:ROOT,errors:[]};const save=()=>fs.writeFileSync(OUT,JSON.stringify(R,null,1));
function serve(){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)){res.writeHead(403);return res.end();}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(d);});});s.listen(PORT,'127.0.0.1',()=>r(s));});}
(async()=>{
 const srv=await serve();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1','--disable-gpu-watchdog']});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(gq=>{try{localStorage.setItem('vs.gq',gq);localStorage.setItem('vs.gqb',gq);}catch(e){}window.__ft=[];let last=0;const f=t=>{if(last)window.__ft.push(t-last);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);if(window.__noaa){}},GQ);
 if(process.env.NOAA)await ctx.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){if(/webgl/.test(t)&&a&&typeof a==='object')a=Object.assign({},a,{antialias:false});return g.call(this,t,a);};});
 await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.abort();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
 const page=await ctx.newPage();try{await require(ROOT+'/work/pw_shot.cjs')(ctx,page);}catch(e){}page.setDefaultTimeout(900000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);global.X=X;global.page=page;global.R=R;global.log=log;
 try{
  await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});await page.waitForTimeout(2000);
  log('boot');
  await X(`J.pick='Jett';FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);const tl=Date.now();
  await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&NM.current.key&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:1500000,polling:2000});
  R.loadS=Math.round((Date.now()-tl)/1000);log('match loaded',R.loadS+'s');
  await X(`(()=>{(window.XHK||(window.XHK=[])).push(()=>{try{if(player&&player.hp<60)player.hp=100;if(!window.__noturn){yaw+=0.004;pitch=0;}}catch(e){}});return 1;})()`);
  await page.waitForTimeout(SETTLE*1000);
  R.cfg=JSON.parse(await X(`JSON.stringify({pr:renderer.getPixelRatio(),buf:[renderer.domElement.width,renderer.domElement.height],gov:XGV.on,xs:{res:XS.res,shd:XS.shd,aa:XS.aa,lod:XS.lod}})`));log('cfg',JSON.stringify(R.cfg));
  const NOOPJS=async()=>{R.noop=await X(`(()=>{const P=WebGL2RenderingContext.prototype;const N=['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','drawRangeElements','clear','useProgram','bindTexture','activeTexture','bindVertexArray','enable','disable','blendFunc','blendFuncSeparate','blendEquation','blendEquationSeparate','depthMask','depthFunc','colorMask','viewport','scissor','cullFace','frontFace','polygonOffset','stencilFunc','stencilOp','stencilMask','uniformMatrix4fv','uniformMatrix3fv','uniformMatrix2fv','uniform1f','uniform1i','uniform2fv','uniform3fv','uniform4fv','uniform1fv','uniform3f','uniform4f','uniform2f','uniform1iv','uniform2i','uniform3i','uniform4i'];let k=0;for(const n of N){if(P[n]){P[n]=function(){};k++;}}return k;})()`);log('noop',R.noop);};if(NOOP)await NOOPJS();
  await X(`(()=>{const T=window.__tm={};const wrap=(name,get,set)=>{const f=get();if(typeof f!=='function'||f.__w)return;const w=function(){const t=performance.now();try{return f.apply(this,arguments);}finally{const e=T[name]||(T[name]=[0,0]);e[0]+=performance.now()-t;e[1]++;}};w.__w=1;set(w);};
   wrap('loop',()=>loop,v=>loop=v);wrap('xSimRun',()=>xSimRun,v=>xSimRun=v);wrap('xVis',()=>xVis,v=>xVis=v);wrap('vmTick',()=>vmTick,v=>vmTick=v);wrap('xSolTick',()=>xSolTick,v=>xSolTick=v);
   const rr=renderer.render;renderer.render=function(sc,c){const t=performance.now();try{return rr.call(this,sc,c);}finally{const k=sc===scene?'render:main':'render:other';const e=T[k]||(T[k]=[0,0]);e[0]+=performance.now()-t;e[1]++;}};
   const um=scene.updateMatrixWorld;scene.updateMatrixWorld=function(f){const t=performance.now();try{return um.call(this,f);}finally{const e=T['umw']||(T['umw']=[0,0]);e[0]+=performance.now()-t;e[1]++;}};
   return 1;})()`);
  for(const st of STEPS){
   if(st==='dump'){R.dump=JSON.parse(await X(fs.readFileSync(__dirname+'/dump.js','utf8')));log('dump',JSON.stringify(R.dump).slice(0,6000));save();}
   else if(st==='noop')await NOOPJS();
   else if(st==='warm'){const tw=Date.now();while(Date.now()-tw<180000){await X(`window.__ft.length=0;1`);await page.waitForTimeout(3000);const n=+(await X('window.__ft.length'));log('warm frames/3s',n);if(n>60)break;}}
   else if(st==='meas'){R.meas=R.meas||[];for(let i=0;i<MEAS_N;i++){await X(`window.__ft.length=0;for(const k in window.__tm)delete window.__tm[k];1`);await page.waitForTimeout(MEAS_S*1000);const r=JSON.parse(await X(`JSON.stringify((()=>{const n=window.__ft.length,T=window.__tm,o={frames:n,ftMean:+(window.__ft.reduce((a,b)=>a+b,0)/Math.max(1,n)).toFixed(2),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};for(const k in T)o[k]=+(T[k][0]/Math.max(1,n)).toFixed(3);return o;})())`));log('meas',JSON.stringify(r));R.meas.push(r);}save();}
   else if(st.startsWith('js:')){const f=st.slice(3);const r=await X(fs.readFileSync(f,'utf8'));log('js',f,String(r).slice(0,4000));(R.js=R.js||{})[f]=r;save();}
   else if(st.startsWith('node:')){const f=st.slice(5);await require(f)(X,page,R,log);save();}
  }
 }catch(e){R.fail=String(e).slice(0,400);log('FAIL',R.fail);}
 save();await browser.close();srv.close();log('done');process.exit(0);
})();
