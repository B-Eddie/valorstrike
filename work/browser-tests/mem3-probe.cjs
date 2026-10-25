// Full-native DM with the low-preset texture cap (vs.gq=low): survival, RSS, startup time, frame progress.
const {serve, launch, boot, startDM} = require('./lib.cjs');
const {execSync} = require('child_process');
function rss() {
  try {
    const out = execSync("ps -eo rss,comm | awk '$2==\"chrome\"{print $1}'", {encoding:'utf8'});
    return Math.round(out.trim().split('\n').map(Number).filter(Boolean).reduce((a,b)=>a+b,0)/1024);
  } catch(e) { return -1; }
}
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'heavy'});
  try {
    await p.addInitScript(() => { try { localStorage.setItem('vs.gq', 'low'); } catch(e){} });
    await boot(p); console.log(el(), 'booted rss', rss()+'MB');
    let crashed = false;
    p.on('crash', () => { crashed = true; console.log(el(), 'TAB CRASH, rss', rss()+'MB'); });
    const startAt = Date.now();
    startDM(p).catch(e => console.log(el(), 'startDM err', String(e).slice(0,100)));
    let f0 = -1, ft0 = 0;
    for (let i = 0; i < 12; i++) {
      await p.waitForTimeout(2000);
      if (crashed) break;
      let st = null;
      try {
        st = await p.evaluate(() => { try { const s = window.__vs.state(); return {run: s.running, xnf: s.xnf}; } catch(e) { return null; } });
      } catch (e) { console.log(el(), 'EVAL FAIL', String(e).slice(0,80)); break; }
      if (i % 3 === 0 || (st && st.run)) console.log(el(), 'rss', rss()+'MB', JSON.stringify(st));
      if (st && st.run) {
        console.log(el(), 'DM RUNNING full-native with texture cap; startup', ((Date.now()-startAt)/1000).toFixed(0)+'s', 'rss', rss()+'MB');
        f0 = st.xnf; ft0 = Date.now(); await p.waitForTimeout(8000);
        const st2 = await p.evaluate(() => window.__vs.state().xnf).catch(()=>null);
        if (st2 != null) console.log(el(), 'rendered frames over 10s wall:', st2 - f0, '(~'+((st2-f0)/10).toFixed(1)+'fps SwiftShader)');
        break;
      }
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close().catch(()=>{}); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
