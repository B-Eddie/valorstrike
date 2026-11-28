// Decisive capture: donor-loaded state + gesture + donor stand-in state per frame, via __vs.xrw hooks.
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
    await p.waitForFunction(() => { const d = window.__vs.xrw().don; return d && d.Operator && d.Operator !== 'pending'; }, undefined, {timeout: 120000, polling: 1000});
    console.log(el(), 'xrw', JSON.stringify(await p.evaluate(() => window.__vs.xrw())));
    console.log(el(), 'gunPrep', JSON.stringify(await p.evaluate(() => window.__vs.gunPrep('Operator'))));
    await p.waitForFunction(() => { const t = window.__vs.duelBot; return t && t.xm && window.__vs.xrwWhy(t.xm).gripFound === true; }, undefined, {timeout: 60000, polling: 1000});
    console.log(el(), 'grip ready', JSON.stringify(await p.evaluate(() => window.__vs.xrwWhy(window.__vs.duelBot.xm))));
    await p.evaluate(() => {
      const t = window.__vs.duelBot; window.__tpTarget = t;
      t.weapon = 'Operator'; if (t.xm) t.xm.w = 'Operator';
      const px = t.g.position.x, pz = t.g.position.z;
      t.xaimOn = false; t.xaim = null; t.xTt = null; t.xTg = null; t.strafe = 0; t.flip = 1e9; t.bolt = 1e9;
      window.__vs.vmHide(true);
      window.__tpPin = setInterval(() => { t.g.position.set(px, 0, pz); t.g.rotation.y = 0.6;
        window.__vs.vmHide(true); // the duel tick re-shows the FP gun; keep it hidden
        for (const c of window.__vs.camera.children) c.visible = false; // every camera-attached FP rig, whichever system re-shows it
        window.__vs.setPos(px + Math.sin(0.6 + Math.PI / 2) * 3.2, 0, pz + Math.cos(0.6 + Math.PI / 2) * 3.2); // the duel round reset re-seats the player; keep the camera put
        window.__vs.aimAt(px, 1.15, pz); }, 25);
      for (const el2 of document.querySelectorAll('body *')) { if (el2.tagName !== 'CANVAS' && !(el2.querySelector && el2.querySelector('canvas'))) el2.style.visibility = 'hidden'; }
      for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; }
    });
    const frame = async (name) => {
      const st = await p.evaluate(() => { const t = window.__tpTarget; if (!t || !t.alive) return {dead: true};
        window.__vs.player.hp = 10000;
        const M = t.xm, P = t.g.position, ry = t.g.rotation.y;
        // camera owned by the pin interval (fixed point: identical framing every frame)
        return {uo: M.sx && M.sx.uo, rn: [t.xAmRn, M.sx && M.sx.rn], ut: M.sx && +(M.sx.ut || 0).toFixed(2), grip: window.__vs.xrwGrip(M), xrw: window.__vs.xrwState(M), gunHidden: !!(M.gun && M.gun.visible === false), vm: window.__vs.vmState()}; });
      await p.screenshot({path: '/downloads/ingame4-' + name + '.png'});
      console.log(el(), name, JSON.stringify(st));
    };
    await new Promise(r => setTimeout(r, 600));
    await frame('rest');
    await p.evaluate(() => { const t = window.__tpTarget, X = t.xm.sx; X.ut = 0; X.uo = null; t.xAmRn = (X.rn == null ? 1 : X.rn + 1); t.xAmRd = 2.33; });
    await p.waitForFunction(() => { const t = window.__tpTarget; return t.xm.sx.rn === t.xAmRn; }, undefined, {timeout: 30000, polling: 250}); // baseline latched
    await p.evaluate(() => { const t = window.__tpTarget, X = t.xm.sx; X.ut = 0; X.uo = null; t.xAmRn = X.rn + 1; t.xAmRd = 2.33; });
    await p.waitForFunction(() => window.__tpTarget.xm.sx.uo === 'reload', undefined, {timeout: 30000, polling: 250}); // gesture confirmed live
    for (let i = 1; i <= 4; i++) { await new Promise(r => setTimeout(r, 420)); await frame('reload-' + i); }
    await new Promise(r => setTimeout(r, 900)); await frame('after');
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,4))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
