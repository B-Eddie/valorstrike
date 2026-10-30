// Audio error soak in headless Chromium (a tool, not in test_all). Real AudioContext (Chromium's fake output device),
// unlocked by a real Playwright mouse click (user activation), offline 5v5 vs bots. Every window.xErr call (the
// "Something broke: ..." toast, fed by window.onerror / unhandledrejection / the game loop's catch), every pageerror and
// console.error is collected with its stack, per scenario step. Also reports GA.errors / AUD.err (handled audio errors).
//   VS_ROOT=<worktree> AGENTS=Jett,Sova,Phoenix MAP=ascent node work/browser_audio_soak.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.VS_ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/baudio.json';
const MAP=process.env.MAP||'ascent',MAP2=process.env.MAP2||'bind',AGENTS=(process.env.AGENTS||'Jett,Sova,Phoenix,Sage').split(','),PORT=+(process.env.PORT||8899);
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.ktx2':'image/ktx2'};
const R={root:ROOT,steps:[],errors:[],fail:null};const t00=Date.now();const log=(...a)=>console.log(((Date.now()-t00)/1000).toFixed(0)+'s',...a);let STEP='boot';
function serve(port,root,cors){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf');}const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'};if(cors)h['Access-Control-Allow-Origin']='*';res.writeHead(200,h);res.end(d);});});s.on('error',()=>r(null));s.listen(port,'127.0.0.1',()=>r(s));});}
// installed before the page's scripts: window.xErr is wrapped whenever the page assigns it
const HOOK=()=>{window.__errs=[];let real=null;const wrap=function(e){try{window.__errs.push({m:String((e&&e.message)||e),s:String((e&&e.stack)||''),t:performance.now()});}catch(_){}return real&&real.apply(this,arguments);};
 Object.defineProperty(window,'xErr',{configurable:true,get(){return real?wrap:undefined;},set(v){real=v;}});
 window.addEventListener('unhandledrejection',e=>{const r=e.reason;window.__errs.push({m:'[unhandledrejection] '+String((r&&r.message)||r),s:String((r&&r.stack)||''),t:performance.now()});});
 try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.gqb','low');localStorage.setItem('vs.cap','0');}catch(e){}};
(async()=>{
 const s1=await serve(PORT,ROOT,false),s2=await serve(8787,path.join(ROOT,'server','public'),true);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(HOOK);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
 if(process.env.TINYTEX!=='0'){const tiny=fs.readFileSync('/workspace/work/qa/eventperf/tiny.png');await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/models/.*\\.(png|jpg)(\\?.*)?$'),r=>r.fulfill({body:tiny,contentType:'image/png'}));}
 // NOAUDIO=1: the downloaded game audio never arrives (offline / blocked), so every sound takes the synthesized fallback
 if(process.env.NOAUDIO)await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/audio/'),r=>r.abort('internetdisconnected'));
 const page=await ctx.newPage();page.setDefaultTimeout(900000);
 page.on('pageerror',e=>R.errors.push({step:STEP,kind:'pageerror',m:String(e).slice(0,400),s:String(e.stack||'').slice(0,1200)}));
 page.on('console',m=>{if(m.type()==='error')R.errors.push({step:STEP,kind:'console.error',m:m.text().slice(0,600)});});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const wait=ms=>page.waitForTimeout(ms);
 const drain=async()=>{const e=await page.evaluate(()=>{const a=window.__errs||[];window.__errs=[];return a;});for(const x of e)R.errors.push({step:STEP,kind:'xErr',m:x.m,s:x.s.slice(0,1500)});return e.length;};
 const save=()=>fs.writeFileSync(OUT,JSON.stringify(R,null,1));
 async function step(name,code,ms=1500){STEP=name;let r=null;try{if(code)r=await X(code);}catch(e){r='EVAL '+String(e).slice(0,200);}if(ms)await wait(ms);const n=await drain();
  const a=await X('JSON.stringify({st:ac?ac.state:"none",plays:GA.plays,gaErr:Object.keys(GA.errors).length,aud:AUD.err,muted:S.muted,run:typeof running!=="undefined"&&running})').catch(e=>String(e));
  R.steps.push({name,r,errs:n,a});log(name,n?'ERRORS '+n:'',r==null?'':String(r).slice(0,80),a);save();}
 const waitRun=async(lbl)=>{STEP='wait '+lbl;await page.waitForFunction(()=>window.__xe('!!(running&&!window.xLdOn&&NM.current&&NM.current.key&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'),null,{timeout:900000,polling:2000});await drain();};
 try{
  await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
  await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
  // real user activation: a click on the lobby background
  STEP='gesture';await page.mouse.click(5,350);await wait(1500);await step('after_gesture',null,500);
  await X(`window.__qa={
   ring(p,r,a){for(let k=0;k<16;k++){const t=a+(k%2?1:-1)*Math.floor((k+1)/2)*0.25,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r,y=p.y||0;const gy=groundAt(x,z,0.5,y+1);if(Math.abs(gy-y)>1.2)continue;if(!blocked(x,z,0.45,gy))return [x,gy,z];}return null;},
   face(b,p){const q=b.g.position;b.g.rotation.y=Math.atan2(p.x-q.x,p.z-q.z);},
   god(){if(player){player.hp=Math.max(player.hp,1000);player.armor=50;}},
   aimAt(b){const q=b.g.position,dx=q.x-player.x,dz=q.z-player.z,dy=(q.y||0)+1.2-((player.y||0)+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));},
   stop(){for(const b of bots)b.cd=1e9;for(const a of allies)a.cd=1e9;},
   key(c,d){window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c.replace(/^Key|^Digit/,'').toLowerCase(),bubbles:true}));},
   mouse(b,d){(d?renderer.domElement:window).dispatchEvent(new MouseEvent(d?'mousedown':'mouseup',{button:b,bubbles:true}));},
   tap(c){__qa.key(c,true);setTimeout(()=>__qa.key(c,false),60);},
   click(b){__qa.mouse(b||0,true);setTimeout(()=>__qa.mouse(b||0,false),60);},
  };1`);
  const nextRound=async()=>{STEP='nextRound';await page.waitForFunction(()=>window.__xe('!!(running&&FV.buy>0)'),null,{timeout:60000,polling:300}).catch(()=>{});await drain();};
  for(let ai=0;ai<AGENTS.length;ai++){const AG=AGENTS[ai],M=ai%2?MAP2:MAP;
   await X(`J.pick=${JSON.stringify(AG)};FV.pick=${JSON.stringify(M)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);await waitRun(AG+'@'+M);
   await page.mouse.click(320,180).catch(()=>{});await step(AG+' running',null,3000);
   await step(AG+' buy_menu','__qa.tap("KeyB");1',800);await step(AG+' buy','(()=>{try{fBuy("Vandal");fBuy("Ghost")}catch(e){return String(e)}return 1})()',800);await step(AG+' buy_close','__qa.tap("KeyB");1',500);
   await step(AG+' buy_end','FV.buy=0.02;__qa.stop();1',1500);
   for(const k of ['Digit2','Digit3','Digit1'])await step(AG+' swap '+k,`__qa.tap("${k}");1`,900);
   const FIRE=`(()=>{const b=bots.find(x=>x.alive);if(b){b.hp=100;const s=__qa.ring(player,9,0.7);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.aimAt(b);}__qa.god();__qa.mouse(0,true);setTimeout(()=>__qa.mouse(0,false),600);return 1;})()`;
   await step(AG+' fire',FIRE,1500);await step(AG+' reload','__qa.tap("KeyR");1',3000);await step(AG+' fire2',FIRE,1200);
   await step(AG+' inspect','__qa.tap("KeyY");1',1500);
   // bots fight back: footsteps, remote gunfire, damage
   await step(AG+' bots_fight','(()=>{for(const b of bots)b.cd=0;for(const a of allies)a.cd=0;__qa.god();return 1})()',6000);
   for(const k of ['KeyC','KeyQ','KeyE','KeyX'])await step(`${AG} abil ${k}`,`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};__qa.god();__qa.key("${k}",true);setTimeout(()=>__qa.key("${k}",false),80);setTimeout(()=>__qa.click(0),500);setTimeout(()=>__qa.click(0),1100);return 1;})()`,2500),await X('__qa.tap("Digit1");1'),await wait(400);
   const MK=`(()=>{__qa.god();const L=bots.filter(b=>b.alive).slice(0,3);window.__mk=L;for(let i=0;i<L.length;i++){const b=L[i];const s=__qa.ring(player,6+i,i*0.35-0.5)||[player.x+2*i,player.y||0,player.z-7];b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);b.hp=1;b.cd=1e9;}let k=0;const f=()=>{const b=__mk.find(x=>x.alive);if(!b||k++>12)return;__qa.aimAt(b);fcd=0;ammo=Math.max(ammo,5);reloading=0;VM.sw=0;shoot(false);setTimeout(f,90);};f();return L.length;})()`;
   await step(AG+' multikill',MK,3000);
   await step(AG+' clutch','(()=>{for(const a of allies){if(a.alive){a.hp=1;try{hurt(a,999,bots[0].name)}catch(e){a.alive=false}}}__qa.god();for(const b of bots)b.cd=0;return allies.filter(a=>a.alive).length})()',4000);
   await step(AG+' hidden','(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});document.dispatchEvent(new Event("visibilitychange"));return 1})()',1500);
   await step(AG+' visible','(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event("visibilitychange"));return document.hidden})()',300);await page.mouse.click(320,180).catch(()=>{});await wait(1000);
   await step(AG+' volume','(()=>{const v=$("sVol");for(const x of [0,35,100,70]){v.value=x;v.dispatchEvent(new Event("input"));}return S.vol})()',500);
   await step(AG+' mute','(()=>{$("sndBtn").click();return S.muted})()',1000);await step(AG+' bots_fight_muted','(()=>{for(const b of bots)b.cd=0;__qa.god();return 1})()',2500);
   await step(AG+' unmute','(()=>{$("sndBtn").click();return S.muted})()',1000);
   await step(AG+' plant',`(()=>{__qa.stop();__qa.god();const s=FV.sp;s.st="carry";s.c=player;s.pt=0;let best=null;for(let gx=-80;gx<=80&&!best;gx+=2)for(let gz=-80;gz<=80;gz+=2){if(inSite({x:gx,z:gz})&&!blocked(gx,gz,0.5,0)){best=[gx,gz];break;}}if(best){player.x=best[0];player.z=best[1];player.y=groundAt(best[0],best[1],0.3,5);player.vx=player.vz=0;}keys.Digit4=true;window.__k4=setInterval(()=>{keys.Digit4=true;},50);return !!best;})()`,5500);
   await X('clearInterval(window.__k4);keys.Digit4=false;1');await step(AG+' post_plant',null,2500);
   await step(AG+' spike_explode','FV.sp.t=0.03;1',3000);await nextRound();
   await step(AG+' defuse',`(()=>{FV.buy=0.02;__qa.stop();const s=FV.sp;const d=bots.find(b=>b.alive);s.st="plant";s.t=30;s.x=player.x+1;s.z=player.z;s.y=player.y||0;s.dt=6.9;fsM.position.set(s.x,0.4,s.z);fsM.visible=true;if(d){d.g.position.set(s.x+0.5,s.y,s.z);d.g.updateMatrixWorld(true);s.du=d;d.h4=1;}return !!d;})()`,3000);
   await nextRound();
   await step(AG+' death','(()=>{FV.buy=0.02;const b=bots.find(x=>x.alive);player.hp=1;hurt(player,999,b?b.name:"Bot");if(player.hp>0)pDie(b?b.name:"Bot","Vandal");return player.hp;})()',3000);
   await step(AG+' spectate','__qa.click(0);1',1500);
   // match end: one round from the win, then the round ends
   await step(AG+' match_end','(()=>{FV.you=FIVE_WIN-1;if(running)fCheck(true,"QA");return FV.you})()',4500);
   await step(AG+' result',`$("result").style.display`,500);
   if(ai===0){await step(AG+' play_again','(()=>{$("againBtn").click();return 1})()',0);await waitRun('again');await step(AG+' again_running',null,3000);await step(AG+' again_end','(()=>{FV.you=FIVE_WIN-1;if(running)fCheck(true,"QA");return 1})()',4000);}
   await step(AG+' lobby','(()=>{$("lobbyBtn").click();return 1})()',1500);
  }
 }catch(e){R.fail=String(e).slice(0,400);log('FAIL',R.fail);}
 STEP='end';await drain().catch(()=>{});
 R.ga=await X('JSON.stringify({errors:GA.errors,plays:GA.plays,aud:AUD,st:ac&&ac.state})').catch(e=>String(e));
 save();log('errors',R.errors.length,JSON.stringify(R.errors.slice(0,20),null,1));await browser.close();if(s1)s1.close();if(s2)s2.close();process.exit(0);
})().catch(e=>{R.fail=String(e).slice(0,400);fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
