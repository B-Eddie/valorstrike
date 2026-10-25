// Multi-scenario gameplay suite, one bounded headless session (light map, mid assets):
// A. DM live fire: aim at nearest bot, hold fire, expect hp drop or kill.
// B. DM natural end: warp clock, expect running=false + result screen.
// C. TDM start: 9 bots + 4 allies.
// D. 5v5 start: buy phase ticking.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  const st = () => p.evaluate(() => window.__vs.state());
  try {
    await boot(p); console.log(el(), 'booted');
    // A. DM live fire
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), 'A: dm running');
    await p.waitForTimeout(4000); // spawn protection wears off
    const fire = await p.evaluate(async () => {
      const vs = window.__vs, P = vs.player;
      const tgt = vs.bots.find(x=>x.alive); if (!tgt) return {err:'no bot'};
      tgt.pp = 0; tgt.hp = 100;
      const hp0 = tgt.hp, ammo0 = vs.state().ammo;
      vs.fire(true);
      const t0 = performance.now();
      while (performance.now() - t0 < 6000 && tgt.alive) {
        const q = tgt.g.position;
        vs.aimAt(q.x, q.y + 1.3, q.z);
        P.x = q.x + 3; P.z = q.z; P.y = q.y; P.vy = 0; // glued at 3 m: removes aim/spread variance
        await new Promise(r2 => setTimeout(r2, 120));
      }
      vs.fire(false);
      return {target: tgt.name, hp0, hp1: tgt.hp, alive: tgt.alive, ammo0, ammo1: vs.state().ammo};
    });
    console.log(el(), 'A: FIRE', JSON.stringify(fire));
    // B. natural DM end
    await p.evaluate(() => window.__vs.setTimeLeft(1.5));
    await p.waitForFunction(() => !window.__vs.state().running, {timeout: 15000});
    const end = await p.evaluate(() => ({running: window.__vs.state().running,
      result: getComputedStyle(document.getElementById('result')).display,
      title: document.getElementById('resTitle') && document.getElementById('resTitle').textContent}));
    console.log(el(), 'B: DM END', JSON.stringify(end));
    // C. TDM
    await p.evaluate(() => window.__vs.startTDM());
    await p.waitForFunction(() => window.__vs.state().running, {timeout: 60000});
    const tdm = await st();
    console.log(el(), 'C: TDM', JSON.stringify({running: tdm.running, tdm: tdm.tdm, bots: tdm.bots, allies: (await 0, tdm.allies)}));
    const allies = await p.evaluate(() => window.__vs.allies.length);
    console.log(el(), 'C: allies', allies);
    // D. 5v5
    await p.evaluate(() => window.__vs.startFive());
    await p.waitForFunction(() => window.__vs.state().running, {timeout: 60000});
    const f1 = await p.evaluate(() => ({buy: window.__vs.FV.buy, dm: window.__vs.FV.dm, bots: window.__vs.bots.length, allies: window.__vs.allies.length}));
    await p.waitForTimeout(2500);
    const f2 = await p.evaluate(() => ({buy: window.__vs.FV.buy, timeLeft: window.__vs.state().timeLeft}));
    console.log(el(), 'D: 5v5', JSON.stringify({f1, f2, buyTicking: f2.buy < f1.buy}));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
