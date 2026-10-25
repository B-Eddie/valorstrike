// Bind teleporter + 5v5 round-flow probe on the light map path.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'bind'; window.__vs.startDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), 'bind dm running');
    // teleport the player into a teleporter entrance, wait past the 400ms dwell, expect an exit move
    const tp = await p.evaluate(async () => {
      const C = window.xNativeMaps.state.current;
      const find = n => C.meta.callouts.find(c=>c.name===n).position;
      const entry = find('A Teleporter'), exit = find('B Exit');
      const P = window.__vs.player;
      P.x = entry[0]; P.z = entry[2]; P.y = window.xNativeMaps.height(C, entry[0], entry[2]);
      const start = [P.x, P.y, P.z];
      await new Promise(r => setTimeout(r, 3000));
      const dEntry = Math.hypot(P.x - entry[0], P.z - entry[2]);
      const dExit = Math.hypot(P.x - exit[0], P.z - exit[2]);
      return {start: start.map(v=>+v.toFixed(1)), now: [P.x, P.y, P.z].map(v=>+v.toFixed(1)), dEntry: +dEntry.toFixed(1), dExit: +dExit.toFixed(1)};
    });
    console.log(el(), 'TP', JSON.stringify(tp));
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,6)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,6)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
