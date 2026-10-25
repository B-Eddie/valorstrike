// Out-of-bounds kill watch on Breeze (gap at x -8..12, z 53..64): warp the player past nav
// coverage -> warning -> death within ~2s of game time. Control: site node warp -> alive.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  const fails = [];
  try {
    await boot(p);
    if (await p.$('#mIntro.on')) { await p.click('#mIntro [data-close]'); }
    await p.evaluate(() => { window.__vs.FV.map = 'breeze'; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0; });
    // control: warp to a site node, wait, must survive
    const site = await p.evaluate(() => { const C = window.xNativeMaps.state.current; const n = C.nav.nodes[Object.values(C.nav.siteNodes)[0]]; window.__vs.setPos(n[0], n[1]+0.1, n[2]); return n; });
    await p.waitForTimeout(2500);
    const alive = await p.evaluate(() => window.__vs.state().player[3]);
    console.log('control at site', site, 'hp:', alive);
    if (alive <= 0) fails.push('control died on a site node');
    // warp into the breeze boundary gap
    await p.evaluate(() => { const C = window.xNativeMaps.state.current; let y = 10; try { y = window.xNativeMaps.height(C, 0, 90, 10); } catch(e) {} window.__vs.setPos(0, y + 0.05, 90); });
    const t0 = Date.now();
    const died = await p.waitForFunction(() => window.__vs.state().player[3] <= 0, {timeout: 40000}).then(()=>true).catch(()=>false);
    console.log('OOB death:', died, 'after', ((Date.now()-t0)/1000).toFixed(1)+'s wall');
    if (!died) fails.push('player survived out of bounds');
    console.log(fails.length ? 'FAIL: '+fails.join(' | ') : 'OOB-PROBE PASS');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
