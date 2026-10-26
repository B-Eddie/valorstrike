// Map seam / load browser check (hark-map B1-B3 merge): offline 5v5 on a native map in headless Chromium (SwiftShader, LOW).
// Records the native map load timings (NM.current.memory: prep / budget / upload ms + wall-clock from xGo to running) and,
// for each reported z-fight seam, renders the scene from 4 headings at 5 m with a dedicated camera (game renders gated off),
// 4 frames per heading each shifted 2 cm sideways (a strafe). Z-fighting shows as speckle that changes between those frames:
// per heading we report the share of pixels that change by > 40/255 between consecutive frames (a clean surface moves by
// sub-pixel parallax only, so the share stays small) and write a contact sheet per seam.
//   SEAMS='x,z;x,z' MAP=ascent node work/browser_map_seams.cjs <out.json> [prefix]
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs');const ROOT='/workspace/work/valorstrike',QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/seams.json',PRE=process.argv[3]||'map-seam',SHOT=ROOT+'/work/validation/';
const MAP=process.env.MAP||'ascent',SEAMS=(process.env.SEAMS||'-22,-18.75;11.25,2;14.5,20.5;49,-39.75').split(';').map(s=>s.split(',').map(Number));
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={map:MAP,steps:[],seams:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`window.__t0=performance.now();FV.pick='${MAP}';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&typeof NM!=="undefined"&&NM.current&&NM.current.key'),null,{timeout:900000,polling:500});
 const load=await X(`JSON.stringify({wallMs:Math.round(performance.now()-window.__t0),key:NM.current.key,memory:Object.fromEntries(Object.entries(NM.current.memory||{}).filter(([k,v])=>typeof v==='number'))})`);log('load',JSON.parse(load));R.load=JSON.parse(load);
 // gate game renders off; keep the original render for the probe camera
 await X(`{window.__r0=renderer.render;renderer.render=function(sc,c){if(sc===scene&&!window.__probe)return;return window.__r0.call(this,sc,c);};window.__god=1;const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};}1`);
 for(const [sx,sz] of SEAMS){const S={at:[sx,sz],views:[]};
  for(let k=0;k<4;k++){const ang=k*Math.PI/2,frames=[];
   for(let f=0;f<4;f++){
    const px=await X(`(()=>{const C=NM.current,a=${ang},d=5,cx=${sx}+Math.sin(a)*d,cz=${sz}+Math.cos(a)*d;let gy=0;try{gy=nmHeight(C,cx,cz,30);}catch(e){}if(!isFinite(gy))gy=0;let ty=0;try{ty=nmHeight(C,${sx},${sz},30);}catch(e){}if(!isFinite(ty))ty=0;
      const cam=window.__pc||(window.__pc=new THREE.PerspectiveCamera(camera.fov,640/360,0.1,500));const off=(${f}-1.5)*0.02;cam.position.set(cx+Math.cos(a)*off,gy+1.6,cz-Math.sin(a)*off);cam.lookAt(${sx},ty+0.8,${sz});cam.updateMatrixWorld();
      window.__probe=1;renderer.render(scene,cam);window.__probe=0;const g=renderer.getContext(),w=g.drawingBufferWidth,h=g.drawingBufferHeight,b=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,b);
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);for(let y=0;y<h;y++)im.data.set(b.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);x.putImageData(im,0,0);
      return JSON.stringify({gy,ty,w,h,url:c.toDataURL('image/png')});})()`);
    frames.push(JSON.parse(px));}
   const diff=await page.evaluate(async(fr)=>{const ld=u=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u;});const ims=await Promise.all(fr.map(f=>ld(f.url)));const w=ims[0].width,h=ims[0].height,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
     const px=ims.map(i=>{x.drawImage(i,0,0);return x.getImageData(0,0,w,h).data;});const out=[];for(let k=1;k<px.length;k++){let n=0,t=0;for(let i=0;i<px[k].length;i+=16){t++;if(Math.abs(px[k][i]-px[k-1][i])+Math.abs(px[k][i+1]-px[k-1][i+1])+Math.abs(px[k][i+2]-px[k-1][i+2])>120)n++;}out.push(+(n/t).toFixed(4));}return out;},frames);
   const file=`${SHOT}${PRE}-${sx}_${sz}-h${k}.png`;fs.writeFileSync(file,Buffer.from(frames[0].url.split(',')[1],'base64'));
   const f3=`/workspace/work/hk_out/seams/${PRE}-${sx}_${sz}-h${k}-f3.png`;fs.mkdirSync('/workspace/work/hk_out/seams',{recursive:true});fs.writeFileSync(f3,Buffer.from(frames[3].url.split(',')[1],'base64'));
   S.views.push({heading:k*90,ground:frames[0].gy,target:frames[0].ty,changed:diff,file:file.replace(ROOT+'/','')});log(`seam ${sx},${sz} h${k*90}`,diff);}
  R.seams.push(S);}
 log('errors',R.errors);await browser.close();
})().catch(e=>{R.errors.push(String(e).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
