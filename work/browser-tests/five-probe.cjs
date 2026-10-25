// 5v5 round-flow probe: buy phase warp, eliminate bots, expect round win + next round buy phase.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), '5v5 running');
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1500);
    const r1 = await p.evaluate(() => ({buy: window.__vs.FV.buy, you: window.__vs.FV.you, them: window.__vs.FV.them}));
    console.log(el(), 'round started', JSON.stringify(r1));
    await p.evaluate(() => { for (const b of window.__vs.bots) if (b.alive) window.__vs.kill(b, false, 'You', 'Vandal'); });
    await p.waitForFunction(() => window.__vs.FV.you === 1, {timeout: 30000}).catch(()=>{});
    const r2 = await p.evaluate(() => ({you: window.__vs.FV.you, them: window.__vs.FV.them, buy: window.__vs.FV.buy, running: window.__vs.state().running, alive: window.__vs.state().alive}));
    console.log(el(), 'after elim', JSON.stringify(r2));
    // dt clamps at 50ms under SwiftShader (~4-5x slow): the inter-round gap is several wall seconds
    await p.waitForFunction(() => window.__vs.state().running, {timeout: 90000}).catch(()=>{});
    const r3 = await p.evaluate(() => ({running: window.__vs.state().running, buy: window.__vs.FV.buy, alive: window.__vs.state().alive, bots: window.__vs.bots.length, you: window.__vs.FV.you}));
    console.log(el(), 'next round', JSON.stringify(r3));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
