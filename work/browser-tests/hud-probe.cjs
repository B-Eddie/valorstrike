// HUD layout check: during banner, after expiry, with an error toast up. Asserts no overlap with HP.
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p} = await launch({profile:'light'});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.light(true); window.__vsNoAgents = true; }); // HUD layout doesn't need the rendered scene; light map avoids SwiftShader crashes
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.waitForTimeout(300); // banner + hint both up
    await p.screenshot({path: '/tmp/hud-banner.png'});
    const m = await p.evaluate(() => {
      const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width && cs.display !== 'none' && +cs.opacity > 0.05 ? {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)} : null; };
      const ov = (a, b) => !!(a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y));
      window.xErr(new Error('overlap probe toast'));
      return new Promise(r => setTimeout(() => {
        const B = {toast: box(document.getElementById('toast')), hint: box(document.getElementById('hint')), err: box(document.getElementById('xErr')), hp: box(document.querySelector('#game .hud.x-bl'))};
        r({B, toastVsHint: ov(B.toast, B.hint), errVsHp: ov(B.err, B.hp), errVsHint: ov(B.err, B.hint)});
      }, 400));
    });
    console.log('OVERLAP', JSON.stringify(m));
    await p.screenshot({path: '/tmp/hud-err.png'});
  } finally { await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
