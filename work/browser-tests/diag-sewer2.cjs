// Split A-Sewer WEST entrance (~(5.9,8.5,13.8)): what blocks the capsule on the flat links?
const MAP = 'split';
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
      for (let zi = 125; zi <= 155; zi += 2) { const z = zi / 10; let row = 'z' + z.toFixed(1) + ' ';
        for (let xi = 45; xi <= 75; xi += 2) { const x = xi / 10;
          const y = H(C, x, z, 8.5);
          row += B(C, x, z, .45, y + .32) ? '#' : (B(C, x, z, .45, y + .32, 1.1) ? 'c' : '.');
        }
        rows.push(row);
      }
      const vert = [];
      for (let yi = 85; yi <= 108; yi++) { const y = yi / 10;
        vert.push(y.toFixed(1) + ':' + (B(C, 5.9, 13.8, .45, y, .5) ? '#' : '.'));
      }
      return {rows, vert: vert.join(' ')};
    });
    console.log('WESTGATE (x 4.5..7.5 step .2; # blocked standing, c blocked standing only, . free)');
    for (const row of r.rows) console.log(row);
    console.log('VERT(5.9,13.8)', r.vert);
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
