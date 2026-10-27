// Sustained-fire bench (a tool, not in test_all): "whenever I shoot at enemies, it starts lagging a lot".
// Boots the real page on the native Ascent map (page_harness native:true, real three.js scene graph, WebGL stubbed),
// starts an offline 5v5, freezes bot fire, then runs frames of 17 ms on the harness clock while the player holds fire:
//   hit  : the crosshair on a bot 8 m ahead (hp topped up each frame so it never dies)
//   miss : the same frames with the bot 1.4 m to the side (still on screen; the shots hit the map behind it)
//   wall : crosshair on the bot but the bot moved 30 m aside (shots fly over open map)
// Per scenario: shots fired, mean / p95 JS ms per frame (shot + loop), page-side THREE objects constructed per frame,
// sampled page allocation KB per frame, and (--prof hit|miss) a CPU profile of the scenario's frames.
//   node work/bench_shoot_enemy.cjs [--frames 240] [--prof hit] [--json out.json]
const fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},F=+(arg('--frames')||240),PROF=arg('--prof'),OUT=arg('--json');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnSrc=name=>{const a=html.indexOf('function '+name+'(');if(a<0)throw Error(name);let i=html.indexOf('{',a),d=0;for(;i<html.length;i++){if(html[i]==='{')d++;else if(html[i]==='}'&&!--d)break;}return html.slice(a,i+1);};
const H=boot({real3:true,seed:7,native:!process.env.LEGACY,fastGlobal:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
// real agent rigs (AGENTS=0 keeps the harness's no-model stand-ins): the page's own loader on models/valorant/agents/*.glb,
// textures replaced by empty THREE.Textures (no image decode in Node; the renderer is stubbed anyway)
const AGENTS=process.env.AGENTS!=='0';
if(AGENTS)xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(`window.__qaC=0;(function(){for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype||!/^[A-Z]/.test(k))continue;
 const W=class extends C{constructor(...a){super(...a);__qaC++;}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}})();true`);
// JS-side render model (work/perf_render_emu.js): counts draws / programs / uploads a real WebGLRenderer would issue
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');const emu0=()=>xe('JSON.stringify(__PS.endFrame())');
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
const pageBytes=hp=>{let b=0;(function w(x){const u=x.callFrame.url;if(x.selfSize&&!/^node:|bench_shoot_enemy|page_harness/.test(u)&&x.callFrame.functionName!=='#onMessage')b+=x.selfSize;for(const c of x.children||[])w(c);})(hp.head);return b;};
const place=(kind)=>`(()=>{const b=window.__qaB&&window.__qaB.alive?window.__qaB:bots.find(x=>x.alive);if(!b)return 0;window.__qaB=b;b.alive=true;b.hp=100;b.armor=0;b.cd=1e9;
  b.g.position.set(player.x${kind==='wall'?'+30':kind==='miss'?'+1.4':''},player.y||0,player.z-8);b.g.updateMatrixWorld(true);player.hp=100;yaw=0;pitch=0;
  camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(pitch,0,0,"YXZ");camera.updateMatrixWorld(true);
  ammo=30;reloading=0;VM.sw=0;try{spray=0;rcl=0;rclH=0;}catch(e){}return 1;})()`;
async function scenario(kind,prof){
 const P=place(kind),fire=`(${P})&&(fcd<=0?(window.__qaN=(window.__qaN||0)+1,shoot(false),1):1)`;
 for(let i=0;i<30;i++){xe(fire);H.advance(17);} // warm
 xe('window.__qaN=0;true');const c0=xe('__qaC'),ts=[];
 const E={calls:0,tris:0,prog:0,tex:0,geo:0,attr:0,attrBytes:0};emu0();
 for(let i=0;i<F;i++){const a=process.hrtime.bigint();xe(fire);H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);const e=JSON.parse(emu0());for(const k in E)E[k]+=e[k]||0;}
 for(const k in E)E[k]=+(E[k]/F).toFixed(2);
 const shots=xe('__qaN'),objs=(xe('__qaC')-c0)/F;
 await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:512});
 for(let i=0;i<F;i++){xe(fire);H.advance(17);}
 const {profile:hp}=await post('HeapProfiler.stopSampling');
 if(prof){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');
  for(let i=0;i<F;i++){xe(fire);H.advance(17);}
  const {profile:cp}=await post('Profiler.stop');const byId=new Map(cp.nodes.map(x=>[x.id,x])),cnt=new Map();for(const id of cp.samples)cnt.set(id,(cnt.get(id)||0)+1);
  const tot=cp.samples.length,incl=new Map(),self=new Map();const key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
  (function walk(x,stack){const k=key(x),own=cnt.get(x.id)||0;let sum=own;self.set(k,(self.get(k)||0)+own);const st=new Set(stack);st.add(k);for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,[...st]);if(!stack.includes(k))incl.set(k,(incl.get(k)||0)+sum);return sum;})(cp.nodes[0],[]);
  console.log(`[${kind}] inclusive top 30:`);[...incl].sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log('  ',(v/tot*100).toFixed(1)+'%',k));
  console.log(`[${kind}] self top 20:`);[...self].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v])=>console.log('  ',(v/tot*100).toFixed(1)+'%',k));}
 const s=[...ts].sort((a,b)=>a-b);
 const r={frames:F,shots,meanMs:+(ts.reduce((a,b)=>a+b,0)/F).toFixed(3),p95Ms:+s[Math.floor(F*.95)].toFixed(3),maxMs:+s[F-1].toFixed(3),threeObjPerFrame:+objs.toFixed(2),allocKBPerFrame:+(pageBytes(hp)/1024/F).toFixed(2),render:E,botHp:xe('__qaB.hp')};
 console.log(kind.padEnd(5),JSON.stringify(r));return r;}
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 console.log('native map:',xe('!!(typeof nmActive==="function"&&nmActive())'));
 if(AGENTS){const t0=Date.now(); // models wait (hidden) for their kit and attach when it lands (xvAttach)
  for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
  console.log('agent kits:',xe('Object.keys(XVA.kits).join(",")'),((Date.now()-t0)/1000).toFixed(1)+' s');}
 xe('FV.buy=0.05;true');await adv(1500);
 console.log('native rigs on units:',xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length'),'/',xe('bots.length+allies.length'));xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});try{xHitInit()}catch(e){}true');
 const res={};const order=(process.env.ORDER||'miss,hit,wall,hit,miss').split(',');
 for(const k of order){const r=await scenario(k,PROF===k&&!res[k]);(res[k]=res[k]||[]).push(r);}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
