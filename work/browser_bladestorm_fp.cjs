// hk-37: Jett Blade Storm first-person look (user 08:53 "the arms for Jett's ultimate look weird"), headless Chromium (SwiftShader, LOW),
// offline 5v5 Ascent, real X key. Game time frozen (__ts 0) per pose, the Wushu X set placed by XAF.gs, then rendered:
//   equip (mid clip), idle, single throw (Attack01 right / Attack02 left, just after the release), right-click flurry clip,
//   between throws (idle after a throw, knives left). Desktop 1280x720 and phone landscape 844x390 (touch).
// Measures per pose: rig visible, both knife holders, the knife meshes' on-screen boxes and depth, the forearm / hand bones'
// world scale (stretch), knife distance from the hand (floating), and whether a knife cuts into the camera near plane.
//   node work/browser_bladestorm_fp.cjs <out.json>   (TAG=before|after; shots work/validation/bladestorm-<TAG>-<pose>-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/bladestorm.json',SHOT=ROOT+'/work/validation/',TAG=process.env.TAG||'now';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
const VIEWS=(process.env.VIEWS||'1280x720,844x390').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const vw0=VIEWS[0].split('x').map(Number),mob=VIEWS.length>1;
 const ctx=await browser.newContext({viewport:{width:vw0[0],height:vw0[1]},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:500}).catch(()=>{});};
 const untilF=async(expr,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(await X(expr))return true;await X('window.__allow=2;1');await page.waitForTimeout(400);}return false;};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await page.mouse.move(vw0[0]/2,vw0[1]/2);
 await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>{u.nt=true;u.g.position.set(player.x+200,player.y-50,player.z+200);});FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await frames(2);
 // a wall-free view: face open floor
 await X(`for(let k=0;k<16;k++){let ok=true;for(let r=.5;r<=6;r+=.5)if(blocked(player.x-Math.sin(yaw)*r,player.z-Math.cos(yaw)*r,.3,player.y))ok=false;if(ok)break;yaw+=Math.PI/8;}pitch=-0.05;1`);
 await X('J.ult=K().u;J.cd.x=0;1');await page.keyboard.press('KeyX');
 const ok=await untilF('XAF.on&&XAF.last&&XAF.last.gun==="bs"&&XAF.last.rig===true&&XAF.last.item===true',240000);
 log('blade storm drawn',await XJ('{ok:XAF.on,last:XAF.last,bs:J.bs,bsOn:J.bsOn,err:XAF.err||null}'));
 check('Blade Storm drawn on the Jett FP rig with the knives loaded',ok,'');
 // measurement in the page (one frozen frame per pose)
 const MEAS=`(()=>{const Rg=XAF.cur,M=Rg&&Rg.guns&&Rg.guns.bs,o={pose:XAF.last,knivesShown:J.bs};if(!Rg)return o;camera.updateMatrixWorld(true);Rg.sc.updateMatrixWorld(true);
  const W=innerWidth,H=innerHeight,v=new THREE.Vector3(),scr=p=>{v.copy(p).project(camera);return [Math.round((v.x+1)/2*W),Math.round((1-v.y)/2*H),+v.z.toFixed(4)];};
  const bw=n=>{const b=xAfBone(Rg,n);if(!b)return null;const s=new THREE.Vector3();b.getWorldScale(s);const p=b.getWorldPosition(new THREE.Vector3());const c=camera.worldToLocal(p.clone());return {s:+s.x.toFixed(3),cam:[c.x,c.y,c.z].map(x=>+x.toFixed(3)),scr:scr(p)};};
  o.bones={};for(const n of ['R_Hand','L_Hand','R_Elbow','L_Elbow','R_Middle1','L_Middle1'])o.bones[n]=bw(n);const k=Rg.root.scale.z||1,un=b=>new THREE.Vector3(b.cam[0]/k,b.cam[1]/k,b.cam[2]);o.fore={};for(const sd of ['R','L'])o.fore[sd]=+un(o.bones[sd+'_Hand']).distanceTo(un(o.bones[sd+'_Elbow'])).toFixed(4); // forearm length with the FOV scale taken out
  o.knives={};const hs=['R','L'].map(n=>xAfBone(Rg,n+'_Hand').getWorldPosition(new THREE.Vector3()));if(M){const ks=M.k||[M.g,M.l].filter(Boolean);ks.forEach((h,i)=>{let on=h.visible;for(let q=h.parent;q;q=q.parent)if(!q.visible)on=false;if(!on)return;
   const b=new THREE.Box3().setFromObject(h);if(b.isEmpty())return;const cs=[],vv=new THREE.Vector3();h.updateMatrixWorld(true);h.traverse(o=>{if(!o.isMesh)return;const P=o.geometry.attributes.position;for(let q=0;q<P.count;q+=2)cs.push(scr(vv.fromBufferAttribute(P,q).applyMatrix4(o.matrixWorld)));}); // hk-44: the drawn vertices (box corners overstate a tilted kunai's screen box)
   const c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3()),r=[Math.min(...cs.map(q=>q[0])),Math.min(...cs.map(q=>q[1])),Math.max(...cs.map(q=>q[0])),Math.max(...cs.map(q=>q[1]))];
   o.knives[i]={size:+Math.max(sz.x,sz.y,sz.z).toFixed(3),fromHand:+Math.min(...hs.map(p=>c.distanceTo(p))).toFixed(3),scr:r,len:Math.round(Math.hypot(r[2]-r[0],r[3]-r[1])),wide:Math.round(Math.min(r[2]-r[0],r[3]-r[1])),onScreen:r[0]>=0&&r[1]>=0&&r[2]<=W&&r[3]<=H,nearCut:cs.some(q=>q[2]<-1||q[2]>1)};});}
  o.fov=camera.fov;o.vfov=(typeof VF_VIEW!=='undefined'&&VF_VIEW.camera)?VF_VIEW.camera.fov:null;o.rootScale=+Rg.root.scale.z.toFixed(3);return o;})()`;
 if(process.env.HOOK)await X(process.env.HOOK+';1');
 const ONLYP=(process.env.POSES||'').split(',').filter(Boolean);
 const poses0=[
  ['equip','s.t=0.8;s.f=-1;s.n=0;s.fired=0;s.alt=false;J.bs=5'],
  ['idle','s.t=4;s.f=-1;s.n=0;s.fired=0;s.alt=false;J.bs=5'],
  ['throw-right','s.t=4;s.n=1;s.fired=1;s.alt=false;s.f=0.12;J.bs=4'],
  ['throw-left','s.t=4;s.n=2;s.fired=1;s.alt=false;s.f=0.14;J.bs=3'],
  ['rightclick','s.t=4;s.n=1;s.fired=1;s.alt=true;s.f=0.25;J.bs=5'],
  ['between','s.t=4;s.n=2;s.fired=1;s.alt=false;s.f=1.6;J.bs=3'],
 ];
 const poses=ONLYP.length?poses0.filter(p=>ONLYP.includes(p[0])):poses0;
 const res={};
 for(const vw of VIEWS){const [w,h]=vw.split('x').map(Number);
  await page.setViewportSize({width:w,height:h});await X('try{onResize&&onResize()}catch(e){};dispatchEvent(new Event("resize"));1');await X('window.__ts=1;1');await frames(2);
  for(const [nm,st] of poses){
   await X(`window.__ts=0;XRT.debt=0;clock.getDelta();J.bsOn=true;rw='knife';{let s=XAF.gs;if(!s||s.k!=='bs')s=XAF.gs={k:'bs',t:0,f:-1,n:0,fired:0,tail:0};${st};}1`);await frames(2);
   const m=await XJ(MEAS);res[vw+' '+nm]=m;log(vw+' '+nm,m);
   await page.screenshot({path:`${SHOT}bladestorm-${TAG}-${nm}-${vw}.jpg`,type:'jpeg',quality:85,timeout:300000}).catch(e=>log('shot failed',String(e).slice(0,120)));
  }
  await X('window.__ts=1;1');
 }
 // judgement rows (same on every viewport)
 const all=Object.entries(res);
 // no stretching: each forearm (elbow -> hand, FOV scale taken out) keeps one length in every pose / viewport (+- 1 cm)
 const fl=sd=>all.map(([k,m])=>m.fore&&m.fore[sd]).filter(x=>x>0),spread=sd=>{const v=fl(sd);return v.length?Math.max(...v)-Math.min(...v):1;};
 check('no stretched arms (forearm length constant across poses and viewports, +- 1.5 cm; Valorant\'s own Attack01 reaches the right forearm 1.1 cm, same before the fix)',spread('R')<0.015&&spread('L')<0.015,{R:fl('R'),L:fl('L')});
 // hk-37: Valorant floats the daggers around the open hands (never gripped): one per dagger left, on screen, face-on, clear of the hands
 const bad=all.filter(([k,m])=>{const K=Object.values(m.knives||{});return K.length!==m.knivesShown||K.some(n=>!n.onScreen||n.nearCut||n.fromHand<0.1||n.len<0.05*(+k.split('x')[0])||n.wide<6);});
 check('Blade Storm daggers float in view: one per dagger left, each fully on screen (not cut), face-on (>= 5% of the width long, >= 6 px wide), clear of the hands',!bad.length,bad.map(([k,m])=>[k,m.knivesShown,m.knives]));
 // framing vs Valorant's own Blade Storm idle (16:9): right glove ~ (0.74, 0.75), left ~ (0.34, 0.77) of the screen; rig FOV-matched
 {const m=res['1280x720 idle'];const f=b=>b&&[+(b.scr[0]/1280).toFixed(2),+(b.scr[1]/720).toFixed(2)];const r=m&&f(m.bones.R_Middle1),l=m&&f(m.bones.L_Middle1);
  check('idle framing = Valorant Blade Storm view (knuckles within 0.15 of the reference glove spots; rig scaled for the 43.383 deg viewmodel FOV)',!!r&&!!l&&Math.hypot(r[0]-0.74,r[1]-0.75)<0.15&&Math.hypot(l[0]-0.34,l[1]-0.77)<0.15&&m.rootScale>1.7,{r,l,rootScale:m&&m.rootScale});}
 check('no page errors',!R.errors.length,R.errors.slice(0,5));
 await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
