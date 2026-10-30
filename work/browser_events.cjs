// Event hitch catalogue in headless Chromium (a tool, not in test_all; companion of work/bench_events.cjs). SwiftShader
// software GL: frame times are CPU-bound and far slower than a real GPU, so compare runs on the same box only; what carries
// over to real hardware is the GPU WORK each event triggers for the first time: shader compiles / program links (counted
// and timed by wrapping WebGL2RenderingContext), texture uploads (texImage2D / texSubImage2D / texStorage2D / compressed*),
// buffer creation (bufferData), plus renderer.info.programs growth and long tasks.
// Offline 5v5 (xGo(startFive), as the lobby) at the MEDIUM preset (desktop default), small viewport (W x H, DSF 1).
// Per event window (WIN ms after the trigger): rAF frame intervals (p50 / max / count > 50 ms), compiles + link ms,
// uploads, buffers, programs before -> after, long tasks.
//   VS_ROOT=<worktree> AGENT=Jett MAP=ascent TAG=base node work/browser_events.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.VS_ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/bevents.json',TAG=process.env.TAG||'run';
const MAP=process.env.MAP||'ascent',AGENT=process.env.AGENT||'Jett',GQ=process.env.GQ||'medium',PORT=+(process.env.PORT||8897),W=+(process.env.W||640),H=+(process.env.H||360),WIN=+(process.env.WIN||2500);
const ONLY=process.env.ONLY?process.env.ONLY.split(','):null,ABIL_ONLY=!!process.env.ABIL_ONLY;
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.ktx2':'image/ktx2'};
const R={tag:TAG,root:ROOT,gq:GQ,map:MAP,agent:AGENT,size:[W,H],events:[],errors:[]};const t00=Date.now();const log=(...a)=>console.log(((Date.now()-t00)/1000).toFixed(0)+'s',...a);
function serve(port,root,cors){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'};if(cors)h['Access-Control-Allow-Origin']='*';res.writeHead(200,h);res.end(d);});});s.on('error',()=>r(null));s.listen(port,'127.0.0.1',()=>r(s));});}
// GL instrumentation, installed before the page makes its context
const GLHOOK=()=>{const G=window.__GL={compile:0,link:0,linkMs:0,compileMs:0,tex:0,texBytes:0,buf:0,bufBytes:0,draw:0,progInfo:[],on:true};
 for(const C of [window.WebGL2RenderingContext,window.WebGLRenderingContext]){if(!C)continue;const P=C.prototype;
  const wrapT=(k,f)=>{const o=P[k];if(!o)return;P[k]=function(){const r=f?f.apply(this,arguments):0;return o.apply(this,arguments);};};
  const oc=P.compileShader;P.compileShader=function(s){const t=performance.now();const r=oc.call(this,s);G.compile++;G.compileMs+=performance.now()-t;return r;};
  const ol=P.linkProgram;P.linkProgram=function(p){const t=performance.now();const r=ol.call(this,p);G.link++;G.linkMs+=performance.now()-t;return r;};
  // three r149 reads LINK_STATUS right after linking unless KHR_parallel_shader_compile; the status query is where the driver waits: time it
  const og=P.getProgramParameter;P.getProgramParameter=function(p,k){const t=performance.now();const r=og.call(this,p,k);G.linkMs+=performance.now()-t;return r;};
  const osi=P.getShaderInfoLog,opi=P.getProgramInfoLog;
  for(const k of ['texImage2D','texSubImage2D','texImage3D','texSubImage3D','compressedTexImage2D','compressedTexSubImage2D','texStorage2D','texStorage3D'])wrapT(k,function(){G.tex++;});
  wrapT('bufferData',function(t,d){G.buf++;G.bufBytes+=(d&&d.byteLength)||0;});
  for(const k of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])wrapT(k,function(){G.draw++;});}};
