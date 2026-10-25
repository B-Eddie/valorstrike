// Heavy profile + real DM start via UI: sample heap + chrome process RSS until crash or running.
const {serve, launch, boot, startDM} = require('./lib.cjs');
const {execSync} = require('child_process');
function rss() {
  try {
    const out = execSync("ps -o rss= -C chrome 2>/dev/null || ps -eo rss,comm | awk '$2==\"chrome\"{print $1}'", {encoding:'utf8'});
    const kb = out.trim().split('\n').map(Number).filter(Boolean).reduce((a,b)=>a+b,0);
    return Math.round(kb/1024);
  } catch(e) { return -1; }
}
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'heavy'});
  try {
    await boot(p); console.log(el(), 'booted rss', rss()+'MB');
    let crashed = false;
    p.on('close', () => { crashed = true; });
    p.on('crash', () => { crashed = true; console.log(el(), 'TAB CRASH event'); });
    startDM(p).catch(e => console.log(el(), 'startDM err', String(e).slice(0,120)));
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(2000);
      if (crashed) { console.log(el(), 'CRASHED, rss', rss()+'MB'); break; }
      let m = null, st = null;
      try {
        m = await p.evaluate(() => { const pm = performance.memory || {}; return Math.round((pm.usedJSHeapSize||0)/1048576); });
        st = await p.evaluate(() => { try { const s = window.__vs.state(); return s.running ? 'RUNNING' : 'lobby'; } catch(e) { return '?'; } });
      } catch (e) { console.log(el(), 'EVAL FAIL', String(e).slice(0,90), 'rss', rss()+'MB'); break; }
      if (i % 2 === 0 || st === 'RUNNING') console.log(el(), 'heap', m+'MB', 'rss', rss()+'MB', st);
      if (st === 'RUNNING') { console.log(el(), 'DM RUNNING in heavy'); break; }
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    await b.close().catch(()=>{}); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
