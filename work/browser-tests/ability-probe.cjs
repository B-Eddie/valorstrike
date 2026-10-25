// Ability smoke: 5v5 Jett, cast Q (updraft) + E (dash) via real key events; watch player state + errors.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1500);
    const before = await p.evaluate(() => { const P = window.__vs.player; return {x: +P.x.toFixed(1), y: +P.y.toFixed(1), z: +P.z.toFixed(1), agent: (window.J && J.pick) || '?'}; });
    console.log(el(), 'before', JSON.stringify(before));
    await p.keyboard.press('KeyQ'); // updraft
    await p.waitForTimeout(700);
    const midQ = await p.evaluate(() => { const P = window.__vs.player; return {y: +P.y.toFixed(1), vy: P.vy && +P.vy.toFixed(2)}; });
    console.log(el(), 'after Q', JSON.stringify(midQ));
    await p.keyboard.press('KeyE'); // dash
    await p.waitForTimeout(900);
    const midE = await p.evaluate(() => { const P = window.__vs.player; return {x: +P.x.toFixed(1), y: +P.y.toFixed(1), z: +P.z.toFixed(1)}; });
    console.log(el(), 'after E', JSON.stringify(midE));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
