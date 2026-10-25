// Bounded gameplay probe: boot light, start DM via window.startDM(), poll state, then kill a bot and watch for crashes.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch();
  try {
    await boot(p); console.log(el(), 'booted');
    const r = await p.evaluate(() => {
      try { window.startDM(); return {ok:true, running: !!window.running, mode: window.mode, dm: !!(window.FV&&FV.dm)}; }
      catch(e) { return {ok:false, err: String(e && e.stack || e).slice(0,700)}; }
    });
    console.log(el(), 'startDM', JSON.stringify(r));
    let running = r.running;
    for (let i = 0; i < 10 && !running; i++) {
      await p.waitForTimeout(3000);
      const st = await p.evaluate(() => ({running: !!window.running, bots:(window.bots||[]).length})).catch(e=>({err:String(e).slice(0,120)}));
      console.log(el(), 'poll', JSON.stringify(st));
      running = st.running;
    }
    if (running) {
      const state = await p.evaluate(() => ({bots:(window.bots||[]).length, alive:(window.bots||[]).filter(x=>x.alive).length, names:(window.bots||[]).map(x=>x.name).slice(0,8)}));
      console.log(el(), 'MATCH', JSON.stringify(state));
      // kill a bot, watch for the reported explosion crash / ragdoll errors
      const k = await p.evaluate(() => {
        try { const b0 = (window.bots||[]).find(x=>x.alive); if (!b0) return {err:'no alive bot'};
          window.hurt(b0, 9999); return {ok:true, killed:b0.name, alive:b0.alive}; }
        catch(e) { return {err: String(e && e.stack || e).slice(0,700)}; }
      });
      console.log(el(), 'KILL', JSON.stringify(k));
      for (let i = 0; i < 6; i++) {
        await p.waitForTimeout(2000);
        const st = await p.evaluate(() => ({running: !!window.running, errs: (window.__lastErr||'')})).catch(e=>({err:String(e).slice(0,120)}));
        console.log(el(), 'postkill', JSON.stringify(st));
      }
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10)));
    console.log('LOGS', JSON.stringify(logs.slice(0,14)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,600)); process.exit(1); });
