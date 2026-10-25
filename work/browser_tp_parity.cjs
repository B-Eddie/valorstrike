// Third-person locomotion / jump / landing parity browser check (valorant-parity.md section 7 items 1-9; browser list 2-3 for the TP side):
// offline 5v5 on Ascent, headless Chromium (SwiftShader, LOW), render gated. One enemy bot is driven along a flat lane at fixed dt through
// the page's own xVisB/xUbAnim/mixer/xUbPost; foot bones measured in world space (planted-foot speed vs ground speed), clip weights,
// hip yaw, jump/land layers. Filmstrips: hk_out/loco_<case>_<k>.jpg.  node work/browser_tp_parity.cjs <out.json>
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/tp.json',PRE=process.argv[3]||'hud',SHOT=ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',d]);log('check '+n,ok?'pass':'FAIL');};
const SIZES=(process.env.SIZES||'1280x720,640x360,390x844').split(',').map(s=>s.split('x').map(Number));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:SIZES[0][0],height:SIZES[0][1]},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:1000});};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='ascent';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:900000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;1`);
 await X(`{window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 // In-page harness: one enemy bot taken off the AI and driven along a flat straight lane at fixed dt (1/60 s) through the game's own
 // xVisB -> xUbAnim -> mixer -> xUbPost path, all inside one synchronous evaluate (the game loop cannot interleave). Foot bones are read
 // in world space every step; filmstrips are rendered with the real renderer from a side camera.
 await X('FV.buy=9999;window.__god=1;1');await frames(3);log('match started',await X('JSON.stringify({mode,map:FV.map,bots:bots.length,loaded:bots.filter(b=>b.xm&&b.xm.sx).length})'));
 await X(`window.__lc=(function(){const b=bots.find(u=>u.alive&&u.xm&&u.xm.sx);if(!b)return null;const M=b.xm,X=M.sx,sc=X.sc,Lf=sc.getObjectByName('L_Foot'),Rf=sc.getObjectByName('R_Foot');
  const p0=b.g.position.clone();let best=null;for(let k=0;k<16;k++){const a=k*Math.PI/8,dx=Math.sin(a),dz=Math.cos(a);let ok=true,y0=groundAt(p0.x,p0.z,.3,p0.y+1);for(let s=-8;s<=8;s+=.25){const g=groundAt(p0.x+dx*s,p0.z+dz*s,.3,p0.y+1);if(!(Math.abs(g-y0)<.04)){ok=false;break;}}if(ok){best={a,dx,dz,y0};break;}}
  return {b,M,X,Lf,Rf,p0,lane:best};})();JSON.stringify(window.__lc&&{lane:window.__lc.lane,name:window.__lc.b.name,p0:window.__lc.p0})`).then(v=>log('lane',v));
 const run=async(cs)=>JSON.parse(await X(`JSON.stringify((()=>{const C=window.__lc,b=C.b,M=C.M,X=C.X,L=C.lane,dt=1/60,v=new THREE.Vector3(),w=new THREE.Vector3();
  const cs=${JSON.stringify(cs)};const i0=bots.indexOf(b);if(i0>=0)bots.splice(i0,1);window.__lcB=b;
  const head=L.a+(cs.rel||0);b.g.rotation.y=L.a;b.cr=!!cs.cr;let s=-7,y=L.y0,vy=0;b.g.position.set(C.p0.x+Math.sin(head)*s,y,C.p0.z+Math.cos(head)*s);
  X.px=X.pz=X.py=null;X.spS=0;b.xp.x=b.g.position.x;b.xp.z=b.g.position.z;const out={frames:[],ev:[]};
  const N=Math.round((cs.t||1.6)/dt);let slide=0,cnt=0,ratio=[];let prev=null;
  for(let i=0;i<N;i++){const t=i*dt;let sp=cs.v;if(cs.stopAt!=null&&t>=cs.stopAt)sp=0;
   s+=sp*dt;   if(cs.jumpAt!=null&&t>=cs.jumpAt&&!out.jumped){vy=cs.vy;out.jumped=1;}if(out.jumped&&!out.landed){vy-=cs.g*dt;y+=vy*dt;if(y<=L.y0){y=L.y0;out.landed=t;}}
   b.g.position.set(C.p0.x+Math.sin(head)*s,y,C.p0.z+Math.cos(head)*s);
   xVisB(b,dt,performance.now(),false);xUbPre(M);X.mx.update(dt);xUbPost(M);X.sc.updateMatrixWorld(true);
   C.Lf.getWorldPosition(v);C.Rf.getWorldPosition(w);const f=v.y<w.y?v:w,id=v.y<w.y?'L':'R';
   if(prev&&prev.id===id&&t>0.4&&!(out.jumped&&!out.landed)&&Math.abs(f.y-y)<.2&&sp>0){const d=Math.hypot(f.x-prev.x,f.z-prev.z);ratio.push(d/(sp*dt));}
   prev={id,x:f.x,z:f.z};
   const wt=k=>+(X.w[k]||0).toFixed(2);out.frames.push([+t.toFixed(3),wt('idle'),wt('walk'),wt('run'),wt('crouchWalk'),wt('jump'),wt('fall'),wt('land'),wt('aim')||wt('knife'),+X.yaw.toFixed(2),X.air?1:0]);}
  ratio.sort((a,b)=>a-b);out.slideMed=ratio.length?+ratio[ratio.length>>1].toFixed(3):null;out.slideP25=ratio.length?+ratio[ratio.length>>2].toFixed(3):null;out.n=ratio.length;
  out.timeScale=Object.fromEntries(Object.entries(X.a).filter(([k,a])=>X.w[k]>.05).map(([k,a])=>[k,+a.timeScale.toFixed(2)]));return out;})())`));
 const CASES=[
  ['rifle run 5.4 m/s',{v:5.4,t:1.6}],['knife run 6.75 m/s',{v:6.75,t:1.6}],['shift-walk 3.2 m/s',{v:3.2,t:1.6}],['crouch-walk 2.0 m/s',{v:2.0,t:1.6,cr:1}],
  ['strafe left 5.4',{v:5.4,t:1.6,rel:Math.PI/2}],['strafe right 5.4',{v:5.4,t:1.6,rel:-Math.PI/2}],['backpedal 3.2',{v:3.2,t:1.6,rel:Math.PI}],
  ['stop from run',{v:5.4,t:1.6,stopAt:1.0}],['standing jump',{v:0,t:1.5,jumpAt:.3,vy:6.93,g:20.54}],['running jump',{v:5.4,t:1.6,jumpAt:.5,vy:6.93,g:20.54}]];
 const res={};for(const [n,cs] of CASES){try{res[n]=await run(cs);const r=res[n];log(n,{slideMed:r.slideMed,slideP25:r.slideP25,n:r.n,ts:r.timeScale,last:r.frames[r.frames.length-1],landed:r.landed});}catch(e){log(n+' error',String(e).slice(0,200));}}
 fs.writeFileSync(OUT.replace(/\.json$/,'_frames.json'),JSON.stringify(res));
 const F=(n,col)=>res[n]?res[n].frames.map(f=>f[col]):[];const at=(n,t)=>res[n]&&res[n].frames.find(f=>f[0]>=t-1e-6);
 // planted-foot speed / ground speed during contact (median over contact frames): 0 = locked foot, 1 = moonwalk
 for(const [n,lim] of [['rifle run 5.4 m/s',.15],['knife run 6.75 m/s',.2],['shift-walk 3.2 m/s',.15],['crouch-walk 2.0 m/s',.15],['backpedal 3.2',.2]])
  if(res[n])check(`${n}: planted foot holds the ground (median contact foot speed <= ${lim} of ground speed)`,res[n].slideMed!=null&&res[n].slideMed<=lim,JSON.stringify({med:res[n].slideMed,p25:res[n].slideP25,n:res[n].n,ts:res[n].timeScale}));
 if(res['shift-walk 3.2 m/s']){const l=at('shift-walk 3.2 m/s',1.5);check('shift-walk uses the jog clip at ~1.1x (not a sped-up slow walk)',l&&l[3]>.9&&Math.abs((res['shift-walk 3.2 m/s'].timeScale.run||0)-3.2/2.9)<.15,JSON.stringify({l,ts:res['shift-walk 3.2 m/s'].timeScale}));}
 if(res['crouch-walk 2.0 m/s']){const l=at('crouch-walk 2.0 m/s',1.5);check('crouch-walk blends the crouch-walk clip',l&&l[4]>.5,JSON.stringify(l));}
 for(const n of ['strafe left 5.4','strafe right 5.4']) if(res[n]){const l=at(n,1.5);check(`${n}: hips turned toward the move (|yaw| 0.9-1.3 rad), aim layer on`,l&&Math.abs(l[9])>.9&&Math.abs(l[9])<=1.26&&l[8]>.9,JSON.stringify(l));}
 if(res['strafe left 5.4']&&res['strafe right 5.4']){const a=at('strafe left 5.4',1.5)[9],b2=at('strafe right 5.4',1.5)[9];check('strafe left/right turn the hips opposite ways',Math.sign(a)===-Math.sign(b2),a+' / '+b2);}
 if(res['backpedal 3.2'])check('backpedal plays the stride in reverse',(res['backpedal 3.2'].timeScale.run||res['backpedal 3.2'].timeScale.walk||0)<0,JSON.stringify(res['backpedal 3.2'].timeScale));
 if(res['stop from run']){const fr=res['stop from run'].frames;const t9=(fr.find(f=>f[0]>=1.0&&f[1]>=.9)||[99])[0];check('stop: idle pose (weight >= 0.9) within 0.3 s of stopping',t9-1.0<=.3,'idle>=0.9 at +'+(t9-1).toFixed(3)+' s');}
 if(res['standing jump']){const fr=res['standing jump'].frames;const j=Math.max(...fr.map(f=>f[5])),fa=Math.max(...fr.map(f=>f[6])),la=Math.max(...fr.map(f=>f[7]));
  check('standing jump: Jump_Start on take-off, Jump_Loop airborne, land clip after a standstill landing',j>.3&&fa>.3&&la>.1,JSON.stringify({jump:j,fall:fa,land:la,landed:res['standing jump'].landed}));}
 if(res['running jump']){const fr=res['running jump'].frames,lt=res['running jump'].landed||9;const la=Math.max(...fr.filter(f=>f[0]>=lt).map(f=>f[7]),0);const r=at('running jump',Math.min(1.58,lt+.35));
  check('running landing goes straight back to the stride (no knee buckle)',la<.05&&r&&r[3]>.7,JSON.stringify({landMax:la,after:r,landed:lt}));}
 // filmstrips: re-run rifle run and strafe and render 6 frames 100 ms apart from a side camera
 for(const [n,cs] of [['rifle run 5.4 m/s',{v:5.4,t:1.0}],['strafe left 5.4',{v:5.4,t:1.0,rel:Math.PI/2}],['crouch-walk 2.0 m/s',{v:2.0,t:1.0,cr:1}]]){
  const tiles=[];for(let k=0;k<6;k++){await run(Object.assign({},cs,{t:cs.t+k*.1}));
   const u=await X(`(()=>{const b=window.__lc.b,L=window.__lc.lane,P=b.g.position;camera.position.set(P.x+L.dz*3.6,P.y+1.1,P.z-L.dx*3.6);camera.lookAt(P.x,P.y+.9,P.z);camera.updateMatrixWorld();window.__allow=1;renderer.render(scene,camera);return renderer.domElement.toDataURL('image/jpeg',.8);})()`);tiles.push(u);}
  for(let k=0;k<6;k++)fs.writeFileSync(`/workspace/work/hk_out/loco_${n.split(' ')[0]}_${k}.jpg`,Buffer.from(tiles[k].split(',')[1],'base64'));log('film '+n,6);}
 log('done',1);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
