// Floor-pickup [F] prompt check in a real 5v5 round (xdOn requires mode=five && !dm).
const MAP = process.env.MAP || 'ascent';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.FV.buy = 0.1; }, MAP);
    await p.click('#mIntro [data-close]'); await p.click('#playBtn');
    await p.evaluate(() => window.__vs.startFive());
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 280000, polling: 2000});
    console.log(el(), 'FIVE RUNNING');
    await p.waitForFunction(() => window.__vs.bots.some(t => t.alive), {timeout: 60000, polling: 1000});
    const drop = await p.evaluate(() => { const t = window.__vs.bots.find(x => x.alive);
      const p0 = t.g.position;
      window.__vs.kill(t, false, 'You', 'Vandal');
      return {x: p0.x, y: p0.y, z: p0.z, w: typeof t.w === 'string' ? t.w : t.w && t.w.name}; });
    console.log(el(), 'killed at', JSON.stringify(drop));
    await new Promise(r => setTimeout(r, 600));
    // Sample the prompt rapidly right after aiming (player physics can drift the eye).
    for (let k = 0; k < 6; k++) {
      await p.evaluate((d) => { window.__vs.setPos(d.x + 1.0, d.y, d.z + 1.0); window.__vs.aimAt(d.x, d.y + 0.08, d.z); }, drop);
      await new Promise(r => setTimeout(r, 250));
      const pr = await p.evaluate(() => { const elp = document.getElementById('xdPrompt');
        return elp ? {disp: elp.style.display, text: elp.textContent.trim()} : null; });
      console.log(el(), 'prompt sample' + k, JSON.stringify(pr));
      if (pr && pr.disp === 'flex') break;
    }
    await p.screenshot({path: '/downloads/pickup-2.png'});
    // also verify no prompt when looking away
    await p.evaluate((d) => { window.__vs.aimAt(d.x, d.y + 30, d.z); }, drop);
    await new Promise(r => setTimeout(r, 500));
    const gone = await p.evaluate(() => { const elp = document.getElementById('xdPrompt');
      return elp ? elp.style.display : 'no-el'; });
    console.log(el(), 'after look-away display=', gone);
    console.log(el(), 'PICKUP5 DONE');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 200)); }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
