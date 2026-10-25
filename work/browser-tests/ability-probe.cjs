// Ability smoke: 5v5 Jett kit via real key events (jKey dispatch), buy phase warped out.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { const J = window.__vs.J; J.pick = 'Jett'; J.on = true; J.c = 1; J.q = 1; J.e = 1; J.ult = 8; J.cd = {c:0,q:0,e:0,x:0}; window.__vs.FV.buy = 0; });
    const s0 = await p.evaluate(() => { const P = window.__vs.player; return {x:+P.x.toFixed(1), y:+P.y.toFixed(1), z:+P.z.toFixed(1), smokes: window.__vs.J.smokes.length, bs: window.__vs.J.bsOn}; });
    console.log(el(), 'before', JSON.stringify(s0));
    await p.keyboard.press('KeyQ'); await p.waitForTimeout(500); // updraft
    const q = await p.evaluate(() => { const P = window.__vs.player; return {y:+P.y.toFixed(1), vy:+(P.vy||0).toFixed(1)}; });
    console.log(el(), 'Q updraft', JSON.stringify(q), q.y > s0.y + 0.5 ? 'PASS' : 'FAIL');
    await p.keyboard.press('KeyE'); await p.waitForTimeout(400); // dash
    const e2 = await p.evaluate(() => { const P = window.__vs.player; return {x:+P.x.toFixed(1), z:+P.z.toFixed(1)}; });
    const dashed = Math.hypot(e2.x - s0.x, e2.z - s0.z) > 2;
    console.log(el(), 'E dash', JSON.stringify(e2), dashed ? 'PASS' : 'FAIL');
    await p.keyboard.press('KeyC'); await p.waitForTimeout(400); // cloudburst smoke
    const c = await p.evaluate(() => window.__vs.J.smokes.length);
    console.log(el(), 'C smoke', c, c > 0 ? 'PASS' : 'FAIL');
    await p.keyboard.press('KeyX'); await p.waitForTimeout(400); // blade storm
    const x = await p.evaluate(() => ({bsOn: window.__vs.J.bsOn, bs: window.__vs.J.bs, ult: window.__vs.J.ult}));
    console.log(el(), 'X bladestorm', JSON.stringify(x), x.bsOn ? 'PASS' : 'FAIL');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
