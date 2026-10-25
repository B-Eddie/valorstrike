// Ability matrix smoke: every native agent's C/Q/E/X via real key events in one 5v5.
// Broad assertion: activating never throws a page error and consumes the charge (or sets a cooldown).
// Deep per-agent effect verification exists only for Jett (ability-probe.cjs).
const {serve, launch, boot} = require('./lib.cjs');
const AGENTS = ['Jett','Phoenix','Sova','Sage','Reyna','Raze','Omen','Killjoy','Breach','Skye','Chamber','Cypher'];
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0; });
    const results = [];
    for (const ag of AGENTS) {
      await p.evaluate((a) => { const J = window.__vs.J; J.pick = a; J.on = true; J.c = 2; J.q = 2; J.e = 2; J.ult = 99; J.cd = {c:0,q:0,e:0,x:0};
        J.dr = 0; J.fts = null; J.om = null; J.nano = []; J.ab = null; J.tur = null; J.ld = null; J.par = []; J.smokes = []; J.bsOn = false; J.dis = 0; // full cross-agent ability-state reset: no bleed from the previous agent's channels/targeting modes
        try { const BC = window.__vsBC || null; } catch (e) {} }, ag);
      const before = await p.evaluate(() => { const J = window.__vs.J; return {c:J.c,q:J.q,e:J.e,ult:J.ult,err:0}; });
      for (const k of ['KeyC','KeyQ','KeyE','KeyX']) { await p.keyboard.press(k); await p.waitForTimeout(260); }
      const after = await p.evaluate(() => { const J = window.__vs.J; const cd = J.cd || {}; return {c:J.c,q:J.q,e:J.e,ult:J.ult,cds:(cd.c||0)+(cd.q||0)+(cd.e||0)+(cd.x||0)}; });
      const consumed = (before.c-after.c)+(before.q-after.q)+(before.e-after.e) > 0 || before.ult > after.ult || after.cds > 0;
      results.push(`${ag}:${consumed?'fired':'NOEFFECT'}`);
      console.log(el(), ag, JSON.stringify({before, after}), consumed ? 'fired' : 'NO EFFECT');
    }
    console.log(el(), 'MATRIX', results.join(' '));
    console.log(el(), 'page errors during matrix:', errors.length);
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
