// Many enemies, live page in headless Chromium (SwiftShader: absolute frame times are software-GL bound, compare runs on the
// same box only). Offline 5v5 (startFive), MEDIUM, 1280x720, Ascent A site. For N = 1 / 4 / 8 units placed 5-15 m in front
// of the player (bots first, then allies; pinned there and kept alive each frame, all firing, player firing back):
// rAF frame ms (mean / p95), renderer.render ms of the world pass, xSolTick ms per frame (agent animation + pose follow-ups
// + hit volumes), draw calls. Units are pinned inside the xSolTick wrapper before the timer starts.
//   VS_ROOT=<worktree> [INDEX=<page html, default VS_ROOT/index.html>] [MAP=ascent MS=10000] TAG=after node work/browser_many_perf.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.VS_ROOT,QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/many.json',TAG=process.env.TAG||'run';
const MAP=process.env.MAP||'ascent',GQ=process.env.GQ||'medium',PORT=+(process.env.PORT||8896),W=1280,H=720,MS=+(process.env.MS||10000);
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const R={tag:TAG,root:ROOT,map:MAP,gq:GQ,runs:[],errors:[]};const t00=Date.now();const log=(...a)=>console.log(((Date.now()-t00)/1000).toFixed(0)+'s',...a);
function serve(port,root,cors){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'};if(cors)h['Access-Control-Allow-Origin']='*';res.writeHead(200,h);res.end(d);});});s.on('error',()=>r(null));s.listen(port,'127.0.0.1',()=>r(s));});}
(async()=>{
 if(!ROOT)throw Error('VS_ROOT');
 const s1=await serve(PORT,ROOT,false),s2=await serve(8787,path.join(ROOT,'server','public'),true);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(gq=>{try{localStorage.setItem('vs.gq',gq);localStorage.setItem('vs.gqb',gq);}catch(e){}},GQ);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(process.env.INDEX||ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
 const page=await ctx.newPage();page.setDefaultTimeout(600000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/rooms|Failed to load resource|CORS/.test(t))R.errors.push(t.slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 try{
  await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  await X(`J.pick='Jett';FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:900000,polling:2000});
  log('match running');
  await X(`(()=>{try{fBuy('Vandal');}catch(e){}return 1;})()`);await page.waitForTimeout(4000);
  const C0=JSON.parse(await X(`JSON.stringify({site:NM.current.siteGoals,b:NM.current.bounds})`));const site=C0.site.A||C0.site[Object.keys(C0.site)[0]],cx=(C0.b.x1+C0.b.x2)/2,cz=(C0.b.z1+C0.b.z2)/2,yw=Math.atan2(-(cx-site[0]),-(cz-site[1]));
  // per-frame pin (inside the xSolTick wrapper, outside its timer) + timers
  await X(`(()=>{const C=NM.current;window.__pin={x:${site[0]},z:${site[1]},yaw:${yw},N:0,spots:[]};player.x=__pin.x;player.z=__pin.z;player.y=nmHeight(C,__pin.x,__pin.z);yaw=__pin.yaw;pitch=0;FV.buy=0;
   window.__M={sol:[],rt:[],rf:[],calls:0,on:false};
   const f=xSolTick;xSolTick=function(){const q=window.__pin;if(q&&player){player.x=q.x;player.z=q.z;yaw=q.yaw;pitch=0;player.hp=100;fireHeld=true;if(typeof ammo!=='undefined'&&ammo<3&&typeof MAG==='function'){ammo=MAG();reloading=0;}
     for(const s of q.spots){const b=s.b;if(!b.g)continue;b.hp=100;if(b.alive===false)continue;b.g.position.set(s.x,s.y,s.z);if('x' in b){b.x=s.x;b.z=s.z;}}}
    const a=performance.now();try{return f.apply(this,arguments);}finally{if(__M.on)__M.sol.push(performance.now()-a);}};
   const r0=renderer.render;renderer.render=function(s,c){const t=performance.now();const x=r0.call(this,s,c);if(__M.on&&s===scene&&c===camera){__M.rt.push(performance.now()-t);__M.calls+=this.info.render.calls;}return x;};
   let last=0;const raf=requestAnimationFrame.bind(window);const tick=t=>{if(__M.on&&last)__M.rf.push(t-last);last=t;raf(tick);};raf(tick);return 1;})()`);
  for(const N of [1,4,8]){
   const placed=await X(`(()=>{const C=NM.current,q=__pin,fx=-Math.sin(q.yaw),fz=-Math.cos(q.yaw);q.spots=[];let i=0;
     for(const b of bots.concat(allies)){if(i>=${N})break;if(!b.g||b.alive===false)continue;const d=5+1.4*i,s=((i%2)?1:-1)*(0.8+0.5*i);const x=q.x+fx*d+fz*s,z=q.z+fz*d-fx*s;let y=player.y;try{y=nmHeight(C,x,z,player.y+1);}catch(e){}q.spots.push({b,x,y,z});i++;}
     // everyone else far away behind the player (out of view)
     let k=0;for(const b of bots.concat(allies)){if(q.spots.some(s=>s.b===b)||!b.g)continue;const x=q.x-fx*(60+3*k),z=q.z-fz*(60+3*k);q.spots.push({b,x,y:player.y,z,far:1});k++;}
     return i;})()`);
   await page.waitForTimeout(3000);
   await X('__M.sol=[];__M.rt=[];__M.rf=[];__M.calls=0;__M.on=true;1');await page.waitForTimeout(MS);
   const m=JSON.parse(await X(`(()=>{__M.on=false;const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,p95=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length*.95)];};
     const alive=__pin.spots.filter(s=>!s.far&&s.b.alive!==false).length;
     return JSON.stringify({frames:__M.rf.length,frameMs:+mean(__M.rf).toFixed(1),frameP95:+p95(__M.rf).toFixed(1),renderMs:+mean(__M.rt).toFixed(1),xSolTickMs:+mean(__M.sol).toFixed(2),xSolTickP95:+p95(__M.sol).toFixed(2),solCalls:__M.sol.length,calls:__M.rt.length?+(__M.calls/__M.rt.length).toFixed(0):null,aliveInView:alive});})()`));
   m.n=N;m.placed=placed;R.runs.push(m);log('N',N,JSON.stringify(m));fs.writeFileSync(OUT,JSON.stringify(R,null,1));
  }
 }catch(e){R.fail=String(e).slice(0,300);log('FAIL',R.fail);}
 fs.writeFileSync(OUT,JSON.stringify(R,null,1));await browser.close();if(s1)s1.close();if(s2)s2.close();log('done');process.exit(0);
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
