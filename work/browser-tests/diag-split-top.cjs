// Split stair-mouth isolation: can the player descend the long flight when starting
// k nodes BELOW the top? And what happens starting exactly AT the top node?
const fs = require('fs'), path = require('path');
const {serve, launch, boot, startDM} = require('./lib.cjs');
const NAV = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/public/worlds/split/navigation.json'), 'utf8'));
function longestFlight() {
  const N = NAV.nodes, valid = NAV.valid;
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
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'split'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    await p.evaluate(() => { window.__vs.player.hp = 1e9; });
    const descend = async (fromIdx, secs) => {
      const nodes = flight.slice(0, fromIdx + 1).reverse(); // start at fromIdx, walk toward base
      const f = nodes[0];
      await p.evaluate(([f, t]) => { window.__vs.setPos(f.x, f.y + .1, f.z); window.__vs.aimAt(t.x, t.y + 1, t.z); window.__vs.player.hp = 1e9; }, [f, nodes[1] || f]);
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
    const top = flight.length - 1;
    const fromTop = await descend(top, 12);
    console.log(el(), 'from TOP node', top, '-> end', JSON.stringify(fromTop.map(v=>+v.toFixed(2))), '(start y', flight[top].y.toFixed(2) + ')');
    const fromMid = await descend(top - 3, 25);
    console.log(el(), 'from node', top - 3, '-> end', JSON.stringify(fromMid.map(v=>+v.toFixed(2))), '(start y', flight[top-3].y.toFixed(2), 'base y', flight[0].y.toFixed(2) + ')');
    // What does the nav say around the top node? adjacency + any other nodes within 2m of the mouth.
    const mouth = flight[top];
    const near = [];
    for (let i = 0; i < NAV.nodes.length; i++) { const n = NAV.nodes[i];
      const d = Math.hypot(n[0]-mouth.x, n[2]-mouth.z);
      if (d < 2.5) near.push([i, +n[0].toFixed(2), +n[1].toFixed(2), +n[2].toFixed(2), NAV.valid ? NAV.valid[i] : 1]); }
    console.log('top node idx', flight[top].i, 'adj', JSON.stringify(NAV.adj[flight[top].i]), 'nearby nodes', JSON.stringify(near));
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 220)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
