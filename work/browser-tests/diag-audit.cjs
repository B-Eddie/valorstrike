// Full-map nav edge audit + simulated prune, motor-equivalent (r=0.45 capsule, foot +0.32,
// rise 0.321 strict, descent-tolerant for drop edges). Measures: edge failures, trap nodes,
// largest-component size before/after, spawn/site/callout reachability before/after, cost.
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
      const t0 = performance.now();
      const X = window.xNativeMaps, C = X.state.current, N = C.nav.nodes, A = C.nav.adj, H = X.height, B = X.blocked;
      const sweep = (pa, pb, dh) => { const d = Math.hypot(pb[0]-pa[0], pb[2]-pa[2]), steps = Math.max(1, Math.ceil(d/.18)); let y = pa[1];
        for (let k = 1; k <= steps; k++) { const x = pa[0]+(pb[0]-pa[0])*k/steps, z = pa[2]+(pb[2]-pa[2])*k/steps, h = H(C, x, z, y);
          if (h-y > .321) return 'rise@' + x.toFixed(1) + ',' + z.toFixed(1) + ' dy' + (h-y).toFixed(2);
          if (dh >= -0.35 && y-h > .35) return 'drop@' + x.toFixed(1) + ',' + z.toFixed(1) + ' dy' + (y-h).toFixed(2);
          if (B(C, x, z, .45, Math.max(y,h)+.32)) return 'blocked@' + x.toFixed(1) + ',' + z.toFixed(1) + ' y' + y.toFixed(1);
          y = h; } return true; };
      // Motor moves axis-split (x then z) with ground snap; accept an edge if the direct chord
      // OR the axis-split L-path (x-then-z or z-then-x through the corner) is walkable.
      const walk = (a, b) => { const pa = N[a], pb = N[b]; const dh = pb[1] - pa[1];
        if (sweep(pa, pb, dh) === true) return true;
        const why = sweep(pa, pb, dh);
        const c1 = [pb[0], H(C, pb[0], pa[2], pa[1]), pa[2]];
        if (sweep(pa, c1, c1[1]-pa[1]) === true && sweep(c1, pb, pb[1]-c1[1]) === true) return true;
        const c2 = [pa[0], H(C, pa[0], pb[2], pa[1]), pb[2]];
        if (sweep(pa, c2, c2[1]-pa[1]) === true && sweep(c2, pb, pb[1]-c2[1]) === true) return true;
        return why; };
      const auditR = (RAD) => {
      const sweepR = (pa, pb, dh) => { const d = Math.hypot(pb[0]-pa[0], pb[2]-pa[2]), steps = Math.max(1, Math.ceil(d/.18)); let y = pa[1];
        for (let k = 1; k <= steps; k++) { const x = pa[0]+(pb[0]-pa[0])*k/steps, z = pa[2]+(pb[2]-pa[2])*k/steps, h = H(C, x, z, y);
          if (h-y > .321 || (dh >= -0.35 && y-h > .35) || B(C, x, z, RAD, Math.max(y,h)+.32)) return false;
          y = h; } return true; };
      const walkR = (a, b) => { const pa = N[a], pb = N[b]; const dh = pb[1] - pa[1];
        if (sweepR(pa, pb, dh)) return true;
        const c1 = [pb[0], H(C, pb[0], pa[2], pa[1]), pa[2]];
        if (sweepR(pa, c1, c1[1]-pa[1]) && sweepR(c1, pb, pb[1]-c1[1])) return true;
        const c2 = [pa[0], H(C, pa[0], pb[2], pa[1]), pb[2]];
        if (sweepR(pa, c2, c2[1]-pa[1]) && sweepR(c2, pb, pb[1]-c2[1])) return true;
        return false; };
      let eBad = 0, eBadKept = 0; const pruned = A.map(() => []); let trap = 0; const bad = [];
      for (let a = 0; a < N.length; a++) { if (!C.playable[a]) continue; let good = 0;
        for (const b of A[a]) { const dh = N[b][1] - N[a][1];
          if (walkR(a, b) || dh < -0.35) { good++; pruned[a].push(b); if (dh < -0.35 && !walkR(a, b)) eBadKept++; } else { eBad++; bad.push([a, b]); } }
        if (A[a].length && !good) trap++; }
      return {eBad, eBadKept, trap, pruned, bad, after: measure(pruned), frags: (() => { const seen = new Uint8Array(N.length); const out = [];
        for (let i = 0; i < N.length; i++) { if (seen[i] || !C.playable[i]) continue; const q = [i]; seen[i] = 1; let size = 0;
          for (let k = 0; k < q.length; k++) { size++; for (const j of pruned[q[k]]) if (!seen[j] && C.playable[j]) { seen[j] = 1; q.push(j); } }
          out.push(size); } return out.sort((x, y) => y - x); })()}; };
      let r45, r40;
      let eTotal = 0, eBad = 0; const badEdge = [], trap = [], pruned = A.map(() => []);
      for (let a = 0; a < N.length; a++) { if (!C.playable[a]) { continue; }
        for (const b of A[a]) { eTotal++; }
      }
      const components = (adj) => { const seen = new Uint8Array(N.length); let largest = 0, count = 0;
        for (let i = 0; i < N.length; i++) { if (seen[i] || !C.playable[i]) continue; count++;
          const q = [i]; seen[i] = 1; let size = 0;
          for (let k = 0; k < q.length; k++) { size++; for (const j of adj[q[k]]) if (!seen[j] && C.playable[j]) { seen[j] = 1; q.push(j); } }
          if (size > largest) largest = size; }
        return {count, largest}; };
      const near = (x, z, y) => X.near(C, x, z, y);
      const reach = (adj, from) => { const seen = new Uint8Array(N.length); const q = [from]; seen[from] = 1;
        for (let k = 0; k < q.length; k++) for (const j of adj[q[k]]) if (!seen[j] && C.playable[j]) { seen[j] = 1; q.push(j); } return seen; };
      const atk = near(C.meta.attacker[0], C.meta.attacker[2], C.meta.attacker[1]);
      const def = near(C.meta.defender[0], C.meta.defender[2], C.meta.defender[1]);
      const sites = Object.fromEntries(Object.entries(C.meta.sites).map(([k, p]) => [k, near(p[0], p[2], p[1])]));
      const callouts = C.meta.callouts.map(c => ({name: c.name, i: near(c.position[0], c.position[2], c.position[1])}));
      const measure = (adj) => { const comp = components(adj); const rs = reach(adj, atk);
        return {comp, defOK: !!rs[def], sitesOK: Object.fromEntries(Object.entries(sites).map(([k, i]) => [k, !!rs[i]])),
                calloutsLost: callouts.filter(c => !rs[c.i]).map(c => c.name)}; };
      r45 = auditR(.45); r40 = auditR(.4);
      // Articulation: components on pruned graph, then bad edges crossing component lines.
      const cid = new Int32Array(N.length).fill(-1); let nc = 0; const compSize = [];
      for (let i = 0; i < N.length; i++) { if (cid[i] >= 0 || !C.playable[i]) continue; const q = [i]; cid[i] = nc; let sz = 0;
        for (let k = 0; k < q.length; k++) { sz++; for (const j of r45.pruned[q[k]]) if (cid[j] < 0 && C.playable[j]) { cid[j] = nc; q.push(j); } }
        compSize.push(sz); nc++; }
      const mainCid = cid[near(C.meta.attacker[0], C.meta.attacker[2], C.meta.attacker[1])];
      const artic = {};
      for (const [a, b] of r45.bad) { if (cid[a] < 0 || cid[b] < 0 || cid[a] === cid[b]) continue;
        const k = Math.min(cid[a], cid[b]) + '>' + Math.max(cid[a], cid[b]);
        (artic[k] = artic[k] || {n: 0, samples: []}).n++;
        if (artic[k].samples.length < 3) artic[k].samples.push({a: N[a].map(v => +v.toFixed(1)), b: N[b].map(v => +v.toFixed(1))});
      }
      const fragDetail = [];
      { const byCid = {};
        for (let i = 0; i < N.length; i++) { if (cid[i] > 0 && C.playable[i]) (byCid[cid[i]] = byCid[cid[i]] || []).push(i); }
        for (const [c, ids] of Object.entries(byCid)) { if (ids.length < 4) continue;
          const xs = ids.map(i => N[i][0]), ys = ids.map(i => N[i][1]), zs = ids.map(i => N[i][2]);
          const inSet = new Set(ids);
          const links = [];
          for (const i of ids) for (const b of A[i]) if (C.playable[b] && !inSet.has(b) && cid[b] === 0 && links.length < 4)
            links.push({a: N[i].map(v => +v.toFixed(1)), b: N[b].map(v => +v.toFixed(1)), dh: +(N[b][1]-N[i][1]).toFixed(2)});
          const lost = callouts.filter(cl => ids.includes(cl.i)).map(cl => cl.name);
          fragDetail.push({cid: +c, size: ids.length,
            bounds: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)].map(v => +v.toFixed(1)),
            callouts: lost, links});
        }
        fragDetail.sort((a, b) => b.size - a.size);
      }
      const defI = near(C.meta.defender[0], C.meta.defender[2], C.meta.defender[1]);
      const spawnCids = (C.nav.spawnNodes || []).map(i => cid[i]);
      const before = measure(A), after = measure(pruned);
      return {map: C.key, nodes: N.length, playable: C.playable.reduce((n, v) => n + v, 0), eTotal,
              r45: {eBad: r45.eBad, eBadKept: r45.eBadKept, trap: r45.trap, after: r45.after, frags: r45.frags}, r45bad: r45.bad, artic, compSize, mainCid, defCid: cid[defI], spawnCids, fragDetail,
              r40: {eBad: r40.eBad, trap: r40.trap, after: r40.after, frags: r40.frags},
              ms: +(performance.now() - t0).toFixed(0), before, after: r45.after, fragSizes: (() => { const seen = new Uint8Array(N.length); const out = [];
        for (let i = 0; i < N.length; i++) { if (seen[i] || !C.playable[i]) continue; const q = [i]; seen[i] = 1; let size = 0;
          for (let k = 0; k < q.length; k++) { size++; for (const j of pruned[q[k]]) if (!seen[j] && C.playable[j]) { seen[j] = 1; q.push(j); } }
          out.push(size); }
        return out.sort((x, y) => y - x); })()};
    });
    console.log('AUDIT', JSON.stringify(r));
    console.log('BADEDGES', JSON.stringify(r.r45bad));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
