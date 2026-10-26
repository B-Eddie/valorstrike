// Rendered touch defuse + interrupted-touch safety (offline five, 844x390 emulated touch).
// 1) FIRE hold + touchCancel -> fireHeld cleared (no stuck firing); joystick drag + touchCancel -> movement stops.
// 2) Plant via touch 4 (production path; harness: spike assigned, buy skipped, teleport to navmesh site goal).
// 3) Defuse: hold -> dt rises, "· half" at 3.5; touchCancel mid-hold -> checkpoint kept at 3.5 (no reset, no stuck key);
//    re-hold -> defuse completes (st done).
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'mid', viewport:{width:844, height:390}, touch:true});
  const cdp = await p.context().newCDPSession(p);
  const down = (x, y, id) => cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y, id}]});
  const move = (x, y, id) => cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x, y, id}]});
  const up = () => cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  const cancel = () => cdp.send('Input.dispatchTouchEvent', {type:'touchCancel', touchPoints:[]});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'ascent'; });
  await p.evaluate(() => window.__vs.startFive());
  await p.waitForFunction(() => { const s = window.__vs.state(); return s.running && s.mode === 'five' && !s.dm && s.player; }, {timeout: 60000});
  const R = { checks: [] }; const ck = (name, ok, extra) => { R.checks.push({name, ok: !!ok, extra}); console.log(el(), (ok ? 'ok  ' : 'FAIL'), name, extra === undefined ? '' : JSON.stringify(extra)); };
  await wait(1500);
  await p.waitForFunction(() => !window.__vs.state().xLdOn, {timeout: 60000}).catch(() => console.log(el(), 'WARN xLd'));
  const btn = async (k) => p.evaluate((k) => { const e = document.querySelector('#xT .tb[data-k="' + k + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return {x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)}; }, k);
  // --- 1) interrupted touches cannot stick
  const fb = await btn('fire');
  await down(fb.x, fb.y, 1); await wait(700);
  const fh1 = await p.evaluate(() => window.__vs.state().fireHeld);
  await cancel(); await wait(400);
  const fh2 = await p.evaluate(() => window.__vs.state().fireHeld);
  ck('FIRE hold then touchCancel: fireHeld cleared', fh1 === true && fh2 === false, {fh1, fh2});
  const pos0 = await p.evaluate(() => [window.__vs.player.x, window.__vs.player.z]);
  await down(150, 250, 2); for (let i = 1; i <= 4; i++) { await move(150, 250 - i*15, 2); await wait(50); } await wait(700);
  const pos1 = await p.evaluate(() => [window.__vs.player.x, window.__vs.player.z]);
  await cancel(); await wait(200);
  const posA = await p.evaluate(() => [window.__vs.player.x, window.__vs.player.z]); await wait(800);
  const posB = await p.evaluate(() => [window.__vs.player.x, window.__vs.player.z]);
  const movedDuring = Math.hypot(pos1[0]-pos0[0], pos1[1]-pos0[1]), movedAfter = Math.hypot(posB[0]-posA[0], posB[1]-posA[1]);
  ck('joystick drag then touchCancel: movement stops', movedDuring > 0.5 && movedAfter < 0.15, {movedDuring: +movedDuring.toFixed(2), movedAfter: +movedAfter.toFixed(2)});
  // --- 2) plant via touch 4
  const goals = await p.evaluate(() => window.__vs.siteGoals());
  const g = goals && (goals.A || goals.B || goals.C);
  await p.evaluate((g) => { const FV = window.__vs.FV; FV.buy = 0; FV.sp.st = 'carry'; FV.sp.c = window.__vs.player; window.__vs.setPos(g[0], 0, g[1]); }, g);
  await wait(800);
  const pb = await btn('plant');
  await down(pb.x, pb.y, 3);
  let planted = false;
  for (let i = 0; i < 30 && !planted; i++) { await wait(300); planted = await p.evaluate(() => window.__vs.FV.sp.st === 'plant'); }
  await up();
  ck('touch 4 plants the spike', planted);
  // --- 3) defuse (harness: player flips to defenders, defender bots moved away, stand on the spike)
  await p.evaluate(() => { const FV = window.__vs.FV; FV.atk = false; for (const b of window.__vs.bots) { b.g.position.x += 400; b.g.position.z += 400; b.x = b.g.position.x; b.z = b.g.position.z; } window.__vs.setPos(FV.sp.x, 0, FV.sp.z); });
  await wait(800);
  const dt0 = await p.evaluate(() => { const d = document.getElementById('defuse'); return { shown: d.style.display !== 'none', text: d.firstChild ? d.firstChild.textContent : '', dt: +window.__vs.FV.sp.dt.toFixed(2) }; });
  ck('"Hold 4 to defuse" shows at the spike', dt0.shown && dt0.text.includes('Hold 4 to defuse'), dt0);
  await down(pb.x, pb.y, 4);
  let half = null;
  for (let i = 0; i < 40 && !half; i++) { await wait(200); const d = await p.evaluate(() => ({ dt: window.__vs.FV.sp.dt, text: document.getElementById('defuse').firstChild.textContent })); if (d.dt >= 3.55) half = d; }
  ck('defuse hold reaches half checkpoint ("· half")', half && half.text.includes('half'), half);
  await cancel(); await wait(500);
  const dHold = await p.evaluate(() => +window.__vs.FV.sp.dt.toFixed(2));
  await wait(700);
  const dHold2 = await p.evaluate(() => +window.__vs.FV.sp.dt.toFixed(2));
  ck('touchCancel mid-defuse: checkpoint kept at 3.5, no stuck hold', dHold === 3.5 && dHold2 === 3.5, {dHold, dHold2});
  await down(pb.x, pb.y, 5);
  let done = false;
  for (let i = 0; i < 40 && !done; i++) { await wait(200); done = await p.evaluate(() => window.__vs.FV.sp.st === 'done'); }
  await up();
  ck('re-hold finishes the defuse', done, await p.evaluate(() => window.__vs.FV.sp.st));
  R.pass = R.checks.every(c => c.ok);
  console.log(el(), 'RESULT', JSON.stringify({pass: R.pass, failed: R.checks.filter(c => !c.ok).map(c => c.name)}));
  await b.close(); srv.close(); process.exit(R.pass ? 0 : 1);
})().catch(e => { console.log('DEFUSE FAIL', e.message); process.exit(1); });
