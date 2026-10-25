// Bounded gameplay probe via window.__vs debug hooks: light boot (no scene.gltf, no agent gate),
// start DM, wait for running, kill a bot, watch for crashes.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch();
  try {
    await boot(p); console.log(el(), 'booted');
    const r = await p.evaluate(() => {
      if (!window.__vs) return {err:'no __vs hook'};
      window.__vs.light(true);
      try { window.__vs.startDM(); return {ok:true}; }
      catch(e) { return {err: String(e && e.stack || e).slice(0,700)}; }
    });
    console.log(el(), 'startDM', JSON.stringify(r));
    let running = false;
    for (let i = 0; i < 20 && !running; i++) {
      await p.waitForTimeout(3000);
      const st = await p.evaluate(() => window.__vs ? window.__vs.state() : {err:'no __vs'}).catch(e=>({err:String(e).slice(0,150)}));
      console.log(el(), 'poll', JSON.stringify(st).slice(0,300));
      running = st.running;
    }
    if (running) {
      const k = await p.evaluate(() => {
        try { const b0 = (window.__vs.bots||[]).find(x=>x.alive); if (!b0) return {err:'no alive bot'};
          window.__vs.hurt(b0, 9999); return {ok:true, killed:b0.name, aliveNow:b0.alive}; }
        catch(e) { return {err: String(e && e.stack || e).slice(0,700)}; }
      });
      console.log(el(), 'KILL', JSON.stringify(k));
      for (let i = 0; i < 5; i++) {
        await p.waitForTimeout(2000);
        const st = await p.evaluate(() => window.__vs.state()).catch(e=>({err:String(e).slice(0,150)}));
        console.log(el(), 'postkill', JSON.stringify(st).slice(0,300));
      }
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,10)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource/.test(l)).slice(0,10)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,600)); process.exit(1); });
