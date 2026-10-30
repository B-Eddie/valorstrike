// Reload magazine drop (xDrop) without a shader link mid-fight (eventperf, user 2026-10-29 "check every event for lag"):
// the falling magazine used a transparent clone of the mag material made on every reload and disposed 0.7 s later; a
// transparent material is its own program (OPAQUE define), so the first reload linked it in the fight and every later
// reload linked it again (the dispose had released it). Checks on the real page (offline 5v5, real three scene graph):
//  - two reloads of the same gun draw the SAME pooled clone (no new material, never disposed), transparent, and a fresh
//    copy of the source each time (opacity back to the source's when the next drop starts)
//  - two overlapping drops never share a clone
//  - the per-map precompile's warm list (xWarmLazy) holds a mesh with each magazine's pooled clone, so the program is
//    linked behind the loading screen (perf_render_emu: no new program key during a live reload)
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.buy=0;FV.menu=false;try{buyMenu(false)}catch(e){};player.hp=1e6;true');
 xe('bEquip("Vandal","pri");if(rw!=="pri")swapW("pri");true');await adv(1600);
 // dispose spy on every material
 xe('window.__disp=0;{const d=THREE.Material.prototype.dispose;THREE.Material.prototype.dispose=function(){if((XRL.du&&XRL.du.has(this))||(window.__dropMats&&__dropMats.has(this)))__disp++;return d.apply(this,arguments);};}window.__dropMats=new Set();true');
 const drop=()=>JSON.parse(xe(`(()=>{const P=XRP.Vandal;xDrop(P.mag);const f=XRL.fx[XRL.fx.length-1];const ms=[];f.m.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>{ms.push(m);__dropMats.add(m);});});
   window.__last=ms;const src=[];P.mag.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>src.push(m));});const R=window.__reg||(window.__reg=[]);return JSON.stringify({n:ms.length,ids:ms.map(m=>{let i=R.indexOf(m);if(i<0)i=R.push(m)-1;return i;}),tr:ms.every(m=>m.transparent),op:ms.map(m=>m.opacity),srcOp:src.map(m=>m.opacity),same:ms.some(m=>src.includes(m))});})()`));
 const fade=async()=>{for(let i=0;i<50;i++){xe('xFx(0.02);true');}};
 const a=drop();assert.ok(a.n>0,'the drop carries a material');assert.ok(a.tr,'drop clones are transparent');assert.ok(!a.same,'the source material itself is never faded');
 await fade();assert.equal(xe('XRL.fx.length'),0,'drop faded out and left the scene');
 const b=drop();assert.deepEqual(b.ids,a.ids,'the second reload reuses the pooled clone (no new material)');assert.deepEqual(b.op,b.srcOp,'a reused clone starts as a fresh copy of the source (opacity)');
 const c=drop();assert.ok(c.ids.every(id=>!b.ids.includes(id)),'an overlapping drop never shares a clone with one still falling');
 await fade();assert.equal(xe('__disp'),0,'pooled drop clones are never disposed');
 // warm list: every magazine's pooled clone is in xWarmLazy, and a live reload then links nothing new
 const w=JSON.parse(xe(`(()=>{const warm=xWarmLazy();const mats=new Set();warm.forEach(m=>[].concat(m.material).forEach(x=>mats.add(x)));warm.forEach(m=>scene.remove(m));const miss=[];
   for(const k in XRP){const g=XRP[k].mag;if(!g)continue;g.traverse(o=>{if(o.isMesh&&o.material)[].concat(xDropMat(o.material)).forEach(x=>{if(!mats.has(x))miss.push(k);});});}
   if(XRL.du)for(const m of XRL.du)XRL.du.delete(m);return JSON.stringify({miss,n:warm.length});})()`));
 assert.deepEqual(w.miss,[],'xWarmLazy carries the pooled drop clone of every magazine');
 xe('xPrecompile();__PS.endFrame();__PS.live=true;__PS.progNew.length=0;true');
 xe('ammo=3;rsv=60;reloading=xRT();true');await adv(2600);
 const pn=JSON.parse(xe('JSON.stringify(__PS.progNew.map(p=>p.obj+" "+p.key.slice(0,50)))'));
 assert.deepEqual(pn.filter(s=>/mag/.test(s)),[],'no new program for the dropped magazine during a live reload');
 assert.equal(H.errors.length,errs0,'page errors '+JSON.stringify(H.errors.slice(errs0)));
 console.log(`reload drop pool: pooled transparent clones reused (${a.n} material(s)), never disposed, overlapping drops separate, warm list covers ${w.n} magazine mesh(es), live reload links no new program`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
