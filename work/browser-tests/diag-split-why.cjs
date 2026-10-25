// Why does the split descent freeze mid-flight? Safe-place at node 12 (nmHeight, like nmPlace),
// walk down, and log what the client collision reports ahead of the capsule at each sample.
const fs = require('fs'), path = require('path');
const {serve, launch, boot, startDM} = require('./lib.cjs');
const NAV = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/public/worlds/split/navigation.json'), 'utf8'));
const N = NAV.nodes, valid = NAV.valid;
const CHAIN=[9360,9301,9240,9178,9130,9090,9045,8988,8925,8849,8770,8684,8592,8496,8393,8294,8193,8104,8021,7941,7870,7809,7778];
(async()=>{
  const flight = CHAIN.map((i) => ({ i, x: N[i][0], y: N[i][1], z: N[i][2] }));
  const path = flight.slice(12).reverse().concat([]); // from node 12 down to base... reversed: [n12..n0]? no: flight.slice(0,13).reverse()
  const walkNodes = flight.slice().reverse(); // full descent from the plateau node
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'split'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    const caps = await p.evaluate(() => ({ nmActive: typeof nmActive, xnm: typeof window.xNativeMaps, heightFn: window.xNativeMaps && typeof window.xNativeMaps.height }));
    console.log('caps', JSON.stringify(caps));
    const f = walkNodes[0], t = walkNodes[1];
    const placed = await p.evaluate(([f, t]) => {
      const C = window.xNativeMaps.state.current; const y = window.xNativeMaps.height(C, f.x, f.z, f.y);
      window.__vs.setPos(f.x, y + .02, f.z); window.__vs.aimAt(t.x, t.y + 1, t.z); window.__vs.player.hp = 1e9;
      return { navY: f.y, bvhY: y };
    }, [f, t]);
    console.log('placed', JSON.stringify(placed));
    await p.keyboard.down('KeyW');
    const tEnd = Date.now() + 50000; let lastLog = 0;
    while (Date.now() < tEnd) {
      const s = await p.evaluate(() => {
        const q = window.__vs.state().player; if (!q) return null;
        try { window.__vs.bots.forEach((bb) => { if (bb.alive) window.__vs.kill(bb); }); } catch (e) {}
        const C = window.xNativeMaps.state.current;
        const g = window.xNativeMaps.height(C, q[0], q[2], q[1]);
        // probe blocked() at the position and 0.3 ahead in -x (descent direction is +x here: nodes go 26.5 -> 35.5)
        const bl0 = window.xNativeMaps.blocked(C, q[0], q[2], .4, q[1], 1.8);
        const blA = window.xNativeMaps.blocked(C, q[0] + .3, q[2], .4, q[1], 1.8);
        const gA = window.xNativeMaps.height(C, q[0] + .3, q[2], q[1]);
        return [q[0], q[1], q[2], g, bl0 ? 1 : 0, blA ? 1 : 0, gA];
      });
      if (s && Date.now() - lastLog > 400) { lastLog = Date.now();
        console.log(s.map((v) => typeof v === 'number' ? +v.toFixed(2) : v).join(','));
        let ni = 0, nd = 1e9;
        for (let i = 0; i < walkNodes.length; i++) { const d = Math.hypot(s[0]-walkNodes[i].x, s[2]-walkNodes[i].z); if (d < nd) { nd = d; ni = i; } }
        const tt = walkNodes[Math.min(ni + 1, walkNodes.length - 1)];
        await p.evaluate((tt) => window.__vs.aimAt(tt.x, tt.y + 1, tt.z), tt); }
      await new Promise(r => setTimeout(r, 100));
    }
    await p.keyboard.up('KeyW');
  } catch (e) { console.log('PROBE-FAIL', String(e).slice(0, 200)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
