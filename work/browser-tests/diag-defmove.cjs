// Do breeze defenders leave spawn? Sample both teams' positions twice and compare.
const MAP = process.env.MAP || 'breeze';
const WAIT1 = +(process.env.W1 || 6), WAIT2 = +(process.env.W2 || 40);
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    const snap = () => p.evaluate(() => {
      const g = (u) => ({n: u.name, x: +u.g.position.x.toFixed(1), y: +u.g.position.y.toFixed(1), z: +u.g.position.z.toFixed(1), alive: u.alive});
      return {allies: window.__vs.allies.map(g), bots: window.__vs.bots.map(g)};
    });
    await new Promise(r => setTimeout(r, WAIT1 * 1000));
    const s1 = await snap();
    await new Promise(r => setTimeout(r, (WAIT2 - WAIT1) * 1000));
    const s2 = await snap();
    console.log('MOVE', JSON.stringify({s1, s2}));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
