// Characterize the split A-Sewer doorway blockage at (-46.3,6.6,2.5): standing vs crouch
// capsule on a fine grid, plus a vertical profile at the center line.
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
      const X = window.xNativeMaps, C = X.state.current, B = X.blocked, H = X.height;
      const rows = [];
      for (let zi = 16; zi <= 36; zi++) { const z = zi / 10; let row = '';
        for (let xi = -476; xi <= -454; xi++) { const x = xi / 10;
          const y = H(C, x, z, 6.6);
          const stand = B(C, x, z, .4, y + .32, 1.8);
          const crouch = B(C, x, z, .4, y + .32, 1.1);
          row += stand ? (crouch ? '#' : 'c') : '.';
        }
        rows.push('z' + z.toFixed(1) + ' ' + row);
      }
      const vert = [];
      for (let yi = 66; yi <= 92; yi++) { const y = yi / 10;
        vert.push(y.toFixed(1) + ':' + (B(C, -46.5, 2.5, .4, y, .6) ? '#' : '.'));
      }
      return {rows, vert: vert.join(' ')};
    });
    console.log('DOOR');
    for (const row of r.rows) console.log(row);
    console.log('VERT', r.vert);
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
