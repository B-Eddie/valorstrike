// hk-35: browser check of qa-29's shared motor wall slide (eaf28e2, server/src/motor.cjs == vendor/valorant-feel.js) on the
// real page: offline 5v5 on Ascent and Bind, the player walks (real W key, forward = the walk direction) into slanted walls
// and must keep sliding along them at ~6.75 cos(angle) instead of stopping dead (the old axis-separated motor: 0 m/s), never
// ending inside a wall, never riding up (feet within 0.1 m of the start floor). Spots: the server fixture Ascent
// (-12.5, 7.07, 40) toward -z (test-map-bounds 'slides') plus spots found by server/tools/find-wall-slides.mjs on the server
// world (same motor). Each walk is 1.5 s of GAME time at time dilation __ts 0.25 (xSimStep wrapped, positions per sim step).
// Usage: (cd <repo> && node work/browser_wall_slide.cjs out.json)  MAPS=ascent,bind
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT=process.env.ROOT||'/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/wall-slide.json',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
// [from, dir (x, z), server m/s, deg between walk and slide] - server/tools/find-wall-slides.mjs output (hk-35, main eaf28e2)
const SPOTS={ascent:[[[-12.5,7.07,40],[0,-1],5.5,null],[[-64.29,4.28,-23.27],[0.383,-0.924],3.74,56.3],[[-57.46,4.05,-20.07],[0.924,0.383],3.74,56.3]],
 bind:[[[-65.33,8.9,-18.25],[0.383,0.924],2.59,63.2],[[-65.64,8.9,-24.62],[0.383,-0.924],2.16,71.8],[[-59.3,8.87,-24.2],[-0.383,-0.924],2.59,63.2],[[-52.66,8.93,-18.33],[0.383,0.924],2.59,63.3]]};
const MAPS=(process.env.MAPS||'ascent,bind').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const simWait=async(sec,why)=>{const t=+(await X('window.__sim||0'));await page.waitForFunction(t=>window.__xe('window.__sim||0')>=t,t+sec,{timeout:900000,polling:200}).catch(e=>log('simWait '+(why||sec)+' timeout',String(e).slice(0,80)));};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});await page.mouse.move(320,180);
 for(const map of MAPS)try{
  await X(`try{leave()}catch(e){}1`);await page.waitForTimeout(1500);
  await X(`FV.pick=${JSON.stringify(map)};J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}
   if(!window.__simH){window.__simH=1;window.__sim=0;window.__rec=null;const s0=xSimStep;xSimStep=function(d){const r=s0.apply(this,arguments);window.__sim+=d;if(window.__rec&&player&&window.__rec.length<4000)window.__rec.push([+window.__sim.toFixed(4),player.x,player.y,player.z]);return r;};}1`);
  await X('window.__god=1;bots.concat(allies).forEach(u=>u.nt=true);FV.buy=Math.min(FV.buy,0.2);1');
  await page.waitForFunction(()=>window.__xe('FV.buy<=0'),null,{timeout:900000,polling:1000}).catch(e=>log('buy end wait',String(e).slice(0,80)));
  const nm=await XJ(`{map:FV.map||FV.pick,native:typeof nmActive==='function'&&!!nmActive(),p:[player.x,player.y,player.z].map(v=>+v.toFixed(2))}`);log(map+' match',nm);
  let i=0;for(const [from,dir,sv,deg] of SPOTS[map]||[]){i++;
   // park everyone else far away; stand at the spot facing the walk
   await X(`bots.concat(allies).forEach((u,k)=>{u.g.position.set(player.x+200+k*3,player.y-50,player.z+200);});(()=>{const P=player;P.x=${from[0]};P.z=${from[2]};const fy=xFy(P.x,P.z,${from[1]}+.1);P.y=Number.isFinite(fy)&&Math.abs(fy-${from[1]})<.6?fy:${from[1]};P.vx=P.vz=0;P.vy=0;P.air=false;yaw=Math.atan2(-(${dir[0]}),-(${dir[1]}));pitch=0;})();1`);
   await X('window.__ts=0.25;1');await simWait(0.2,'settle');const s0=await XJ(`{p:[player.x,player.y,player.z].map(v=>+v.toFixed(3)),yaw:+yaw.toFixed(3)}`);
   await X('window.__rec=[];1');await page.keyboard.down('KeyW');await simWait(1.5,'walk');await page.keyboard.up('KeyW');const rec=await XJ('window.__rec');await X('window.__rec=null;window.__ts=1;1');
   const end=await XJ(`(()=>{const P=player;return {p:[P.x,P.y,P.z].map(v=>+v.toFixed(3)),inWall:typeof blocked==='function'?!!blocked(P.x,P.z,.3,P.y):null};})()`);
   // slide speed over the last 0.6 s of the walk, its angle to the walk, the floor
   const t1=rec.length?rec[rec.length-1][0]:0,a=rec.find(r=>r[0]>=t1-.6)||rec[0],b=rec[rec.length-1]||a;let v=null,ang=null,along=null,dy=null;
   if(a&&b&&b[0]>a[0]){const dt=b[0]-a[0],vx=(b[1]-a[1])/dt,vz=(b[3]-a[3])/dt;v=Math.hypot(vx,vz);ang=v>.05?Math.acos(Math.max(-1,Math.min(1,(vx*dir[0]+vz*dir[1])/v)))*180/Math.PI:null;along=(vx*dir[0]+vz*dir[1]);}
   const ys=rec.map(r=>r[2]);dy=ys.length?Math.max(...ys)-s0.p[1]:null;const tot=b&&s0?Math.hypot(b[1]-s0.p[0],b[3]-s0.p[2]):null;
   const r={from,dir,server:{v:sv,deg},start:s0,end,steps:rec.length,v:v&&+v.toFixed(2),ang:ang&&+ang.toFixed(1),along:along&&+along.toFixed(2),dy:dy&&+dy.toFixed(3),moved:tot&&+tot.toFixed(2)};log(map+' wall '+i,r);
   if(i===1)await page.screenshot({path:`${SHOT}wall-slide-${map}-640x360.jpg`,type:'jpeg',quality:75,timeout:300000}).catch(e=>log('shot failed (non-fatal)',String(e).slice(0,100)));
   const want=Math.max(1.5,(sv||0)*0.75);
   check(`${map} wall ${i} (${from.join(', ')} toward ${dir.join(', ')}): the walk keeps sliding along the slanted wall (>= ${want.toFixed(2)} m/s over the last 0.6 s, 15-80 deg off the walk), never inside a wall, feet within 0.1 m of the floor`,
    rec.length>10&&v!=null&&v>=want&&ang!=null&&ang>=(deg==null?5:10)&&ang<=80&&end.inWall!==true&&dy!=null&&dy<0.1,r);}
 }catch(e){R.errors.push(map+' '+String(e).slice(0,300));log(map+' error',String(e).slice(0,300));}
 check('no page errors',!R.errors.length,{errors:R.errors.slice(0,5)});
 await browser.close();process.exit(R.checks.every(c=>c[1]==='pass')?0:1);
})().catch(e=>{R.errors.push('fatal '+String(e).slice(0,300));log('fatal',String(e).slice(0,300));process.exit(2);});
