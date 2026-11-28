// Controlled in-game capture: pin the duel bot, camera on the GUN, reload burst.
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
    await p.waitForFunction(() => window.__vs.duelBot && window.__vs.duelBot.alive && window.__vs.duelBot.xm && window.__vs.duelBot.xm.valorant, undefined, {timeout: 300000, polling: 3000});
    console.log(el(), 'rig attached');
    await p.evaluate(() => {
      const t = window.__vs.duelBot; window.__tpTarget = t;
      t.weapon = 'Operator'; if (t.xm) t.xm.w = 'Operator';
      for (const el2 of document.querySelectorAll('body *')) { if (el2.tagName !== 'CANVAS' && !(el2.querySelector && el2.querySelector('canvas'))) el2.style.visibility = 'hidden'; }
      for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; }
    });
    const frame = async (name) => {
      await p.evaluate(() => { const t = window.__tpTarget; if (!t || !t.alive) return;
        window.__vs.player.hp = 10000;
        if (!window.__tpPin) { t.xaimOn = false; t.xaim = null; t.xTt = null; t.xTg = null; t.strafe = 0; t.flip = 1e9; t.bolt = 1e9;
        window.__tpPin = setInterval(() => { t.g.position.set(0, 0, -10); t.g.rotation.y = Math.PI * 0.78; }, 25); } // hold the pin through the screenshot
        const M = t.xm, gw = M && M.gun ? M.gun.getWorldPosition(new THREE.Vector3()) : null;
        const cx = 0 + Math.sin(Math.PI * 0.78 + Math.PI / 2) * 1.9, cz = -10 + Math.cos(Math.PI * 0.78 + Math.PI / 2) * 1.9;
        window.__vs.setPos(cx, 0, cz);
        if (gw) window.__vs.aimAt(gw.x, gw.y, gw.z); });
      await p.screenshot({path: '/downloads/ingame2-' + name + '.png'});
      console.log(el(), name, 'captured');
    };
    await new Promise(r => setTimeout(r, 600));
    await frame('rest');
    await p.evaluate(() => { const t = window.__tpTarget; t.xAmRn = (t.xAmRn || 0) + 1; t.xAmRd = 2.33; });
    for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 400)); await frame('reload-' + i); }
    await new Promise(r => setTimeout(r, 800)); await frame('after');
    const st = await p.evaluate(() => { const M = window.__tpTarget.xm; return {rigStoodIn: M && M.gun && M.gun.visible === false}; });
    console.log(el(), 'during-next-reload check skipped; stoodIn(at after) =', JSON.stringify(st));
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
