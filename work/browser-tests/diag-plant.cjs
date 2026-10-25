const MAP = process.env.MAP || 'breeze';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0.1; });
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const C = window.xNativeMaps.state.current, FV = window.__vs.FV, out = {siteGoals: {}, plants: {}};
      for (const k of Object.keys(C.siteGoals || {})) {
        out.siteGoals[k] = C.siteGoals[k];
        out.plants[k] = window.__vs ? true : true;
      }
      const car = FV.sp && FV.sp.c;
      out.carrier = car ? car.name : null; out.spike = {st: FV.sp.st, site: FV.sp.site};
      // verify each site goal is in-zone via the same inSite the plant tick uses
      out.inZone = {};
      for (const k of Object.keys(C.siteGoals || {})) {
        const g = C.siteGoals[k];
        out.inZone[k] = (function(){ try { return (window.xNativeMaps && C.plants) ? (function(x,z){const t=C.meta.transform,pr=C.meta.apiProjection,ca=Math.cos(t.angle),sa=Math.sin(t.angle),sx=ca*x-sa*z+t.cx,sz=sa*x+ca*z+t.cz,u=Math.floor((sx*100*pr.xMultiplier+pr.xScalarToAdd)*1024),v=Math.floor((-sz*100*pr.yMultiplier+pr.yScalarToAdd)*1024);for(const row of C.plants.rows[v]||[])if(u>=row[0]&&u<row[1])return row[2];return undefined;})(g[0],g[1]) : 'no-plants'; } catch(e){ return 'err'; } })();
      }
      return out;
    });
    console.log('INFO', JSON.stringify(info));
    // teleport the carrier to the B (or first available) site goal and watch the plant tick
    const r = await p.evaluate(() => {
      const C = window.xNativeMaps.state.current, FV = window.__vs.FV, vs = window.__vs;
      const site = FV.sp.site && C.siteGoals[FV.sp.site] ? FV.sp.site : Object.keys(C.siteGoals)[0];
      const g = C.siteGoals[site], car = FV.sp.c;
      if (!car || !g) return {err: 'no carrier or goal', site};
      car.g.position.set(g[0], 8, g[1]); car.np = null; car.xr = [];
      return {site, goal: g, carrier: car.name};
    });
    console.log('TELEPORT', JSON.stringify(r));
    for (let i = 0; i < 10; i++) {
      await p.waitForTimeout(1000);
      const s = await p.evaluate(() => ({st: window.__vs.FV.sp.st, pt: +(window.__vs.FV.sp.pt || 0).toFixed(2), site: window.__vs.FV.sp.site}));
      console.log('tick', JSON.stringify(s));
      if (s.st === 'plant') { console.log('PLANTED OK'); break; }
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
