// Verify a capsule-valid route now exists from attacker spawn into A Sewer through the connector.
const MAP = 'split';
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'light', viewport:{width:320, height:180}});
  try {
    await boot(p);
    await p.evaluate((m) => { window.__vs.FV.pick = m; window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); }, MAP);
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    const r = await p.evaluate(() => {
      const X = window.xNativeMaps, C = X.state.current, N = C.nav.nodes;
      const s = X.near(C, C.meta.attacker[0], C.meta.attacker[2], C.meta.attacker[1]);
      const e = X.near(C, 36.25, 19, 3.02); // deepest sewer node
      const path = X.path(C, s, e);
      if (!path.length) return {ok: false};
      const badHops = [];
      for (let i = 0; i + 1 < path.length; i++) {
        const a = N[path[i]], b2 = N[path[i + 1]];
        const pa = {x: a[0], y: a[1], z: a[2]}, n = b2;
        // runtime hop semantics: first edge drop-tolerant, rest strict
        const ok = (i === 0 ? true : true);
        const seg = (function(){const d=Math.hypot(n[0]-pa.x,n[2]-pa.z),steps=Math.max(1,Math.ceil(d/.18));let y=pa.y;
          for(let k=1;k<=steps;k++){const x=pa.x+(n[0]-pa.x)*k/steps,z=pa.z+(n[2]-pa.z)*k/steps,h=X.height(C,x,z,y);
            if(h-y>.321||(i>0&&y-h>.35)||X.blocked(C,x,z,.45,Math.max(y,h)+.32))return false;y=h;}return true;})();
        if (!seg) badHops.push([path[i], path[i + 1]]);
      }
      return {ok: true, hops: path.length - 1, badHops: badHops.length, badSample: badHops.slice(0, 5),
              viaConnector: path.includes(11726) || path.includes(11727) || path.includes(11728),
              end: N[path[path.length - 1]].map(v => +v.toFixed(1))};
    });
    console.log('SEWPATH', JSON.stringify(r));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
