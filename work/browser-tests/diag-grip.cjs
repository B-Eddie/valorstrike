// Visual checks with native rigs: (a) third-person grip pose on a live bot, (b) floor-pickup prompt on a dropped gun.
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
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    console.log(el(), 'DM RUNNING');
    await p.waitForFunction(() => window.__vs.bots.some(t => t.alive && t.xm && t.xm.valorant), {timeout: 180000, polling: 3000});
    console.log(el(), 'rig attached');
    // (a) grip: stand 2.5u in front of a rigged bot, look at its chest
    await p.evaluate(() => { const t = window.__vs.bots.find(x => x.alive && x.xm && x.xm.valorant);
      window.__gripTarget = t;
      const p0 = t.g.position, ry = t.g.rotation.y;
      window.__vs.setPos(p0.x + Math.sin(ry) * 2.5, 0, p0.z + Math.cos(ry) * 2.5);
      window.__vs.aimAt(p0.x, p0.y + 1.2, p0.z);
      for (const el of document.querySelectorAll('body *')) { if (el.tagName !== 'CANVAS' && !(el.querySelector && el.querySelector('canvas'))) el.style.visibility = 'hidden'; }
      for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width < 400) c.style.visibility = 'hidden'; } });
    // Re-aim at the bot's live position immediately before the shot (bots keep moving).
    for (let k = 0; k < 3; k++) {
      await p.evaluate(() => { const t = window.__gripTarget; if (!t || !t.alive) return;
        const p0 = t.g.position, ry = t.g.rotation.y;
        window.__vs.setPos(p0.x + Math.sin(ry + 0.5) * 1.4, 0, p0.z + Math.cos(ry + 0.5) * 1.4);
        window.__vs.aimAt(p0.x, p0.y + 1.25, p0.z); });
      await p.screenshot({path: '/downloads/grip-' + k + '.png'});
      console.log(el(), 'grip' + k, 'captured');
    }
    // (b) pickup prompt: kill the bot, aim at its dropped gun, read the prompt element
    await p.evaluate(() => { const t = window.__gripTarget; window.__vs.kill(t, false, 'You', 'Vandal'); });
    await new Promise(r => setTimeout(r, 1500));
    const prompt = await p.evaluate(() => { const t = window.__gripTarget; const M = t.xm;
      if (!M || !M.gun) return {ok: false, why: 'no dropped gun'};
      const g = M.gun.getWorldPosition ? M.gun.getWorldPosition(new THREE.Vector3()) : M.gun.position;
      window.__vs.setPos(g.x + 1.2, g.y, g.z + 1.2);
      window.__vs.aimAt(g.x, g.y, g.z);
      return {ok: true, gun: [+g.x.toFixed(1), +g.y.toFixed(1), +g.z.toFixed(1)]}; });
    console.log(el(), 'gun at', JSON.stringify(prompt));
    await new Promise(r => setTimeout(r, 900));
    const txt = await p.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) el.style.visibility = '';
      const els = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /\[F\]|pick ?up|Press F/i.test(e.textContent || ''));
      return els.map(e => ({tag: e.tagName, id: e.id || '', txt: (e.textContent || '').trim().slice(0, 60), vis: getComputedStyle(e).visibility, disp: getComputedStyle(e).display, op: getComputedStyle(e).opacity})); });
    console.log(el(), 'prompt candidates', JSON.stringify(txt));
    await p.screenshot({path: '/downloads/pickup-1.png'});
    console.log(el(), 'PICKUP-PROBE DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
