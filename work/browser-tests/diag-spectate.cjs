// Spectate 3P toggle check: die in a 5v5, click the spectate 3P button, verify state + camera.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); }, MAP);
    await p.click('#mIntro [data-close]'); await p.click('#playBtn');
    await p.evaluate(() => window.__vs.startFive());
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    console.log(el(), 'FIVE RUNNING');
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    // Walk into the enemy repeatedly until dead (spectate UI appears on death).
    let dead = false;
    for (let k = 0; k < 60 && !dead; k++) {
      const st = await p.evaluate((tp) => { const t = window.__vs.bots.find(x => x.alive);
        if (t && tp) { const p0 = t.g.position; window.__vs.setPos(p0.x + 1.5, p0.y, p0.z + 1.5); window.__vs.aimAt(p0.x, p0.y + 1.2, p0.z); }
        const hpEl = document.querySelector('#hp span');
        return {tp: !!document.querySelector('.x-sp__tp'), hp: hpEl && hpEl.textContent, t: window.__vs.state().timeLeft, buy: window.__vs.FV.buy}; }, k % 4 === 0);
      if (k % 4 === 0) console.log(el(), 'poll', JSON.stringify(st));
      dead = st.tp;
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(el(), 'spectate button present:', dead);
    if (!dead) throw new Error('player never died / no spectate UI');
    await new Promise(r => setTimeout(r, 2500)); // past any death-cam delay
    const before = await p.evaluate(() => { const el2 = document.querySelector('.x-sp__tp');
      return el2 ? {aria: el2.getAttribute('aria-pressed'), text: el2.textContent.trim().slice(0,40), cls: el2.className} : null; });
    console.log(el(), 'before click:', JSON.stringify(before));
    await p.screenshot({path: '/downloads/spectate-before.png'});
    await p.click('.x-sp__tp');
    await new Promise(r => setTimeout(r, 1200));
    const after = await p.evaluate(() => { const el2 = document.querySelector('.x-sp__tp');
      return el2 ? {aria: el2.getAttribute('aria-pressed'), text: el2.textContent.trim().slice(0,40), cls: el2.className} : null; });
    console.log(el(), 'after click:', JSON.stringify(after));
    await p.screenshot({path: '/downloads/spectate-3p.png'});
    console.log(el(), 'SPECTATE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
