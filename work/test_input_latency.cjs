// Aim latency guard (perf2 round 2, user 1 Nov 2026: "not fast enough" = low FPS AND aim feels delayed when moving the mouse).
// The real page (page_harness, offline 5v5 live round): a mouse move must reach the camera on the very next rendered frame,
// whole (no smoothing / lerp tail), whatever point between two frames it arrives at, and also on a frame that runs several
// sim sub-steps (a slow frame). Recoil recovery is a separate offset and never eats the player's own input.
// Measured in real browsers too (qa/perf2/inputlat.cjs, synthetic mousemove at a random point between frames, 40 moves):
// Chromium 40/40 and Firefox 40/40 drawn on the next rAF tick (no extra frame of lag in the game's input -> render path).
// This test is a guard: no extra-frame bug was found (base 3fcdd22 already passes); it pins the order mousemove -> yaw ->
// camera.rotation -> renderer.render inside one loop().
//   node work/test_input_latency.cjs
const assert=require('assert/strict');
(async()=>{
 const {boot}=require('./page_harness.cjs');const H=boot({seed:7,real3:true}),xe=H.xe;
 const tick=()=>new Promise(r=>setImmediate(r));
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 // live round, nobody shooting, look allowed (drag = the unlocked look path; pointer lock takes the same handler)
 xe('FV.buy=0;timeLeft=900;for(const b of bots)b.cd=1e9;player.hp=100;drag=true;paused=false;window.__rd=[];window.__R0=renderer.render;renderer.render=function(s,c){window.__rd.push({y:c.rotation.y,x:c.rotation.x,yaw,pitch});return window.__R0.apply(this,arguments);};true');
 const frame=async(ms=1000/60)=>{const n=xe('__rd.length');H.advance(ms);await tick();const r=xe('JSON.stringify(__rd.slice('+n+'))');return JSON.parse(r);};
 for(let i=0;i<10;i++)await frame();
 const move=(dx,dy)=>xe(`window.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:${dx},movementY:${dy}}));true`);
 const rcl0=()=>xe('JSON.stringify([rcl,rclH])');
 const res=[];
 for(const [k,ms] of [[0,1000/60],[1,1000/60],[2,120],[3,1000/60]]){ // k=2: a 120 ms frame (several sim sub-steps)
  xe('rcl=0;rclH=0;true');const before=await frame();const last=before[before.length-1];
  const y0=xe('yaw'),p0=xe('pitch'),kk=xe('(0.07*Math.PI/180)*S.sens*(Math.tan((camera.fov*Math.PI)/360)/Math.tan((typeof xHipVFov==="function"?xHipVFov():window.ValorantFeel.C.verticalFov)*Math.PI/360))');
  const dx=k%2?-37:53,dy=k%2?11:-7;move(dx,dy);
  const ey=y0-dx*kk,ep=Math.max(-1.4,Math.min(1.4,p0-dy*kk));
  assert.ok(Math.abs(xe('yaw')-ey)<1e-12,'the mousemove handler applies the whole delta to yaw at once');
  const next=await frame(ms);assert.ok(next.length>=1,'a frame was drawn');
  const d=next[0];res.push({frameMs:+ms.toFixed(1),dYawDrawn:+(d.y-last.y).toFixed(6),dYawInput:+(ey-y0).toFixed(6)});
  assert.ok(Math.abs(d.y-ey)<1e-9,`next rendered frame shows the new yaw (drawn ${d.y}, input ${ey}, before ${last.y}) [frame ${ms.toFixed(0)} ms]`);
  assert.ok(Math.abs(d.x-ep)<1e-9,`next rendered frame shows the new pitch (drawn ${d.x}, input ${ep})`);
  const after=await frame();assert.ok(Math.abs(after[0].y-ey)<1e-9&&Math.abs(after[0].x-ep)<1e-9,'no smoothing tail: the frame after holds the same angle');}
 // recoil kick recovery runs on its own offset (rcl / rclH): a move during recovery still lands whole on the next frame
 xe('rcl=0.05;rclH=0.02;true');await frame();const y0=xe('yaw');move(40,0);const d=(await frame())[0];const r=JSON.parse(rcl0());
 assert.ok(Math.abs((d.y+r[1])-xe('yaw'))<1e-9&&Math.abs(xe('yaw')-(y0-40*xe('(0.07*Math.PI/180)*S.sens*(Math.tan((camera.fov*Math.PI)/360)/Math.tan((typeof xHipVFov==="function"?xHipVFov():window.ValorantFeel.C.verticalFov)*Math.PI/360))')))<1e-9,'during recoil recovery the whole mouse delta is on the next frame (camera = yaw - recovering kick)');
 console.log('aim latency: input drawn on the next rendered frame, whole, no smoothing',JSON.stringify(res));
 console.log('test_input_latency: OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
