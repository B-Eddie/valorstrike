// Split round-trip WITHOUT teleporting to the top node: walk from the base through the flight
// aiming past the top at a plateau node, then walk back down from wherever we stand.
const fs = require('fs'), path = require('path');
const {serve, launch, boot, startDM} = require('./lib.cjs');
const NAV = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/public/worlds/split/navigation.json'), 'utf8'));
const N = NAV.nodes, valid = NAV.valid;
function longestFlight() {
  const rising = new Map();
  for (let a = 0; a < N.length; a++) { if (valid && !valid[a]) continue;
    for (const b of NAV.adj[a]) { if (valid && !valid[b]) continue;
      const dy = N[b][1]-N[a][1], dh = Math.hypot(N[b][0]-N[a][0], N[b][2]-N[a][2]);
      if (dy > .12 && dy < .42 && dh < 1.6) { if (!rising.has(a)) rising.set(a, []); rising.get(a).push(b); } } }
  let best = null;
  const walk = (start) => { const chain=[start]; let cur=start;
    while (rising.has(cur) && rising.get(cur).length) { const nx = rising.get(cur)[0]; if (chain.includes(nx)) break; chain.push(nx); cur=nx; }
    return chain; };
  for (const a of rising.keys()) { const c = walk(a); if (!best || c.length > best.length) best = c; }
  return best.map((i) => ({ i, x: N[i][0], y: N[i][1], z: N[i][2] }));
}
(async()=>{
  const flight = longestFlight();
  // Plateau target: valid node ~2-3m past the top node, continuing the flight's direction.
  const top = flight[flight.length-1], prev = flight[flight.length-2];
  const dx = top.x - prev.x, dz = top.z - prev.z, dl = Math.hypot(dx, dz) || 1;
  const px = top.x + dx / dl * 2.5, pz = top.z + dz / dl * 2.5;
  let plat = null, pd = 1e9;
  for (let i = 0; i < N.length; i++) { if (valid && !valid[i]) continue;
    const d = Math.hypot(N[i][0]-px, N[i][2]-pz);
    if (d < pd && Math.abs(N[i][1]-top.y) < .4) { pd = d; plat = { i, x: N[i][0], y: N[i][1], z: N[i][2] }; } }
  console.log('flight', flight.length, 'nodes; plateau target', JSON.stringify(plat));
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'split'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    await p.evaluate(() => { window.__vs.player.hp = 1e9; });
    const walkPath = async (nodes, secs, teleport) => {
      if (teleport) { const f = nodes[0];
        await p.evaluate(([f, t]) => { window.__vs.setPos(f.x, f.y + .1, f.z); window.__vs.aimAt(t.x, t.y + 1, t.z); window.__vs.player.hp = 1e9; }, [f, nodes[1] || f]); }
      await p.keyboard.down('KeyW');
      const tEnd = Date.now() + secs * 1000; let last = null;
      while (Date.now() < tEnd) { const s = await p.evaluate(() => { const q = window.__vs.state().player; try { window.__vs.bots.forEach((bb) => { if (bb.alive) window.__vs.kill(bb); }); } catch (e) {} return q && [q[0], q[1], q[2]]; });
        if (s) { last = s;
          let ni = 0, nd = 1e9;
          for (let i = 0; i < nodes.length; i++) { const d = Math.hypot(s[0]-nodes[i].x, s[2]-nodes[i].z); if (d < nd) { nd = d; ni = i; } }
          const t = nodes[Math.min(ni + 1, nodes.length - 1)];
          await p.evaluate((t) => window.__vs.aimAt(t.x, t.y + 1, t.z), t); }
        await new Promise(r => setTimeout(r, 100)); }
      await p.keyboard.up('KeyW');
      return last;
    };
    const upPath = plat ? flight.concat([plat]) : flight;
    const upEnd = await walkPath(upPath, 20, true);
    console.log(el(), 'UP end', JSON.stringify(upEnd.map(v=>+v.toFixed(2))), 'top', JSON.stringify(top), 'platY', plat && plat.y.toFixed(2));
    const onPlateau = plat && Math.hypot(upEnd[0]-plat.x, upEnd[2]-plat.z) < 1.2;
    console.log(el(), 'reached plateau:', !!onPlateau);
    const dnEnd = await walkPath(flight.slice().reverse(), 40, false); // NO teleport: walk back from where we stand
    const base = flight[0];
    const home = Math.hypot(dnEnd[0]-base.x, dnEnd[2]-base.z) < 1.8 && Math.abs(dnEnd[1]-base.y) < .5;
    console.log(el(), 'DOWN end', JSON.stringify(dnEnd.map(v=>+v.toFixed(2))), 'base', JSON.stringify(base), 'home', home);
    console.log(onPlateau && home ? 'ROUNDTRIP PASS' : 'ROUNDTRIP FAIL');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 220)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
