// Defuse path (warp-assisted: spike state forced to planted; the defuse input itself is a real held key):
// player as defender, near spike, hold 4 -> dt accumulates -> half checkpoint kept -> defuse at 7 -> defender round win.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1200);
    const setup = await p.evaluate(() => {
      const vs = window.__vs, FV = vs.FV, C = window.xNativeMaps.state.current;
      const site = (C.meta.sites.B || Object.values(C.meta.sites)[0]);
      const P = vs.player;
      FV.atk = false; // player defends
      P.x = site[0] + 1; P.z = site[2] + 1; P.y = window.xNativeMaps.height(C, P.x, P.z); P.vy = 0;
      const s = FV.sp; s.st = 'plant'; s.site = 'B'; s.x = site[0]; s.z = site[2]; s.t = 45; s.dt = 0; // warp: spike already planted
      return {site, atk: FV.atk, st: s.st};
    });
    console.log(el(), 'setup', JSON.stringify(setup));
    await p.keyboard.down('Digit4');
    let done = false, half = false;
    for (let i = 0; i < 58 && !done; i++) {
      await p.waitForTimeout(1000);
      const s = await p.evaluate(() => ({st: window.__vs.FV.sp.st, dt: +(window.__vs.FV.sp.dt || 0).toFixed(2), you: window.__vs.FV.you, them: window.__vs.FV.them, running: window.__vs.state().running}));
      if (s.dt >= 3.5 && !half) { half = true; console.log(el(), 'half checkpoint', JSON.stringify(s)); }
      if (i % 5 === 0 || s.st === 'done') console.log(el(), 'defusing', JSON.stringify(s));
      done = s.st === 'done' || !s.running;
    }
    await p.keyboard.up('Digit4');
    const r = await p.evaluate(() => ({you: window.__vs.FV.you, them: window.__vs.FV.them, running: window.__vs.state().running}));
    console.log(el(), 'result', JSON.stringify(r), done && r.you === 1 ? 'PASS (defender win via player defuse)' : 'CHECK');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
