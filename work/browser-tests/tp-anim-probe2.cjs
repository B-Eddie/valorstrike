// Controlled in-game capture: pin the duel bot WHERE IT SPAWNED (open floor), profile camera,
// per-frame state dump proving whether the donor stand-in was active at capture time.
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
    const pin = await p.evaluate(() => {
      const t = window.__vs.duelBot; window.__tpTarget = t;
      t.weapon = 'Operator'; if (t.xm) t.xm.w = 'Operator';
      const px = t.g.position.x, pz = t.g.position.z; // pin at its own spawn spot (open duel floor)
      t.xaimOn = false; t.xaim = null; t.xTt = null; t.xTg = null; t.strafe = 0; t.flip = 1e9; t.bolt = 1e9;
      window.__tpPin = setInterval(() => { t.g.position.set(px, 0, pz); t.g.rotation.y = 0.6; }, 25);
      for (const el2 of document.querySelectorAll('body *')) { if (el2.tagName !== 'CANVAS' && !(el2.querySelector && el2.querySelector('canvas'))) el2.style.visibility = 'hidden'; }
      for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; }
      return {px: +px.toFixed(1), pz: +pz.toFixed(1)};
    });
    console.log(el(), 'pinned at', JSON.stringify(pin));
    const frame = async (name) => {
      const st = await p.evaluate(() => { const t = window.__tpTarget; if (!t || !t.alive) return {dead: true};
        window.__vs.player.hp = 10000;
        const M = t.xm, P = t.g.position, ry = t.g.rotation.y;
        const gw = M && M.gun ? M.gun.getWorldPosition(new THREE.Vector3()) : {x: P.x, y: P.y + 1.2, z: P.z};
        window.__vs.setPos(P.x + Math.sin(ry + Math.PI / 2) * 2.2, 0, P.z + Math.cos(ry + Math.PI / 2) * 2.2);
        window.__vs.aimAt(gw.x, gw.y, gw.z);
        return {uo: M.sx && M.sx.uo, rp: M.sx && M.sx.grip && +M.sx.grip.rp && +M.sx.grip.rp.toFixed(2), gunHidden: !!(M.gun && M.gun.visible === false), alive: !!t.alive}; });
      await p.screenshot({path: '/downloads/ingame3-' + name + '.png'});
      console.log(el(), name, JSON.stringify(st));
    };
    await new Promise(r => setTimeout(r, 600));
    await frame('rest');
    await p.evaluate(() => { const t = window.__tpTarget; t.xAmRn = 1; t.xAmRd = 2.33; }); // baseline edge (first sight: X.rn null -> no gesture)
    await new Promise(r => setTimeout(r, 500));
    const base = await p.evaluate(() => { const t = window.__tpTarget; t.xAmRn = 2; return t.xm && t.xm.sx ? t.xm.sx.rn : 'no-sx'; }); // real edge -> gesture
    console.log(el(), 'bump baseline->2, sx.rn was', JSON.stringify(base));
    for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 380)); await frame('reload-' + i); }
    await new Promise(r => setTimeout(r, 900)); await frame('after');
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
