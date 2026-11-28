const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid', viewport:{width:640, height:360}, args:['--js-flags=--max-old-space-size=1024','--disable-features=site-per-process','--no-zygote']});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'ascent'; window.__vs.light(true); window.__vs.agents(false); });
    await p.click('#mIntro [data-close]').catch(() => {});
    await p.evaluate(() => window.__vs.startDuel());
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, undefined, {timeout: 420000, polling: 2000});
    await new Promise(r => setTimeout(r, 8000));
    console.log(el(), 'XGM', JSON.stringify(await p.evaluate(() => { try { return { ld: XGM.ld, rdy: XGM.rdy, tKeys: Object.keys(XGM.T).length, srcKeys: Object.keys(XGM.src).length, live: XGM.live.length, guns: Object.keys(XV.guns || {}).length, failures: XV.failures }; } catch (e) { return String(e); } })));
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'DIAG-FAIL', String(e).slice(0, 200)); }
  finally { console.log('LOGS', JSON.stringify((logs || []).slice(0, 12))); console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
