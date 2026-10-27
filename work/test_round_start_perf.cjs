// perf-1 guard, real page (work/page_harness.cjs native: real native-map loader, nav, collision BVH, bots; WebGL stubbed and
// modelled by work/perf_render_emu.js), MEDIUM preset, Ascent 5v5 through two round starts with the profile pilot:
//  - shader precompile covers the lazily made smoke material and the agent blob shadow texture: no program compiled and no
//    texture uploaded mid-match (5f742f8: the smoke program at the first smoke, the 64 px blob texture at the first blob),
//    and a smoke / blob made mid-match after the warm-up compiles / uploads nothing either;
//  - round start: the spawn's buy area is built once per map and side (no BotBrain.buyArea at the second round start;
//    5f742f8 built it twice there), and the round-start / first-action frames stay under a generous wall-time tripwire.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{performance}=require('perf_hooks');const {boot}=require('./page_harness.cjs');
(async()=>{const H=boot({real3:true,seed:3,native:true,fastGlobal:true}),xe=H.xe,tick=()=>new Promise(r=>setImmediate(r));
 xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
 try{xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');}catch(e){}
 xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');xe('try{xGQApply("medium")}catch(e){};true');
 const src=fs.readFileSync(path.join(__dirname,'perf_match_profile.cjs'),'utf8'),pil=src.slice(src.indexOf('xe(`(()=>{const P=window.__PILOT'),src.indexOf('return true;})()`);')+'return true;})()`);'.length);assert(pil.length>200,'pilot found');
 xe(`J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await tick();}};
 for(let i=0;i<400&&!xe('!!(typeof nmActive==="function"&&nmActive()&&running)');i++)await adv(200);assert(xe('!!nmActive()'),'native Ascent loaded');
 eval(pil);
 // counters: real route searches (not served by the shared route cache) and buy-area builds, per frame
 xe(`(()=>{const W=window.__RS={area:0};const a0=BotBrain.buyArea;BotBrain.buyArea=function(){W.area++;return a0.apply(this,arguments);};return true;})()`);
 xe('__PS.live=true;__PS.endFrame();true');
 const rows=[];let prevBuy=xe('FV.buy'),starts=0,actions=0,firstAct=[],roundStart=[],win=0;
 // frame budget: buy ~45 s + one full round (100 s action, up to 45 s Spike fuse, post-round) + the next buy = up to ~16000 frames
 // at 60 fps; 9000 (150 s) only fitted a short first round (e341267 spawn walls + 7fd1afb collision: round 1 ran to frame 9115)
 for(let i=0;i<16000&&(actions<2||win>0);i++){xe("__RS.area=0;true");const a=performance.now();H.frameMs(1000/60);const ms=performance.now()-a;xe('__PS.endFrame()');
  const buy=xe('FV.buy'),rs=JSON.parse(xe('JSON.stringify(__RS)'));
  if(buy>prevBuy+1){starts++;roundStart.push({i,ms,...rs});}
  if(win>0){const r=firstAct[firstAct.length-1];r.ms=Math.max(r.ms,ms);win--;}
  if(prevBuy>0&&!(buy>0)){actions++;firstAct.push({i,ms,...rs});win=4;}/* the transition frame and the 4 after it (bots start holding on the first action frame) */
  prevBuy=buy;if((i&7)===7)await tick();}
 assert(actions>=2&&starts>=1,'two action phases and a round start reached ('+actions+'/'+starts+')');
 // mid-match smoke + blob after the warm-up: nothing new to compile or upload
 xe(`(()=>{const L=[];const m=new THREE.Mesh(orbGeo,xSmokeM("xTestSmoke",0x6a7fa0,0x405070));m.position.set(player.x,player.y+1,player.z);scene.add(m);L.push(m);
  if(typeof xBlob!=="undefined"&&xBlob.mat){const b=new THREE.Mesh(xBlob.geo,xBlob.mat);b.position.set(player.x,player.y+.02,player.z);scene.add(b);L.push(b);}window.__TL=L;return true;})()`);
 const hasBlob=xe('__TL.length===2');H.frameMs(1000/60);xe('__PS.endFrame();for(const m of __TL)scene.remove(m);true');
 const PS=JSON.parse(xe('JSON.stringify({prog:__PS.progNew.length,progK:__PS.progNew.slice(0,3).map(p=>p.key.slice(0,40)),up:__PS.up.filter(u=>u.live).length,upK:__PS.up.filter(u=>u.live).slice(0,3).map(u=>u.w+"x"+u.h+" "+u.n)})'));
 assert(hasBlob,'Medium preset draws agent blob shadows (the blob texture is part of the check)');
 assert.equal(PS.prog,0,'no shader program compiled mid-match: '+JSON.stringify(PS.progK));assert.equal(PS.up,0,'no texture uploaded mid-match: '+JSON.stringify(PS.upK));
 for(const r of roundStart)assert.equal(r.area,0,'round start '+r.i+': buy area reused (built '+r.area+'x)');
  const worst=Math.max(...roundStart.concat(firstAct).map(r=>r.ms));assert(worst<150,'round-start / first-action frame '+worst.toFixed(1)+' ms (tripwire bound 150: wall time on a shared box)');
 assert.equal((H.errors||[]).filter(e=>!/\[object Object\]/.test(String(e&&(e.message||e.e||e)))).length,0,'no page errors: '+JSON.stringify((H.errors||[]).slice(0,3).map(e=>String(e&&(e.message||e.e||e)).slice(0,160))));
 console.log('Round-start perf: 0 mid-match compiles / uploads (smoke + blob covered); round starts '+roundStart.map(r=>r.i+':'+r.ms.toFixed(1)+'ms area '+r.area).join(', ')+'; first action frames '+firstAct.map(r=>r.i+':'+r.ms.toFixed(1)+'ms').join(', '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
