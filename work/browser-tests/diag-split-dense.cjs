// Dense-sample the split descent stall: start at flight node 12, walk down, log every sample.
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
  const rev = flight.slice().reverse(); // walk from node 12 down to base
  const startIdx = flight.length - 1 - 12; // reversed index of flight node 12
  const path = rev.slice(startIdx);
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'split'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    const f = path[0];
    await p.evaluate(([f, t]) => { window.__vs.setPos(f.x, f.y + .1, f.z); window.__vs.aimAt(t.x, t.y + 1, t.z); window.__vs.player.hp = 1e9; }, [f, path[1]]);
    await p.keyboard.down('KeyW');
    const out = [];
    const tEnd = Date.now() + 30000;
    while (Date.now() < tEnd) {
      const s = await p.evaluate(() => { const q = window.__vs.state().player; try { window.__vs.bots.forEach((bb) => { if (bb.alive) window.__vs.kill(bb); }); } catch (e) {} return q && [q[0], q[1], q[2]]; });
      if (s) { let ni = 0, nd = 1e9;
        for (let i = 0; i < path.length; i++) { const d = Math.hypot(s[0]-path[i].x, s[2]-path[i].z); if (d < nd) { nd = d; ni = i; } }
        out.push([+s[0].toFixed(2), +s[1].toFixed(2), +s[2].toFixed(2), ni]);
        const t = path[Math.min(ni + 1, path.length - 1)];
        await p.evaluate((t) => window.__vs.aimAt(t.x, t.y + 1, t.z), t); }
      await new Promise(r => setTimeout(r, 100));
    }
    await p.keyboard.up('KeyW');
    for (const r of out) console.log(r.join(','));
    console.log('base', JSON.stringify(flight[0]));
  } catch (e) { console.log('PROBE-FAIL', String(e).slice(0, 200)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
