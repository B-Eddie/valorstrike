// Spectate 3P toggle check: die in a 5v5, click the spectate 3P button, verify state + camera.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:+(process.env.VW||640), height:+(process.env.VH||360)}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); }, MAP);
    try { await p.click('#mIntro [data-close]', {timeout: 4000}); } catch (e) {}
    try { await p.click('#playBtn', {timeout: 4000}); } catch (e) {}
    await p.evaluate(() => { try { document.getElementById('mIntro').style.display = 'none'; } catch (e) {}
      window.__vs.startFive(); });
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
      const card = await p.evaluate(() => !!document.querySelector('.x-kb.on'));
      if (card && !global.__cardShot) { global.__cardShot = 1; await p.screenshot({path: '/downloads/death-card-' + (process.env.VW||'640') + '.png'}); console.log(el(), 'death card captured'); }
      dead = st.tp && card === false;
      await new Promise(r => setTimeout(r, 450));
    }
    console.log(el(), 'spectate button present:', dead);
    if (!dead) throw new Error('player never died / no spectate UI');
    await new Promise(r => setTimeout(r, 2500)); // past any death-cam delay
    const name = () => p.evaluate(() => { const els = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /SPECTATING/i.test(e.textContent || '')); return els.length ? els[0].textContent.trim() : null; });
    await p.screenshot({path: '/downloads/spec-1p.png'});
    console.log(el(), '1P:', JSON.stringify(await name()));
    await p.click('.x-sp__tp');
    await new Promise(r => setTimeout(r, 1500));
    const after = await p.evaluate(() => { const el2 = document.querySelector('.x-sp__tp');
      return el2 ? {aria: el2.getAttribute('aria-pressed'), text: el2.textContent.trim().slice(0,40)} : null; });
    console.log(el(), 'after toggle:', JSON.stringify(after));
    await p.screenshot({path: '/downloads/spec-3p.png'});
    await p.keyboard.press('Space'); // switch spectated player
    await new Promise(r => setTimeout(r, 1500));
    console.log(el(), 'after switch:', JSON.stringify(await name()));
    await p.screenshot({path: '/downloads/spec-switch.png'});
    console.log(el(), 'SPECTATE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
