// Tab-strip swipe verification at 844x390 (touch): drag the strip, then ESCALATION and CUSTOM
// must become tappable and activate; the X close button must remain usable.
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'light', viewport:{width:844, height:390}, touch:true});
  const cdp = await p.context().newCDPSession(p);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); });
  await p.click('#playBtn');
  await p.waitForSelector('#xQueue:not([hidden])', {timeout: 15000});
  const strip = () => p.evaluate(() => { const s = document.querySelector('#xQueue .x-qtabs'); return { sl: s.scrollLeft, sw: s.scrollWidth, cw: s.clientWidth }; });
  const tabState = (name) => p.evaluate((name) => { const t = [...document.querySelectorAll('#xQueue [role=tab]')].find(x => x.textContent.trim().startsWith(name)); if (!t) return null; const r = t.getBoundingClientRect(); const s = document.querySelector('#xQueue .x-qtabs').getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width/2, s.left + 4), s.right - 4), cy = r.top + r.height/2;
    const hit = document.elementFromPoint(cx, cy);
    return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], clipRight: Math.round(s.right), tapX: Math.round(cx), tapY: Math.round(cy), hitOk: hit === t || t.contains(hit), on: t.classList.contains('on') }; }, name);
  console.log(el(), 'strip before', JSON.stringify(await strip()));
  // swipe left on the strip (drag right-to-left over the tab area, avoiding the X at ~800)
  await touch('touchStart', [{x: 700, y: 110, id: 1}]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{x: 700 - i*70, y: 110, id: 1}]); await wait(40); }
  await touch('touchEnd', []);
  await wait(300);
  const slAfter = (await strip()).sl;
  console.log(el(), 'strip after swipe', JSON.stringify(await strip()));
  const esc = await tabState('ESCALATION');
  console.log(el(), 'ESCALATION', JSON.stringify(esc));
  if (esc && esc.hitOk) { await touch('touchStart', [{x: esc.tapX, y: esc.tapY, id: 2}]); await wait(60); await touch('touchEnd', []); await wait(300); }
  const escOn = (await tabState('ESCALATION')).on;
  const card = await p.evaluate(() => { const panes = [...document.querySelectorAll('.x-qp')].map(q => ({ id: q.id, hidden: q.hidden, display: getComputedStyle(q).display })); const vis = [...document.querySelectorAll('.x-qp')].find(q => !q.hidden && getComputedStyle(q).display !== 'none'); const h = vis ? vis.querySelector('.x-qcard h3') : null; return { n: panes.length, panes, card: h ? h.textContent : null }; });
  console.log(el(), 'ESCALATION on after tap:', escOn, '| panes:', JSON.stringify(card));
  const cus = await tabState('CUSTOM');
  console.log(el(), 'CUSTOM', JSON.stringify(cus));
  if (cus && cus.hitOk) { await touch('touchStart', [{x: cus.tapX, y: cus.tapY, id: 3}]); await wait(60); await touch('touchEnd', []); await wait(300); }
  const cusOn = (await tabState('CUSTOM')).on;
  console.log(el(), 'CUSTOM on after tap:', cusOn);
  // X still usable
  const xr = await p.evaluate(() => { const x = document.querySelector('#xQueue .x-qx'); const r = x.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; });
  await touch('touchStart', [{x: xr.x, y: xr.y, id: 4}]); await wait(60); await touch('touchEnd', []);
  await wait(300);
  const closed = await p.evaluate(() => document.getElementById('xQueue').hidden);
  const slNow = (await strip()).sl;
  console.log(el(), 'RESULT', JSON.stringify({ swiped: slAfter > 50, slNow, escOn, cusOn, closed, pass: slAfter > 50 && escOn && cusOn && closed }));
  await p.screenshot({path: '/tmp/tab_swipe.png'});
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('SWIPE FAIL', e.message); process.exit(1); });
