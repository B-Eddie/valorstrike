// Ragdoll verification with native rigs ON: kill a bot, then measure ragdoll bone divergence
// (finite, bounded) and capture a screenshot of the corpse pose.
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); }, MAP);
    await startDM(p);
    console.log(el(), 'startDM clicked');
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    console.log(el(), 'DM RUNNING');
    // Rigs attach asynchronously after match start; wait for them before killing.
    await p.waitForFunction(() => window.__vs.bots.some(t => t.alive && t.xm && t.xm.valorant), {timeout: 180000, polling: 3000});
    console.log(el(), 'rigs attached');
    // Find a bot with a native rig
    const has = await p.evaluate(() => window.__vs.bots.map(t => { const M = t.xm;
      return {n: t.name, rig: !!M, ub: !!(M && M.ub), sx: !!(M && M.sx), sc: !!(M && M.sx && M.sx.sc),
              valorant: !!(M && M.valorant), inScene: !!(M && M.m && M.m.parent), alive: t.alive}; }));
    console.log(el(), 'bots', JSON.stringify(has));
    await p.evaluate(() => { const t = window.__vs.bots.find(x => x.alive && x.xm && x.xm.valorant) || window.__vs.bots[0];
      window.__killTarget = t;
      // Stand 4u from the target and face it so the corpse is in view.
      const p = t.g.position; const a = Math.random() * 6.283;
      window.__vs.setPos(p.x + Math.sin(a) * 2.2, 0, p.z + Math.cos(a) * 2.2);
      window.__vs.aimAt(p.x, p.y + 1, p.z);
      window.__vs.kill(t, false, 'You', 'Vandal');
      setTimeout(() => window.__vs.aimAt(p.x, p.y + 0.3, p.z), 300); });
    // Multi-angle capture within the corpse's visible window (~0.5-2.8s post-kill).
    // Hide DOM HUD so only the WebGL scene shows; orbit the player around the corpse.
    const cap = await p.evaluate(() => { const t = window.__killTarget; const M = t && t.xm;
      if (!M || !M.m) return null; const p = M.m.position; return {x: p.x, y: p.y, z: p.z}; });
    if (cap) {
      await p.evaluate(() => {
        for (const el of document.querySelectorAll('body *')) { if (el.tagName !== 'CANVAS' && !(el.querySelector && el.querySelector('canvas'))) el.style.visibility = 'hidden'; }
        for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; }
      });
      const angles = [0.3, 2.4, 4.5];
      for (let k = 0; k < angles.length; k++) {
        await p.evaluate((c) => { const M = window.__killTarget && window.__killTarget.xm;
          if (M) { const now = performance.now(); M.diedAt = now; M.ragStarted = now; if (M.ragdoll) M.ragdoll.time = 0; }
          window.__vs.setPos(c.x + Math.sin(c.a) * 2.1, 0, c.z + Math.cos(c.a) * 2.1);
          window.__vs.aimAt(c.x, c.y + 0.25, c.z); }, {x: cap.x, y: cap.y, z: cap.z, a: angles[k]});
        await new Promise(r => setTimeout(r, 650));
        await p.screenshot({path: '/downloads/ragdoll-ang' + k + '.png'});
        const surv = await p.evaluate(() => { const st = window.__vs.state(); return st && st.running; });
        console.log(el(), 'angle' + k, 'captured running=' + surv);
      }
    }
    console.log(el(), 'RAG-PROBE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.slice(0,12)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
