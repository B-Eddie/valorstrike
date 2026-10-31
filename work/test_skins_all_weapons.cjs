// Every buyable weapon (BUY + the Knife) has a skins-table entry and builds its native first-person rig, third-person model
// and loading-gate preload from authentic assets in the repo (lane-skins, 2026-10-31: Bandit / Warden were missing from
// server/src/skins.json, so xskDef(w, 'standard') threw, xvFPData failed and first person fell back to the placeholder arms;
// the loading-gate preload swallowed the same throw, so neither gun was warmed behind the overlay).
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const cat = JSON.parse(fs.readFileSync('server/src/skins.json', 'utf8'));
const sk = fs.readFileSync('work/skins_runtime.js', 'utf8').replace('/*SKINS_JSON*/null', JSON.stringify(cat));
const vr = fs.readFileSync('work/valorant_runtime.js', 'utf8');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// The buyable list, read from the shipped page (BUY rows with [name, price] are guns; armour rows carry a 3rd value).
const bl = html.slice(html.indexOf('const BUY = '), html.indexOf(';\n', html.indexOf('const BUY = ')));
const BUY = vm.runInNewContext(bl.replace('const BUY = ', '(') + ')');
const guns = [...new Set(BUY.flatMap((c) => c[1]).filter((it) => it.length === 2).map((it) => it[0]))];
const all = guns.concat('Knife');
assert(guns.includes('Bandit') && guns.includes('Warden') && guns.length >= 18, 'BUY parsed: ' + guns.join(','));

// 1. Skins table: every weapon in a category and in the Standard collection.
const catW = cat.categories.flatMap((c) => c[1]);
const std = cat.collections.find((c) => c.id === 'standard');
for (const w of all) {
  check(catW.includes(w), w + ': not in skins.json categories');
  check(std && Object.prototype.hasOwnProperty.call(std.skins, w) && std.skins[w].ch && std.skins[w].ch.length >= 1, w + ': no Standard skin entry');
  const e = std && std.skins[w];
  if (e && e.icon) check(fs.existsSync(e.icon), w + ': Standard icon file missing ' + e.icon);
}
check(new Set(catW).size === catW.length, 'duplicate weapon in categories');
// The import script that regenerates skins.json carries the same categories (else a re-import drops the guns again).
const imp = fs.readFileSync('work/import_valorant_skins.py', 'utf8');
const CATS = JSON.parse(/^CATS=(\[.*\])$/m.exec(imp)[1]);
check(JSON.stringify(CATS) === JSON.stringify(cat.categories), 'work/import_valorant_skins.py CATS != skins.json categories');

// 2. Client skins runtime: xskDef / xskAsset / xskName do not throw for any buyable gun.
const ctx = { window: {}, document: { getElementById: () => null, body: null }, localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 }, setTimeout, clearTimeout, addEventListener() {}, console, Map, Set, Promise, bots: [], allies: [] };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(sk, ctx);
for (const w of all) {
  check(ctx.XSK.weapons.includes(w), w + ': not in XSK.weapons');
  try { ctx.xskDef(w, 'standard'); ctx.xskAsset(w, 'standard'); ctx.xskName(w, 'standard'); ctx.xskSw(w, 'standard'); } catch (e) { failures.push(w + ': skins runtime throws ' + e.message); }
}

// 3. First person: xvFPData resolves from the real manifest (native FP_/GN_ clips and weapon glb on disk) for every gun.
const win = {}; vm.runInNewContext(fs.readFileSync('models/valorant/manifest.js', 'utf8'), { window: win });
const loads = [];
const fpCtx = Object.assign(ctx, { XV: { config: win.VALORANT_ASSETS, failures: {} }, xvLoad: (n) => { loads.push(n); return fs.existsSync('models/valorant/' + n + '.glb') ? Promise.resolve({ scene: { name: n }, animations: [] }) : Promise.reject(new Error('missing models/valorant/' + n + '.glb')); } });
vm.runInContext(vr.slice(vr.indexOf('function xvFPData('), vr.indexOf('function xvFPLoad(')), fpCtx);
// 4. Loading gate: xvFPList (Competitive) lists every buyable gun and xvFPPreload resolves each one's rig data.
vm.runInContext(vr.slice(vr.indexOf('function xvFPList('), vr.indexOf('function xvKnCombo(')), fpCtx);
fpCtx.mode = 'five'; fpCtx.BUY = BUY; fpCtx.WEAP = Object.fromEntries(guns.map((w) => [w, {}])); fpCtx.J = { pick: 'Jett' }; fpCtx.fpaWeap = () => 'Classic';
const warmed = []; fpCtx.vfWarm = (_, o) => warmed.push(o.root.name); fpCtx.XGM = { rdy: false, T: {} };

// 5. Third person: XGM.F (the installer-written native model table) maps every gun to a glb that exists.
const fl = html.slice(html.indexOf('  F: { Classic:'), html.indexOf('\n', html.indexOf('  F: { Classic:')));
const F = vm.runInNewContext('({' + fl.trim().replace(/,\s*$/, '') + '})').F;
for (const w of all) check(F[w] && fs.existsSync('models/' + F[w] + '.glb'), w + ': no third-person XGM.F model (' + F[w] + ')');

(async () => {
  for (const w of all) {
    try { const D = await vm.runInContext('xvFPData', fpCtx)('Jett', w); check(D && D.weapon && D.arms && D.files.some((f) => /^FP_/.test(f)), w + ': FP rig data incomplete (no FP_ clip file)'); }
    catch (e) { failures.push(w + ': no first-person rig: ' + e.message); }
  }
  const L = fpCtx.xvFPList(); for (const w of all) check(L.includes(w), w + ': not in the loading-gate preload list');
  warmed.length = 0; await fpCtx.xvFPPreload();
  const slug = (w) => w === 'Knife' ? 'melee' : w.toLowerCase();
  for (const w of all) check(warmed.includes(slug(w)), w + ': not preloaded/warmed behind the loading screen');
  // 6. Real native rig through three.js (server/tools/fp-view.mjs runs the production xvFPLoad / xvFPPlay) with the skin the
  // skins table resolves: authored arms + weapon + Idle / Equip / Fire / Reload / Inspect clips for every gun.
  let FP = null; try { FP = await import('../server/tools/fp-view.mjs'); } catch (e) { console.log('  (real rig stage skipped: ' + e.message.split('\n')[0] + ')'); }
  if (FP) for (const w of all) {
    try { const id = ctx.xskGet(w), R = await FP.build('jett', slug(w), FP.runtime({ id, asset: ctx.xskAsset(w, id) })), kinds = FP.anims(R);
      check(R.F.ws.children.length > 0, w + ': native rig has no weapon mesh');
      for (const k of ['Idle', 'Equip', 'Inspect'].concat(w === 'Knife' ? [] : ['Fire', 'Reload'])) check(kinds.includes(k), w + ': native rig lacks ' + k); }
    catch (e) { failures.push(w + ': real native rig build failed: ' + e.message); }
  }
  if (failures.length) { console.error('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
  console.log('Skins/FP/TP/preload: all ' + all.length + ' buyable weapons (' + all.join(', ') + ') have a skins entry, a native FP rig' + (FP ? ' (built through three.js)' : '') + ', a TP model and are preloaded');
})().catch((e) => { console.error(e); process.exit(1); });
