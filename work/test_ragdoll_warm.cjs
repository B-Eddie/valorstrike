// Corpse code warmed behind the loading screen (eventperf, user 2026-10-29 "check every event ... and check if it starts
// lagging"): the first corpses of a match were built by cold code (xrRagdoll / xrSupports / xrSolve / xrPose interpreted
// until V8 has run them a dozen times, plus each agent's skinned sample list made at its first death) = 10-25 ms per kill
// early in a match, 50-200 ms frames on a multi-kill or a Spike detonation. xrWarm (run by xWarmShaders, which the loading
// gate calls once the agents are in) runs that code on the living rigs and throws the result away. Checks on the real
// page (offline 5v5, real three scene graph, native agent rigs):
//  - xWarmShaders runs xrWarm: at least XR_WARM.n ragdoll builds, and every living rig's skinned geometries end up with a
//    cached sample list (xrSampleList), as a death would have left them
//  - nothing visible changes: every bone's position / quaternion / scale, every node's matrixWorld (after the same
//    scene.updateMatrixWorld the render does) and every skeleton's boneMatrices are bit-identical before / after
//  - a corpse built after the warm-up has bit-identical particles and contact points to one built from the same pose
//    with no warm-up (same pose restored), so deaths look exactly as before
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
 // snapshot of everything a render reads from the rigs
 xe(`window.__snap=()=>{scene.updateMatrixWorld(true);const out=[];for(const M of XSOL.mx){if(!M||!M.valorant||!M.sx)continue;M.m.traverse(o=>{out.push(o.position.toArray().concat(o.quaternion.toArray(),o.scale.toArray(),o.matrixWorld.elements).join(','));if(o.isSkinnedMesh&&o.skeleton){o.skeleton.update();out.push(Array.from(o.skeleton.boneMatrices).join(','));}});}return out;};
  window.__rag=(M)=>{const R=xrRagdoll(M);return JSON.stringify(R.list.map(a=>[a.n,a.p.toArray(),a.old.toArray(),a.r,(a.sup||[]).map(v=>v.toArray())]));};true`);
 // reference corpse of one rig from its current pose, before any warm-up (its own sample list gets cached here)
 const M0='XSOL.mx.filter(M=>M&&M.valorant&&!M.dead&&M.sx)[0]';
 const before=xe('JSON.stringify(__snap())'),ref=xe(`__rag(${M0})`);
 assert.equal(xe('JSON.stringify(__snap())'),before,'a ragdoll build alone leaves the pose untouched');
 const cached0=xe(`XSOL.mx.filter(M=>M&&M.valorant&&!M.dead&&M.sx).slice(1).every(M=>{let ok=true;M.sx.sc.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.skinIndex&&!XR_SL.has(o.geometry))ok=false;});return ok;})`);
 assert.equal(typeof xe('typeof XR_WARM==="undefined"?null:XR_WARM.n'),'number','xrWarm exists (XR_WARM)');
 const calls0=xe('XR_WARM.calls');
 xe('xPC=false;window.xWarmShaders();true');
 const calls=xe('XR_WARM.calls')-calls0,warmMs=xe('XR_WARM.last');
 assert.ok(calls>=xe('XR_WARM.n'),'xWarmShaders ran the corpse warm-up: '+calls+' builds');
 const miss=JSON.parse(xe(`JSON.stringify(XSOL.mx.filter(M=>M&&M.valorant&&!M.dead&&M.sx).filter(M=>{let ok=true;M.sx.sc.traverse(o=>{if(o.isSkinnedMesh&&o.visible!==false&&o.geometry.attributes.skinIndex&&!XR_SL.has(o.geometry))ok=false;});return !ok;}).map(M=>M.ag||'?'))`));
 assert.deepEqual(miss,[],'every living rig has its sample list cached after the warm-up');
 assert.equal(xe('JSON.stringify(__snap())'),before,'the warm-up leaves every bone / matrixWorld / boneMatrices bit-identical');
 assert.equal(xe(`__rag(${M0})`),ref,'a corpse built after the warm-up is bit-identical to one built before it');
 assert.equal(H.errors.length,errs0,'page errors '+JSON.stringify(H.errors.slice(errs0)));
 console.log(`ragdoll warm: ${calls} warm builds on ${rigs} rigs in ${warmMs.toFixed(0)} ms (page clock) behind the loading screen; sample lists cached for all (before: ${cached0?'already':'not'}); pose, matrices, bone matrices and corpse particles/contact points bit-identical`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
