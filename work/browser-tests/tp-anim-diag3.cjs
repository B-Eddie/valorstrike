// Why doesn't the donor stand-in engage in-game? Direct state + manual driver call.
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
    const d1 = await p.evaluate(async () => {
      const t = window.__vs.duelBot; t.weapon = 'Operator'; if (t.xm) t.xm.w = 'Operator';
      t.xaimOn = false; t.xaim = null; t.xTt = null; t.xTg = null;
      window.__tpPin = setInterval(() => { t.g.rotation.y = 0.6; }, 25);
      // wait for donor load to settle
      const t1 = Date.now(); while (XRWB.don.Operator === undefined && Date.now() - t1 < 20000) await new Promise(r => setTimeout(r, 500));
      const don = XRWB.don.Operator;
      return {donLoaded: don !== undefined, don: don ? {rl: !!don.reload, eq: !!don.equip, fi: !!don.fire} : don === null ? 'null' : 'pending',
        valorant: !!t.xm.valorant, ub: !!t.xm.ub, hasSx: !!t.xm.sx, gripBefore: !!(t.xm.sx && t.xm.sx.grip),
        gunKids: (() => { const out = []; t.xm.gun.traverse(o => { if (o.userData && o.userData.grip) out.push('grip@' + o.name); }); return out; })(),
        inXsol: (() => { try { return XSOL.mx.indexOf(t.xm) >= 0; } catch (e) { return 'XSOL unreachable: ' + e; } })()};
    });
    console.log(el(), 'STATE', JSON.stringify(d1));
    await p.evaluate(() => { const t = window.__vs.duelBot; t.xAmRn = 1; t.xAmRd = 2.33; });
    await new Promise(r => setTimeout(r, 500));
    const d2 = await p.evaluate(() => {
      const t = window.__vs.duelBot; t.xAmRn = 2; const out = {};
      out.uoBefore = t.xm.sx.uo;
      try { xUbAnim(t, t.xm, 0, 1 / 60); out.uoAfterUb = t.xm.sx.uo; } catch (e) { out.ubErr = String(e).slice(0, 120); }
      try { xgPose(t.xm, 1 / 60); const G = t.xm.sx.grip; out.grip = G ? {ok: G.ok, rl: G.rl, rp: G.rp, w: +G.w.toFixed(2)} : null; out.gunHidden = t.xm.gun.visible === false; } catch (e) { out.gpErr = String(e).slice(0, 160); }
      return out;
    });
    console.log(el(), 'MANUAL', JSON.stringify(d2));
    await new Promise(r => setTimeout(r, 700));
    const d3 = await p.evaluate(() => { const t = window.__vs.duelBot; const G = t.xm.sx.grip;
      return {uo: t.xm.sx.uo, rp: G && G.rp != null ? +G.rp.toFixed(2) : null, gunHidden: t.xm.gun.visible === false}; });
    console.log(el(), 'NATURAL', JSON.stringify(d3));
    console.log(el(), 'DONE');
  } catch (e) { console.log(el(), 'DIAG-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,4))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
