// Enumerate lotus nav nodes blocked at crouch height (1.35) in the LIVE client BVH
// (permanent geometry only - round barriers are not in this BVH). Output candidate invalidations.
const fs = require('fs'), path = require('path');
const {serve, launch, boot, startDM} = require('./lib.cjs');
const NAV = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/public/worlds/lotus/navigation.json'), 'utf8'));
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'lotus'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    const r = await p.evaluate((N) => {
      const C = window.xNativeMaps.state.current, X = window.xNativeMaps;
      const stand = [], crouch = [];
      for (let i = 0; i < N.nodes.length; i++) {
        if (N.valid && !N.valid[i]) continue;
        const n = N.nodes[i];
        const g = X.height(C, n[0], n[2], n[1] + .3);
        if (Math.abs(g - n[1]) > .3) { continue; } // node y disagrees with surface: different issue, skip
        if (X.blocked(C, n[0], n[2], .4, g, 1.8)) { stand.push(i);
          if (X.blocked(C, n[0], n[2], .4, g, 1.35)) crouch.push(i); }
      }
      return { stand, crouch };
    }, NAV);
    console.log('stand-blocked', r.stand.length, 'crouch-blocked', r.crouch.length);
    console.log('CROUCH', JSON.stringify(r.crouch));
    console.log('STANDONLY', JSON.stringify(r.stand.filter((i) => !r.crouch.includes(i)).slice(0, 60)));
  } catch (e) { console.log('PROBE-FAIL', String(e).slice(0, 200)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
