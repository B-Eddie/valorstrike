// Hit-path perf regressions ("when I shoot / take damage it starts to lag"):
//  (a) native-map shader warmup also compiles the pooled hit effects that stay hidden until first use (tracers, hit
//      impacts, the first-person muzzle flash), then hides them again; hidden collision meshes inside the map group are never flipped
//  (b) the hit-impact pool goes idle: once every burst has expired a tick does no per-slot matrix work
//  (c) shots allocate no vectors: bFx reuses its muzzle/end scratch, xSurfHit's synthesized hit and slab test are
//      allocation-free (one owner object per parent group, so decals still follow their map), bfxBot reuses its ray
//  (d) taking damage keeps one hurt-overlay timer per burst instead of one per hit
//  (e) default brightness puts no CSS filter on the game canvas
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'index.html'),'utf8'),nat=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const T=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const fnSrc=(src,name)=>{const a=src.indexOf('function '+name+'(');assert(a>=0,name);let i=src.indexOf('{',a),d=0;for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&!--d)break;}return src.slice(a,i+1);};
// (a) native warmup
{const line=nat.split('\n').find(l=>l.startsWith('{const precompile=xPrecompile;xPrecompile=function(){if(!nmActive())'));assert(line,'native precompile wrapper');
 const tracer={isLine:true,visible:false},impact={isMesh:true,visible:false},group={isGroup:true,visible:false,children:[{isMesh:true,visible:false}]},shown={isMesh:true,visible:true};
 // the first-person muzzle flash (a hidden Sprite under the gun under the camera): its program was first built by the first
 // shot of the match (work/bench_shoot_enemy.cjs first-hit render model: 1 new program + 1 texture upload on shot one)
 const scene={children:[tracer,impact,group,shown]},cam={visible:true,parent:scene},gun={visible:false,parent:cam},muzzle={isSprite:true,visible:false,parent:gun};
 const seen=[];const c={xPrecompile(){},nmActive:()=>true,xPC:false,BFX:{ok:true},bfxInit(){},xHitInit(){c.inited=1;},console,muzzle,
  scene,camera:cam,renderer:{compile(){seen.push([tracer.visible,impact.visible,group.visible,group.children[0].visible,muzzle.visible,gun.visible]);}}};
 vm.createContext(c);vm.runInContext(line,c);c.xPrecompile();
 assert.deepEqual(seen,[[true,true,false,false,true,true]],'hidden effect leaves and the muzzle flash (with its hidden gun) visible during compile; map groups and their hidden meshes untouched');
 assert.equal(tracer.visible,false);assert.equal(impact.visible,false);assert.equal(muzzle.visible,false);assert.equal(gun.visible,false);assert.equal(c.inited,1,'hit impacts created before the warmup');assert.equal(c.xPC,true);
 // its texture is uploaded with the other lazily used ones (xWarmLazy, both warmup paths)
 assert.match(fnSrc(s,'xWarmLazy'),/initTexture\(muzzle\.material\.map\)/,'muzzle flash texture uploaded at warmup');}
// (b) idle hit-impact pool
{const Impact=require('../vendor/hit-impact.js')(T),scene=new T.Scene(),cam=new T.PerspectiveCamera();cam.updateMatrixWorld(true);
 const fx=new Impact(scene,8);let writes=0;const sm=fx.shards.setMatrixAt.bind(fx.shards);fx.shards.setMatrixAt=(i,m)=>{writes++;sm(i,m);};
 fx.emit(new T.Vector3(0,1,0),null,true);fx.tick(.016,cam);assert(writes>0);for(let i=0;i<30;i++)fx.tick(.05,cam);assert(!fx.shards.visible);
 writes=0;for(let i=0;i<100;i++)fx.tick(.016,cam);assert.equal(writes,0,'idle pool: no per-slot work per frame');
 fx.emit(new T.Vector3(0,1,0),null,false);fx.tick(.016,cam);assert(writes>0&&fx.cores.visible,'emit wakes the pool');}
