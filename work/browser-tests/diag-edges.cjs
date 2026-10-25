const MAP = process.env.MAP || 'split';
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
      const s = X.near(C, -46.1, 2.6, 6.6);
      const walk = (a, b, r) => { const pa = N[a], pb = N[b]; const d = Math.hypot(pb[0]-pa[0], pb[2]-pa[2]), steps = Math.max(1, Math.ceil(d/.18)); let y = pa[1];
        for (let k = 1; k <= steps; k++) { const x = pa[0]+(pb[0]-pa[0])*k/steps, z = pa[2]+(pb[2]-pa[2])*k/steps, h = H(C, x, z, y);
          if (h-y > .321 || y-h > .35 || B(C, x, z, r, Math.max(y,h)+.32)) return 'FAIL@'+(k/steps).toFixed(2)+' dy='+(h-y).toFixed(2);
          y = h; } return 'ok'; };
      const edges = (A[s] || []).map(j => ({j, node: N[j].map(v=>+v.toFixed(1)), r43: walk(s, j, .43), r45: walk(s, j, .45)}));
      const playable = []; for (let i = 0; i < N.length; i++) if (C.playable[i]) playable.push(i);
      const ctrl = [];
      for (let k = 0; k < 6; k++) { const i = playable[(k * 2654435761) % playable.length];
        const es = (A[i] || []).map(j => walk(i, j, .45)); const bad = es.filter(e => e !== 'ok').length;
        ctrl.push({i, adj: es.length, bad}); }
      return {s, sNode: N[s].map(v=>+v.toFixed(2)), adj: A[s] && A[s].length, edges, ctrl};
    });
    console.log('EDGES', JSON.stringify(r));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
