// Live corroboration: client collision at the lotus under-overhang nodes vs upper level.
const {serve, launch, boot, startDM} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid', viewport:{width:640, height:360}});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'lotus'; window.__vs.light(true); window.__vs.agents(false); });
    await startDM(p);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 120000, polling: 1000});
    const r = await p.evaluate(() => {
      const C = window.xNativeMaps.state.current, X = window.xNativeMaps;
      const pts = [[3628,-12,4.95,-9.3],[3629,-12,4.95,-8.5],[3630,-12,4.95,-7.8],[3631,-12,4.95,-7],[3712,-11.3,4.95,-10.8],[3627,-12,5.34,-10]];
      const out = [];
      for (const [i,x,y,z] of pts) {
        const g = X.height(C, x, z, y + .3);
        // ceiling above the node ground
        const ray = new THREE.Ray(new THREE.Vector3(x, g + .01, z), new THREE.Vector3(0, 1, 0));
        const hit = C.bvh.raycastFirst(ray, THREE.DoubleSide);
        const ceil = hit ? g + hit.distance : null;
        out.push({ i, ground: +g.toFixed(3), ceil: ceil && +ceil.toFixed(3), clearance: ceil && +(ceil - g).toFixed(3),
          blocked18: X.blocked(C, x, z, .4, g, 1.8), blocked135: X.blocked(C, x, z, .4, g, 1.35), blocked110: X.blocked(C, x, z, .4, g, 1.1) });
      }
      return out;
    });
    for (const row of r) console.log(JSON.stringify(row));
  } catch (e) { console.log('PROBE-FAIL', String(e).slice(0, 200)); process.exitCode = 1; }
  finally { console.log('ERRORS', JSON.stringify(errors.slice(0,6))); await b.close(); srv.close(); }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
