// Measure DOM overlay boxes during the death/spectate state at a given viewport.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:+(process.env.VW||568), height:+(process.env.VH||320)}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); }, MAP);
    try { await p.click('#mIntro [data-close]', {timeout: 4000}); } catch (e) {}
    try { await p.click('#playBtn', {timeout: 4000}); } catch (e) {}
    await p.evaluate(() => { try { document.getElementById('mIntro').style.display = 'none'; } catch (e) {}
      window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
        let dead = false;
    for (let k = 0; k < 200 && !dead; k++) {
      await p.evaluate((tp) => { const t = window.__vs.bots.find(x => x.alive);
        if (t && tp) { const p0 = t.g.position; window.__vs.setPos(p0.x + 1.5, p0.y, p0.z + 1.5); window.__vs.aimAt(p0.x, p0.y + 1.2, p0.z); } }, k % 8 === 0);
      const card = await p.evaluate(() => !!document.querySelector('.x-kb.on'));
      if (card) {
        const boxes = await p.evaluate(() => {
          const out = {};
          const grab = (id, el2) => { if (!el2) return; const cs = getComputedStyle(el2);
            if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
            const r = el2.getBoundingClientRect();
            out[id] = {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), op: cs.opacity}; };
          grab('toast', document.getElementById('toast'));
          grab('xKb', document.getElementById('xKb'));
          grab('ann', document.querySelector('.x-ann'));
          grab('deathCard', document.querySelector('.x-kb.on'));
          grab('minimap', document.getElementById('xMap'));
          grab('hpPanel', document.getElementById('hp'));
          grab('ammo', document.getElementById('ammo'));
          grab('score', document.getElementById('score'));
          grab('timer', document.getElementById('timer'));
          grab('sub', document.getElementById('xSub'));
          grab('credits', document.getElementById('xCr'));
          grab('feed', document.getElementById('feed'));
          grab('hint', document.getElementById('hint'));
          grab('spBar', document.querySelector('.x-sp'));
          return out; });
        console.log(el(), 'BOXES', JSON.stringify(boxes));
        await p.screenshot({path: '/downloads/boxes-' + (process.env.VW||'568') + '.png'});
        dead = true;
      }
      await new Promise(r => setTimeout(r, 150));
    }
    if (!dead) throw new Error('never died');
    console.log(el(), 'BOXES DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
