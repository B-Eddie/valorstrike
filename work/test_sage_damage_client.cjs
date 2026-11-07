// Real module construction with the REAL three.js (no WebGL): each new kit's module entry points build, tick through their lifetime
// and end without throwing and without leaving objects in the scene. Proves construction/lifecycle only, NOT appearance, yaw or shader compile.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const three=fs.readFileSync(path.join(__dirname,'two-browser','qa','three.min.js'),'utf8');
const c2d=new Proxy({},{get:(o,k)=>k==='createRadialGradient'||k==='createLinearGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:1}):k==='getImageData'?()=>({data:new Uint8ClampedArray(4)}):()=>{},set:()=>true});
const mkCanvas=()=>({width:64,height:64,style:{},getContext:()=>c2d,addEventListener(){},toDataURL:()=>''});
const document={createElement:t=>t==='canvas'?mkCanvas():{style:{},appendChild(){},remove(){},setAttribute(){}},getElementById:()=>null,querySelectorAll:()=>[],body:{appendChild(){}},addEventListener(){}};
const errs=[];let nowv=0;
const ctx=vm.createContext({document,window:{},navigator:{userAgent:'node'},performance:{now:()=>nowv},console,Math,Date,setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},xE:e=>errs.push(String(e&&e.stack||e)),player:{x:0,y:0,z:0},camera:{position:{x:0,y:2,z:0}},innerWidth:800,innerHeight:600});
ctx.self=ctx;ctx.globalThis=ctx;
vm.runInContext(three+';this.THREE=THREE;',ctx);
const T=ctx.THREE;ctx.scene=new T.Scene();
const blocks=['SAGE','SKYE','DEADLOCK','GEKKO','FADE','MIKS','VETO','VYSE','HUSH'];
for(const b of blocks){const i=html.indexOf('// ---- '+b+' FX ----'),j=html.indexOf('// ---- END '+b+' FX ----',i);assert(i>0&&j>i,b);vm.runInContext(html.slice(i,j),ctx,{filename:b});}

vm.runInContext('sgxUseGameTick();var h=sgxBarrierWall({x:0,y:0,z:0},0);for(var i=0;i<60;i++)sgxTick(1/60);',ctx);
const h=ctx.h,mat=h.segs[0].mesh.material;
assert.equal(mat.uniforms.uD.value,0);h.setHp(0,.35);assert.equal(mat.uniforms.uD.value,.65);
assert.equal(mat.uniforms.uA.value,1,'damage does not make wall see-through');
const seed=mat.uniforms.uSeed.value;ctx.sgxTick(.5);assert.equal(mat.uniforms.uSeed.value,seed,'fractures do not swim');
h.setHp(0,NaN);assert.equal(mat.uniforms.uD.value,.65);h.setHp(0,5);assert.equal(mat.uniforms.uD.value,0);
h.setHp(0,-1);assert.equal(mat.uniforms.uD.value,1);h.breakSeg(0);assert.equal(h.segs[0].mesh.visible,false);
h.setHp(0,1);assert.equal(mat.uniforms.uD.value,1,'gone segment cannot resurrect');h.end();ctx.sgxReset();
assert.equal(ctx.scene.children.length,0);assert.deepEqual(errs,[]);console.log('Sage HP fracture/clamp/stable pattern/break/reset: PASS');

// Exercise the actual live row handler with the actual module, not just source matching.
Object.assign(ctx,{J:{sw:null},netWalls:new Map(),XBAR:{len:10.4,segs:4,h:3,th:.4,hp:400,fort:200},sgWallEnd(){},netSyncCb(){},netSyncDevices(){},netSyncRegrowth(){},netSyncTrail(){},netSyncWaveform(){}});
const ni=html.indexOf('function netSyncEffects(rows){'),nj=html.indexOf('const netSgBlk0=',ni);
vm.runInContext(html.slice(ni,nj),ctx);
const row={id:451,kind:'barrier',p:[0,0,0],yaw:0,hp:1600,seg:[400,400,400,400],fo:0};
ctx.netSyncEffects([row]);let bh=ctx.netWalls.get(451).userData.sgxh;
assert.equal(bh.segs[0].mesh.material.uniforms.uD.value,0,'fresh 400 HP is not damaged');
row.fo=1;row.seg=[300,300,300,300];ctx.netSyncEffects([row]);
assert.equal(ctx.netWalls.get(451).userData.sgxf,1,'explicit fortify works when every segment is below 400');
assert.equal(bh.segs[0].mesh.material.uniforms.uD.value,.5);
row.seg[1]=0;ctx.netSyncEffects([row]);assert.equal(bh.segs[1].mesh.visible,false);
ctx.netSyncEffects([]);assert.equal(ctx.netWalls.size,0);ctx.sgxReset();assert.equal(ctx.scene.children.length,0);
assert.deepEqual(errs,[]);console.log('Sage actual row-handler unfortified/damaged-fortified/break/drop: PASS');

const late={id:452,kind:'barrier',p:[0,0,0],yaw:0,hp:900,seg:[300,0,300,300],fo:1,age:8};
ctx.netSyncEffects([late]);bh=ctx.netWalls.get(452).userData.sgxh;
assert.equal(bh.fx.age,8);assert.equal(bh.segs[0].mesh.position.y,1.47);assert.equal(bh.segs[0].mesh.visible,true);
assert.equal(bh.segs[1].mesh.visible,false);assert.equal(ctx.sgxLive.length,1,'late missing segment has no shatter replay');
ctx.sgxTick(.05);assert.equal(ctx.sgxLive.length,1,'old wall has no rise shard replay');
late.seg[2]=0;ctx.netSyncEffects([late]);assert.equal(ctx.sgxLive.length,2,'subsequent real segment loss shatters once');
ctx.netSyncEffects([late]);assert.equal(ctx.sgxLive.length,2);ctx.netSyncEffects([]);ctx.sgxReset();assert.equal(ctx.scene.children.length,0);
console.log('Sage late row current age + silent initial missing segment, live loss once: PASS');

// Full composed page: netClearEffects must end the separately-added Sage module group.
const H=require('./page_harness.cjs').boot({real3:true}),xe=H.xe;
xe('NET.socket={readyState:1,send(){}};netSyncEffects([{id:744,kind:`barrier`,p:[0,0,0],yaw:0,hp:1800,seg:[600,0,600,600],fo:1,age:8}]);true');
assert.equal(xe('sgxLive.length'),1);assert.equal(xe('netWalls.size'),1);
xe('netClearEffects();true');assert.equal(xe('sgxLive.length'),0,'clear ends module not only hidden collision proxy');assert.equal(xe('netWalls.size'),0);
console.log('Sage actual composed-page clear ends persistent module: PASS');

xe('netSyncEffects([{id:745,kind:`barrier`,mesh:1,r:3.75,h:3,p:[0,0,0],yaw:0,hp:680,seg:[680],age:8,tl:22}]);true');
assert.equal(xe('sgxLive.length'),0,'Deadlock never builds Sage ice');assert.equal(xe('dlxLive.length'),1);assert.equal(xe('netWalls.get(745).userData.sgxh.fx.age'),8);assert.equal(xe('netWalls.get(745).userData.sgxh.fx.ttl'),30);xe('netClearEffects();true');assert.equal(xe('dlxLive.length'),0);console.log('Deadlock actual composed-page barrier identity/current-age/drop: PASS');
