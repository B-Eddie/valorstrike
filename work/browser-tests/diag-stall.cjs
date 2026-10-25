// Focused stall diagnosis on breeze: when an ally goes stationary with no target, dump its
// full AI state (goal, waypoint, nearest-enemy reference, path) to see WHERE it wants to go.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'breeze'; window.__vs.light(true); window.__vs.agents(false); window.__vs.startTDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const lastPos = {}, still = {}, dumped = {};
    for (let i = 0; i < 38; i++) {
      await p.waitForTimeout(2000);
      const units = await p.evaluate(() => window.__vs.allies.filter(a => a.alive).map(a => {
        const q = a.g.position;
        return {n: a.name, x: +q.x.toFixed(1), y: +q.y.toFixed(1), z: +q.z.toFixed(1),
                tg: !!a.xTg, nb: a.xNb ? [a.xNb.name, +a.xNb.g.position.x.toFixed(1), +a.xNb.g.position.z.toFixed(1), a.xNb.alive] : null,
                np: a.np && a.np.map(v => +(+v).toFixed(1)), ng: a.ng && a.ng.map(v => +(+v).toFixed(1)),
                ox: a.ox, oz: a.oz, trT: a.trT, blk: a.blk, xr: a.xr ? a.xr.length : -1, see: +(a.see||0).toFixed(2)};
      }));
      for (const u of units) {
        if (lastPos[u.n] && Math.hypot(u.x-lastPos[u.n][0], u.z-lastPos[u.n][1]) < 0.5 && !u.tg) {
          still[u.n] = (still[u.n]||0)+2;
          if (still[u.n] >= 8 && !dumped[u.n]) { dumped[u.n] = 1; console.log(el(), 'STALL', JSON.stringify(u)); }
        } else still[u.n] = 0;
        lastPos[u.n] = [u.x, u.z];
      }
    }
    console.log(el(), 'done; enemies:', await p.evaluate(() => window.__vs.bots.filter(b=>b.alive).map(b=>[b.name,+b.g.position.x.toFixed(0),+b.g.position.z.toFixed(0)]).map(JSON.stringify).join(' ')));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
