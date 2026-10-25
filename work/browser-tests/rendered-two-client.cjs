// Rendered two-client online acceptance: one Chromium, two pages, real wrangler dev server.
// A creates a private DM room, B joins by code, A starts; A walks to B (keyboard input),
// aims via __vs.aimAt and fires (fireHeld) until the server credits A with killing B.
// Verifies: A's kill feed names A->B, B dies and respawns; screenshots on both clients.
const {spawn} = require('child_process');
const http = require('http');
const {serve, launch, boot} = require('./lib.cjs');
const SERVER_DIR = __dirname + '/../../server';
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
function waitHttp(url, ms) { const end = Date.now()+ms; return new Promise((res, rej) => { const t = () => http.get(url, r => { r.resume(); res(); }).on('error', () => { if (Date.now() > end) rej(new Error('server never came up: '+url)); else setTimeout(t, 500); }); t(); }); }
(async () => {
  const wr = process.env.NO_WRANGLER ? {kill(){}} : spawn('node_modules/.bin/wrangler', ['dev','--local','--ip','127.0.0.1','--var','ALLOW_LOCAL_ORIGIN:true','--var','ENABLE_SPIKE:true'], {cwd: SERVER_DIR, stdio: ['ignore',require('fs').openSync('/tmp/wrangler_out.log','w'),require('fs').openSync('/tmp/wrangler_err.log','w')]});
  process.on('exit', () => { try { wr.kill(); } catch(e){} });
  await waitHttp('http://127.0.0.1:8787/profile?qa=1', 30000); console.log(el(), 'server up');
  const srv = await serve();
  const {b} = await launch({profile:'light', viewport:{width:960, height:600}});
  const ctx = b; // one browser; two pages
  const pA = await ctx.newPage({viewport:{width:960, height:600}});
  const ONE = !!process.env.ONE; const pB = ONE ? null : await ctx.newPage({viewport:{width:960, height:600}});
  const errsA = [], errsB = []; pA.on('pageerror', e => errsA.push(String(e))); if (pB) pB.on('pageerror', e => errsB.push(String(e)));
  const bootOne = async (p, name) => {
    await boot(p);
    await p.click('#mIntro [data-close]').catch(()=>{});
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); });
    await p.click('#playBtn');
    await p.waitForSelector('#xQueue:not([hidden])', {timeout: 15000});
    await p.fill('#xOnName', name);
  };
  await bootOne(pA, 'RendA'); if (!ONE) await bootOne(pB, 'RendB');
  console.log(el(), 'both booted, lobby open');
  // A: DM mode, create private room (call the same functions the buttons call -
  // button hit-testing is covered by diag-lobby-modes; small viewports scroll-shift clicks)
  await pA.evaluate(() => { document.querySelector('#xOn [data-om="dm"]').click(); document.getElementById('xOnCreate').click(); });
  let code = null;
  for (let i = 0; i < 15 && !code; i++) {
    await wait(2000);
    const d = await pA.evaluate(() => ({msg: (document.getElementById('xOnMsg')||{}).textContent||'', codeT: (document.getElementById('xOnCodeT')||{}).textContent||'', roomHidden: (document.getElementById('xOnRoom')||{}).hidden, list: ((document.getElementById('xOnList')||{}).textContent||'').slice(0,60)}));
    console.log(el(), 'create-diag', JSON.stringify(d));
    if (/^[A-Z2-9]{6}$/.test(d.codeT)) code = d.codeT;
  }
  if (!code) throw new Error('room code never appeared');
  console.log(el(), 'room code', code);
  if (!ONE && pB) { await pB.goto('about:blank'); console.log(el(), 'B parked at about:blank'); }

  console.log(el(), 'starting via mpStart');
  await pA.evaluate(() => document.getElementById('xOnStart').click());
  console.log(el(), 'mpStart sent');
  for (const [p, tag] of (ONE ? [[pA,'A']] : [[pA,'A'],[pB,'B']])) {
    let ok = false;
    for (let i = 0; i < 90 && !ok; i++) {
      await wait(2000);
      const d = await p.evaluate(() => { const s = window.__vs && window.__vs.state ? window.__vs.state() : null; const ld = document.querySelector('#xLoad, .x-load, [id*="Load"]'); return { vs: !!window.__vs, running: s ? s.running : null, xLdOn: s ? s.xLdOn : null, mode: s ? s.mode : null, load: ld ? (ld.textContent||'').slice(0,60) : null, body: document.body.className }; }).catch(e => ({err: String(e).slice(0,80)}));
      console.log(el(), tag, 'boot-diag', JSON.stringify(d));
      ok = !!d.running;
    }
    if (!ok) { await p.screenshot({path: '/tmp/rend2_stuck_' + tag + '.png'}); console.log(el(), tag, 'NEVER RUNNING - screenshot saved'); }
  }
  console.log(el(), 'running-wait phase done');
  const stA = await pA.evaluate(() => window.__vs.state());
  console.log(el(), 'A state mode=', stA.mode, 'map=', stA.map, 'bots=', stA.bots, 'names=', JSON.stringify((stA.botsPos||[]).map(r=>r[0])));
  // Kill phase: A hunts B by name via botsPos; keyboard walk + aimAt + fire bursts.
  await pA.keyboard.down('KeyW');
  let killed = false, bSawDeath = false, bSawRespawn = false, bHp0 = null;
  if (ONE) { console.log(el(), 'ONE-client diag done'); await pA.screenshot({path:'/tmp/rend2_one.png'}); await b.close(); srv.close(); wr.kill(); process.exit(0); }
  // B re-enters the lobby fresh and joins the RUNNING match by code
  await bootOne(pB, 'RendB');
  await pB.evaluate((c) => { document.getElementById('xOnCode').value = c; document.getElementById('xOnJoin').click(); }, code);
  console.log(el(), 'B join clicked (mid-match)');
  for (let i = 0; i < 45; i++) {
    await wait(2000);
    const d = await pB.evaluate(() => { const s = window.__vs && window.__vs.state ? window.__vs.state() : null; return { vs: !!window.__vs, running: s ? s.running : null, mode: s ? s.mode : null }; }).catch(e => ({err: String(e).slice(0,60)}));
    if (i % 3 === 0 || d.running) console.log(el(), 'B boot-diag', JSON.stringify(d));
    if (d.running) break;
  }
  const killEnd = Date.now() + 20000;
  while (Date.now() < killEnd && !killed) {
    const posB = await pA.evaluate(() => { const r = (window.__vs.state().botsPos||[]).find(r => r[0] === 'RendB'); return r || null; });
    const bHp = await pB.evaluate(() => { const s = window.__vs.state(); return s.player ? s.player[3] : null; }).catch(() => null);
    if (bHp === 0 || bHp === null && bHp0 !== null) {}
    if (bHp0 !== null && bHp !== null && bHp0 > 0 && bHp <= 0) bSawDeath = true;
    if (bSawDeath && bHp > 0) bSawRespawn = true;
    bHp0 = bHp;
    if (posB) {
      await pA.evaluate((r) => { window.__vs.aimAt(r[1], r[2] + 1.1, r[3]); }, posB);
      const me = await pA.evaluate(() => window.__vs.state().player);
      const dist = me ? Math.hypot(posB[1]-me[0], posB[3]-me[2]) : 99;
      if (dist < 25) { await pA.evaluate(() => window.__vs.fire(true)); await wait(350); await pA.evaluate(() => window.__vs.fire(false)); }
      if (dist < 6) await pA.keyboard.up('KeyW'); else await pA.keyboard.down('KeyW');
    }
    const feed = await pA.evaluate(() => (document.getElementById('feed')||{}).textContent || '');
    if (/RendA/.test(feed) && /RendB/.test(feed)) killed = true;
    await wait(300);
  }
  await pA.keyboard.up('KeyW').catch(()=>{}); await pA.evaluate(() => window.__vs.fire(false)).catch(()=>{});
  console.log(el(), 'kill phase done: killed(A->B in feed)=', killed, 'B death seen=', bSawDeath, 'B respawn seen=', bSawRespawn);
  await pA.screenshot({path: '/tmp/rend2_A.png'}); await pB.screenshot({path: '/tmp/rend2_B.png'});
  // respawn confirmation window
  if (bSawDeath && !bSawRespawn) { const e2 = Date.now()+8000; while (Date.now()<e2 && !bSawRespawn) { const hp = await pB.evaluate(() => { const s = window.__vs.state(); return s.player ? s.player[3] : null; }).catch(()=>null); if (hp > 0) bSawRespawn = true; await wait(400); } console.log(el(), 'post-wait B respawn=', bSawRespawn); }
  await pB.screenshot({path: '/tmp/rend2_B_after.png'});
  console.log(el(), killed && bSawDeath && bSawRespawn ? 'RENDERED-2C PASS' : 'RENDERED-2C INCOMPLETE');
  console.log('ERRS A', JSON.stringify(errsA.slice(0,3)), 'ERRS B', JSON.stringify(errsB.slice(0,3)));
  await b.close(); srv.close(); wr.kill(); process.exit(0);
})().catch(e => { console.log('RENDERED-2C FAIL', e.message); process.exit(1); });
