// Smoke every remaining mode start: surf, aim, duel, retake, rifle. Fresh page per mode.
const {serve, launch, boot} = require('./lib.cjs');
const MODES = ['startSurf', 'startAim', 'startDuel', 'startRetake', 'startRifle'];
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    for (const m of MODES) {
      await boot(p); // fresh page state per mode
      const r = await p.evaluate((mm) => {
        try { window.__vs.light(true); window.__vs.agents(false); window.__vs[mm](); return {ok:true}; }
        catch(e) { return {err: String(e && e.stack || e).slice(0,300)}; }
      }, m);
      if (r.err) { console.log(el(), m, 'START-ERR', r.err); continue; }
      const running = await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 30000}).then(()=>true).catch(()=>false);
      const st = await p.evaluate(() => window.__vs.state()).catch(()=>({}));
      console.log(el(), m, JSON.stringify({running, mode: st.mode, bots: st.bots, timeLeft: st.timeLeft && +st.timeLeft.toFixed(1)}));
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
