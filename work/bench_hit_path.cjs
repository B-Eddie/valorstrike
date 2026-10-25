// Hit-path / per-frame cost bench (a tool, not in test_all): boots the real page in the headless harness
// (work/page_harness.cjs, real three.js scene graph, WebGL stubbed), starts an offline 5v5 on Ascent, then measures
//   fire-hit : shoot() into a bot standing 8 m in front of the camera
//   fire-miss: shoot() into the floor/wall (decal + spark + tracer path)
//   bot-fire : bfxBot() for an enemy bot (tracer/impact path run for every bot shot)
//   take-hit : the bot-hits-player block of tick() (hurt + xTag + xDmgArc + #dmg flash + updHud)
//   frame    : one full loop() (sim step + HUD + render stub) with 9 bots alive
// For each: mean / p95 ms per call, page-level THREE allocations per call (new THREE.X counted by constructor),
// DOM elements created per call, scene descendants added, timers left pending per call.
//   node work/bench_hit_path.cjs [--json out.json] [--n 300]
const fs=require('fs'),path=require('path'),v8=require('v8'),vm=require('vm');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},N=+(arg('--n')||300),OUT=arg('--json');
v8.setFlagsFromString('--expose_gc');
const H=boot({real3:true,seed:7}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
// The audit DOM resolves getElementById by walking the whole tree (a browser uses an id map): cache it so the
// harness's DOM cost does not swamp the page's own (an entry is re-resolved when the element lost its id).
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
// vendor/hit-impact.js is a page script the audit harness does not load: evaluate it into the page so the hit path matches the browser.
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
const PROF=arg('--prof');let insp=null;
async function profile(name,setup,call,n){ // --prof <name>: CPU + sampled-allocation profile of one measured call
 insp=HS;
 const post=(m,p)=>new Promise((ok,no)=>insp.post(m,p||{},(e,r)=>e?no(e):ok(r)));
 await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:50});await post('HeapProfiler.enable');
 await post('Profiler.start');await post('HeapProfiler.startSampling',{samplingInterval:512});
 const run=typeof call==="function"?call:()=>xe(call);for(let i=0;i<n;i++){xe(setup);run();}
 const {profile:cp}=await post('Profiler.stop'),{profile:hp}=await post('HeapProfiler.stopSampling');
 const self=new Map();const dt=cp.timeDeltas,byId=new Map(cp.nodes.map(x=>[x.id,x]));const cnt=new Map();for(const id of cp.samples)cnt.set(id,(cnt.get(id)||0)+1);
 for(const [id,c] of cnt){const x=byId.get(id),k=x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);self.set(k,(self.get(k)||0)+c);}
 const incl=new Map();(function walk(x,seen){const k=x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);let own=cnt.get(x.id)||0,sum=own;for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,seen);if(/index\.html/.test(x.callFrame.url))incl.set(k,(incl.get(k)||0)+sum);x._t=sum;return sum;})(cp.nodes[0]);
 const tot0=[...cnt.values()].reduce((a,b)=>a+b,0);console.log('Inclusive page functions (top 25):');[...incl].sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,v])=>console.log(' ',(v/tot0*100).toFixed(1)+'%',k));
 const tot=[...cnt.values()].reduce((a,b)=>a+b,0);console.log('CPU self (top 25 of '+tot+' samples):');[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,v])=>console.log(' ',(v/tot*100).toFixed(1)+'%',k));
 const al=new Map();(function walk(x,stack){const k=x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);if(x.selfSize)al.set(k,(al.get(k)||0)+x.selfSize);for(const c of x.children||[])walk(c);})(hp.head);
 const at=[...al.values()].reduce((a,b)=>a+b,0);console.log('Alloc self (top 20, '+(at/1024/n).toFixed(1)+' KB/call sampled):');[...al].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v])=>console.log(' ',(v/1024/n).toFixed(2)+' KB/call',k));
}
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
// Counting wrappers: page code resolves THREE.X at call time, three's internals do not (only page allocations counted).
xe(`window.__qaC={};window.__qaDom=0;(function(){const K=["Vector3","Vector2","Quaternion","Matrix4","Color","Raycaster","Mesh","Sprite","Line","Group","Object3D",
 "BufferGeometry","PlaneGeometry","SphereGeometry","BoxGeometry","CapsuleGeometry","MeshBasicMaterial","MeshLambertMaterial","MeshStandardMaterial","SpriteMaterial","LineBasicMaterial",
 "Texture","CanvasTexture","PointLight","Box3","Sphere","Euler","Ray"];for(const k of K){const C=THREE[k];if(!C)continue;const W=class extends C{constructor(...a){super(...a);__qaC[k]=(__qaC[k]||0)+1;}};
 Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}
 const ce=document.createElement.bind(document);document.createElement=function(t){__qaDom++;return ce(t);};})();true`);
