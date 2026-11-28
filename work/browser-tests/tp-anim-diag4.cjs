// Why is the duelBot's grip faded out? One-shot state dump, no screenshots.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}, args:['--js-flags=--max-old-space-size=1024','--disable-features=site-per-process','--no-zygote']});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'ascent'; window.__vs.light(true); window.__vs.agents(false); });
    await p.click('#mIntro [data-close]').catch(() => {});
    await p.evaluate(() => window.__vs.startDuel());
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, undefined, {timeout: 420000, polling: 2000});
    await p.waitForFunction(() => window.__vs.duelBot && window.__vs.duelBot.alive && window.__vs.duelBot.xm && window.__vs.duelBot.xm.valorant, undefined, {timeout: 300000, polling: 3000});
    await new Promise(r => setTimeout(r, 3000));
    console.log(el(), 'WHY', JSON.stringify(await p.evaluate(() => window.__vs.xrwWhy(window.__vs.duelBot.xm))));
    console.log(el(), 'GRIP', JSON.stringify(await p.evaluate(() => window.__vs.xrwGrip(window.__vs.duelBot.xm))));
    console.log(el(), 'XRW', JSON.stringify(await p.evaluate(() => window.__vs.xrw())));
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'DIAG-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,4))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
