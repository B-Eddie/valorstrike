// Brimstone legs while moving (the owner: "Brimstone legs look wrong while moving"): real rendered pixels, before / after.
// Offline 5v5 Ascent in headless Chromium (SwiftShader). Two units are pinned 3.4 m in front of the camera, side-on, and
// driven through the movement animator at run speed (xUbAnim sees 5.4 m/s forward): Brimstone (left) and Jett (right,
// the reference row every other agent is retargeted from). Three shots a quarter stride apart, plus foot / knee numbers
// read from the rendered skeletons (feet must reach the floor and swing fore-aft along the facing, not sideways).
//   ROOT=<tree> TAG=before|after PW=<playwright dir> node work/browser_brimstone_legs.cjs <out.json>
// Shots: work/validation/brimstone-legs/<TAG>-<k>.jpg
const PW=process.env.PW||'/tmp/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/tmp/pw/browsers';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http');
const ROOT=process.env.ROOT||path.join(__dirname,'..'),OUT=process.argv[2]||'/tmp/brim.json',TAG=process.env.TAG||'after',PORT=+(process.env.PORT||8877);
const SHOT=process.env.SHOT||path.join(__dirname,'validation/brimstone-legs/');fs.mkdirSync(SHOT,{recursive:true});
const R={tag:TAG,root:ROOT,steps:[],errors:[]};const t00=Date.now();const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.log(k,JSON.stringify(v));};
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.ktx2':'image/ktx2','.wasm':'application/wasm'};
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
 s.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(PORT);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:300}).catch(()=>{});};
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';J.pick='Sova';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};}1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;window.__pin=[];const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;for(const q of window.__pin){q.u.g.position.set(q.x,q.y,q.z);q.u.g.rotation.y=q.r;q.u.cd=9;q.u.xaimOn=false;q.u.xTt=null;q.u.xTg=null;}}return r0.call(this,sc,c);};}1`);
 await frames(2);
 await X(`for(let k=0;k<16;k++){let ok=true;for(let r=.5;r<=6;r+=.5)for(const a of [-.4,0,.4])if(blocked(player.x-Math.sin(yaw+a)*r,player.z-Math.cos(yaw+a)*r,.3,player.y))ok=false;if(ok)break;yaw+=Math.PI/8;}pitch=-0.18;1`);
 // the two staged units run in place: xUbAnim gets 5.4 m/s and a one-frame forward delta along their facing
 const st=await XJ(`(()=>{const L=bots.concat(allies).filter(u=>u&&u.alive&&u.g);const pick=(i,a)=>{const u=L[i];u.agent=a;XBA[u.name]=a;if(u.xm){try{u.g.remove(u.xm.m);}catch(e){}u.xm=null;u.xd=0;}return u;};
   const A=pick(0,'Brimstone'),B=pick(1,'Jett'),f=camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(),o=camera.getWorldPosition(new THREE.Vector3()),rt=new THREE.Vector3(-f.z,0,f.x),face=Math.atan2(-f.x,-f.z);
   window.__pin=[{u:A,x:o.x+f.x*3.4-rt.x*0.8,y:player.y,z:o.z+f.z*3.4-rt.z*0.8,r:face+Math.PI/2},{u:B,x:o.x+f.x*3.4+rt.x*0.8,y:player.y,z:o.z+f.z*3.4+rt.z*0.8,r:face+Math.PI/2}];window.__A=A;window.__B=B;
   if(!window.__ua){window.__ua=1;const ua=xUbAnim;xUbAnim=function(b,M,sp,dt){if((b===__A||b===__B)&&M&&M.sx&&dt>0){const P=b.g.position,ry=b.g.rotation.y;M.sx.px=P.x-Math.sin(ry)*5.4*dt;M.sx.pz=P.z-Math.cos(ry)*5.4*dt;M.sx.py=P.y;sp=5.4;}return ua.call(this,b,M,sp,dt);};}
   return {A:A.name,B:B.name,face};})()`);
 log('stage',st);await X('window.__allow=1e9;1');
 const mk=await page.waitForFunction(()=>window.__xe('!!(__A.xm&&__A.xm.sx&&__B.xm&&__B.xm.sx&&__A.xm.sx.rm&&__B.xm.sx.rm)'),null,{timeout:600000,polling:2000}).then(()=>1).catch(()=>0);
 log('models',{mk,fail:await XJ('XV.failures||null')});
 await page.waitForTimeout(4000);
 // foot / knee numbers in each unit's own frame: fwd = along its facing, lat = sideways, up = above its feet's floor (the unit's y)
 const legs=`(()=>{const out={};for(const [k,u] of [['brimstone',__A],['jett',__B]]){const m=u.xm&&u.xm.m;if(!m)continue;m.updateMatrixWorld(true);const ry=u.g.rotation.y,fx=-Math.sin(ry),fz=-Math.cos(ry),v=new THREE.Vector3(),B={};
   m.traverse(o=>{if(o.isBone&&/^(L|R)_(Foot|Calf|Thigh)$|^(Left|Right)(Foot|Leg|UpLeg)$|^[lr]_?(foot|calf|thigh)$/i.test(o.name)){o.getWorldPosition(v);const dx=v.x-u.g.position.x,dz=v.z-u.g.position.z;B[o.name]={fwd:+(dx*fx+dz*fz).toFixed(3),lat:+(dx*fz-dz*fx).toFixed(3),up:+(v.y-u.g.position.y).toFixed(3)};}});
   out[k]={clip:u.xm.sx.rm.actions?Object.keys(u.xm.sx.w||{}).filter(n=>(u.xm.sx.w[n]||0)>.2):null,bones:B};}return out;})()`;
 for(let k=0;k<3;k++){await page.waitForTimeout(k?190:0);await X('window.__allow=0;1');
  log('legs '+k,await XJ(legs));await page.screenshot({path:SHOT+`${TAG}-${k}.jpg`,quality:80,type:'jpeg'}).catch(e=>log('shot',String(e)));await X('window.__allow=1e9;1');}
 log('errors',R.errors.slice(0,5));await browser.close();srv.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,500));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
