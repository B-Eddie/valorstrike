// A Sewer doorway (split, ~(-46.5,2.5)): two-level height map to find a walkable (<=0.32u)
// crossing between the y~6.6 channel and the y~7.0+ surround.
const MAP = process.env.MAP || 'split';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const r = await p.evaluate(() => {
      const X = window.xNativeMaps, C = X.state.current, H = X.height;
      const rows = [];
      for (let zi = 40; zi >= 15; zi -= 3) { const z = zi / 10; let row = 'z' + z.toFixed(1) + ' ';
        for (let xi = -480; xi <= -445; xi += 2) { const x = xi / 10;
          const lo = H(C, x, z, 6.6), hi = H(C, x, z, 8.2);
          // symbol: height band of the upper surface, or 'L' if only low floor
          const y = hi > lo + .2 ? hi : lo;
          row += y < 6.8 ? '.' : y < 7.1 ? 'a' : y < 7.4 ? 'b' : y < 7.7 ? 'c' : y < 8.0 ? 'd' : '#';
        }
        rows.push(row);
      }
      // Numeric transect at the doorway z=2.5
      const transect = [];
      for (let xi = -480; xi <= -445; xi += 1) { const x = xi / 10;
        transect.push(x.toFixed(1) + ':' + H(C, x, 2.5, 8.2).toFixed(2) + '/' + H(C, x, 2.5, 6.6).toFixed(2));
      }
      return {rows, transect};
    });
    console.log('SEWERMAP (x -48.0 .. -44.5 step .2; .=low<6.8 a 6.8-7.1 b 7.1-7.4 c 7.4-7.7 d 7.7-8 #>=8)');
    for (const row of r.rows) console.log(row);
    console.log('TRANSECT z=2.5 hi/lo:', r.transect.join(' '));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
