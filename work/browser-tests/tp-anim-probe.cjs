// In-game visual verification of the Rocklan TP weapon-part work: real Chrome + the real game.
// Captures a bot's held gun while its reload gesture, equip motion and fire cycle run, so the
// rigged donor stand-in is seen in its actual held position (not isolated geometry).
// node work/browser-tests/tp-anim-probe.cjs
const {serve, launch, boot, startDM} = require('./lib.cjs');
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
    console.log(el(), 'DUEL RUNNING, rig attached');
    // frame the target bot; hide DOM chrome; keep the player alive
    await p.evaluate(() => {
      const t = window.__vs.duelBot;
      window.__tpTarget = t;
      for (const el2 of document.querySelectorAll('body *')) { if (el2.tagName !== 'CANVAS' && !(el2.querySelector && el2.querySelector('canvas'))) el2.style.visibility = 'hidden'; }
      for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; }
    });
    const frame = async (name) => {
      await p.evaluate(() => { const t = window.__tpTarget; if (!t || !t.alive) return;
        window.__vs.player.hp = 10000;
        const p0 = t.g.position, ry = t.g.rotation.y;
        window.__vs.setPos(p0.x + Math.sin(ry + 0.4) * 2.2, 0, p0.z + Math.cos(ry + 0.4) * 2.2);
        window.__vs.aimAt(p0.x, p0.y + 1.2, p0.z); });
      await p.screenshot({path: '/downloads/ingame-' + name + '.png'});
      console.log(el(), name, 'captured');
    };
    // (a) reload: give the bot a donor gun and start the client reload gesture it would run on empty
    const setup = await p.evaluate(() => { const t = window.__tpTarget, M = t.xm;
      const before = {w: M && M.w, uw: t.weapon};
      t.weapon = 'Operator'; if (M) M.w = 'Operator';
      return before; });
    console.log(el(), 'target weapon', JSON.stringify(setup), '-> Operator');
    await new Promise(r => setTimeout(r, 800)); // let the held-gun sync swap the mesh
    await p.evaluate(() => { const t = window.__tpTarget; t.xAmRn = (t.xAmRn || 0) + 1; t.xAmRd = 2.33; });
    await new Promise(r => setTimeout(r, 250)); await frame('reload-1');
    await new Promise(r => setTimeout(r, 400)); await frame('reload-2');
    await new Promise(r => setTimeout(r, 400)); await frame('reload-3');
    await new Promise(r => setTimeout(r, 400)); await frame('reload-4');
    await new Promise(r => setTimeout(r, 900)); await frame('reload-end');
    // (b) fire: bump the shot counter the TP driver bumps on server shot events (Bucky pump)
    await p.evaluate(() => { const t = window.__tpTarget, M = t.xm; t.weapon = 'Operator'; if (M) M.w = 'Operator'; });
    await new Promise(r => setTimeout(r, 800));
    const fire = await p.evaluate(() => { const M = window.__tpTarget.xm; if (!M || !M.sx) return {ok:false};
      M.sx.shots = (M.sx.shots || 0) + 1; return {ok:true, shots:M.sx.shots}; });
    console.log(el(), 'fire bump', JSON.stringify(fire));
    await new Promise(r => setTimeout(r, 350)); await frame('fire-mid');
    await new Promise(r => setTimeout(r, 1200)); await frame('fire-end');
    // (c) equip: swap back to a donor gun with an equip clip
    await p.evaluate(() => { const t = window.__tpTarget, M = t.xm; t.weapon = 'Marshal'; if (M) M.w = 'Marshal'; });
    await new Promise(r => setTimeout(r, 300)); await frame('equip-mid');
    await new Promise(r => setTimeout(r, 1300)); await frame('equip-end');
    const state = await p.evaluate(() => { const t = window.__tpTarget, M = t && t.xm;
      return {alive: !!(t && t.alive), w: M && M.w, rigStoodIn: !!(M && M.gun && M.gun.visible === false)}; });
    console.log(el(), 'final', JSON.stringify(state));
    console.log(el(), 'TP-ANIM-PROBE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 300)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource/.test(l)).slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
