const MAP = process.env.MAP || 'haven';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const r = await p.evaluate(() => {
      const X = window.xNativeMaps, C = X.state.current, N = C.nav.nodes;
      const H = X.height, B = X.blocked;
      const s = X.near(C, 29, 7.2, 5);
      const path = X.path(C, s, X.near(C, 46.5, -28));
      const p1 = N[path[1]];
      const pos = {x: 29, y: 5, z: 7.2};
      // motor's wrapped blocked(), minus sgBlk (legacy-map boxes, absent on native maps)
      const mBlk = (x, z, r, y) => { if (B(C, x, z, r, y)) return true; if (!B(C, x, z, r, y)) { const floor = H(C, x, z, y + .32); return !(floor <= y + .32 && !B(C, x, z, r, y + .32)); } };
      const seg = (p, n) => { const d = Math.hypot(n[0]-p.x, n[2]-p.z), steps = Math.max(1, Math.ceil(d/.18)); let y = p.y;
        for (let k = 1; k <= steps; k++) { const x = p.x+(n[0]-p.x)*k/steps, z = p.z+(n[2]-p.z)*k/steps, h = H(C, x, z, y);
          if (h-y > .321 || y-h > .35 || B(C, x, z, .43, Math.max(y,h)+.32)) return 'fail@'+k+'/'+steps+' h='+h.toFixed(2)+' y='+y.toFixed(2);
          y = h; } return 'ok endY='+y.toFixed(2)+' nodeY='+n[1].toFixed(2); };
      const dx = p1[0]-pos.x, dz = p1[2]-pos.z, d = Math.hypot(dx, dz), vx = dx/d, vz = dz/d;
      return {s, pathLen: path.length, p1, segP1: seg(pos, p1),
        dir: [+vx.toFixed(2), +vz.toFixed(2)],
        blkX: mBlk(pos.x + vx*0.3, pos.z, 0.45, pos.y),
        blkZ: mBlk(pos.x, pos.z + vz*0.3, 0.45, pos.y),
        blkDiag: mBlk(pos.x + vx*0.3, pos.z + vz*0.3, 0.45, pos.y)};
    });
    console.log('SEG', JSON.stringify(r));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
