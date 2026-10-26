// Rendered native body smoke check. PW_MODULE selects playwright-core; CHROMIUM_PATH selects Chromium.
// Writes measurements and a Jett pose strip. Run from the repository root.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PW_MODULE||'playwright-core'),root=path.join(__dirname,'..');
const out=process.env.TP_BODY_OUT||path.join(__dirname,'validation/tp-body-browser');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const errors=[];
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
 await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1000,height:600}});page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('vs.gq','low');});
  if(process.env.THREE_QA_DIR)await page.route(/https:\/\/(unpkg.com|cdn.jsdelivr.net)\//,r=>{const n=r.request().url().split('/').pop(),base=process.env.THREE_QA_DIR;const f=n==='three.min.js'?path.join(base,'three-149/build',n):path.join(base,'three-147/examples/js',n==='GLTFLoader.js'?'loaders':'utils',n);return r.fulfill({path:f,contentType:'application/javascript'});});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('xReady = true; // every mode is initialised','window.__tpEval=s=>eval(s);xReady = true; // every mode is initialised');
  await page.route(/\/index.html$/,r=>r.fulfill({body:html,contentType:'text/html'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__tpEval,{timeout:60000});
  const result=await page.evaluate(async()=>window.__tpEval(`(async()=>{
   await xvAgentsReady(['Jett','Sage','Breach']);
   const sc=new THREE.Scene();sc.background=new THREE.Color(0x19212b);sc.add(new THREE.HemisphereLight(0xffffff,0x7b8190,2));
   const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,4,4);sc.add(light);
   const cam=new THREE.PerspectiveCamera(35,1000/600,.01,20);cam.position.set(2,1.5,4);cam.lookAt(0,1,0);
   const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1000,600);r.domElement.id='tpBodyCapture';document.body.appendChild(r.domElement);r.domElement.style.cssText='position:fixed;inset:0;z-index:9999999;width:1000px;height:600px';
   const rows=[];window.__tpRender=()=>{};
   for(const name of ['Jett','Sage','Breach']){
    const M={m:new THREE.Group(),mats:[],nm:name};xvAgent(M,XVA.kits[name]);sc.add(M.m);const X=M.sx;
    const pose=(lo,cb=0,yaw=0)=>{X.cb=cb;X.yaw=yaw;for(const n in X.a){const w=n===lo?1-.62*cb:n===(lo==='idle'?'crouch':'crouchWalk')?.62*cb:n==='aim'?1:0;X.w[n]=w;X.a[n].setEffectiveWeight(w);if(w)X.a[n].play();else X.a[n].stop();}for(let i=0;i<60;i++){xUbPre(M);X.mx.update(1/60);xUbPost(M);}M.m.updateMatrixWorld(true);r.render(sc,cam);};
    pose('idle');const stand=X.ncStand;let gap=0,drop=0;
    for(const [lo,cb,yaw]of [['run',0,0],['run',0,1.25],['idle',1,0],['walk',1,0]]){pose(lo,cb,yaw);const F=X.follow,want=F.offset.clone().multiply(F.p.scale).applyQuaternion(F.p.quaternion).add(F.p.position);gap=Math.max(gap,F.s.position.distanceTo(want));if(cb===1)drop=stand-X.sc.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).y;}
    rows.push({name,gap,stand,drop});
    if(name==='Jett')window.__tpJett={M,pose};sc.remove(M.m);
   }
   window.__tpRender=(lo,cb,yaw)=>{sc.add(window.__tpJett.M.m);window.__tpJett.pose(lo,cb,yaw);};return rows;
  })()`));
  for(const [name,lo,cb,yaw]of [['idle','idle',0,0],['jog','run',0,0],['strafe','run',0,1.25],['crouch','idle',1,0]]){await page.evaluate(([lo,cb,yaw])=>window.__tpRender(lo,cb,yaw),[lo,cb,yaw]);await page.locator('#tpBodyCapture').screenshot({path:path.join(out,name+'.png')});}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows:result,errors},null,2));
  if(errors.length||result.some(r=>r.gap>1e-6||Math.abs(r.drop-.45)>.015))throw Error(JSON.stringify({result,errors}));
  console.log(JSON.stringify({rows:result,errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
