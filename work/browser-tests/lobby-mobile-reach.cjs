// Mobile/small-viewport lobby reachability: tabs, START, mode cards, online controls.
// Offline (no wrangler): lobby panels only, no match start.
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
(async () => {
  const V = process.env.VIEW || '390x844';
  const [w, h] = V.split('x').map(Number);
  const srv = await serve();
  const {b, p} = await launch({profile:'light', viewport:{width:w, height:h}});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); });
  await p.click('#playBtn').catch(e => console.log('playBtn click fail', e.message.slice(0,80)));
  await p.waitForSelector('#xQueue:not([hidden])', {timeout: 15000}).catch(()=>{});
  const d = await p.evaluate(() => {
    const vis = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { vis: cs.display !== 'none' && cs.visibility !== 'hidden', rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], inV: r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }; };
    const hit = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return t === e || e.contains(t); };
    const tabs = [...document.querySelectorAll('#xQueue [role=tab]')].map(t => ({ id: t.textContent.trim().slice(0,14), ...vis(t), hit: hit(t) }));
    const rot = document.getElementById('rot');
    return { vw: innerWidth, vh: innerHeight,
      rot: rot ? { display: getComputedStyle(rot).display, text: (rot.textContent||'').trim().slice(0,40) } : null,
      queueOpen: !document.getElementById('xQueue').hidden,
      start: vis(document.querySelector('.x-qplay')), startHit: hit(document.querySelector('.x-qplay')),
      tabs, online: vis(document.getElementById('xOn')), quick: vis(document.getElementById('xOnQuick')), quickHit: hit(document.getElementById('xOnQuick')) };
  });
  console.log(el(), V, JSON.stringify(d, null, 1));
  await p.screenshot({path: '/tmp/reach_' + V + '.png'});
  console.log(el(), 'screenshot /tmp/reach_' + V + '.png');
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('REACH FAIL', e.message); process.exit(1); });
