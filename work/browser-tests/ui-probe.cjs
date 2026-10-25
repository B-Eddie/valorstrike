// Normal-UI-path probe: real clicks through lobby -> DM, with the localhost light flag
// set beforehand (so the native scene load is skipped). Verifies the user lifecycle
// (xLd loading gate, xMatchLoad, xLob0 clearing) is not masked by the debug hooks.
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch();
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vsLight = true; window.__vsNoAgents = true; });
    await startDM(p); console.log(el(), 'dm clicked via UI');
    let running = false;
    for (let i = 0; i < 20 && !running; i++) {
      await p.waitForTimeout(3000);
      const st = await p.evaluate(() => window.__vs ? window.__vs.state() : {err:'no __vs'}).catch(e=>({err:String(e).slice(0,150)}));
      console.log(el(), 'poll', JSON.stringify({running:st.running, timeLeft:st.timeLeft, lob0:st.lob0, xLdOn:st.xLdOn, bots:st.bots}));
      running = st.running;
    }
    if (running) {
      const s1 = await p.evaluate(() => window.__vs.state().botsPos[1]);
      await p.waitForTimeout(2000);
      const s2 = await p.evaluate(() => window.__vs.state().botsPos[1]);
      console.log(el(), 'MOVE', JSON.stringify(s1), '->', JSON.stringify(s2));
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
