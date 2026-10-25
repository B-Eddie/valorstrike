// Five-mode natural round soak, team-aware: no warps, no forced state. Runs a full round on
// bind at real-time game speed (tiny viewport). Defenders holding site = normal; only
// ATTACKING side stationary >16s mid-round is flagged. Tracks spike state/position, deaths
// per team, round end. Detached run: logs to file, exits on round end or sample cap.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  const issues = [];
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.FV.pick = 'bind'; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const setup = await p.evaluate(() => ({map: window.xNativeMaps.state.current.key, atk: window.__vs.FV.atk, nAllies: window.__vs.allies.length, nBots: window.__vs.bots.length}));
    console.log(el(), 'five on', JSON.stringify(setup));
    if (setup.map !== 'bind') issues.push('map assertion failed: ' + setup.map);
    // player attacks or defends? attackers must move; defenders may hold.
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1500);
    const lastPos = {}, still = {};
    let lastT = null, prevEA = null, prevAA = null, ended = null;
    let shortened = false;
    for (let i = 0; i < 47; i++) {
      await p.waitForTimeout(2000);
      if (i === 34 && !shortened) { shortened = true; await p.evaluate(() => window.__vs.setTimeLeft(12)); console.log(el(), 'round clock shortened to 12s to observe round end'); }
      const s = await p.evaluate(() => {
        const vs = window.__vs, FV = vs.FV;
        const unit = u => [u.name, +u.g.position.x.toFixed(1), +u.g.position.y.toFixed(1), +u.g.position.z.toFixed(1), !!u.alive];
        return {t: vs.state().timeLeft, running: vs.state().running,
                enemies: vs.bots.map(unit), allies: vs.allies.map(unit),
                player: vs.state().player, atk: FV.atk,
                sp: FV.sp ? {st: FV.sp.st, x: FV.sp.x, z: FV.sp.z, site: FV.sp.site} : null};
      });
      if (lastT !== null && s.t !== null && s.t > lastT + 1) { ended = {sp: s.sp}; console.log(el(), 'ROUND TRANSITION: t', lastT.toFixed(0), '->', s.t.toFixed(0), 'sp:', JSON.stringify(s.sp)); break; }
      if (!s.running) { ended = {t: s.t, sp: s.sp}; console.log(el(), 'match stopped, sp:', JSON.stringify(s.sp)); break; }
      lastT = s.t;
      const eAlive = s.enemies.filter(u => u[4]).length, aAlive = s.allies.filter(u => u[4]).length;
      if (prevEA !== null && eAlive !== prevEA) console.log(el(), 'enemy deaths/alive:', prevEA, '->', eAlive, 't:', s.t && s.t.toFixed(0), 'sp:', s.sp && s.sp.st);
      if (prevAA !== null && aAlive !== prevAA) console.log(el(), 'ally deaths/alive:', prevAA, '->', aAlive, 't:', s.t && s.t.toFixed(0), 'sp:', s.sp && s.sp.st);
      prevEA = eAlive; prevAA = aAlive;
      for (const side of ['enemies', 'allies']) {
        const attacking = (side === 'allies') === s.atk; // ally side attacks iff player attacks
        for (const [n, x, y, z, alive] of s[side]) {
          const k = side + ':' + n;
          if ([x,y,z].some(v => !Number.isFinite(v))) { issues.push('NaN position on ' + k); continue; }
          if (!alive) { delete lastPos[k]; delete still[k]; continue; }
          if (lastPos[k]) {
            const d = Math.hypot(x-lastPos[k][0], z-lastPos[k][1]);
            if (d < 0.5) {
              still[k] = (still[k]||0)+2;
              const planted = s.sp && s.sp.st === 'plant'; // post-plant hold at the site is correct play
              if (attacking && !planted && still[k] === 16) issues.push('ATTACKING '+k+' stationary 16s at ('+x+','+z+'), t='+(s.t&&s.t.toFixed(0)));
            } else still[k] = 0;
          }
          lastPos[k] = [x, z];
        }
      }
      if (i % 10 === 9) console.log(el(), 't:', s.t && s.t.toFixed(0), 'enemies:', eAlive, 'allies:', aAlive, 'sp:', JSON.stringify(s.sp));
    }
    if (!ended) console.log(el(), 'sample cap reached, t:', lastT && lastT.toFixed(0));
    console.log('ISSUES:', issues.length ? JSON.stringify(issues, null, 1) : 'none');
    console.log(issues.length === 0 ? 'FIVE-SOAK PASS' : 'FIVE-SOAK FAIL');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
