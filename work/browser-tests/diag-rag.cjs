// Ragdoll verification with native rigs ON: kill a bot, then measure ragdoll bone divergence
// (finite, bounded) and capture a screenshot of the corpse pose.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); }, MAP);
    await startDM(p);
    console.log(el(), 'startDM clicked');
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    console.log(el(), 'DM RUNNING');
    // Rigs attach asynchronously after match start; wait for them before killing.
    await p.waitForFunction(() => window.__vs.bots.some(t => t.alive && t.xm), {timeout: 180000, polling: 3000});
    console.log(el(), 'rigs attached');
    // Find a bot with a native rig
    const has = await p.evaluate(() => window.__vs.bots.map(t => ({n: t.name, rig: !!t.xm, alive: t.alive})));
    console.log(el(), 'bots', JSON.stringify(has));
    await p.evaluate(() => { const t = window.__vs.bots.find(x => x.alive && x.xm) || window.__vs.bots[0];
      window.__killTarget = t; window.__vs.kill(t, false, 'You', 'Vandal'); });
    await new Promise(r => setTimeout(r, 1200));
    const rag1 = await p.evaluate(() => { const M = window.__killTarget && window.__killTarget.xm;
      if (!M) return {ok: false, why: 'no xm'};
      const R = M.ragdoll; if (!R) return {ok: false, why: 'no ragdoll yet', dead: M.dead, xd: window.__killTarget.xd};
      let maxD = 0, nan = 0;
      for (const pt of R.points) { const d = Math.hypot(pt.p.x - pt.p0.x, pt.p.y - pt.p0.y, pt.p.z - pt.p0.z);
        if (!Number.isFinite(d)) nan++; else if (d > maxD) maxD = d; }
      return {ok: true, points: R.points.length, maxDrift: +maxD.toFixed(2), nan};
    });
    console.log(el(), 'ragdoll@1.2s', JSON.stringify(rag1));
    await p.screenshot({path: '/downloads/ragdoll-1.png'});
    await new Promise(r => setTimeout(r, 2500));
    const rag2 = await p.evaluate(() => { const M = window.__killTarget && window.__killTarget.xm;
      const R = M && M.ragdoll; if (!R) return {ok: false};
      let maxD = 0, nan = 0;
      for (const pt of R.points) { const d = Math.hypot(pt.p.x - pt.p0.x, pt.p.y - pt.p0.y, pt.p.z - pt.p0.z);
        if (!Number.isFinite(d)) nan++; else if (d > maxD) maxD = d; }
      return {ok: true, maxDrift: +maxD.toFixed(2), nan, alive: window.__killTarget.alive};
    });
    console.log(el(), 'ragdoll@3.7s', JSON.stringify(rag2));
    await p.screenshot({path: '/downloads/ragdoll-2.png'});
    console.log(el(), 'RAG-PROBE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.slice(0,12)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
