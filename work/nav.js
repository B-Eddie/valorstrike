// Nav-graph audit for Bind + Haven: runs the page's own xgBuild (0.8 m clearance, 45 m cap, forced XG_SPEC links)
// on each map's box list, counts components, and checks every spawn + Spike pad snaps to the main component.
"use strict";
const vm = require("vm");
module.exports = function navAudit(context) {
  const out = vm.runInContext(`(() => {
    const { FMAP, SITES, HSITES, xgBuild, xgClear, setB, getB } = __nav;
    const keep = getB(), keepS = Object.assign({}, SITES), res = [];
    const pads = { bind: { A: [-20, -21], B: [20, -21] }, haven: HSITES, split: __nav.SSITES, lotus: __nav.LSITES, breeze: __nav.BZSITES };
    for (const k of ["bind", "haven", "split", "lotus", "breeze"]) {
      setB(FMAP[k].boxes); for (const s in SITES) delete SITES[s]; Object.assign(SITES, pads[k]);
      const G = xgBuild(k), pts = Object.assign({ "Atk spawn": [0, 35], "Def spawn": [0, -35] }, pads[k]), miss = [];
      for (const n in pts) { const [x, z] = pts[n]; let bi = -1, bd = 1e9; G.N.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0 || bd > 8 || !G.ok[bi]) miss.push(n + (bi < 0 ? "" : " (" + bd.toFixed(1) + " m, " + (G.ok[bi] ? "main" : "split") + ")")); }
      const split = G.N.filter((_, i) => !G.ok[i]).map((p) => "[" + p.map((v) => +v.toFixed(2)).join(",") + "]");
      // if split: greedily pick 1 m grid points (0.8 m clear) that join the most components, as the fewest nav points to add
      const fix = [];
      if (G.nc > 1) {
        const U = G.N.map(() => []); G.adj.forEach((l, u) => l.forEach(([v]) => { U[u].push(v); U[v].push(u); }));
        const cp = G.N.map(() => -1); let c = 0;
        G.N.forEach((_, s) => { if (cp[s] >= 0) return; const st = [s]; cp[s] = c; while (st.length) U[st.pop()].forEach((v) => { if (cp[v] < 0) { cp[v] = c; st.push(v); } }); c++; });
        const P = [...Array(c).keys()], f = (x) => (P[x] === x ? x : (P[x] = f(P[x]))), live = () => new Set(cp.map(f)).size;
        const nodes = G.N.map((p, i) => [p, i]);
        for (let guard = 0; live() > 1 && guard < 6; guard++) {
          let best = null;
          for (let x = -29; x <= 29; x++) for (let z = -39; z <= 39; z++) {
            if (!xgClear(x, z, x, z, 0.8)) continue;
            const hit = new Set(); nodes.forEach(([p, i]) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d > 0.1 && d <= 45 && xgClear(x, z, p[0], p[1], 0.8)) hit.add(f(cp[i])); });
            if (hit.size > 1 && (!best || hit.size > best.h.size)) best = { x, z, h: hit };
          }
          if (!best) break; const r = [...best.h]; r.slice(1).forEach((q) => (P[q] = r[0])); fix.push([best.x, best.z]);
        }
      }
      res.push({ k, nodes: G.N.length, nc: G.nc, miss, checked: Object.keys(pts), split, fix });
    }
    setB(keep); for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS);
    return JSON.stringify(res);
  })()`, context);
  return JSON.parse(out);
};
