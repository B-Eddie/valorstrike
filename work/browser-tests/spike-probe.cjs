// Spike plant flow: warp carrier to site B, hold 4, expect plant -> fuse -> detonation -> attacker round win.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
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
      FV.atk = true; FV.sp.c = P; FV.sp.st = 'carry'; // ensure player carries, attacking
      P.x = site[0]; P.z = site[2]; P.y = window.xNativeMaps.height(C, site[0], site[2]); P.vy = 0;
      return {site, sp: {st: FV.sp.st, c: FV.sp.c === P ? 'player' : 'other'}, atk: FV.atk};
    });
    console.log(el(), 'setup', JSON.stringify(setup));
    await p.keyboard.down('Digit4');
    let planted = false;
    for (let i = 0; i < 25 && !planted; i++) {
      await p.waitForTimeout(1000);
      const s = await p.evaluate(() => ({st: window.__vs.FV.sp.st, pt: +(window.__vs.FV.sp.pt || 0).toFixed(2), mv: window.__vs.player.mv}));
      if (i % 4 === 0 || s.st === 'plant') console.log(el(), 'planting', JSON.stringify(s));
      planted = s.st === 'plant';
    }
    await p.keyboard.up('Digit4');
    if (!planted) { console.log(el(), 'PLANT FAIL'); } else {
      console.log(el(), 'PLANTED');
      const fuse = await p.evaluate(() => { window.__vs.FV.sp.t = 1.2; return window.__vs.FV.sp.site; });
      const r0 = await p.evaluate(() => ({you: window.__vs.FV.you, them: window.__vs.FV.them, running: window.__vs.state().running}));
      await p.waitForFunction(() => !window.__vs.state().running || window.__vs.FV.you + window.__vs.FV.them > 0, {timeout: 30000}).catch(()=>{});
      const r1 = await p.evaluate(() => ({you: window.__vs.FV.you, them: window.__vs.FV.them, running: window.__vs.state().running}));
      console.log(el(), 'detonation', JSON.stringify({site: fuse, before: r0, after: r1}), r1.you === 1 ? 'PASS (attacker win)' : 'CHECK');
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
