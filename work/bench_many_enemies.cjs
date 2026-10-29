// Many enemies on screen (user: "fps 60 -> 20 when I meet many enemies"; a tool, not in test_all). Page harness (real
// three.js scene graph, WebGL stubbed, work/perf_render_emu.js counts what a WebGLRenderer would issue), native Ascent,
// offline 5v5 with the real agent rigs. N units (bots first, then allies) stand 5-12 m in front of the camera, all firing
// (bot fire on, player hp topped up), for 1 / 5 / 9 units. Per N: JS ms per frame (mean / p95), xSolTick ms (agent
// animation + pose follow-ups + hit volumes), draw calls (whole world frame), calls on agents (units' subtrees), new programs.
//   VS_ROOT=<tree> node work/bench_many_enemies.cjs [--frames 120] [--json out.json]
const fs=require('fs'),path=require('path');const ROOT=process.env.VS_ROOT||path.join(__dirname,'..');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},F=+(arg('--frames')||120),OUT=arg('--json');
const H=boot({real3:true,seed:7,native:true,fastGlobal:true,root:ROOT}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}await adv(100);}return false;};
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
(async()=>{const t0=Date.now();
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
 xe('FV.buy=0.05;true');await adv(1500);console.log('boot',((Date.now()-t0)/1000).toFixed(0)+'s','rigs',xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length'));
 H.win.__hr=()=>Number(process.hrtime.bigint())/1e6;
 xe(`window.__VW={sol:0};{const f=xSolTick;xSolTick=function(){const a=__hr();try{return f.apply(this,arguments);}finally{__VW.sol+=__hr()-a;}};}
  window.__agentCalls=()=>{const U=new Set(bots.concat(allies).filter(b=>b.g).map(b=>b.g));let n=0;const fr=new THREE.Frustum(),m4=new THREE.Matrix4(),sp=new THREE.Sphere();camera.updateMatrixWorld();m4.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);fr.setFromProjectionMatrix(m4);
   for(const g of U)g.traverseVisible(o=>{if(!o.isMesh)return;let v=true;for(let p=o;p;p=p.parent)if(!p.visible)v=false;if(!v)return;if(o.frustumCulled!==false){const G=o.geometry;if(!G.boundingSphere)G.computeBoundingSphere();sp.copy(G.boundingSphere).applyMatrix4(o.matrixWorld);if(!fr.intersectsSphere(sp))return;}n+=Array.isArray(o.material)?Math.max(1,o.geometry.groups.length):1;});return n;};true`);
 const put=N=>`(()=>{const L=bots.concat(allies).filter(b=>b.alive&&b.g);let i=0;for(const b of L){b.hp=100;if(i<${N}){const x=player.x+((i%3)-1)*1.8,z=player.z-(5+Math.floor(i/3)*3.5);b.g.position.set(x,player.y||0,z);b.cd=0;}else{b.g.position.set(player.x+200+i*3,player.y||0,player.z+200);b.cd=1e9;}b.g.updateMatrixWorld(true);i++;}
  player.hp=100;yaw=0;pitch=0;camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);fireHeld=true;ammo=30;reloading=0;return Math.min(i,${N});})()`;
 const res=[];for(const N of [1,5,9]){const st=put(N);for(let i=0;i<40;i++){xe(st);H.advance(17);}xe('__VW.sol=0;__PS.live=true;__PS.progNew.length=0;true');xe('__PS.endFrame();true');
  const ts=[];let calls=0,ac=0;for(let i=0;i<F;i++){xe(st);const a=process.hrtime.bigint();H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);calls+=JSON.parse(xe('JSON.stringify(__PS.endFrame())')).calls;if(i%10===0)ac+=xe('__agentCalls()');}
  const s=[...ts].sort((a,b)=>a-b),r={n:xe(st),frames:F,frameMs:+(ts.reduce((a,b)=>a+b,0)/F).toFixed(2),p95:+s[Math.floor(F*.95)].toFixed(2),xSolTickMs:+(xe('__VW.sol')/F).toFixed(2),calls:+(calls/F).toFixed(1),agentCalls:+(ac/Math.ceil(F/10)).toFixed(1),newPrograms:xe('__PS.progNew.length')};
  console.log('N',JSON.stringify(r));res.push(r);}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
