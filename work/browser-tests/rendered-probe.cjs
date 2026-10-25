// Bounded REAL rendered check: full assets (scene.gltf + agents), SwiftShader, one attempt.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'light'}) // scene.gltf+map bins allowed; agent GLBs blocked (fallback rigs) to cut SwiftShader skinning cost;
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.agents(true); window.__vs.startDM(); }); // gate stubbed; full native map
    let running = false;
    for (let i = 0; i < 15 && !running; i++) {
      await p.waitForTimeout(5000);
      const st = await p.evaluate(() => ({
        running: window.__vs ? window.__vs.state().running : null,
        nm: document.querySelector('#nativeMapLoading small') ? document.querySelector('#nativeMapLoading small').textContent : '',
      })).catch(e => ({err: String(e).slice(0,100)}));
      console.log(el(), 'poll', JSON.stringify(st));
      running = st.running;
    }
    if (running) {
      await p.screenshot({path: '/tmp/rendered-dm.png'}); // immediately: SwiftShader tab may not survive long
      console.log(el(), 'screenshot saved');
      const st = await p.evaluate(() => window.__vs.state());
      console.log(el(), 'STATE', JSON.stringify({running: st.running, bots: st.bots, alive: st.alive}));
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
