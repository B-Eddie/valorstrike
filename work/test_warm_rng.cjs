// Warm-ups leave the seeded game alone (eventperf follow-up, 2026-10-29): the event-lag warm-ups (07f8f8e reload magazine
// drop pool, e204bec corpse warm, c3b9504 Barrier Orb warm mesh) must not change gameplay. Every new three object takes its
// uuid from Math.random (MathUtils.generateUUID), and the offline match (bots, spread, routes) plays from that same
// generator, so a warm-up that builds objects mid-match, or a pool that skips a clone the old code made, shifts every
// later draw: 07f8f8e's per-precompile warm meshes + reused drop clones played a different seeded match than 9af6813
// (test_bot_play_offline seed 3: near pulls n 1 -> 8, its live spray check then failed on a match base never played).
// Checks on the real page (offline 5v5, real three scene graph), counting the draws of the page's own Math.random:
//  - the loading gate's warm-up (window.xWarmShaders: xPrecompile + xWarmLazy warm meshes + xrWarm corpse warm) draws none
//  - a reload's magazine drop (xDrop) draws exactly what the pre-pool xDrop drew (mesh clone + one fresh material clone
//    per material), on the first drop, a reused pooled clone, and an overlapping drop
//   node work/test_warm_rng.cjs
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.buy=0;FV.menu=false;try{buyMenu(false)}catch(e){};player.hp=1e6;true');
 xe('bEquip("Vandal","pri");if(rw!=="pri")swapW("pri");true');await adv(1600);
 assert.ok(xe('!!(XRP.Vandal&&XRP.Vandal.mag)'),'the Vandal viewmodel has a magazine (the drop / warm list have something to do)');
 // count the page generator's draws (a warm-up that swaps in its own generator is not counted: that is the point)
 xe('window.__rn=0;{const r=Math.random;Math.random=function(){__rn++;return r.apply(this,arguments);};}true');
 // 1. the loading gate's warm-up
 const w=JSON.parse(xe(`(()=>{xPC=false;const r0=typeof XR_WARM!=='undefined'?XR_WARM.runs:-1,mags=[];for(const k in XRP)if(XRP[k].mag)mags.push(k);__rn=0;window.xWarmShaders();
   return JSON.stringify({n:__rn,pc:xPC,xr:typeof XR_WARM!=='undefined'?XR_WARM.runs-r0:-1,mags:mags.length});})()`));
 console.log(`warm-up: ${w.n} draws (precompile ran ${w.pc}, corpse warm runs +${w.xr}, ${w.mags} magazine(s) in the warm list)`);
 assert.ok(w.pc,'the warm-up ran (xPC set)');assert.ok(w.mags>0,'magazines are warmed');
 assert.equal(w.n,0,'the loading-gate warm-up (xPrecompile / xWarmLazy / xrWarm) draws nothing from the seeded game generator');
 // 2. reload magazine drop: same draws as the pre-pool code (m.clone() + a fresh x.clone() per material)
 const want=+xe(`(()=>{__rn=0;const c=XRP.Vandal.mag.clone();c.traverse(o=>{if(o.material)[].concat(o.material).forEach(x=>x.clone());});return __rn;})()`);
 const drop=()=>+xe('(()=>{__rn=0;xDrop(XRP.Vandal.mag);return __rn;})()');
 const fade=()=>{for(let i=0;i<50;i++)xe('xFx(0.02);true');};
 const d1=drop();fade();const d2=drop();const d3=drop();fade();
 console.log(`reload drop draws: pre-pool ${want}, first ${d1}, reused ${d2}, overlapping ${d3}`);
 assert.ok(want>0,'a fresh clone draws uuids');
 assert.equal(d1,want,'first drop draws what the pre-pool drop drew');assert.equal(d2,want,'a reused pooled clone draws what a fresh clone drew');
 assert.equal(d3,want,'an overlapping drop draws what a fresh clone drew');
 assert.equal(H.errors.length,errs0,'page errors '+JSON.stringify(H.errors.slice(errs0)));
 console.log('warm-ups and the drop pool leave the seeded game generator as the base code did ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
