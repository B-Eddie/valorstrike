// Corpse-build code kept optimized between deaths (death lane, 2026-11-25: 100-200 ms death frames). V8 discards the optimized
// code of xrSupports / xrSolve ~10-15 s after their last call (Chromium, %GetOptimizationStatus), so a death more than ~10 s after
// the previous one built its 6000-sample contact volume in baseline code (xrRagdoll 10-41 ms on the kill frame instead of ~2 ms).
// xrKeep (a screen hook, every XR_KEEP.ms) runs the whole build + one solve / pose step on a private rig. Checks on the real page
// (offline 5v5, real three scene graph, native agent rigs):
//  - xrKeep is on the loop's screen hooks and a tick builds a full ragdoll (every joint, contact points) on its private rig,
//    which is never in the scene
//  - a tick is invisible to the game: every rig node's matrix / matrixWorld / matrixWorldNeedsUpdate and every skeleton's
//    boneMatrices are bit-identical before / after (raw, no refresh in between: stale matrices of culled rigs stay stale),
//    no game geometry's cached sample list is built or replaced, nothing is drawn from the seeded game generator
//  - a corpse built after keep ticks is bit-identical (particles, contact points) to one built from the same pose before them
//  - it only runs in a running, unpaused match, at most once per XR_KEEP.ms, and not within XR_KEEP.ms of a death
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:7,native:true}),xe=H.xe,errs0=H.errors.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.buy=1e9;true'); // hold the buy phase: nobody dies while the rigs come in
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,5));}
 const rigs=xe('XSOL.mx.filter(M=>M&&M.valorant&&!M.dead&&M.sx&&M.sx.sc).length');assert.ok(rigs>=4,'native rigs in the match: '+rigs);
 xe('FV.buy=1e9;for(const b of bots.concat(allies))b.cd=1e9;true');
 assert.equal(xe('typeof xrKeep==="function"&&typeof XR_KEEP==="object"&&(window.XHK||[]).includes(xrKeep)'),true,'xrKeep is on the loop screen hooks');
 // raw state (no updateMatrixWorld / skeleton.update in between): what any game code would read next
 xe(`window.__raw=()=>{const out=[];for(const M of XSOL.mx){if(!M||!M.m)continue;M.m.traverse(o=>{out.push(o.matrix.elements.join(','),o.matrixWorld.elements.join(','),o.matrixWorldNeedsUpdate);if(o.isSkinnedMesh&&o.skeleton)out.push(Array.from(o.skeleton.boneMatrices).join(','));});}return JSON.stringify(out);};
  window.__sl=()=>{const g=[];for(const M of XSOL.mx){if(!M||!M.sx)continue;M.sx.sc.traverse(o=>{if(o.isSkinnedMesh)g.push([o.geometry,XR_SL.get(o.geometry)]);});}return g;};
  window.__rag=(M)=>{const R=xrRagdoll(M);return JSON.stringify(R.list.map(a=>[a.n,a.p.toArray(),a.old.toArray(),a.r,(a.sup||[]).map(v=>v.toArray())]));};true`);
 const M0='XSOL.mx.filter(M=>M&&M.valorant&&!M.dead&&M.sx)[0]';
 const ref=xe(`__rag(${M0})`);
 xe('window.__rn=0;{const r=Math.random;Math.random=function(){__rn++;return r.apply(this,arguments);};}window.__sl0=__sl();true');
 const raw0=xe('__raw()');
 // a forced tick
 const t=JSON.parse(xe(`(()=>{const r0=XR_KEEP.runs;XR_KEEP.last=-1e9;xrKeep();const K=XR_KEEP.M;const R=K&&xrRagdoll(K,K.ground);
  return JSON.stringify({ran:XR_KEEP.runs-r0,priv:!!K,inScene:!!(K&&K.m.parent),n:R?R.list.length:0,sup:R?R.list.filter(a=>a.sup&&a.sup.length).length:0,links:R?R.links.length:0,aims:R?R.aims.length:0});})()`));
 assert.equal(t.ran,1,'a due tick ran');assert.ok(t.priv&&!t.inScene,'the keep rig is private (never in the scene)');
 assert.equal(t.n,20,'the keep rig builds a full ragdoll: 19 joints + head end ('+t.n+')');assert.equal(t.sup,19,'every simulated joint got contact points ('+t.sup+')');
 assert.ok(t.links>=40&&t.aims===15,'links / aims built like a real corpse: '+t.links+' / '+t.aims);
 assert.equal(xe('__raw()'),raw0,'a keep tick leaves every rig matrix / matrixWorld / flag / boneMatrices bit-identical (raw)');
 assert.equal(xe('__rn'),0,'a keep tick draws nothing from the seeded game generator');
 assert.equal(xe('__sl().every(([g,c],i)=>__sl0[i][0]===g&&__sl0[i][1]===c)'),true,'no game geometry sample list is built or replaced');
 // more ticks across page time, then a corpse from the same pose: bit-identical
 for(let i=0;i<5;i++){await adv(Math.ceil(xe('XR_KEEP.ms'))+50);}
 assert.ok(xe('XR_KEEP.runs')>=4,'ticks keep running every XR_KEEP.ms: '+xe('XR_KEEP.runs'));
 assert.equal(xe(`__rag(${M0})`),ref,'a corpse built after keep ticks is bit-identical to one built before them');
 // gating
 const g=JSON.parse(xe(`(()=>{const o={};const run=()=>{const r0=XR_KEEP.runs;xrKeep();return XR_KEEP.runs-r0;};
  XR_KEEP.last=performance.now()-XR_KEEP.ms/2;o.early=run();
  XR_KEEP.last=-1e9;const pz=paused;paused=true;o.paused=run();paused=pz;
  const rn=running;running=false;o.stopped=run();running=rn;
  XR_KEEP.last=-1e9;XDEAD.push({c:{diedAt:performance.now()-XR_KEEP.ms/3},gn:null,t:0});o.recentDeath=run();XDEAD.pop();
  XR_KEEP.last=-1e9;o.due=run();return JSON.stringify(o);})()`));
 assert.deepEqual(g,{early:0,paused:0,stopped:0,recentDeath:0,due:1},'gating: '+JSON.stringify(g));
 assert.equal(H.errors.length,errs0,'page errors '+JSON.stringify(H.errors.slice(errs0)));
 console.log(`ragdoll keep: private rig ${t.n} particles / ${t.sup} with contact points / ${t.links} links; ${xe('XR_KEEP.runs')} ticks; rig state, sample lists and game RNG untouched; corpse bit-identical; gating ${JSON.stringify(g)}`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
