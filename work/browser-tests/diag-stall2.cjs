const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'breeze'; window.__vs.light(true); window.__vs.agents(false); window.__vs.startTDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const lastPos = {}, still = {};
    for (let i = 0; i < 70; i++) {
      await p.waitForTimeout(1000);
      const units = await p.evaluate(() => window.__vs.allies.filter(a => a.alive).map(a => {
        const q = a.g.position;
        return {n: a.name, x: +q.x.toFixed(1), y: +q.y.toFixed(1), z: +q.z.toFixed(1), tg: !!a.xTg,
                nt: !!a.nt, npT: +(a.npT||0).toFixed(2), npS: +(a.npS||0).toFixed(2), blk: a.blk,
                np: a.np && a.np.map(v => +(+v).toFixed(1)), ng: a.ng && a.ng.map(v => +(+v).toFixed(1)),
                nbx: a.xNb ? [+a.xNb.g.position.x.toFixed(0), +a.xNb.g.position.z.toFixed(0)] : null};
      }));
      for (const u of units) {
        const k = u.n;
        if (lastPos[k] && Math.hypot(u.x-lastPos[k][0], u.z-lastPos[k][1]) < 0.5 && !u.tg) {
          still[k] = (still[k]||0)+1;
          if (still[k] >= 5 && still[k] <= 9) console.log('TRACE', JSON.stringify(u));
        } else still[k] = 0;
        lastPos[k] = [u.x, u.z];
      }
    }
    console.log('done');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
