// Omen From the Shadows end-to-end: X -> minimap targeting (no pause) -> real minimap
// click on a valid far nav point -> ult spent -> 3s channel -> player teleports there.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  const fails = [];
  try {
    await boot(p);
    if (await p.$('#mIntro.on')) { await p.click('#mIntro [data-close]'); } // dismiss intro modal like a real user, else it eats minimap clicks
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0; const J = window.__vs.J; J.pick='Omen'; J.on=true; J.ult=99; J.cd={c:0,q:0,e:0,x:0}; });
    await p.waitForTimeout(900);
    const before = await p.evaluate(() => window.__vs.state().player.slice(0,3));
    const target = await p.evaluate(() => {
      const C = window.xNativeMaps.state.current, MM = document.getElementById('xMap');
      const pl = window.__vs.state().player, b = C.bounds, W = MM.width, H = MM.height;
      const pad = 8, s = (Math.min(W,H)-pad*2)/Math.max(b.x2-b.x1, b.z2-b.z1), ox = (W-(b.x2-b.x1)*s)/2, oz = (H-(b.z2-b.z1)*s)/2;
      let best = null, bd = 0;
      const pool = Object.values(C.nav.siteNodes || {}); // site centers are wide-open plant areas, tolerant of the coarse minimap pixel grid
      for (const i of pool) {
        const n = C.nav.nodes[i]; if (!n) continue;
        const d = Math.hypot(n[0]-pl[0], n[2]-pl[2]);
        if (d > 12 && d > bd) { best = n; bd = d; } // site/spawn nodes are guaranteed open standable spots
      }
      if (!best) return null;
      const r = MM.getBoundingClientRect();
      return {cx: Math.round(r.left + (ox+(best[0]-b.x1)*s)*r.width/W), cy: Math.round(r.top + (oz+(best[2]-b.z1)*s)*r.height/H), wx: best[0], wz: best[2], dist: bd};
    });
    if (!target) { console.log('no valid far nav target'); fails.push('no target'); }
    else {
      console.log('player at', before.map(v=>v.toFixed(1)).join(','), '-> clicking world', target.wx.toFixed(1)+','+target.wz.toFixed(1), '('+target.dist.toFixed(1)+'u away)');
      await p.keyboard.press('KeyX');
      await p.waitForTimeout(400);
      const mid = await p.evaluate(() => ({ftp: !!window.__vs.J.ftp, paused: window.__vs.state().paused}));
      if (!mid.ftp || mid.paused !== false) fails.push('targeting state wrong: '+JSON.stringify(mid));
      await p.mouse.click(target.cx, target.cy);
      await p.waitForTimeout(400);
      const clicked = await p.evaluate(() => ({rej: window.__omenRej || null, ftp: !!window.__vs.J.ftp, ult: window.__vs.J.ult, fts: !!window.__vs.J.fts, paused: window.__vs.state().paused, toast: document.getElementById('toast').textContent}));
      console.log('after click:', JSON.stringify(clicked));
      if (clicked.ftp) fails.push('still targeting after click');
      if (clicked.ult !== 0) fails.push('ult not spent: '+clicked.ult);
      if (!clicked.fts) fails.push('no teleport channel after click');
      if (clicked.paused !== false) fails.push('paused after click');
      // 3s channel in game time; SwiftShader game time runs ~4-5x slower than wall
      const tp = await p.waitForFunction((t) => { const pl = window.__vs.state().player; return Math.hypot(pl[0]-t.wx, pl[2]-t.wz) < 2.5; }, {wx: target.wx, wz: target.wz}, {timeout: 45000}).then(()=>true).catch(()=>false);
      const after = await p.evaluate(() => window.__vs.state().player.slice(0,3));
      console.log('player after channel:', after.map(v=>v.toFixed(1)).join(','), 'teleported:', tp);
      if (!tp) fails.push('player did not teleport to clicked point');
    }
    console.log(fails.length ? 'FAIL: '+fails.join(' | ') : 'OMEN-ULT-PROBE PASS');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
