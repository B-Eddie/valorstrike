// vs-lane-blackwalls probe (user: "theres the black glitching thing on the walls"): offline 5v5 on each native map in headless
// Chromium (SwiftShader), at a given graphics preset. Game renders are gated off; a probe camera (a clone of the game camera:
// same fov / near / far) stands at seeded nav nodes at eye height and looks at a wall 3-40 m away, renders F frames with the eye
// moved by a few mm and the yaw by a few hundredths of a degree (standing still / micro aim), and reads the pixels back.
// Black flicker = a pixel that is near-black (max channel <= 24) in one frame while, in another frame, no near-black pixel is
// within 2 px and the pixel itself is lit (luma >= 48): the 2 px dilation absorbs sub-pixel parallax of real dark edges.
// Contact sheets of the worst views are written for a human look.
//   TOGGLE=1: each view twice, wall-overlay colour lift (userData.nmLift) off = "before", on = "after" (tot in byVar).
//   ROOT=<tree> PORT=8877 MAPS=ascent,bind Q=low|medium|high SPOTS=24 node work/browser_blackwalls_probe.cjs out.json shotdir
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',PORT=process.env.PORT||'8877';
const OUT=process.argv[2]||'/tmp/bw.json',SHOT=process.argv[3]||'/tmp/bwshots/';fs.mkdirSync(SHOT,{recursive:true});
const MAPS=(process.env.MAPS||'ascent,bind,haven,split,lotus,breeze').split(','),Q=process.env.Q||'low',SPOTS=+(process.env.SPOTS||24),F=+(process.env.FRAMES||6);
const W=+(process.env.W||640),H=+(process.env.H||360);
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const R={q:Q,root:ROOT,maps:{},errors:[],steps:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.log(((Date.now()-t00)/1000).toFixed(0),k,JSON.stringify(v).slice(0,300));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(([q,aa])=>{try{localStorage.setItem('vs.gq',q);if(aa)localStorage.setItem('vs.aa',aa);}catch(e){}},[Q,process.env.AA||'']);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'\\/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));page.on('console',m=>{if(m.type()==='error')R.errors.push('console '+m.text().slice(0,200));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});log('booted',Q);
 let first=true;
 for(const MAP of MAPS){
  if(!first)await X(`try{leave()}catch(e){}1`);first=false;
  await X(`FV.pick='${MAP}';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(m=>window.__xe('running&&!window.xLdOn&&typeof NM!=="undefined"&&NM.current&&NM.current.key==="'+m+'"'),MAP,{timeout:900000,polling:500});
  await X(`{if(!window.__r0){window.__r0=renderer.render;renderer.render=function(sc,c){if(sc===scene&&!window.__probe)return;return window.__r0.call(this,sc,c);};const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};}}1`);
  await new Promise(r=>setTimeout(r,1500));
  const info=JSON.parse(await X(`JSON.stringify({near:camera.near,far:camera.far,fov:camera.fov,fog:scene.fog?[scene.fog.near,scene.fog.far]:null,pr:renderer.getPixelRatio(),db:(()=>{const g=renderer.getContext();return g.getParameter(g.DEPTH_BITS);})(),shadow:renderer.shadowMap.enabled,aa:renderer.getContext().getContextAttributes().antialias,tex:NM.texMissing||0})`));
  const M={info,views:[],tot:{px:0,flick:0,black:0},byVar:{}};R.maps[MAP]=M;log(MAP+' loaded',info);
  for(let s=0;s<SPOTS;s++){
   const v=JSON.parse(await X(`(()=>{const C=NM.current,N=C.nav.nodes;let seed=${s*7919+13};const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
     const pick=N[Math.floor(rnd()*N.length)];const eye=new THREE.Vector3(pick[0],pick[1]+1.6,pick[2]);
     // a heading that hits a map surface 3-40 m away
     const rc=new THREE.Raycaster();rc.far=60;let best=null;for(let k=0;k<16;k++){const a=rnd()*Math.PI*2,pt=-0.25+rnd()*0.3;const d=new THREE.Vector3(Math.sin(a)*Math.cos(pt),Math.sin(pt),Math.cos(a)*Math.cos(pt));rc.set(eye,d);let hit=Infinity;rc.firstHitOnly=true;try{const h=rc.intersectObjects(C.M.solids||[],false)[0];hit=h?h.distance:Infinity;}catch(e){}if(hit>3&&hit<40&&(!best||Math.abs(hit-12)<Math.abs(best.hit-12)))best={a,pt,hit};}
     if(!best)return JSON.stringify({skip:1});
     window.__v={eye,a:best.a,pt:best.pt};return JSON.stringify({eye:[eye.x,eye.y,eye.z].map(x=>+x.toFixed(2)),yaw:+best.a.toFixed(3),pitch:+best.pt.toFixed(3),hit:+best.hit.toFixed(1)});})()`));
   if(v.skip)continue;
   for(const VAR of (process.env.TOGGLE?['before','after']:[''])){if(VAR)await X(`(()=>{const on=${VAR==='after'};let n=0;const seen=new Set();NM.current.M.g.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){const k=m.userData&&m.userData.nmLift;if(!k||seen.has(m))continue;seen.add(m);const cur=!m.userData.nmLiftOff;if(cur!==on){m.color.multiplyScalar(on?k:1/k);m.userData.nmLiftOff=!on;}n++;}});return n;})()`);
   const frames=[];
   for(let f=0;f<F;f++){
    const url=await X(`(()=>{const V=window.__v;for(const u of [...(typeof bots!=='undefined'?bots:[]),...(typeof allies!=='undefined'?allies:[])])if(u&&u.g)u.g.visible=false;if(typeof player!=='undefined'&&player.g)player.g.visible=false;
      const cam=window.__pc||(window.__pc=camera.clone());cam.fov=camera.fov;cam.near=camera.near;cam.far=camera.far;cam.aspect=${W}/${H};cam.updateProjectionMatrix();
      const off=(${f}-${(F-1)/2})*0.004,a=V.a+(${f}%2?1:-1)*0.0004*${f};cam.position.copy(V.eye).add(new THREE.Vector3(Math.cos(V.a)*off,0,-Math.sin(V.a)*off));
      const d=new THREE.Vector3(Math.sin(a)*Math.cos(V.pt),Math.sin(V.pt),Math.cos(a)*Math.cos(V.pt));cam.up.set(0,1,0);cam.lookAt(cam.position.clone().add(d));cam.updateMatrixWorld();
      window.__probe=1;renderer.setRenderTarget(null);renderer.render(scene,cam);window.__probe=0;const g=renderer.getContext(),w=g.drawingBufferWidth,h=g.drawingBufferHeight,b=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,b);
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);for(let y=0;y<h;y++)im.data.set(b.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);x.putImageData(im,0,0);return c.toDataURL('image/png');})()`);
    frames.push(url);}
   const st=await page.evaluate(async(fr)=>{const ld=u=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u;});const ims=await Promise.all(fr.map(ld));const w=ims[0].width,h=ims[0].height,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
     const px=ims.map(i=>{x.drawImage(i,0,0);return x.getImageData(0,0,w,h).data;});const n=w*h,R2=2;
     const blk=px.map(p=>{const b=new Uint8Array(n);for(let i=0;i<n;i++){const r=p[i*4],g=p[i*4+1],bb=p[i*4+2];b[i]=(r<=24&&g<=24&&bb<=24)?1:0;}return b;});
     const lum=px.map(p=>{const l=new Uint8Array(n);for(let i=0;i<n;i++)l[i]=(p[i*4]*77+p[i*4+1]*150+p[i*4+2]*29)>>8;return l;});
     const dil=blk.map(b=>{const t=new Uint8Array(n),o=new Uint8Array(n);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){let v=0;for(let k=-R2;k<=R2&&!v;k++){const X2=xx+k;if(X2>=0&&X2<w&&b[y*w+X2])v=1;}t[y*w+xx]=v;}for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){let v=0;for(let k=-R2;k<=R2&&!v;k++){const Y=y+k;if(Y>=0&&Y<h&&t[Y*w+xx])v=1;}o[y*w+xx]=v;}return o;});
     const fl=new Uint8Array(n);let flick=0,black=0;for(let i=0;i<n;i++){let any=0;for(let a=0;a<blk.length;a++)if(blk[a][i]){any=1;for(let b=0;b<blk.length;b++)if(b!==a&&!dil[b][i]&&lum[b][i]>=48){fl[i]=1;break;}if(fl[i])break;}if(any)black++;if(fl[i])flick++;}
     // heat image: frame 0 dimmed, flicker pixels magenta
     const out=x.createImageData(w,h);for(let i=0;i<n;i++){const f=fl[i];out.data[i*4]=f?255:px[0][i*4]*.6;out.data[i*4+1]=f?0:px[0][i*4+1]*.6;out.data[i*4+2]=f?255:px[0][i*4+2]*.6;out.data[i*4+3]=255;}x.putImageData(out,0,0);
     // where flicker pixels are, which frames are black there (sample up to 6)
     const ex=[];for(let i=0;i<n&&ex.length<6;i+=1)if(fl[i]&&(i%97===0||ex.length<2&&i%13===0))ex.push({x:i%w,y:Math.floor(i/w),seq:blk.map(b=>b[i]).join(''),lum:lum.map(l=>l[i]).join(',')});
     return {flick,black,n,heat:c.toDataURL('image/png'),ex};},frames);
   M.tot.px+=st.n;M.tot.flick+=st.flick;M.tot.black+=st.black;if(VAR){const b=M.byVar[VAR]||(M.byVar[VAR]={px:0,flick:0,black:0});b.px+=st.n;b.flick+=st.flick;b.black+=st.black;}
   const tag=`${MAP}-${Q}-s${s}${VAR?'-'+VAR:''}`;const rec={s,VAR,...v,flick:st.flick,black:st.black,ex:st.ex};
   if(st.flick>0||s<3||process.env.ALLSHOTS){fs.writeFileSync(SHOT+tag+'-f0.png',Buffer.from(frames[0].split(',')[1],'base64'));fs.writeFileSync(SHOT+tag+'-f1.png',Buffer.from(frames[1].split(',')[1],'base64'));fs.writeFileSync(SHOT+tag+'-heat.png',Buffer.from(st.heat.split(',')[1],'base64'));rec.shot=tag;}
   M.views.push(rec);log(`${MAP} s${s} ${VAR}`,{hit:v.hit,flick:st.flick,black:st.black});}
  }
  log(MAP+' total',M.tot);
 }
 log('errors',R.errors.slice(0,20));await browser.close();
})().catch(e=>{R.errors.push(String(e.stack||e).slice(0,600));fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.error(e);process.exit(1);});
