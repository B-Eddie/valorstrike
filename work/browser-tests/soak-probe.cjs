// DM soak: ~75s of live combat, player firing at nearest bot, watching for errors/state corruption.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), 'dm running');
    // player auto-fire at nearest live bot, re-aimed continuously (runs in-page)
    await p.evaluate(() => {
      window.__soak = setInterval(() => {
        try {
          const vs = window.__vs, P = vs.player; if (!P || P.hp <= 0) return;
          const tgt = vs.bots.filter(x=>x.alive).sort((a,c)=>a.g.position.distanceTo(new THREE.Vector3(P.x,P.y,P.z))-c.g.position.distanceTo(new THREE.Vector3(P.x,P.y,P.z)))[0];
          if (!tgt) { vs.fire(false); return; }
          const q = tgt.g.position; vs.aimAt(q.x, q.y + 1.3, q.z); vs.fire(true);
        } catch (e) {}
      }, 150);
    });
    let lastK = 0;
    for (let i = 0; i < 15; i++) {
      await p.waitForTimeout(5000);
      const s = await p.evaluate(() => { const t = window.__vs.state(); const dm = window.__vs.DM; return {running: t.running, alive: t.alive, timeLeft: +t.timeLeft.toFixed(1), hp: t.player[3], myK: (dm.k && dm.k.You) || 0}; });
      if (s.myK !== lastK) { console.log(el(), 'KILLCREDIT', s.myK); lastK = s.myK; }
      console.log(el(), 'SOAK', JSON.stringify(s));
      if (!s.running) break;
    }
    await p.evaluate(() => { clearInterval(window.__soak); window.__vs.fire(false); });
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,10)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
