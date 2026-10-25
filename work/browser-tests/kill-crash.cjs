// Repro: start DM (assets blocked), kill a bot via hurt(), watch for the "explosion"/crash.
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now();
  const srv = await serve();
  const {b, p, errors, logs} = await launch();
  try {
    await boot(p); console.log('booted', Date.now()-t0);
    await startDM(p); console.log('dm clicked', Date.now()-t0);
    await p.waitForFunction(() => window.running === true, null, {timeout:120000});
    console.log('MATCH RUNNING', Date.now()-t0);
    await p.waitForTimeout(1500);
    const state = await p.evaluate(() => ({
      mode: window.mode, bots: (window.bots||[]).length,
      alive: (window.bots||[]).filter(x=>x.alive).length,
      native: (window.xValorantAssets ? window.xValorantAssets.probe().nativeAgents : 'n/a')
    }));
    console.log('STATE', JSON.stringify(state));
    const killed = await p.evaluate(() => {
      const t = (window.bots||[]).find(x => x.alive);
      if (!t) return 'NO-BOT';
      window.hurt(t, 9999, 'You');
      return t.name;
    });
    console.log('KILLED', killed);
    for (let i = 0; i < 10; i++) { await p.waitForTimeout(400); if (errors.length) break; }
    await p.screenshot({path:'/downloads/kill-crash.png'});
    const after = await p.evaluate(() => ({running: window.running, dead: (window.XDEAD||[]).length})).catch(e => 'EVAL-FAIL ' + e);
    console.log('AFTER', JSON.stringify(after));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10), null, 1));
    console.log('LOGS', JSON.stringify(logs.slice(0,12), null, 1));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,800)); process.exit(1); });
