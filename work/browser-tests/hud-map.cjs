// Whole-HUD map: measure every fixed HUD panel + every touch button at coarse/short sizes,
// report ALL pairwise rect intersections (allowlist: designed container/child + same-cluster pairs).
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const MODE = process.env.HUDMODE || 'five';
  const VIEW = (process.env.VIEW || '844x390').split('x').map(Number);
  const {b, p} = await launch({profile:'mid', viewport:{width:VIEW[0], height:VIEW[1]}, touch:true});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'ascent'; });
  await p.evaluate((MODE) => MODE === 'dm' ? window.__vs.startDM() : window.__vs.startFive(), MODE);
  await p.waitForFunction((MODE) => { const s = window.__vs.state(); return s.running && s.player && (MODE !== 'dm' || s.dm); }, {timeout: 60000}, MODE);
  await wait(1500);
  await p.waitForFunction(() => !window.__vs.state().xLdOn, {timeout: 60000}).catch(() => console.log(el(), 'WARN xLd'));
  const map = await p.evaluate(() => {
    const out = {};
    const grab = (name, e) => { if (!e) return; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05) out[name] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    grab('minimap', document.getElementById('xMap'));
    grab('scores', document.querySelector('#game .hud.x-top'));
    grab('subtitle', document.getElementById('xSub'));
    grab('feed', document.querySelector('#game .hud.x-fw'));
    grab('credits', document.getElementById('xCr'));
    grab('ammo', document.querySelector('#game .hud.x-br'));
    grab('vitals', document.querySelector('#game .hud.x-bl'));
    grab('abilities', document.querySelector('#game .x-ab'));
    grab('hint', document.getElementById('hint'));
    grab('standings', document.querySelector('.x-dmlb'));
    document.querySelectorAll('#xT .tb').forEach(t => grab('tb:' + t.dataset.k, t));
    return out;
  });
  const ks = Object.keys(map);
  console.log(el(), 'MAP', MODE, VIEW.join('x'), JSON.stringify(map));
  const same = (a, b) => { const A = a.split(':')[0], B = b.split(':')[0]; return A === 'tb' && B === 'tb'; }; // touch cluster is fit()-managed
  const hits = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const A = map[ks[i]], B = map[ks[j]];
    if (same(ks[i], ks[j])) continue;
    if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) hits.push([ks[i], ks[j], A, B]);
  }
  console.log(el(), 'OVERLAPS', JSON.stringify(hits));
  await p.screenshot({path: '/tmp/hudmap_' + MODE + '_' + VIEW[0] + 'x' + VIEW[1] + '.png'});
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('MAP FAIL', e.message); process.exit(1); });
