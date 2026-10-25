// Bounded touch gameplay check: offline DM, emulated touch device, 844x390 landscape.
// Verifies: touch layer appears, stick drag moves the player, right-side drag aims (yaw), FIRE tap spends ammo.
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'mid', viewport:{width:844, height:390}, touch:true});
  const cdp = await p.context().newCDPSession(p);
  const touch = async (type, points) => { await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points}); };
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); });
  await p.evaluate(() => window.__vs.startDM());
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) { await wait(2000); const d = await p.evaluate(() => window.__vs.state()).catch(()=>null); if (d && d.running) ok = true; }
  if (!ok) { console.log('TOUCH-DM FAIL never running'); process.exit(1); }
  console.log(el(), 'DM running');
  const ui = await p.evaluate(() => { const T = document.getElementById('xT'); const j = document.getElementById('xJ'); const f = T && T.querySelector('.tb[data-k="fire"]');
    return { tOn: T ? T.classList.contains('on') : null, stick: j ? j.getBoundingClientRect().toJSON() : null, fire: f ? f.getBoundingClientRect().toJSON() : null, coarse: matchMedia('(pointer: coarse)').matches }; });
  console.log(el(), 'touch UI', JSON.stringify(ui));
  if (!ui.tOn || !ui.stick || !ui.fire) { console.log('TOUCH-DM FAIL touch UI missing'); process.exit(1); }
  const p0 = (await p.evaluate(() => window.__vs.state())).player;
  // floating joystick: touch on the LEFT half starts the stick at the touch point; drag up = forward
  let movedDist = 0, joyShown = false;
  for (const [dx, dy, ms] of [[0,-60,2000],[-60,0,1500],[60,0,1500]]) {
    await touch('touchStart', [{x: 150, y: 250, id: 1}]);
    await touch('touchMove', [{x: 150 + dx/2, y: 250 + dy/2, id: 1}]);
    await touch('touchMove', [{x: 150 + dx, y: 250 + dy, id: 1}]);
    await wait(ms);
    const cur = (await p.evaluate(() => window.__vs.state())).player;
    const disp = await p.evaluate(() => { const j = document.getElementById('xJ'); return j ? j.style.display : null; }); // read while still held: pointerup hides the stick by design
    if (disp === 'block') joyShown = true;
    await touch('touchEnd', []);
    const dd = Math.hypot(cur[0]-p0[0], cur[2]-p0[2]);
    if (dd > movedDist) movedDist = dd;
  }
  const moved = [p0[0], p0[1], p0[2]]; // movement measured by movedDist above
  // aim drag on the right half of the screen
  // aim measured as camera world-direction change across a right-half drag
  const dirA = await p.evaluate(() => { const c = window.__vs.camera; const v = new (c.position.constructor)(); c.getWorldDirection(v); return [v.x, v.y, v.z]; });
  await touch('touchStart', [{x: 650, y: 200, id: 2}]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [{x: 650 - i*30, y: 200, id: 2}]);
  await touch('touchEnd', []);
  await wait(300);
  const dirB = await p.evaluate(() => { const c = window.__vs.camera; const v = new (c.position.constructor)(); c.getWorldDirection(v); return [v.x, v.y, v.z]; });
  // FIRE tap
  const ammo0 = (await p.evaluate(() => window.__vs.state())).ammo;
  const fc = { x: ui.fire.x + ui.fire.width/2, y: ui.fire.y + ui.fire.height/2 };
  await touch('touchStart', [{x: fc.x, y: fc.y, id: 3}]); await wait(80); await touch('touchEnd', []);
  await wait(400);
  const ammo1 = (await p.evaluate(() => window.__vs.state())).ammo;
  const aimDelta = Math.hypot(dirB[0]-dirA[0], dirB[2]-dirA[2]);
  console.log(el(), 'RESULT', JSON.stringify({ movedDist: +movedDist.toFixed(2), aimDelta: +aimDelta.toFixed(3), ammo0, ammo1,
    joyShown, pass: movedDist > 0.5 && aimDelta > 0.01 && ammo1 < ammo0 && joyShown }));
  await p.screenshot({path: '/tmp/touch_dm.png'});
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('TOUCH-DM FAIL', e.message); process.exit(1); });
