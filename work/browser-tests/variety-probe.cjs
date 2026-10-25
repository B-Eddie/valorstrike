// Bot behavior variety: sample per-bot movement over ~50s; verify paths diverge.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), 'dm running');
    const track = {};
    for (let i = 0; i < 25; i++) {
      await p.waitForTimeout(2000);
      const pos = await p.evaluate(() => window.__vs.bots.map(b => [b.name, b.g.position.x, b.g.position.y, b.g.position.z, b.alive]));
      for (const [n, x, y, z, alive] of pos) {
        if (!alive) continue;
        (track[n] = track[n] || []).push([x, z]);
      }
    }
    const stats = Object.entries(track).filter(([,p]) => p.length > 5).map(([n, p]) => {
      let path = 0, turns = 0, prevH = null;
      for (let i = 1; i < p.length; i++) {
        const dx = p[i][0]-p[i-1][0], dz = p[i][1]-p[i-1][1], d = Math.hypot(dx, dz);
        path += d;
        if (d > 0.05) { const h = Math.atan2(dx, dz); if (prevH !== null) { let dh = Math.abs(h - prevH); if (dh > Math.PI) dh = 2*Math.PI - dh; turns += dh; } prevH = h; }
      }
      return {n, path: +path.toFixed(1), turns: +turns.toFixed(2)};
    });
    console.log(el(), 'VARIETY');
    for (const s of stats) console.log('  ', JSON.stringify(s));
    const paths = stats.map(s => s.path), turns = stats.map(s => s.turns);
    const spread = (a) => a.length > 1 ? (Math.max(...a) - Math.min(...a)) : 0;
    console.log(el(), 'SPREAD', JSON.stringify({pathSpread: +spread(paths).toFixed(1), turnSpread: +spread(turns).toFixed(2), bots: stats.length}));
  } finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
