const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  try {
    await boot(p);
    if (await p.$('#mIntro.on')) { await p.click('#mIntro [data-close]'); }
    await p.evaluate(() => { window.__vs.FV.map = 'bind'; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const r = await p.evaluate(() => {
      const C = window.xNativeMaps.state.current;
      return {key: C.key, node25: C.nav.nodes[25], valid25: C.nav.valid ? C.nav.valid[25] : 'no-valid-array', validType: typeof C.nav.valid, playable25: C.playable ? C.playable[25] : 'none'};
    });
    console.log('map data:', JSON.stringify(r));
    await p.evaluate(() => { window.__vs.FV.buy = 0; window.__vs.setPos(-77.25, 3.87, 39.75); });
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => ({pos: window.__vs.state().player}));
    console.log('after warp:', JSON.stringify(st));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
