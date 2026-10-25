// Coordinated HUD coexistence: FIRST BLOOD ann + kill feed + toast + KILLED BY card at once.
// Measures container rect intersections at 568x320, 640x360, 1280x720. PASS = no overlaps.
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'mid', viewport:{width:568, height:320}});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'ascent'; });
  await p.evaluate(() => window.__vs.startFive());
  await p.waitForFunction(() => { const s = window.__vs.state(); return s.running && s.mode === 'five' && !s.dm && s.player; }, {timeout: 60000});
  await wait(1500);
  await p.waitForFunction(() => !window.__vs.state().xLdOn, {timeout: 60000}).catch(() => console.log(el(), 'WARN xLd'));
  const rects = () => p.evaluate(() => {
    const out = {};
    const grab = (name, e) => { if (!e) return; const r = e.getBoundingClientRect(); const vis = r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.05; if (vis) out[name] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    grab('ann', document.querySelector('#xAnn.x-ann.on'));
    grab('ant', document.querySelector('#xAnn .x-ant'));
    grab('ans', document.querySelector('#xAnn .x-ans'));
    grab('feed', document.querySelector('#game .hud.x-fw'));
    grab('feedRow', document.querySelector('#feed .kf'));
    grab('toast', document.querySelector('#toast.on'));
    grab('card', document.querySelector('.x-kb.on'));
    grab('minimap', document.getElementById('xMap'));
    grab('scores', document.querySelector('#game .hud.x-top'));
    return out;
  });
  const inter = (A, B) => A && B && A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3];
  const results = [];
  for (const [w, h] of [[568, 320], [640, 360], [1280, 720]]) {
    await p.setViewportSize({width: w, height: h});
    await wait(600);
    // clear leftovers from the previous round and re-arm the once-per-round FIRST BLOOD
    await p.evaluate(() => { document.querySelectorAll('#feed .kf').forEach(x => x.remove()); window.__vs.resetFirstBlood(); });
    // toast + ann + feed together: round-start toast, then a bot kill (FIRST BLOOD + feed row)
    await p.evaluate(() => { window.__vs.FV.buy = 0.2; });
    await wait(500); // buy ticks to 0 -> "Round start" toast
    await p.evaluate(() => { const b = window.__vs.bots.find(x => x.alive); window.__vs.kill(b, false, 'You', 'Vandal'); });
    await p.waitForFunction(() => document.querySelector('#toast.on') && document.querySelector('#xAnn.on'), {timeout: 4000}).catch(() => console.log(el(), 'WARN toast/ann race'));
    await wait(150);
    const r1 = await rects();
    r1.antOverflow = await p.evaluate(() => { const e = document.querySelector('#xAnn .x-ant'); return e ? e.scrollWidth - e.clientWidth : null; });
    r1.annGlyphs = await p.evaluate(() => { const e = document.querySelector('#xAnn .x-ant'); if (!e) return null; const r = document.createRange(); r.selectNodeContents(e); const q = r.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; });
    if (r1.annGlyphs && r1.feed) { const g = r1.annGlyphs, f = r1.feed; if (g[0] < f[2] && f[0] < g[2] && g[1] < f[3] && f[1] < g[3]) r1.glyphHitFeed = { g, f }; }
    if (r1.annGlyphs && r1.minimap) { const g = r1.annGlyphs, m = r1.minimap; if (g[0] < m[2] && m[0] < g[2] && g[1] < m[3] && m[1] < g[3]) r1.glyphHitFeed = { glyphHitMinimap: true, g, m }; }
    if (r1.annGlyphs && r1.scores) { const g = r1.annGlyphs, sc = r1.scores; if (g[0] < sc[2] && sc[0] < g[2] && g[1] < sc[3] && sc[1] < g[3]) r1.glyphHitFeed = { glyphHitScores: true, g, sc }; }
    if (r1.annGlyphs && r1.feed) r1.glyphFeedGap = r1.feed[0] - r1.annGlyphs[2];
    // KILLED BY card while the feed is still up
    await p.evaluate(() => { const P = window.__vs.player; window.__vs.hurt(P, 999, 'Sova'); window.__vs.die('Sova'); });
    await wait(300);
    const r2 = await rects();
    const pairs = [];
    const chk = (set, tag) => { const ks = Object.keys(set); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { if (inter(set[ks[i]], set[ks[j]])) pairs.push([tag, ks[i], ks[j], set[ks[i]], set[ks[j]]]); } };
    const drop = (set) => { const c = {}; for (const k of ['ant', 'ans', 'feed', 'toast', 'card']) if (set[k]) c[k] = set[k]; return c; }; // region containers; ann-vs-anchors is covered by the glyph checks (full-width bands overlap anchors as containers by design); minimap x scores is pre-existing and out of scope
    chk(drop(r1), 'ann+feed+toast'); chk(drop(r2), 'card');
    results.push({ size: w + 'x' + h, r1, r2, overlaps: pairs });
    console.log(el(), w + 'x' + h, 'r1', JSON.stringify(r1));
    console.log(el(), w + 'x' + h, 'r2', JSON.stringify(r2));
    console.log(el(), w + 'x' + h, 'overlaps', JSON.stringify(pairs));
    await p.screenshot({path: '/tmp/hud_' + w + 'x' + h + '.png'});
    // next round state: revive for the next size's kill
    await p.evaluate(() => { const P = window.__vs.player; P.hp = 100; });
  }
  const bad = results.filter(r => r.overlaps.length || r.r1.glyphHitFeed);
  console.log(el(), 'RESULT', JSON.stringify({pass: !bad.length, sizes: bad.map(r => r.size)}));
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('HUD FAIL', e.message); process.exit(1); });
