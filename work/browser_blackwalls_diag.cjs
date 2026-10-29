// vs-lane-blackwalls diagnosis: for given views, render each probe frame three ways - normal, background magenta (fog off),
// and material-ID (every map material swapped for an unlit MeshBasicMaterial of a unique colour, same depth state: side,
// polygonOffset, alphaTest + map, transparent / depthWrite) - and report, for every pixel that is near-black in one frame and
// lit in another (the probe's flicker rule), what was drawn there in each frame: background (crack / hole) or which material.
//   ROOT=<tree> PORT=8877 MAP=ascent Q=low VIEWS='x,y,z,yaw,pitch;...' node work/browser_blackwalls_diag.cjs out.json shotdir
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.resolve(__dirname,'..'),QA='/workspace/work/qa/',PORT=process.env.PORT||'8877';
const OUT=process.argv[2]||'/tmp/bwd.json',SHOT=process.argv[3]||'/tmp/bwd/';fs.mkdirSync(SHOT,{recursive:true});
const MAP=process.env.MAP||'ascent',Q=process.env.Q||'low',F=+(process.env.FRAMES||6),W=+(process.env.W||640),H=+(process.env.H||360);
let VIEWS=(process.env.VIEWS||'15.25,9.67,44,1.952,-0.059');const AUTO=/^auto:/.test(VIEWS)?+VIEWS.slice(5):0;VIEWS=AUTO?[]:VIEWS.split(';').map(s=>s.split(',').map(Number));
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};
const R={map:MAP,q:Q,views:[],errors:[]};const t00=Date.now();const log=(k,v)=>{console.log(((Date.now()-t00)/1000).toFixed(0),k,JSON.stringify(v).slice(0,400));fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(([q,aa])=>{try{localStorage.setItem('vs.gq',q);if(aa)localStorage.setItem('vs.aa',aa);}catch(e){}},[Q,process.env.AA||'']);
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'\\/(index\\.html)?(\\?.*)?$'),r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);
 page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:300000,polling:1000});
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await X(`FV.pick='${MAP}';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(m=>window.__xe('running&&!window.xLdOn&&typeof NM!=="undefined"&&NM.current&&NM.current.key==="'+m+'"'),MAP,{timeout:900000,polling:500});
 await X(`{window.__r0=renderer.render;renderer.render=function(sc,c){if(sc===scene&&!window.__probe)return;return window.__r0.call(this,sc,c);};const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};
  window.__mats=[];window.__idm=new Map();NM.current.M.g.traverse(o=>{if(!o.isMesh)return;const ms=[].concat(o.material);ms.forEach(m=>{if(!window.__idm.has(m)){const id=window.__mats.length+1;window.__mats.push(m.name+(m.userData.zLayer?'|z'+m.userData.zLayer:'')+(m.userData.decal?'|decal':'')+(m.alphaTest?'|at':'')+(m.transparent?'|tr':''));
    const b=new THREE.MeshBasicMaterial({color:new THREE.Color(((id>>8)&255)/255,(id&255)/255,0.5),side:m.side,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits,alphaTest:m.alphaTest,map:m.alphaTest>0||m.transparent?m.map:null,transparent:false,depthWrite:m.depthWrite,depthTest:m.depthTest,visible:m.visible});b.toneMapped=false;
    if(b.map){b.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\\n diffuseColor.rgb=diffuse;');};b.customProgramCacheKey=()=>'bwid';}
    window.__idm.set(m,b);
    const dm=b.clone();dm.map=b.map;dm.onBeforeCompile=s=>{s.vertexShader='varying float vBwD;\\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\\n vBwD=-mvPosition.z;');s.fragmentShader='varying float vBwD;\\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\\n diffuseColor.rgb=diffuse;').replace('#include <dithering_fragment>','#include <dithering_fragment>\\n { float d=floor(vBwD*1000.0+0.5); gl_FragColor=vec4(floor(d/65536.0)/255.0,mod(floor(d/256.0),256.0)/255.0,mod(d,256.0)/255.0,1.0); }');};dm.customProgramCacheKey=()=>'bwdist'+(dm.map?'m':'');(window.__dmm=window.__dmm||new Map()).set(m,dm);}});});
  window.__swap=(on,D)=>{const T=D?window.__dmm:window.__idm;NM.current.M.g.traverse(o=>{if(!o.isMesh)return;if(on){o.userData.__m=o.material;o.material=Array.isArray(o.material)?o.material.map(m=>T.get(m)):T.get(o.material);}else if(o.userData.__m){o.material=o.userData.__m;o.userData.__m=null;}});};
  window.__grab=()=>{const g=renderer.getContext(),w=g.drawingBufferWidth,h=g.drawingBufferHeight,b=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,b);const o=new Uint8Array(w*h*4);for(let y=0;y<h;y++)o.set(b.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);return o;};
  window.__b64=a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s);};}1`);
 await new Promise(r=>setTimeout(r,1500));
 R.mats=JSON.parse(await X(`JSON.stringify(window.__mats)`));
 for(let s=0;s<AUTO;s++){const v=JSON.parse(await X(`(()=>{const C=NM.current,N=C.nav.nodes;let seed=${s*7919+13};const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
     const pick=N[Math.floor(rnd()*N.length)];const eye=new THREE.Vector3(pick[0],pick[1]+1.6,pick[2]);const rc=new THREE.Raycaster();rc.far=60;rc.firstHitOnly=true;let best=null;
     for(let k=0;k<16;k++){const a=rnd()*Math.PI*2,pt=-0.25+rnd()*0.3;const d=new THREE.Vector3(Math.sin(a)*Math.cos(pt),Math.sin(pt),Math.cos(a)*Math.cos(pt));rc.set(eye,d);let hit=Infinity;try{const h=rc.intersectObjects(C.M.solids||[],false)[0];hit=h?h.distance:Infinity;}catch(e){}if(hit>3&&hit<40&&(!best||Math.abs(hit-12)<Math.abs(best.hit-12)))best={a,pt,hit};}
     return JSON.stringify(best?[eye.x,eye.y,eye.z,best.a,best.pt].map(x=>+x.toFixed(3)):null);})()`));if(v)VIEWS.push(v);}
 log('views',VIEWS);
 for(const [vx,vy,vz,yaw,pitch] of VIEWS){
  await X(`(()=>{for(const u of [...(typeof bots!=='undefined'?bots:[]),...(typeof allies!=='undefined'?allies:[])])if(u&&u.g)u.g.visible=false;if(typeof player!=='undefined'&&player.g)player.g.visible=false;
   const cam=window.__pc||(window.__pc=camera.clone());cam.fov=camera.fov;cam.near=camera.near;cam.far=camera.far;cam.aspect=${W}/${H};cam.updateProjectionMatrix();return 1;})()`);
  const out={n:[],bg:[],id:[],ds:[]};
  for(let f=0;f<F;f++)for(const pass of ['n','bg','id','ds']){
   const b64=await X(`(()=>{const cam=window.__pc,eye=new THREE.Vector3(${vx},${vy},${vz}),F=${F},f=${f};const off=(f-(F-1)/2)*0.004,a=${yaw}+(f%2?1:-1)*0.0004*f;cam.position.copy(eye).add(new THREE.Vector3(Math.cos(${yaw})*off,0,-Math.sin(${yaw})*off));
    const d=new THREE.Vector3(Math.sin(a)*Math.cos(${pitch}),Math.sin(${pitch}),Math.cos(a)*Math.cos(${pitch}));cam.up.set(0,1,0);cam.lookAt(cam.position.clone().add(d));cam.updateMatrixWorld();
    const bg=scene.background,fog=scene.fog;window.__probe=1;if('${pass}'==='bg'){scene.background=new THREE.Color(1,0,1);scene.fog=null;}const oe=renderer.outputEncoding,tm=renderer.toneMapping;if('${pass}'==='id'||'${pass}'==='ds'){window.__swap(true,'${pass}'==='ds');scene.background=new THREE.Color(0,0,0);renderer.outputEncoding=THREE.LinearEncoding;renderer.toneMapping=THREE.NoToneMapping;}
    renderer.render(scene,cam);const px=window.__grab();if('${pass}'==='id'||'${pass}'==='ds'){window.__swap(false);renderer.outputEncoding=oe;renderer.toneMapping=tm;}scene.background=bg;scene.fog=fog;window.__probe=0;return window.__b64(px);})()`);
   out[pass].push(Buffer.from(b64,'base64'));}
  const w=W,h=H,n=w*h,R2=2,mats=R.mats;const blk=out.n.map(p=>{const b=new Uint8Array(n);for(let i=0;i<n;i++)b[i]=(p[i*4]<=24&&p[i*4+1]<=24&&p[i*4+2]<=24)?1:0;return b;});
  const lum=out.n.map(p=>{const l=new Uint8Array(n);for(let i=0;i<n;i++)l[i]=(p[i*4]*77+p[i*4+1]*150+p[i*4+2]*29)>>8;return l;});
  const dil=blk.map(b=>{const o=new Uint8Array(n);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let dy=-R2;dy<=R2&&!v;dy++)for(let dx=-R2;dx<=R2&&!v;dx++){const X2=x+dx,Y=y+dy;if(X2>=0&&X2<w&&Y>=0&&Y<h&&b[Y*w+X2])v=1;}o[y*w+x]=v;}return o;});
  const cls={},kinds={},cop=[];let flick=0;const flm=new Uint8Array(n);
  const what=(f,i)=>{const B=out.bg[f],I=out.id[f];if(B[i*4]>200&&B[i*4+1]<40&&B[i*4+2]>200)return 'background';const id=(I[i*4]<<8)|I[i*4+1];return id?mats[id-1]:'none';};
  for(let i=0;i<n;i++){let fa=-1,fb=-1;for(let a=0;a<F&&fa<0;a++)if(blk[a][i])for(let b=0;b<F;b++)if(b!==a&&!dil[b][i]&&lum[b][i]>=48){fa=a;fb=b;break;}
   if(fa<0)continue;flick++;flm[i]=1;const D=f=>{const p=out.ds[f];return (p[i*4]*65536+p[i*4+1]*256+p[i*4+2])/1000;};const da=D(fa),db=D(fb),gap=Math.abs(da-db),kind=gap<0.03?'COPLANAR':'edge';kinds[kind]=(kinds[kind]||0)+1;if(kind==='COPLANAR'){cop.push([i%w,Math.floor(i/w),+da.toFixed(2),+(da-db).toFixed(4)]);}
   const key=kind+' '+what(fa,i)+'  <lit: '+what(fb,i)+'>';cls[key]=(cls[key]||0)+1;}
  const top=Object.entries(cls).sort((a,b)=>b[1]-a[1]).slice(0,30);
  const cls0={};for(let i=0;i<n;i++)if(blk[0][i]){const k=what(0,i);cls0[k]=(cls0[k]||0)+1;}
  const top0=Object.entries(cls0).sort((a,b)=>b[1]-a[1]).slice(0,30);
  const res={flick,kinds,cop:cop.slice(0,40),top,black0:top0,img:{n0:out.n[0],n1:out.n[1],bg0:out.bg[0],id0:out.id[0],fl:Buffer.from(flm.map(v=>v*255))}};
  const tag=`${MAP}-${Q}-${vx}_${vz}`;const {PNG}=(()=>{try{return require('/workspace/work/pw/node_modules/pngjs');}catch(e){return {};}})();
  for(const k in res.img)fs.writeFileSync(SHOT+tag+'-'+k+(k==='fl'?'.gray':'.rgba'),res.img[k]);
  delete res.img;R.views.push({at:[vx,vy,vz,yaw,pitch],...res});log('view '+tag,res);
 }
 await browser.close();
})().catch(e=>{R.errors.push(String(e.stack||e).slice(0,600));fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.error(e);process.exit(1);});