// (c) allocation-free shot effects
{const lazy=t=>t.replace(/\(([\w.]+) \|\| \(\1 = new THREE\.\w+\(\)\)\)/g,'$1').replace(/([\w.]+) \|\| \(\1 = \{[^}]*\}\)/g,'$1'); // one-time lazy scratch is fine
 const bfx=lazy(fnSrc(s,'bFx')),surf=fnSrc(s,'xSurfHit'),bot=lazy(fnSrc(s,'bfxBot'));
 assert.doesNotMatch(bfx,/new THREE\.Vector3|\.clone\(\)|computeBoundingSphere/,'bFx: scratch points, no per-shot bounding-sphere scan');
 assert.doesNotMatch(surf,/new THREE\.|\[\[ox/,'xSurfHit: no vectors / per-box arrays per shot');
 assert.doesNotMatch(bot,/new THREE\.|\.concat\(|\.map\(/,'bfxBot: no per-shot vectors / arrays');
 assert.doesNotMatch(s,/setFromCamera\(new THREE\.Vector2/,'crosshair rays reuse XC0');
 // behaviour: synthesized floor / box hits are the same values, one owner object per parent group
 const c={THREE:T,player:{x:0,z:0},camera:{position:new T.Vector3(0,1.6,0)},yaw:0,pitch:0,scene:{name:'scene'},solids:[{parent:{name:'mapA'}}],boxes:[{x1:-1,x2:1,z1:-6,z2:-4,h:3}]};
 vm.createContext(c);vm.runInContext(s.slice(s.indexOf('const XSH = {'),s.indexOf('\n',s.indexOf('const XSH = {')))+'\n'+surf+';this.f=xSurfHit;',c);
 const h1=c.f(null,new T.Vector3(0,0,-1),200,new T.Vector3(0,1.6,0));assert.equal(h1.distance,4);assert.deepEqual([...h1.n],[0,0,1]);assert.equal(h1.point.z,-4);
 const o1=h1.object;const h2=c.f(null,new T.Vector3(0,-1,0),200,new T.Vector3(0,1.6,0));assert.equal(h2.distance,1.6);assert.deepEqual([...h2.n],[0,1,0]);assert.equal(h2.object,o1,'same parent: same owner');
 c.solids[0]={parent:{name:'mapB'}};const h3=c.f(null,new T.Vector3(0,-1,0),200,new T.Vector3(0,1.6,0));assert.notEqual(h3.object,o1,'new map group: new owner (old decals still clear with their map)');assert.equal(h3.object.parent.name,'mapB');}
// (d) one hurt-overlay timer per burst
{const timers=new Map();let id=0;const el={style:{opacity:0}};const c={$:()=>el,setTimeout:(f,ms)=>{timers.set(++id,f);return id;},clearTimeout:t=>timers.delete(t)};
 vm.createContext(c);vm.runInContext(fnSrc(s,'xDmgFlash'),c);for(let i=0;i<10;i++)c.xDmgFlash();assert.equal(timers.size,1);assert.equal(+el.style.opacity,1);
 [...timers.values()][0]();assert.equal(+el.style.opacity,0);
 assert.equal((s.match(/setTimeout\(\(\) => \$\("dmg"\)\.style\.opacity = 0, 150\)/g)||[]).length,0,'every hit site uses xDmgFlash');}
// (e) brightness filter only off the default
{const line=s.slice(s.indexOf('const applyBright = '),s.indexOf('\n',s.indexOf('const applyBright = ')));const cv={style:{filter:'x'}},c={S:{bright:100},document:{querySelector:()=>cv}};
 vm.createContext(c);vm.runInContext(line+'\n;this.f=applyBright;',c);c.f();assert.equal(cv.style.filter,'');c.S.bright=120;c.f();assert.equal(cv.style.filter,'brightness(1.2)');}
console.log('Hit-path perf: native warmup compiles hidden hit effects, idle impact pool, allocation-free shot effects (owner per map group), one hurt-overlay timer per burst, no default canvas filter');
