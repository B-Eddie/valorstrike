// Rendered Spike plant by the touch "4" button (offline five, 844x390 emulated touch):
// hold to plant (progress rises), release cancels (pt resets), re-hold completes the plant.
// Harness: spike assigned to the player and player teleported into the site (production carrier is random).
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'mid', viewport:{width:844, height:390}, touch:true});
  const cdp = await p.context().newCDPSession(p);
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'ascent'; });
  await p.evaluate(() => window.__vs.startFive());
  await p.waitForFunction(() => { const s = window.__vs.state(); return s.running && s.mode === 'five' && !s.dm && s.player; }, {timeout: 60000});
  const R = { checks: [] }; const ck = (name, ok, extra) => { R.checks.push({name, ok: !!ok, extra}); console.log(el(), (ok ? 'ok  ' : 'FAIL'), name, extra === undefined ? '' : JSON.stringify(extra)); };
  await wait(1500);
  await p.waitForFunction(() => !window.__vs.state().xLdOn, {timeout: 60000}).catch(() => console.log(el(), 'WARN xLd still visible'));
  const dtext = () => p.evaluate(() => { const d = document.getElementById('defuse'); return { shown: d && d.style.display !== 'none', text: d && d.firstChild ? d.firstChild.textContent : '', pt: window.__vs.FV.sp && +(+window.__vs.FV.sp.pt).toFixed(2), st: window.__vs.FV.sp && window.__vs.FV.sp.st }; });
  // harness: make the player the carrier, skip buy phase, stand on a site (try generic A then Ascent A)
  const goals = await p.evaluate(() => window.__vs.siteGoals());
  console.log(el(), 'siteGoals', JSON.stringify(goals));
  const g = goals && (goals.A || goals.B || goals.C);
  if (g) await p.evaluate((g) => { const FV = window.__vs.FV; FV.buy = 0; FV.sp.st = 'carry'; FV.sp.c = window.__vs.player; window.__vs.setPos(g[0], 0, g[1]); }, g);
  else await p.evaluate(() => { const FV = window.__vs.FV; FV.buy = 0; FV.sp.st = 'carry'; FV.sp.c = window.__vs.player; window.__vs.setPos(-20, 0, -21); });
  await wait(800);
  let d0 = await dtext();
  if (!(d0.shown && d0.text.includes('Hold 4'))) { await p.evaluate(() => window.__vs.setPos(-31.7, 0, -19.4)); await wait(800); d0 = await dtext(); }
  ck('in site: "Hold 4 to plant" shows', d0.shown && d0.text.includes('Hold 4'), d0);
  const pb = await p.evaluate(() => { const e = document.querySelector('#xT .tb[data-k="plant"]'); if (!e) return null; const r = e.getBoundingClientRect(); const off = e.classList.contains('off'); const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return { w: Math.round(r.width), off, hitOk: hit === e || e.contains(hit), x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; });
  ck('touch plant button present/usable in five', pb && pb.w > 30 && !pb.off, pb);
  // hold -> planting progresses
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x: pb.x, y: pb.y, id: 1}]});
  await wait(1300);
  const d1 = await dtext();
  ck('hold: "Planting" + progress', d1.text.startsWith('Planting') && d1.pt > 0.3, d1);
  await p.screenshot({path: '/tmp/spike_planting.png'});
  // release -> cancel
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await wait(400);
  const d2 = await dtext();
  ck('release cancels (pt reset, prompt back)', d2.pt === 0 && d2.text.includes('Hold 4'), d2);
  // re-hold to completion
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x: pb.x, y: pb.y, id: 2}]});
  let d3 = null;
  for (let i = 0; i < 40; i++) { await wait(300); d3 = await dtext(); if (d3.st === 'plant') break; }
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  ck('re-hold completes the plant', d3 && d3.st === 'plant', d3);
  R.pass = R.checks.every(c => c.ok);
  console.log(el(), 'RESULT', JSON.stringify({pass: R.pass, failed: R.checks.filter(c => !c.ok).map(c => c.name)}));
  await b.close(); srv.close(); process.exit(R.pass ? 0 : 1);
})().catch(e => { console.log('SPIKE FAIL', e.message); process.exit(1); });
