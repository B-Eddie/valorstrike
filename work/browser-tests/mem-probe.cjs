// Measure JS heap growth during full-native (heavy) load until tab crash, to quantify the memory curve.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'heavy'});
  try {
    await boot(p); console.log(el(), 'booted');
    let crashed = false;
    p.on('close', () => { crashed = true; });
    for (let i = 0; i < 45; i++) {
      await p.waitForTimeout(2000);
      if (crashed) { console.log(el(), 'TAB CRASHED'); break; }
      let m = null;
      try {
        m = await p.evaluate(() => {
          const pm = performance.memory || {};
          const cache = Object.keys((window.XV_CACHE_EST) || {}).length;
          return {used: Math.round((pm.usedJSHeapSize||0)/1048576), total: Math.round((pm.totalJSHeapSize||0)/1048576), limit: Math.round((pm.jsHeapSizeLimit||0)/1048576)};
        });
      } catch (e) { console.log(el(), 'EVAL FAIL (crash?)', String(e).slice(0,80)); break; }
      console.log(el(), 'heap', JSON.stringify(m));
    }
    const final = await p.evaluate(() => {
      const vs = window.__vs;
      let kits = 0; try { kits = Object.keys(window.__vsKits || {}).length; } catch(e){}
      return {running: vs ? vs.state().running : null};
    }).catch(() => null);
    console.log(el(), 'final', JSON.stringify(final));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close().catch(()=>{}); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
