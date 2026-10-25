const {serve, launch, boot} = require('./lib.cjs');
const MAP = process.env.MAP || 'breeze';
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1500);
    console.log('setup', await p.evaluate(() => JSON.stringify({atk: window.__vs.FV.atk, sp: window.__vs.FV.sp ? window.__vs.FV.sp.st : null})));
    const lastPos = {}, still = {}, dumped = {};
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(2000);
      const dump = await p.evaluate(() => {
        const C = window.xNativeMaps && window.xNativeMaps.state.current;
        const out = [];
        for (const a of window.__vs.allies) {
          if (!a.alive) continue;
          const q = a.g.position;
          const scal = {}; for (const [k, v] of Object.entries(a)) if (typeof v === 'number' && Number.isFinite(v)) scal[k] = +v.toFixed(2);
          let nav = null;
          if (C) {
            const s = window.xNativeMaps.near(C, q.x, q.z, q.y);
            const nb = a.xNb && a.xNb.alive ? a.xNb.g.position : null;
            const e = nb ? window.xNativeMaps.near(C, nb.x, nb.z, nb.y) : -1;
            nav = {s, e, pl: (e >= 0 && s >= 0) ? window.xNativeMaps.path(C, s, e).length : -1,
                   ps: C.playable ? C.playable[s] : -1, pe: (e >= 0 && C.playable) ? C.playable[e] : -1,
                   adj: C.nav.adj[s] ? C.nav.adj[s].length : -1};
          }
          out.push({n: a.name, tg: !!a.xTg, car: !!(window.__vs.FV.sp && window.__vs.FV.sp.c === a), xr: a.xr && a.xr.length, xo: a.xo || null, xg0: window.__vs.FV.sp ? window.__vs.FV.sp.st : null, x: +q.x.toFixed(1), y: +q.y.toFixed(1), z: +q.z.toFixed(1),
                    np: a.np && a.np.map(v => +(+v).toFixed(1)), ng: a.ng && a.ng.map(v => +(+v).toFixed(1)),
                    nbx: a.xNb && a.xNb.alive ? 1 : 0, nav, scal});
        }
        return out;
      });
      for (const u of dump) {
        const k = u.n;
        if (lastPos[k] && Math.hypot(u.x-lastPos[k][0], u.z-lastPos[k][1]) < 0.5) {
          still[k] = (still[k]||0)+1;
          if (still[k] >= 3 && !dumped[k] && !u.tg && u.xg0 !== 'plant') { dumped[k] = 1; console.log('DUMP', JSON.stringify(u)); }
        } else { still[k] = 0; }
        lastPos[k] = [u.x, u.z];
      }
    }
    console.log('done');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
