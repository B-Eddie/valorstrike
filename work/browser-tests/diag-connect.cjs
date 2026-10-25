// A-Sewer west-gate connector builder (split): find capsule-valid crossing lanes between the
// main component and the sewer fragment, then emit a JSON patch (waypoint nodes + edges)
// that would reconnect the fragment honestly. Verification only - no file writes here.
const MAP = 'split';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const r = await p.evaluate(() => {
      const X = window.xNativeMaps, C = X.state.current, N = C.nav.nodes, A = C.nav.adj, H = X.height, B = X.blocked;
      const sweep = (pa, pb) => { const dh = pb[1] - pa[1];
        const d = Math.hypot(pb[0]-pa[0], pb[2]-pa[2]), steps = Math.max(1, Math.ceil(d/.18)); let y = pa[1];
        for (let k = 1; k <= steps; k++) { const x = pa[0]+(pb[0]-pa[0])*k/steps, z = pa[2]+(pb[2]-pa[2])*k/steps, h = H(C, x, z, y);
          if (h-y > .321 || (dh >= -0.35 && y-h > .35) || B(C, x, z, .45, Math.max(y,h)+.32)) return false;
          y = h; } return true; };
      // Candidate lanes: from main-side node row (x<=5.5) to sewer-side row (x>=6.25),
      // scanning z for straight and one-waypoint crossings.
      const mainNodes = [], fragNodes = [];
      for (let i = 0; i < N.length; i++) { if (!C.playable[i]) continue; const p = N[i];
        if (p[1] > 8.2 && p[1] < 8.8 && p[2] > 12.4 && p[2] < 15.6) {
          if (p[0] <= 5.6 && p[0] >= 4.5) mainNodes.push(i);
          if (p[0] >= 6.1 && p[0] <= 7.5) fragNodes.push(i);
        }
      }
      const lanes = [];
      for (const a of mainNodes) for (const b2 of fragNodes) {
        if (Math.abs(N[a][2]-N[b2][2]) > 1.6) continue;
        if (sweep(N[a], N[b2])) { lanes.push({type: 'direct', a, b: b2}); continue; }
        // one waypoint at mid-x, scanned z
        const mx = (N[a][0]+N[b2][0]) / 2;
        for (let z = Math.min(N[a][2], N[b2][2]) - .5; z <= Math.max(N[a][2], N[b2][2]) + .5; z += .1) {
          const y = H(C, mx, z, 8.5); if (Math.abs(y - N[a][1]) > .321 || Math.abs(y - N[b2][1]) > .4) continue;
          if (B(C, mx, z, .45, y + .32)) continue;
          const w = [mx, y, z];
          if (sweep(N[a], w) && sweep(w, N[b2])) { lanes.push({type: 'waypoint', a, b: b2, w: w.map(v => +v.toFixed(2))}); break; }
        }
        if (lanes.length >= 6) break;
      }
      return {mainCount: mainNodes.length, fragCount: fragNodes.length, lanes: lanes.slice(0, 6)};
    });
    console.log('CONNECT', JSON.stringify(r));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
