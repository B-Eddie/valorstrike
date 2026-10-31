// First-match flow hints (UI lane 3 task 4).
// (1) The controls keys hint (#hint) fades 8 s into live play (xHintTick). The loading screen (window.xLdOn) freezes the match
//     but the hint timer kept running behind it, so on a slow first load the hint had faded before the player ever saw it.
//     The 8 s must hold while the loading screen is up and count only once it hides.
// (2) When the buy phase ends the toast said "Round start" for 0.9 s, which tells a first-time player nothing. In a spike
//     round it now says the side's job for ~2.6 s: attacker with the Spike "You have the Spike · hold 4 on a site", attacker
//     without "Spike with <name> · push a site together", defender "Hold the sites · stop the plant". Deathmatch / TDM /
//     Escalation (FV.dm) keep the plain "Round start". Offline fiveTick and the online client mpCliTick5 both use it.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fnSrc = (head) => { const i = html.indexOf(head); assert(i > 0, head + ' missing'); const j = html.indexOf('\n}\n', i); assert(j > i); return html.slice(i, j + 2); };

// ---- (1) hint timer holds while the loading screen is up ----
{
  const h = { textContent: 'WASD move · Space jump · B buy', style: { opacity: '' } }, g = { style: { display: 'block' } };
  const win = { xLdOn: true };
  const ctx = vm.createContext({ Math, performance: { now: () => 0 }, window: win, running: true, $: (id) => (id === 'hint' ? h : id === 'game' ? g : null) });
  vm.runInContext('var XHN = { t0: 0, txt: "", off: false, MS: 8000 };\n' + fnSrc('function xHintTick(now) {'), ctx);
  let t = 1000; const run = (ms) => { for (const e = t + ms; t < e; t += 100) ctx.xHintTick(t); };
  run(20000); // a slow first load: 20 s behind the loading screen
  assert.notEqual(h.style.opacity, '0', 'controls hint must not fade while the loading screen is up (8 s timer ran behind it)');
  win.xLdOn = false;
  run(7000);
  assert.notEqual(h.style.opacity, '0', 'controls hint still up 7 s after the loading screen hides');
  run(1500);
  assert.equal(h.style.opacity, '0', 'controls hint fades 8 s after the loading screen hides');
  // a loading screen mid-count pauses the count, it does not restart it
  h.style.opacity = ''; ctx.XHN.t0 = 0; ctx.XHN.off = false; ctx.XHN.txt = '';
  run(5000); win.xLdOn = true; run(10000); win.xLdOn = false; run(2500);
  assert.notEqual(h.style.opacity, '0', '5 s + 2.5 s of live play around a loading screen: hint still up');
  run(1000);
  assert.equal(h.style.opacity, '0', '5 s + 3.5 s of live play: hint faded (count paused, not restarted)');
}

// ---- (2) round-start line ----
{
  assert(html.indexOf('function xRsLine() {') > 0, 'xRsLine (side-specific round start line) missing');
  const ctx = vm.createContext({ Math, String, XS: { keys: { buy: 'KeyB' } }, xKbName: (c) => String(c).replace(/^Key|^Digit/, ''), FV: {}, player: { name: 'You' } });
  vm.runInContext('const fName = (u) => (u === player ? "You" : u.name);\n' + fnSrc('function xRsLine() {'), ctx);
  const ally = { name: 'Sova' };
  const line = (fv) => { ctx.FV = fv; return vm.runInContext('xRsLine()', ctx); };
  let r = line({ atk: true, dm: false, sp: { st: 'carry', c: ctx.player } });
  assert.equal(r[0], 'You have the Spike · hold 4 on a site'); assert(r[1] >= 2400 && r[1] <= 3000, 'side line ~2.6 s: ' + r[1]);
  r = line({ atk: true, dm: false, sp: { st: 'carry', c: ally } });
  assert.equal(r[0], 'Spike with Sova · push a site together'); assert(r[1] >= 2400 && r[1] <= 3000);
  r = line({ atk: false, dm: false, sp: { st: 'carry', c: ally } });
  assert.equal(r[0], 'Hold the sites · stop the plant'); assert(r[1] >= 2400 && r[1] <= 3000);
  for (const fv of [{ atk: true, dm: true, sp: { st: 'carry', c: ctx.player } }, { atk: true, dm: true, tdm: true }, { atk: false, dm: true, tdm: true, esc: true }]) {
    r = line(fv); assert.equal(r[0], 'Round start', 'deathmatch / TDM / Escalation keep the plain Round start'); assert(r[1] <= 1200);
  }
  // a rebindable plant key (if one is ever added to XS.keys) is named in the line
  ctx.XS.keys.plant = 'KeyP'; r = line({ atk: true, dm: false, sp: { st: 'carry', c: ctx.player } });
  assert.equal(r[0], 'You have the Spike · hold P on a site'); delete ctx.XS.keys.plant;
  // offline fiveTick and the online client both show it at the end of the buy phase
  const ft = fnSrc('function fiveTick(dt) {'), ct = fnSrc('function mpCliTick5(dt) {');
  assert(!/say\("Round start", 900\)/.test(ft), 'offline fiveTick still says the 0.9 s "Round start"');
  assert(!/say\("Round start", 900\)/.test(ct), 'online client mpCliTick5 still says the 0.9 s "Round start"');
  assert(/xRsLine\(\)/.test(ft) && /xRsLine\(\)/.test(ct), 'both buy-phase ends use xRsLine');
}
console.log('test_first_match_hints: PASS');