const B0=`(()=>{const g=window.__GL;return JSON.stringify({compile:g.compile,link:g.link,linkMs:g.linkMs,compileMs:g.compileMs,tex:g.tex,buf:g.buf,bufBytes:g.bufBytes,progs:(renderer.info.programs||[]).length,lt:window.__lt.length,ft:window.__ft.length});})()`;
(async()=>{
 const s1=await serve(PORT,ROOT,false),s2=await serve(8787,path.join(ROOT,'server','public'),true);R.worlds=!!s2;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1'].concat(process.env.EXTRA?process.env.EXTRA.split(' '):[])});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(gq=>{try{localStorage.setItem('vs.gq',gq);localStorage.setItem('vs.gqb',gq);localStorage.setItem('vs.cap','0');}catch(e){}window.__ft=[];window.__lt=[];window.__rafN=0;let last=0;const f=t=>{window.__rafN++;if(last)window.__ft.push([t,t-last]);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask',buffered:true});}catch(e){}},GQ);
 await ctx.addInitScript(GLHOOK);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
 // map / model PNG + JPG textures served as one 8x8 image (TINYTEX=0 to keep them): SwiftShader spent minutes uploading and mip-mapping the
 // full-size map textures after load (the page's main thread blocked on synchronous GL calls); texture sizes never change a shader program
 if(process.env.TINYTEX!=='0'){const tiny=fs.readFileSync('/workspace/work/qa/eventperf/tiny.png');await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/models/.*\\.(png|jpg)(\\?.*)?$'),r=>r.fulfill({body:tiny,contentType:'image/png'}));}
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{const t=m.text();if(m.type()==='error'||/shader|WebGL|GL_/i.test(t))R.errors.push(m.type()+' '+t.slice(0,300));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const wait=ms=>page.waitForTimeout(ms);
 const save=()=>fs.writeFileSync(OUT,JSON.stringify(R,null,1));
 // one window: pre (not measured), trig, then WIN ms; steps: [[atMs, code], ...] run during the window
 async function win(name,{pre,trig,ms=WIN,steps=[]}={}){
  if(ONLY&&!ONLY.some(o=>name.startsWith(o)))return null;
  if(pre)await X(pre);await wait(150);
  const b=JSON.parse(await X(B0));const t0=Date.now();if(trig)await X(trig);
  for(const [at,code] of steps){const d=at-(Date.now()-t0);if(d>0)await wait(d);await X(code);}
  const left=ms-(Date.now()-t0);if(left>0)await wait(left);
  const a=JSON.parse(await X(B0));const fr=JSON.parse(await X(`JSON.stringify(window.__ft.slice(${b.ft}).map(x=>x[1]))`)),lt=JSON.parse(await X(`JSON.stringify(window.__lt.slice(${b.lt}))`));
  const s=[...fr].sort((x,y)=>x-y),q=k=>s.length?+s[Math.min(s.length-1,Math.floor(s.length*k))].toFixed(1):0;
  const row={name,frames:fr.length,p50:q(.5),p90:q(.9),max:q(1),first3:fr.slice(0,3).map(x=>+x.toFixed(0)),long50:fr.filter(x=>x>50).length,compile:a.compile-b.compile,link:a.link-b.link,glMs:+((a.linkMs-b.linkMs)+(a.compileMs-b.compileMs)).toFixed(1),tex:a.tex-b.tex,buf:a.buf-b.buf,bufKB:Math.round((a.bufBytes-b.bufBytes)/1024),progs:b.progs+'->'+a.progs,longTasks:lt.map(x=>x[1]).slice(0,6)};
  R.events.push(row);log('EV',JSON.stringify(row));save();return row;}
 try{
  log('goto');await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});log('dom');await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  log('assets');const L0=JSON.parse(await X(B0));
  await X(`J.pick=${JSON.stringify(AGENT)};FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);const tl=Date.now();
  await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&NM.current.key&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:900000,polling:2000});
  R.loadS=Math.round((Date.now()-tl)/1000);log('running',R.loadS);
  // agent models + the first frames
  await page.waitForFunction(()=>window.__xe('bots.concat(allies).every(b=>!b.xm||b.xm.valorant)'),null,{timeout:300000,polling:2000}).catch(()=>{});
  log('agents');await wait(4000);const L1=JSON.parse(await X(B0));R.load={compile:L1.compile-L0.compile,linkMs:+(L1.linkMs-L0.linkMs).toFixed(0),tex:L1.tex-L0.tex,progs:L1.progs};
  if(!process.env.KEEPMAP){await X('NM.current.M.g.visible=false;window.__hideMap=setInterval(()=>{try{NM.current.M.g.visible=false}catch(e){}},200);1');await wait(3000);}
  {const ts=Date.now();let ok=0;while(Date.now()-ts<600000){const a=await X('window.__rafN');await wait(2000);const b=await X('window.__rafN');if(b-a>=8){if(++ok>=2)break;}else ok=0;}R.settleS=Math.round((Date.now()-ts)/1000);log('settled',R.settleS+'s');}
  R.dbg=await X('JSON.stringify({xnf:XNF,raf:window.__rafN,paused,running,hidden:document.hidden,cov:xCov(),gate:(()=>{try{return xGate()}catch(e){return String(e)}})(),draw:__GL.draw,lob0:typeof xLob0!=="undefined"?xLob0:null,ldOn:!!window.xLdOn})');await wait(2000);R.dbg2=await X('JSON.stringify({xnf:XNF,raf:window.__rafN,paused,draw:__GL.draw,ptr:document.pointerLockElement?1:0,menu:FV.menu})');log('dbg',R.dbg,R.dbg2);
  if(process.env.DBG){for(let i=0;i<4;i++){const t=Date.now();const v=await X('JSON.stringify({raf:window.__rafN,draw:__GL.draw,ft:(window.__ft||[]).slice(-3)})');log('t',i,v,Date.now()-t);await wait(1500);}await page.screenshot({path:'/tmp/dbg.jpg',type:'jpeg'});log('after shot',await X('JSON.stringify({raf:window.__rafN,draw:__GL.draw})'));await wait(2000);log('after2',await X('JSON.stringify({raf:window.__rafN,draw:__GL.draw})'));save();process.exit(0);}
  R.xs=await X('JSON.stringify({gq:localStorage.getItem("vs.gq"),prc:XS.prc,shd:XS.shd,shm:XS.shm,aa:XS.aa,lod:XS.lod,res:XS.res,pick:J.pick,rigs:bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length,pr:renderer.getPixelRatio()})');log('loaded',R.loadS+'s',JSON.stringify(R.load),R.xs);
  await X(`{if(!window.__rw){window.__rw=1;window.__ft=[];let last=0;const r0=renderer.render;renderer.render=function(sc,c){const x=r0.call(this,sc,c);if(sc===scene&&c===camera){const n=performance.now();if(last)window.__ft.push([n,n-last]);last=n;}return x;};}}1`);
  await X(`window.__qa={
   ring(p,r,a){for(let k=0;k<16;k++){const t=a+(k%2?1:-1)*Math.floor((k+1)/2)*0.25,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r,y=p.y||0;const gy=groundAt(x,z,0.5,y+1);if(Math.abs(gy-y)>1.2)continue;if(!blocked(x,z,0.45,gy)&&los(new THREE.Vector3(x,gy+1.5,z),new THREE.Vector3(p.x,y+1.4,p.z)))return [x,gy,z];}return null;},
   face(b,p){const q=b.g.position;b.g.rotation.y=Math.atan2(p.x-q.x,p.z-q.z);},
   god(){if(player){player.hp=Math.max(player.hp,1000);player.armor=50;}},
   aimAt(b){const q=b.g.position,dx=q.x-player.x,dz=q.z-player.z,dy=(q.y||0)+1.2-((player.y||0)+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));},
   stop(){for(const b of bots)b.cd=1e9;for(const a of allies)a.cd=1e9;},
   key(c,d){window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c.replace(/^Key|^Digit/,'').toLowerCase(),bubbles:true}));},
   mouse(b,d){(d?renderer.domElement:window).dispatchEvent(new MouseEvent(d?'mousedown':'mouseup',{button:b,bubbles:true}));},
   tap(c){__qa.key(c,true);setTimeout(()=>__qa.key(c,false),60);},
   click(b){__qa.mouse(b||0,true);setTimeout(()=>__qa.mouse(b||0,false),60);},
   nextRound(){return new Promise(res=>{const t0=performance.now();const f=()=>{if(running&&FV.buy>0)return res(1);if(performance.now()-t0>20000)return res(0);setTimeout(f,100);};f();});},
  };1`);
  await win('calm_buy',{});
  await win('buy_end',{trig:'FV.buy=0.02;1'});
  await win('calm_live',{});
  if(!ABIL_ONLY){
  const J5=`(()=>{const L=bots.filter(b=>b.alive);for(let i=0;i<L.length;i++){const b=L[i];b.hp=100;const s=__qa.ring(player,7+i*1.3,i*1.2566);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.face(b,player);b.cd=0;}__qa.god();if(!window.__godT)window.__godT=setInterval(()=>{if(window.__god){__qa.god();for(const b of bots)if(b.alive&&window.__god>1)b.hp=100;}},50);window.__god=2;return L.length;})()`;
  await win('jumped5_first',{trig:J5,ms:3000});await win('jumped5_again',{trig:J5,ms:3000});await X('__qa.stop();window.__god=1;1');
  const HIT=hp=>`(()=>{const b=bots.find(x=>x.alive);window.__qaB=b;const s=__qa.ring(player,8,0)||[player.x,player.y||0,player.z-8];b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);b.hp=${hp};__qa.aimAt(b);ammo=Math.max(ammo,10);reloading=0;fcd=0;VM.sw=0;shoot(false);return b.hp;})()`;
  await win('hit_enemy',{trig:HIT(100),ms:1500});await win('hit_enemy_again',{trig:HIT(100),ms:1500});
  const MK=`(()=>{const L=bots.filter(b=>b.alive);window.__mk=L;for(let i=0;i<L.length;i++){const b=L[i];const s=__qa.ring(player,6+i,i*0.35-0.5)||[player.x+2*i,player.y||0,player.z-7];b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);b.hp=1;b.cd=1e9;}let k=0;const f=()=>{const b=__mk.find(x=>x.alive);if(!b||k++>12)return;__qa.aimAt(b);fcd=0;ammo=Math.max(ammo,5);reloading=0;VM.sw=0;shoot(false);setTimeout(f,70);};f();return L.length;})()`;
  await win('multikill',{trig:MK,ms:3000});
  await win('round_end',{trig:'window.__god=0;if(running){fCheck(true,"QA")}1',ms:1500});
  await X('__qa.nextRound()');await wait(200);
  await win('round_start_after',{ms:2500});
  await win('buy_menu_open',{trig:'__qa.tap("KeyB");1',ms:1500});
  await win('buy_vandal',{trig:'(()=>{try{fBuy("Vandal")}catch(e){return String(e)}return 1})()',ms:1500});
  await win('buy_menu_close',{trig:'__qa.tap("KeyB");1',ms:1000});
  await win('buy_end2',{trig:'FV.buy=0.02;__qa.stop();window.__god=1;1'});
  for(const [k,lab] of [['Digit1','pri'],['Digit2','pis'],['Digit3','knife'],['Digit1','pri2']])await win('swap_'+lab,{trig:`__qa.tap("${k}");1`,ms:1500});
  const FIRE=`(()=>{const b=bots.find(x=>x.alive);if(b){window.__qaB=b;b.hp=100;const s=__qa.ring(player,9,0.7);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);}window.__god=2;__qa.mouse(0,true);setTimeout(()=>__qa.mouse(0,false),400);return 1;})()`;
  await win('fire_pri_first',{trig:FIRE,ms:1500});
  await win('reload1',{trig:'__qa.tap("KeyR");1',ms:3000});
  await win('fire_pri_2',{trig:FIRE,ms:1000});
  await win('reload2',{trig:'__qa.tap("KeyR");1',ms:3000});
  await win('swap_pis_fire',{trig:'__qa.tap("Digit2");1',ms:1000});await win('fire_pis_first',{trig:FIRE,ms:1500});
  await win('reload_pis',{trig:'__qa.tap("KeyR");1',ms:2500});
  await win('swap_back',{trig:'__qa.tap("Digit1");1',ms:1000});
  await win('scoreboard',{trig:'__qa.key("Tab",true);setTimeout(()=>__qa.key("Tab",false),800);1',ms:1500});
  await win('drop_gun',{trig:'__qa.tap("KeyG");1',ms:1500});
  await win('pickup_gun',{trig:'__qa.key("KeyF",true);setTimeout(()=>__qa.key("KeyF",false),300);1',ms:1500});
  await win('decals_spray',{trig:'(()=>{let n=0;const f=()=>{if(n++>150)return;yaw+=0.04;ammo=30;reloading=0;fcd=0;try{spray=0;}catch(e){}shoot(false);setTimeout(f,25);};f();return 1;})()',ms:5000});
  await win('calm_decals',{});
  await win('plant',{pre:`(()=>{const s=FV.sp;s.st="carry";s.c=player;s.pt=0;let best=null;for(let gx=-80;gx<=80&&!best;gx+=2)for(let gz=-80;gz<=80;gz+=2){if(inSite({x:gx,z:gz})&&!blocked(gx,gz,0.5,0)){best=[gx,gz];break;}}if(best){player.x=best[0];player.z=best[1];player.y=groundAt(best[0],best[1],0.3,5);player.vx=player.vz=0;}return 1;})()`,
   trig:'keys.Digit4=true;window.__k4=setInterval(()=>{keys.Digit4=true;},50);1',ms:5500});
  await X('clearInterval(window.__k4);keys.Digit4=false;1');
  await win('post_plant',{});
  await win('spike_explode',{trig:'FV.sp.t=0.03;1',ms:2000});
  await X('__qa.nextRound()');await X('FV.buy=0.02;__qa.stop();1');await wait(800);
  await win('defuse_done',{trig:`(()=>{const s=FV.sp;const d=bots.find(b=>b.alive);s.st="plant";s.t=30;s.x=player.x+1;s.z=player.z;s.y=player.y||0;s.dt=6.9;fsM.position.set(s.x,0.4,s.z);fsM.visible=true;if(d){d.g.position.set(s.x+0.5,s.y,s.z);d.g.updateMatrixWorld(true);s.du=d;d.h4=1;}return !!d;})()`,ms:2000});
  await X('__qa.nextRound()');await X('FV.buy=0.02;__qa.stop();1');await wait(800);
  await win('player_death',{trig:'window.__god=0;(()=>{const b=bots.find(x=>x.alive);hurt(player,999,b?b.name:"Bot");if(player.hp<=0)pDie(b?b.name:"Bot","Vandal");return player.hp;})()',ms:2500});
  await win('spectate_next',{trig:'__qa.click(0);1',ms:1500});
  await X('__qa.nextRound()');await X('FV.buy=0.02;__qa.stop();1');await wait(800);
  }
  for(const rep of ['first','again'])for(const k of ['KeyC','KeyQ','KeyE','KeyX']){
   await win(`abil_${k.slice(3)}_${rep}`,{pre:`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};window.__god=1;__qa.god();const b=bots.find(x=>x.alive);if(b){const s=__qa.ring(player,10,0);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);pitch=-0.05;}return 1;})()`,
    trig:`__qa.key("${k}",true);setTimeout(()=>__qa.key("${k}",false),80);1`,steps:[[450,'if(J.eq&&J.eq.st!=="rec")__qa.click(0);1'],[1100,'__qa.click(0);1'],[1500,'__qa.click(0);1']],ms:3500});
   await X('__qa.tap("Digit1");1');await wait(500);}
 }catch(e){R.fail=String(e).slice(0,400);log('FAIL',R.fail);}
 save();await browser.close();if(s1)s1.close();if(s2)s2.close();log('done');process.exit(0);
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
