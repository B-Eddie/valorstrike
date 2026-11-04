// Texture stats table generator / verifier (native_maps_runtime NM_TEXSTATS, nmTexStatsOf).
// Build: headless Chromium (desktop UA: GLTFLoader's ImageBitmapLoader path, the textures exactly as desktop Chrome decodes
// them) loads each map through the game's own nmLoadScene (table off) and runs the game's own nmTexStats over every
// material texture; writes models/valorant/maps/<map>/texstats.json:
//   {"code": sha256/16 of nmTexStats' source line, "t": {"<file>.png": [width, height, bytes, sha256/16 of the file,
//    minAlpha, white, cut, lum, alpha, am, lin]}}
// VERIFY=1: per map, on desktop Chromium, (1) every material texture's runtime nmTexStats equals its table entry exactly,
// (2) nmPrepareScene with the table (every texture a table hit) and without it give identical materials (decal / mask /
// wet, foliage cut-out, ground layer + uniforms, lift, colour, alpha, offsets, visibility) for every mesh. UA=<ua> runs the
// same comparison under another user agent (an iPhone's: GLTFLoader's <img> path) and reports it.
//   VS_ROOT=<worktree> [MAPS=ascent,..] [VERIFY=1] [UA=...] node work/build_map_texstats.cjs [out.json]
'use strict';
const PW=process.env.PW_DIR||'/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const ROOT=process.env.VS_ROOT||path.resolve(__dirname,'..'),QA=process.env.REAL3_DIR||'/workspace/work/qa',OUT=process.argv[2]||'',PORT=+(process.env.PORT||8899);
const MAPS=(process.env.MAPS||'ascent,bind,breeze,haven,lotus,split').split(','),VERIFY=!!process.env.VERIFY;
const LOCAL={'three.min.js':path.join(QA,'three.min.js'),'GLTFLoader.js':path.join(QA,'GLTFLoader.js'),'SkeletonUtils.js':path.join(QA,'SkeletonUtils.js')};
const MIME={'.html':'text/html','.js':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const sha16=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
const src=fs.readFileSync(path.join(ROOT,'work/native_maps_runtime.js'),'utf8'),k0=src.indexOf('function nmTexStats('),CODE=sha16(src.slice(k0,src.indexOf('\n',k0)));
const rt=/NM_TEXSTATS=\{on:true,code:'([0-9a-f]{16})'/.exec(src);if(!rt||rt[1]!==CODE){console.error('NM_TEXSTATS.code',rt&&rt[1],'!= sha of nmTexStats',CODE);process.exit(2);}
function serve(port,root){return new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});s.listen(port,'127.0.0.1',()=>r(s));});}
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const srv=await serve(PORT,ROOT),browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']});
 const opts={viewport:{width:1280,height:720}};if(process.env.UA)opts.userAgent=process.env.UA;
 const R={code:CODE,ua:process.env.UA||'desktop',maps:{}};let bad=0;
 async function page(){const ctx=await browser.newContext(opts);
  await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
  await ctx.route(new RegExp('127\\.0\\.0\\.1:'+PORT+'/(index\\.html)?(\\?.*)?$'),r=>r.fulfill({body:fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={'),contentType:'text/html'}));
  const p=await ctx.newPage();p.setDefaultTimeout(900000);p.on('pageerror',e=>console.error('pageerror',String(e).slice(0,200)));
  await p.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__xe&&window.xValorantAssets&&window.__xe('typeof nmLoadScene==="function"&&typeof renderer!=="undefined"'),null,{timeout:300000,polling:500});
  return {ctx,X:s=>p.evaluate(s=>window.__xe(s),s)};}
 // in-page helpers: load a map (table on / off), the per-texture runtime stats, the prepared materials' signature
 const H=`window.__ts=window.__ts||{
  load:(key,on)=>{NM_TEXSTATS.on=on;NM_TEXSTATS.hit=NM_TEXSTATS.miss=0;return nmLoadScene('models/valorant/maps/'+key+'/',-1);},
  tex:(root)=>{const out={},seen=new Set();root.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material||[])){const t=m&&m.map;if(!t||seen.has(t))continue;seen.add(t);const f=t.userData.nmUri;if(!f){out['?'+seen.size]=null;continue;}const im=t.image;out[f]={w:im.width,h:im.height,st:nmTexStats(im),cls:im.constructor.name};}});return out;},
  sig:(root)=>{const L=[];root.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material||[])){const g=m.userData.groundLayer;L.push([o.name,m.name,m.visible,m.alphaTest,m.transparent,m.depthWrite,m.opacity,m.color.r,m.color.g,m.color.b,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.userData.decal||'',!!m.userData.cutout,m.userData.nmLift||0,g?g.second:null,g?g.u.gbAm.value:null,g?g.u.gbTx.value:null,g?g.u.gbCov.value:null,m.customProgramCacheKey?String(m.customProgramCacheKey()):'',!!m.userData.nmTexMissing]);}});return L;},
  free:(root)=>{try{nmFree({M:{g:root}});}catch(e){}}};1`;
 for(const key of MAPS){const t0=Date.now(),dir=path.join(ROOT,'models/valorant/maps',key);
  if(!VERIFY){const {ctx,X}=await page();await X(H);
   const tex=JSON.parse(await X(`__ts.load(${JSON.stringify(key)},false).then(gl=>{const r=__ts.tex(gl.scene);__ts.free(gl.scene);return JSON.stringify(r);})`));
   const t={};let nul=0,unk=0,cls=new Set();for(const f of Object.keys(tex).sort()){const e=tex[f];if(f[0]==='?'){unk++;continue;}cls.add(e.cls);if(!e.st){nul++;continue;}const b=fs.readFileSync(path.join(dir,'textures',f));const s=e.st;t[f]=[e.w,e.h,b.length,sha16(b),s.minAlpha,s.white,s.cut,s.lum,s.alpha,s.am,s.lin];}
   fs.writeFileSync(path.join(dir,'texstats.json'),JSON.stringify({code:CODE,t})+'\n');R.maps[key]={textures:Object.keys(t).length,nullStats:nul,untagged:unk,decoded:[...cls],s:Math.round((Date.now()-t0)/1000)};
   console.log(key,JSON.stringify(R.maps[key]));await ctx.close();continue;}
  // VERIFY: table on (every texture should hit) vs table off (runtime nmTexStats), same map, fresh page each
  const T=JSON.parse(fs.readFileSync(path.join(dir,'texstats.json'),'utf8'));const one=async on=>{const {ctx,X}=await page();await X(H);
   const r=JSON.parse(await X(`__ts.load(${JSON.stringify(key)},${on}).then(gl=>{const tex=__ts.tex(gl.scene);nmPrepareScene(gl.scene);const sig=__ts.sig(gl.scene),n={hit:NM_TEXSTATS.hit,miss:NM_TEXSTATS.miss};__ts.free(gl.scene);return JSON.stringify({tex,sig,n});})`));await ctx.close();return r;};
  const A=await one(true),B=await one(false);let texEq=0,texNe=[],missing=[];
  for(const f in B.tex){if(f[0]==='?')continue;const e=T.t[f],r=B.tex[f];if(!e){missing.push(f);continue;}const s=r.st,row=s&&[r.w,r.h,s.minAlpha,s.white,s.cut,s.lum,s.alpha,s.am,s.lin],tr=[e[0],e[1]].concat(e.slice(4));if(row&&row.every((v,i)=>v===tr[i]))texEq++;else texNe.push(f);}
  /* mesh order under the root follows load completion, so compare the sorted signatures */const SA=A.sig.map(x=>JSON.stringify(x)).sort(),SB=B.sig.map(x=>JSON.stringify(x)).sort();let sigNe=0,firstNe=null;const n=Math.max(SA.length,SB.length);for(let i=0;i<n;i++)if(SA[i]!==SB[i]){sigNe++;if(!firstNe)firstNe=[SA[i],SB[i]];}
  const cnt=S=>{const c={decal:0,mask:0,wet:0,cutout:0,ground:0,lift:0,hidden:0};for(const x of S){if(x[13])c[x[13]]++;if(x[14])c.cutout++;if(x[16]!==null)c.ground++;if(x[15])c.lift++;if(!x[2])c.hidden++;}return c;};
  R.maps[key]={textures:Object.keys(B.tex).length,texEqual:texEq,texDiffer:texNe.length,texDifferFiles:texNe.slice(0,10),notInTable:missing,materials:n,materialsDiffer:sigNe,firstDiff:firstNe,withTable:A.n,withoutTable:B.n,classesWithTable:cnt(A.sig),classesWithout:cnt(B.sig),s:Math.round((Date.now()-t0)/1000)};
  if(texNe.length||missing.length||sigNe||A.n.miss)bad++;console.log(key,JSON.stringify(R.maps[key]));}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(R,null,1));await browser.close();srv.close();console.log(VERIFY?(bad?'VERIFY FAIL '+bad+' map(s)':'VERIFY OK'):'BUILT');process.exit(VERIFY&&bad?1:0);
})().catch(e=>{console.error('FATAL',e.stack||e);process.exit(1);});
