// Ability parts whose shader program was first linked mid-fight (eventperf, user 2026-10-29 "check every event ... and
// check if it starts lagging"; work/bench_events.cjs over all twelve agents' C / Q / E / X found first-cast program
// links left after the per-map precompile): the Sage Barrier Orb ice (flat-shaded transparent phong, the player's wall and
// every bot Sage's wall). A program link is a 20-200 ms frame on a real GPU driver.
// Checks on the real page (offline 5v5, perf_render_emu counting program keys the way three r149 builds them):
//  - after the precompile the loading gate runs (xPrecompile), a player's and a bot's Barrier Orb in front of the camera
//    draw with no new program
//  - the walls look as before: same material recipe (color, emissive, specular, shininess, flat shading, opacity 0.9)
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:5}),xe=H.xe,errs0=H.errors.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.buy=1e9;player.hp=1e6;for(const b of bots.concat(allies))b.cd=1e9;true');
 xe('xPrecompile();__PS.endFrame();__PS.live=true;__PS.progNew.length=0;true');
 const recipe=JSON.parse(xe(`(()=>{const f=-Math.sin(yaw),g=-Math.cos(yaw);const p=new THREE.Vector3(player.x+f*5,1.5,player.z+g*5);
   const mk=()=>new THREE.MeshPhongMaterial({color:0xc8f6ff,emissive:0x1f6f95,specular:0xffffff,shininess:120,flatShading:true,transparent:true,opacity:0.9});/* fallbacks: the recipe as it was inline before sgIce */
   const ice=typeof sgIce==='function'?sgIce():(sgKey.ice||(sgKey.ice=mk()));ice.opacity=0.9;window.__w1=xBarMake(p,yaw,ice,true,{arr:solids});
   const bi=xBBarrier.ice||(xBBarrier.ice=typeof sgIceMat==='function'?sgIceMat():mk());window.__w2=xBarMake(new THREE.Vector3(player.x+f*8,1.5,player.z+g*8),yaw+0.4,bi,undefined,{});
   const r=m=>[m.type,m.color.getHex(),m.emissive.getHex(),m.specular.getHex(),m.shininess,m.flatShading,m.transparent,m.opacity];return JSON.stringify([r(mk()),r(ice),r(bi),r(__w1.sm[0].material)]);})()`));
 const want=recipe.shift();assert.equal(want[0],'MeshPhongMaterial');
 recipe.forEach((r,i)=>assert.deepEqual(r,want,'barrier material recipe unchanged ('+i+')'));
 await adv(300);
 const pn=JSON.parse(xe('JSON.stringify(__PS.progNew.map(p=>p.obj+" | "+p.key))'));
 assert.deepEqual(pn.filter(s=>/\{sw,si\}/.test(s)),[],'no new program for the Barrier Orb walls after the precompile');
 xe('xBarGone(__w1);xBarGone(__w2);true');
 assert.equal(H.errors.length,errs0,'page errors '+JSON.stringify(H.errors.slice(errs0)));
 console.log(`ability programs warm: Barrier Orb walls (player + bot) draw with no new program after the precompile; recipe unchanged`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
