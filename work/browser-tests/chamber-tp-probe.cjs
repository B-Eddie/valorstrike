// Chamber Rendezvous end-to-end: E places an anchor, E within 15u teleports back to it and
// starts the 30s cooldown; E beyond 15u is rejected without moving the player or consuming
// the anchor; during cooldown no new anchor can be placed.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  const fails = [];
  const pos = () => p.evaluate(() => window.__vs.state().player.slice(0,3));
  const toast = () => p.evaluate(() => document.getElementById('toast').textContent);
  try {
    await boot(p);
    if (await p.$('#mIntro.on')) { await p.click('#mIntro [data-close]'); }
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0; const J = window.__vs.J; J.pick='Chamber'; J.on=true; J.cd={c:0,q:0,e:0,x:0}; });
    const A = await pos();
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    const t1 = await toast(); console.log('after anchor E:', JSON.stringify(t1));
    if (!/anchor/i.test(t1)) fails.push('no anchor toast: '+t1);
    // move 10u away, E -> teleport back to A
    await p.evaluate((a) => window.__vs.setPos(a[0]+10, a[1]+0.05, a[2]), A);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    const B = await pos();
    const back = Math.hypot(B[0]-A[0], B[2]-A[2]);
    console.log('teleport back: dist to anchor', back.toFixed(2), 'toast', JSON.stringify(await toast()));
    if (back > 0.5) fails.push('did not teleport to anchor (dist '+back.toFixed(2)+')');
    // cooldown: E again must not place a new anchor
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    const t2 = await toast();
    if (!/Rendezvous \d+/.test(t2)) fails.push('cooldown toast missing: '+t2);
    // fresh state for the range-reject path: reset cd, place anchor, go 20u, E must reject
    await p.evaluate(() => { const J = window.__vs.J; J.cd.e = 0; });
    const C = await pos();
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300); // new anchor at C
    await p.evaluate((c) => window.__vs.setPos(c[0]+20, c[1]+0.05, c[2]), C);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    const D = await pos(); const t3 = await toast();
    console.log('range reject: moved', Math.hypot(D[0]-C[0]-20, D[2]-C[2]).toFixed(2), 'off expected, toast', JSON.stringify(t3));
    if (!/more than 15/.test(t3)) fails.push('range reject toast missing: '+t3);
    if (Math.hypot(D[0]-(C[0]+20), D[2]-C[2]) > 0.5) fails.push('player moved on rejected teleport');
    // now step inside 15u and E -> teleport to C
    await p.evaluate((c) => window.__vs.setPos(c[0]+10, c[1]+0.05, c[2]), C);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    const E2 = await pos();
    if (Math.hypot(E2[0]-C[0], E2[2]-C[2]) > 0.5) fails.push('in-range reactivation did not teleport');
    console.log(fails.length ? 'FAIL: '+fails.join(' | ') : 'CHAMBER-TP-PROBE PASS');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