const snap=()=>xe(`(()=>{let d=0;scene.traverse(()=>d++);return {c:Object.assign({},__qaC),dom:__qaDom,desc:d};})()`);
const diff=(a,b)=>{const o={};let tot=0;for(const k in b.c){const v=b.c[k]-(a.c[k]||0);if(v){o[k]=v;tot+=v;}}return {alloc:tot,byType:o,dom:b.dom-a.dom,desc:b.desc-a.desc};};
const {Session}=require('inspector'),HS=new Session();HS.connect();const hpost=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
// Sampled allocation bytes attributed to the page (index.html, three, vendor scripts), excluding the bench/inspector.
const pageBytes=hp=>{let b=0;(function w(x){const u=x.callFrame.url;if(x.selfSize&&!/^node:|bench_hit_path/.test(u)&&x.callFrame.functionName!=='#onMessage')b+=x.selfSize;for(const c of x.children||[])w(c);})(hp.head);return b;};
async function measure(name,setup,call,n=N){M[name]=[setup,call,n];
 const run=typeof call==='function'?call:()=>xe(call);xe(setup);for(let i=0;i<10;i++)run(); // warm
 const t0=H.timers.size,s0=snap(),ts=[];
 for(let i=0;i<n;i++){xe(setup);const a=process.hrtime.bigint();run();ts.push(Number(process.hrtime.bigint()-a)/1e6);}
 await hpost('HeapProfiler.enable');await hpost('HeapProfiler.startSampling',{samplingInterval:256}); // allocation pass (separate: sampling slows the timed pass)
 for(let i=0;i<n;i++){xe(setup);run();}
 const {profile:hp}=await hpost('HeapProfiler.stopSampling');
 const s1=snap(),d=diff(s0,s1);ts.sort((a,b)=>a-b);
 const r={calls:n,meanMs:+(ts.reduce((a,b)=>a+b,0)/n).toFixed(4),p95Ms:+ts[Math.floor(n*.95)].toFixed(4),
  threeObjPerCall:+(d.alloc/n/2).toFixed(2),threeObjByType:Object.fromEntries(Object.entries(d.byType).map(([k,v])=>[k,+(v/n/2).toFixed(2)])),
  domPerCall:+(d.dom/n/2).toFixed(2),sceneAdded:d.desc,timersAdded:H.timers.size-t0,allocKBPerCall:+(pageBytes(hp)/1024/n).toFixed(2)};
 console.log(name.padEnd(10),JSON.stringify(r));return r;}
const M={};
(async()=>{
 const map=process.env.MAP||'ascent';
 xe(`FV.pick=${JSON.stringify(map)};window.xQPick=${JSON.stringify(map)};try{mpSet(${JSON.stringify(map)})}catch(e){}true`);
 H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 xe('FV.buy=0.05;true');await adv(1500);
 xe('try{xHitInit()}catch(e){}true');
 const res={hitImpact:xe('!!XHIT'),map,bots:xe('bots.filter(b=>b.alive).length'),allies:xe('allies.filter(b=>b.alive).length')};
 // a bot 8 m ahead of the camera on the player's line of sight; shooter fully ready each call
 const place=`(()=>{const b=bots.find(x=>x.alive)||bots[0];b.alive=true;b.hp=100;b.armor=0;window.__qaB=b;player.hp=100;yaw=0;pitch=0;
  b.g.position.set(player.x,player.y||0,player.z-8);b.g.updateMatrixWorld(true);camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);
  ammo=30;reloading=0;try{fcd=0;}catch(e){}try{spray=0;}catch(e){}try{VM.sw=0;}catch(e){}return 1;})()`;
 res.fireHit=await measure('fire-hit',place,'shoot(false)');res.fireHitLands=xe(place+'&&(shoot(false),__qaB.hp<100)');console.log('fire-hit lands:',res.fireHitLands,'hit-impact:',res.hitImpact);
 res.fireMiss=await measure('fire-miss',place+';pitch=-0.6;camera.rotation.set(-0.6,0,0,"YXZ");camera.updateMatrixWorld(true);__qaB.g.position.x+=30;__qaB.g.updateMatrixWorld(true);1','shoot(false)');
 res.botFire=await measure('bot-fire',`(()=>{const b=bots.find(x=>x.alive);window.__qaS=b;return 1;})()`,'bfxBot(__qaS.g.position)');
 res.takeHit=await measure('take-hit',`player.hp=100;player.armor=0;window.__qaS=bots.find(x=>x.alive)||bots[0];1`,
  `{const b=__qaS,n=30;xHS=false;hurt(player,n,b.name);xTag(player,n);xDmgArc(b.g.position.x,b.g.position.z);if(typeof xDmgFlash==="function")xDmgFlash();else{$("dmg").style.opacity=1;setTimeout(()=>$("dmg").style.opacity=0,150);}updHud();}`); // as tick()'s bot-hits-player block
 xe('player.hp=100;bots.forEach(b=>{if(!b.alive)return;b.hp=100;});true');
 res.frame=await measure('frame','1',()=>H.advance(17),Math.min(N,200)); // one real frame: 17 ms of the harness clock (rAF -> loop(), due timers)
 if(PROF&&M[PROF])await profile(PROF,M[PROF][0],M[PROF][1],M[PROF][2]);
 console.log('hit-impact idle after frames:',xe('XHIT?String(XHIT.idle)+" active "+XHIT.items.filter(e=>e.age<e.life).length:"none"'));
 xe('cancelAnimationFrame(loop.id);true');
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
