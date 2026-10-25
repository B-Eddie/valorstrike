// Boot a DM match on a native map (detached, long budget), then kill a bot and watch for the
// explosion crash + ragdoll behavior. Logs progress for polling.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    console.log(el(), 'booted');
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); }, MAP);
    await startDM(p);
    console.log(el(), 'startDM clicked');
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 300000, polling: 2000});
    console.log(el(), 'DM RUNNING');
    // Kill a bot: apply lethal damage through the same path combat uses if reachable;
    // otherwise drop its hp and let combat finish it.
    const r = await p.evaluate(() => {
      const bots = window.__vs.bots;
      if (!bots || !bots.length) return {ok: false, why: 'no bots'};
      const t = bots[0];
      return {ok: true, name: t.name, hp: t.hp, hasDamage: typeof t.damage, alive: t.alive};
    });
    console.log(el(), 'bot state', JSON.stringify(r));
    if (r.ok) {
      await p.evaluate(() => { const t = window.__vs.bots[0];
        window.__vs.hurt(t, 60, 'You');
        window.__vs.kill(t, false, 'You', 'Vandal');
      });
      await new Promise(r2 => setTimeout(r2, 6000));
      const after = await p.evaluate(() => { const t = window.__vs.bots[0];
        return {alive: t.alive, hp: t.hp, inScene: !!(t.g && t.g.parent),
          rag: !!document.querySelector('canvas')}; });
      console.log(el(), 'after kill', JSON.stringify(after));
    }
    console.log(el(), 'DM-PROBE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
