// Rendered TDM transitions acceptance (touch emulation, 844x390, offline):
// loadout opens via touch BUY, tier locks at 0:00, unlock callouts at 2:00/5:00,
// equips apply, death says "respawning", respawn resets movement state + protection.
const {serve, launch, boot} = require('./lib.cjs');
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await serve();
  const {b, p} = await launch({profile:'mid', viewport:{width:844, height:390}, touch:true});
  p.on('pageerror', e => console.log(el(), 'PAGEERROR', String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') console.log(el(), 'CONSOLE-ERR', m.text().slice(0, 160)); });
  const cdp = await p.context().newCDPSession(p);
  const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y, id:1}]}); await wait(60); await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]}); await wait(250); };
  const tapSel = async (sel) => { const r = await p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); const cx = q.left + q.width/2, cy = q.top + q.height/2; const hit = document.elementFromPoint(cx, cy); const desc = hit ? (hit.id ? '#' + hit.id : hit.className || hit.tagName) : 'none'; return {x: Math.round(cx), y: Math.round(cy), hitOk: hit === e || e.contains(hit), covers: desc}; }, sel); if (!r) return {hitOk:false, missing:true}; if (!r.hitOk) console.log(el(), 'tapSel', sel, 'covered by', r.covers, 'at', r.x, r.y); await tap(r.x, r.y); return r; };
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.FV.pick = 'ascent'; });
  await p.evaluate(() => window.__vs.startTDM());
  await p.waitForFunction(() => { const s = window.__vs.state(); return s.running && s.tdm && s.player; }, {timeout: 60000});
  const R = { checks: [] }; const ck = (name, ok, extra) => { R.checks.push({name, ok: !!ok, extra}); console.log(el(), (ok ? 'ok  ' : 'FAIL'), name, extra === undefined ? '' : JSON.stringify(extra)); };
  await wait(1500); // let the loading screen appear first (it shows after running flips)
  await p.waitForFunction(() => !window.__vs.state().xLdOn, {timeout: 60000}).catch(() => console.log(el(), 'WARN xLd still visible'));
  // touch-drag the loadout grid until the named weapon button's center hit-tests to itself
  const scrollToWeapon = async (name) => {
    for (let i = 0; i < 6; i++) {
      const r = await p.evaluate((name) => { const btn = [...document.querySelectorAll('.x-dmg button[data-n]')].find(x => x.dataset.n === name); if (!btn) return null; const q = btn.getBoundingClientRect(); const port = document.querySelector('.x-dmg__c').getBoundingClientRect(); const cx = q.left + q.width/2, cy = q.top + q.height/2; const hit = document.elementFromPoint(cx, cy); return { cx: Math.round(cx), cy: Math.round(cy), inPort: cy > port.top + 4 && cy < port.bottom - 4, hitOk: hit === btn || btn.contains(hit), port: [Math.round(port.left), Math.round(port.top), Math.round(port.right), Math.round(port.bottom)] }; }, name);
      if (!r) return { missing: true };
      if (r.hitOk && r.inPort) return { x: r.cx, y: r.cy, hitOk: true, tries: i };
      if (i >= 2) { await p.evaluate((name) => { const btn = [...document.querySelectorAll('.x-dmg button[data-n]')].find(x => x.dataset.n === name); btn.scrollIntoView({block: 'center'}); }, name); await wait(250); continue; } // touch drag proved the grid scrolls (Spectre); after 2 drags use scrollIntoView so the tap target is settled
      const sx = Math.round((r.port[0] + r.port[2]) / 2), sy = Math.round(r.port[3] - 30);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x: sx, y: sy, id: 7}]});
      for (let k = 1; k <= 4; k++) { await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x: sx, y: sy - k*40, id: 7}]}); await wait(40); }
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await wait(300);
    }
    return { hitOk: false, scrolled: true };
  };
  // deterministic loadout opening: move live enemy bots far away
  await p.evaluate(() => { for (const b of window.__vs.bots) { b.g.position.x += 400; b.g.position.z += 400; } window.__vs.DM.pp = 0; });
  // --- loadout at tier 0 via touch BUY
  const b0 = await tapSel('#xT .tb[data-k="buy"]');
  ck('touch BUY button hit', b0.hitOk);
  const lo0 = await p.evaluate(() => { const m = document.querySelector('.x-dmg'); const on = m && m.classList.contains('on'); const h = m && m.querySelector('h2 + p, header p'); const secs = [...m.querySelectorAll('section')].map(s => ({ name: s.querySelector('h4').childNodes[0].textContent.trim(), locked: s.classList.contains('x-dmg-locked'), lock: (s.querySelector('h4 small')||{}).textContent || null, disabled: !!s.querySelector('button:disabled') })); return { on, tier: h ? h.textContent : null, secs }; });
  ck('loadout open at tier 0', lo0.on && lo0.tier && lo0.tier.includes('Sidearms'), lo0);
  ck('tier-0 locks: rifles/shotguns 2:00, snipers/MGs 5:00', lo0.secs && lo0.secs.length === 6 && lo0.secs.filter(s => s.locked).length === 4 && lo0.secs.find(s => s.name === 'Rifles').lock === '2:00' && lo0.secs.find(s => s.name === 'Snipers').lock === '5:00' && lo0.secs.filter(s => s.locked).every(s => s.disabled), lo0.secs);
  await p.screenshot({path: '/tmp/tdm_t0_loadout.png'});
  // --- equip an unlocked SMG by touch
  const sp = await scrollToWeapon('Spectre');
  console.log(el(), 'Spectre reach', JSON.stringify(sp));
  if (!sp.hitOk) ck('Spectre reachable by touch scroll', false, sp);
  else await tap(sp.x, sp.y);
  const eq1 = await p.evaluate(() => ({ pri: window.__vs.FV.pri, ammo: window.__vs.state().ammo, menu: !!window.__vs.DM.menu }));
  await wait(1500);
  const eq1b = await p.evaluate(() => ({ menu: !!window.__vs.DM.menu }));
  ck('Spectre equips on tap, menu auto-closes', eq1.pri === 'Spectre' && eq1.ammo === 30 && !eq1.menu && !eq1b.menu, {eq1, eq1b});
  // --- tier 1 unlock at 2:00
  await p.evaluate(() => window.__vs.setTimeLeft(window.__vs.DM.len - 121));
  await wait(1200);
  const t1 = await p.evaluate(() => ({ toast: document.getElementById('toast').textContent, on: document.getElementById('toast').classList.contains('on'), tier: window.__vs.DM.tier }));
  ck('tier-1 callout', t1.on && t1.toast.includes('Rifles & shotguns'), t1);
  await p.screenshot({path: '/tmp/tdm_tier1_toast.png'});
  await tapSel('#xT .tb[data-k="buy"]');
  const lo1 = await p.evaluate(() => { const m = document.querySelector('.x-dmg'); return { on: m.classList.contains('on'), tier: m.querySelector('header p').textContent, riflesLocked: [...m.querySelectorAll('section')].find(s => s.querySelector('h4').textContent.startsWith('Rifles')).classList.contains('x-dmg-locked') }; });
  ck('loadout live re-render at tier 1', lo1.on && lo1.tier.includes('Rifles & shotguns') && !lo1.riflesLocked, lo1);
  const vd = await scrollToWeapon('Vandal');
  console.log(el(), 'Vandal reach', JSON.stringify(vd));
  if (vd.hitOk) await tap(vd.x, vd.y);
  const eq2 = await p.evaluate(() => ({ pri: window.__vs.FV.pri, ammo: window.__vs.state().ammo }));
  ck('Vandal equips at tier 1', eq2.pri === 'Vandal' && eq2.ammo === 25, eq2);
  // --- tier 2 at 5:00
  await p.evaluate(() => window.__vs.setTimeLeft(window.__vs.DM.len - 301));
  await wait(1200);
  const t2 = await p.evaluate(() => ({ toast: document.getElementById('toast').textContent, tier: window.__vs.DM.tier }));
  ck('tier-2 callout', t2.toast.includes('Snipers & machine guns') && t2.tier === 2, t2);
  await tapSel('#xT .tb[data-k="buy"]');
  const lo2 = await p.evaluate(() => { const m = document.querySelector('.x-dmg'); return { tier: m.querySelector('header p').textContent, opDisabled: [...document.querySelectorAll('.x-dmg button[data-n]')].find(x => x.dataset.n === 'Operator').disabled }; });
  ck('tier 2: all weapons', lo2.tier.includes('All weapons') && !lo2.opDisabled, lo2);
  await tapSel('.x-dmg .x-dmg__close');
  // --- death + respawn
  await p.evaluate(() => { const P = window.__vs.player; P.vx = 5; P.vz = -3; P.ch = 1; window.__vs.DM.pp = 0; window.__vs.hurt(P, 999, 'TestBot'); window.__vs.die('TestBot'); });
  const dth = await p.evaluate(() => ({ hp: window.__vs.player.hp, toast: document.getElementById('toast').textContent, prt: window.__vs.DM.prt, menu: !!window.__vs.DM.menu, deaths: window.__vs.DM.d['You'] || 0 }));
  ck('death: respawning text, 1.5s timer, menu closed', dth.hp <= 0 && dth.toast.includes('You died · respawning') && dth.prt > 0 && !dth.menu, dth);
  await p.screenshot({path: '/tmp/tdm_death.png'});
  let rsp = null;
  for (let i = 0; i < 40 && !rsp; i++) { await wait(150); rsp = await p.evaluate(() => { const P = window.__vs.player; if (!(P.hp > 0)) return null; return { hp: P.hp, armor: P.armor, vx: P.vx, ch: P.ch, air: P.air, protMs: Math.round(window.__vs.DM.pp - performance.now()) }; }); }
  ck('respawn: hp/armor/movement reset, protection armed', rsp && rsp.hp === 100 && rsp.armor === 50 && rsp.vx === 0 && rsp.ch === 0 && !rsp.air && rsp.protMs > -2500, rsp);
  R.pass = R.checks.every(c => c.ok);
  console.log(el(), 'RESULT', JSON.stringify({pass: R.pass, failed: R.checks.filter(c => !c.ok).map(c => c.name)}));
  await b.close(); srv.close(); process.exit(R.pass ? 0 : 1);
})().catch(e => { console.log('TDM TRANSITIONS FAIL', e.message); process.exit(1); });
