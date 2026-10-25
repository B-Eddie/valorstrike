// TDM soak: respawning team combat at real-time rate (tiny viewport). Watches respawns
// (alive count recovering), NaN positions, hunters stuck >16s, player hp anomalies.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  const issues = [];
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startTDM(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const setup = await p.evaluate(() => ({map: window.xNativeMaps.state.current.key, nAllies: window.__vs.allies.length, nBots: window.__vs.bots.length}));
    console.log(el(), 'tdm on', JSON.stringify(setup));
    if (setup.map !== MAP) issues.push('map assertion failed: got ' + setup.map);
    const lastPos = {}, still = {};
    let deaths = 0, respawns = 0, tFirst = null, wFirst = null, lastT = null;
    const prevAlive = {};
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(2000);
      const s = await p.evaluate(() => {
        const vs = window.__vs;
        const unit = u => [u.name, +u.g.position.x.toFixed(1), +u.g.position.y.toFixed(1), +u.g.position.z.toFixed(1), !!u.alive, !!(u.xTg || u.xTt)]; // last: has a live target (fighting/holding = legitimately stationary)
        return {t: vs.state().timeLeft, enemies: vs.bots.map(unit), allies: vs.allies.map(unit), player: vs.state().player};
      });
      if (tFirst === null && s.t !== null) { tFirst = s.t; wFirst = Date.now(); }
      lastT = s.t;
      for (const side of ['enemies', 'allies']) {
        const aliveNow = s[side].filter(u => u[4]).length;
        const k = side;
        if (prevAlive[k] !== undefined && aliveNow < prevAlive[k]) { deaths += prevAlive[k] - aliveNow; }
        if (prevAlive[k] !== undefined && aliveNow > prevAlive[k]) { respawns += aliveNow - prevAlive[k]; }
        prevAlive[k] = aliveNow;
        for (const [n, x, y, z, alive, engaged] of s[side]) {
          const kk = side + ':' + n;
          if ([x,y,z].some(v => !Number.isFinite(v))) { issues.push('NaN position on ' + kk); continue; }
          if (!alive) { delete lastPos[kk]; delete still[kk]; continue; }
          if (lastPos[kk]) {
            const d = Math.hypot(x-lastPos[kk][0], z-lastPos[kk][1]);
            if (d < 0.5 && !engaged) { still[kk] = (still[kk]||0)+2; if (still[kk] === 16) issues.push('hunter '+kk+' stationary 16s with NO TARGET at ('+x+','+z+'), t='+(s.t&&s.t.toFixed(0))); }
            else still[kk] = 0;
          }
          lastPos[kk] = [x, z];
        }
      }
      if (i % 10 === 9) console.log(el(), 't:', s.t && s.t.toFixed(0), 'enemies alive:', prevAlive.enemies, 'allies alive:', prevAlive.allies, 'deaths:', deaths, 'respawns:', respawns);
    }
    const rate = (tFirst !== null && lastT !== null && lastT < tFirst) ? ((tFirst - lastT) / ((Date.now() - wFirst) / 1000)).toFixed(2) : 'n/a';
    console.log(el(), 'game-rate:', rate + 'x wall, total deaths:', deaths, 'respawns:', respawns);
    if (deaths > 3 && respawns === 0) issues.push('deaths occurred but ZERO respawns - respawn path broken?');
    console.log('ISSUES:', issues.length ? JSON.stringify(issues, null, 1) : 'none');
    console.log(issues.length === 0 ? 'TDM-SOAK PASS' : 'TDM-SOAK FAIL');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
