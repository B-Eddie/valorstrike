// Roster-scoped readiness via the REAL UI path (mid profile: native rigs load):
// gate must load only participant kits, and every spawned bot must render native (never invisible).
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => {
      window.__vsLight = true; // collision/nav-only map: keeps the run bounded; kits still load
      window.xValorantAssets.state.preloading = 'abort'; // stop background preload so cache deltas = gate loads
    });
    const before = await p.evaluate(() => Object.keys(window.xValorantAssets.state.cache));
    await startDM(p); console.log(el(), 'dm clicked via UI, cache before:', before.length);
    let st = null;
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(3000);
      st = await p.evaluate(() => window.__vs ? window.__vs.state() : null).catch(()=>null);
      if (st && st.running) break;
    }
    if (!st || !st.running) { console.log(el(), 'NEVER RUNNING', JSON.stringify(st)); }
    else {
      console.log(el(), 'RUNNING');
      const r = await p.evaluate(() => {
        const vs = window.__vs, XV = window.xValorantAssets.state;
        const bots = window.__vsBots ? null : null;
        return {
          cache: Object.keys(XV.cache).sort(),
          roster: { you: vs.FV ? 'na' : 'na' },
        };
      });
      const detail = await p.evaluate(() => {
        const s = window.__vs.state();
        return { botsPos: s.botsPos.map((b) => b[0]) };
      });
      console.log(el(), 'cache after:', JSON.stringify(r.cache));
      console.log(el(), 'bot names:', JSON.stringify(detail.botsPos));
    }
    // every spawned bot must have a native rig (valorant=1): never invisible
    const nat = await p.evaluate(() => {
      try {
        const bs = window.__vsBotsDebug ? window.__vsBotsDebug() : null;
        if (bs) return bs;
        // fall back through xValorantAssets.agents(): native agent model count
        return { nativeAgents: window.xValorantAssets.agents().filter((m) => m.valorant).length, total: window.xValorantAssets.agents().length };
      } catch (e) { return { err: String(e).slice(0, 120) }; }
    });
    console.log(el(), 'native rigs:', JSON.stringify(nat));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
