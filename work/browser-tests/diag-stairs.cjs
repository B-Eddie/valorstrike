// Live stairs walk: find the longest rising nav-edge chain on the map (a real flight), walk it
// with a held W key in a live headless DM, verify y rises smoothly (no stalls/falls), then walk
// back down. Player HP is pinned high so bot fire cannot interrupt the movement evidence.
const MAP = process.env.MAP || 'ascent';
const fs = require('fs'), path = require('path');
const {serve, launch, boot, startDM} = require('./lib.cjs');
const NAV = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/public/worlds/' + MAP + '/navigation.json'), 'utf8'));
function longestFlight() {
  const N = NAV.nodes, valid = NAV.valid;
  const rising = new Map(); // from -> [{to,dy}]
  for (let a = 0; a < N.length; a++) { if (valid && !valid[a]) continue;
    for (const b of NAV.adj[a]) { if (valid && !valid[b]) continue;
      const dy = N[b][1] - N[a][1], dh = Math.hypot(N[b][0] - N[a][0], N[b][2] - N[a][2]);
      if (dy > .12 && dy < .42 && dh < 1.6) { if (!rising.has(a)) rising.set(a, []); rising.get(a).push(b); } } }
  let best = null;
  const walk = (start) => { const chain = [start]; let cur = start;
    while (rising.has(cur) && rising.get(cur).length) { const nx = rising.get(cur)[0]; if (chain.includes(nx)) break; chain.push(nx); cur = nx; }
    return chain; };
  for (const a of rising.keys()) { const c = walk(a); if (!best || c.length > best.length) best = c; }
  return best && best.length >= 5 ? best.map((i) => ({ x: N[i][0], y: N[i][1], z: N[i][2] })) : null;
}
(async()=>{
  const flight = longestFlight();
  if (!flight) { console.log('STAIRS SKIP: no >=5-edge rising chain on', MAP); process.exit(0); }
  const rise = flight[flight.length-1].y - flight[0].y;
  console.log('flight:', flight.length, 'nodes, rise', rise.toFixed(2) + 'm', 'from', JSON.stringify(flight[0]), 'to', JSON.stringify(flight[flight.length-1]));
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  const t0 = Date.now(); const el = () => ((Date.now()-t0)/1000).toFixed(0) + 's';
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); }, MAP);
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    await p.evaluate(() => { window.__vs.player.hp = 1e9; }); // god-mode: bot fire must not interrupt movement evidence
    // Walk a node path, re-aiming each poll at the node just ahead (how a player follows stairs).
    const legPath = async (nodes, secs) => {
      const f = nodes[0];
      await p.evaluate(([f, t]) => { window.__vs.setPos(f.x, f.y + .1, f.z); window.__vs.aimAt(t.x, t.y + 1, t.z); window.__vs.player.hp = 1e9; }, [f, nodes[1] || f]);
      await p.keyboard.down('KeyW');
      const samples = [];
      const tEnd = Date.now() + secs * 1000;
      while (Date.now() < tEnd) { const s = await p.evaluate(() => { const q = window.__vs.state().player; try { window.__vs.bots.forEach((bb) => { if (bb.alive) window.__vs.kill(bb); }); } catch (e) {} return q && [q[0], q[1], q[2]]; });
        if (s) { samples.push(s);
          let ni = 0, nd = 1e9;
          for (let i = 0; i < nodes.length; i++) { const d = Math.hypot(s[0] - nodes[i].x, s[2] - nodes[i].z); if (d < nd) { nd = d; ni = i; } }
          const t = nodes[Math.min(ni + 1, nodes.length - 1)];
          await p.evaluate((t) => window.__vs.aimAt(t.x, t.y + 1, t.z), t); }
        await new Promise(r => setTimeout(r, 100)); }
      await p.keyboard.up('KeyW');
      return samples;
    };
    let up = await legPath(flight, Math.min(18, 2 + flight.length * .9));
    // One retry: a wandering bot can body-block the stair base (god-mode stops damage, not collision).
    const upGoal = flight[flight.length - 1];
    if (!up.some((q) => Math.hypot(q[0] - upGoal.x, q[2] - upGoal.z) < 1.6 && Math.abs(q[1] - upGoal.y) < .5)) {
      console.log(el(), 'up leg retry (bot interference suspected)');
      up = await legPath(flight, Math.min(18, 2 + flight.length * .9));
    }
    const upEnd = up[up.length - 1];
    let stall = 0;
    for (let i = 5; i < up.length; i++) { if (Math.hypot(up[i][0] - up[i-5][0], up[i][2] - up[i-5][2]) < .15 && up[i][1] < flight[flight.length-1].y - .3) stall++; }
    const goal = flight[flight.length - 1];
    const reached = up.some((s) => Math.hypot(s[0] - goal.x, s[2] - goal.z) < 1.6 && Math.abs(s[1] - goal.y) < .5);
    const minY = Math.min(...up.map((s) => s[1]));
    console.log(el(), 'up: y', up[0][1].toFixed(2), '->', upEnd[1].toFixed(2), 'goal y', goal.y.toFixed(2), 'reached', reached, 'stallSamples', stall, 'minY', minY.toFixed(2));
    let down = await legPath(flight.slice().reverse(), Math.min(45, 4 + flight.length * 1.6));
    const base = flight[0];
    const home = (q) => Math.hypot(q[0] - base.x, q[2] - base.z) < 1.8 && Math.abs(q[1] - base.y) < .5;
    if (!home(down[down.length - 1])) {
      console.log(el(), 'down leg retry (bot interference suspected)');
      down = await legPath(flight.slice().reverse(), Math.min(45, 4 + flight.length * 1.6));
    }
    const dnEnd = down[down.length - 1];
    const backHome = home(dnEnd);
    console.log(el(), 'down: y', down[0][1].toFixed(2), '->', dnEnd[1].toFixed(2), 'base y', base.y.toFixed(2), 'backHome', backHome);
    if (!reached) throw new Error('did not reach the top (end ' + JSON.stringify(upEnd.map(v=>+v.toFixed(1))) + ' vs goal ' + JSON.stringify(goal) + ')');
    if (stall > 4) throw new Error('stalled on the way up (' + stall + ' samples)');
    if (minY < flight[0].y - 1.5) throw new Error('fell off the flight (minY ' + minY.toFixed(2) + ')');
    if (!backHome) throw new Error('walk-back-down did not return to the base (end ' + JSON.stringify(dnEnd.map(v=>+v.toFixed(1))) + ')');
    console.log(el(), 'STAIRS DONE:', MAP, 'flight of', flight.length, 'nodes (+' + rise.toFixed(2) + 'm) walked up smoothly and back down in a live DM');
  } catch (e) { console.log(el(), 'PROBE-FAIL', String(e).slice(0, 220)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
