// Bounded REAL rendered check via the normal UI path: dismiss intro modal with its own
// button, lobby -> DM clicks, full scene.gltf (no light flag), fallback-free capture.
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light'}); // map assets allowed; agent GLBs blocked (indicators only)
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vsNoAgents = true; }); // stub gate only; map path fully real
    await startDM(p); console.log(el(), 'dm clicked via UI (modal dismissed by its own button)');
    let running = false;
    for (let i = 0; i < 15 && !running; i++) {
      await p.waitForTimeout(5000);
      const st = await p.evaluate(() => ({running: window.__vs ? window.__vs.state().running : null})).catch(e => ({err: String(e).slice(0,100)}));
      console.log(el(), 'poll', JSON.stringify(st));
      running = st.running;
    }
    if (running) {
      await p.waitForTimeout(2500); // intro/banner settle
      await p.screenshot({path: '/tmp/rendered-dm.png'});
      console.log(el(), 'screenshot saved');
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
