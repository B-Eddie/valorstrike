// match scenes for the pixel gate (h.cjs MODE=match, STEPS=node:agents.cjs): loop frozen, every agent of the match posed
// deterministically (bind pose, then its idle clip at a fixed time) in a lineup in front of the player, first-person
// viewmodel at a fixed idle phase with its sway state zeroed, a few ability effects spawned with a reseeded RNG,
// FX pools / props that animate on their own hidden. Shots: 8 lineup views (viewmodel drawn on top as in game), 1 viewmodel
// alone, per FP weapon (Vandal Prime skin, knife BlastX skin, Classic), 3 ability views, and a compositor screenshot (HUD).
const fs = require('fs');
module.exports = async (X, page, R, log, SHOT) => {
  const frames = async (n) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); };
  const wait = async (ms) => { await page.waitForTimeout(ms); };
  // prep while the loop runs: god mode, bots frozen in place, buy a Vandal (Prime skin given in PRE)
  log('prep', await X(`(()=>{[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());bots.concat(allies).forEach(u=>{u.cd=1e9;u.nt=true;if(${process.env.VW?1:0})u.w='Vandal';});FV.buy=Math.max(FV.buy,60);FV.cr=9000;let r='';if(${JSON.stringify(process.env.WEAP||'vandal')}==='vandal')try{fBuy("Vandal");r='bought';}catch(e){r='buy err '+e;}return r;})()`));
  await wait(6000); await frames(3);
  await X(`(()=>{window.__loop0=window.__loop0||loop;window.__freeze=()=>{cancelAnimationFrame(loop.id);loop=function(){};};window.__thaw=()=>{loop=window.__loop0;loop.id=requestAnimationFrame(loop);};
   window.__seed=(n)=>{let s=n>>>0;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};return 1;})()`);
  const setup = fs.readFileSync(__dirname + '/js/agents_setup.js', 'utf8');
  const gc = async () => { try { const c = await page.context().newCDPSession(page); await c.send('HeapProfiler.collectGarbage'); await c.detach(); } catch (e) { log('gc err', String(e).slice(0, 200)); } };
  const shotsFor = async (tag) => {
    await X(`window.__freeze();1`); await wait(300); await gc();
    const info = await X(setup); log('setup', tag, String(info).slice(0, 1500)); (R.setupInfo = R.setupInfo || {})[tag] = info;
    const V = JSON.parse(await X('JSON.stringify(window.__views)'));
    if (process.env.VFMAT) { const d = await X(fs.readFileSync(__dirname + '/js/vfmat.js', 'utf8')); fs.writeFileSync(__dirname + '/shots/' + R.map + '-' + R.gq + '-' + R.tag + '-vfmat-' + tag + '.json', d); log('vfmat', d.length); }
    if (process.env.BONES) { const d = await X(fs.readFileSync(__dirname + '/js/bones.js', 'utf8')); fs.writeFileSync(__dirname + '/shots/' + R.map + '-' + R.gq + '-' + R.tag + '-bones-' + tag + '.json', d); log('bones', d.length); if (process.env.BONES === 'only') return; }
    if (process.env.DRAWLIST) { const d = await X(fs.readFileSync(__dirname + '/js/drawlist.js', 'utf8')); fs.writeFileSync(__dirname + '/shots/' + R.map + '-' + R.gq + '-' + R.tag + '-drawlist-' + tag + '.json', d); log('drawlist', d.length); if (process.env.DRAWLIST === 'only') return; }
    for (let i = 0; i < V.length; i++) await SHOT(tag + '_a' + i, `window.__view(${i});renderer.render(scene,camera)`);
    await SHOT(tag + '_vm', `window.__vmOnly();renderer.render(scene,camera)`);
    await X('window.__vmOnlyOff();1');
  };
  const WEAP = process.env.WEAP || 'vandal';
  if (WEAP === 'knife') { await X(`swapW("knife");VM.sw=0;1`); await wait(5000); await frames(3); await shotsFor('knife'); return; }
  if (WEAP === 'classic') { await X(`swapW("pis");VM.sw=0;1`); await wait(5000); await frames(3); await shotsFor('classic'); return; }
  await shotsFor('vandal');
  if (process.env.DRAWLIST === 'only' || process.env.BONES === 'only') return;
  // HUD: compositor screenshot of the whole page in the frozen state
  await X(`window.__view(0);renderer.render(scene,camera);1`); await wait(500);
  const png = await page.screenshot({ timeout: 300000 }); const hudf = __dirname + '/shots/' + R.map + '-' + R.gq + '-' + R.tag + '-hud.png'; fs.writeFileSync(hudf, png); log('hud', hudf);
  // abilities: spawn a few effects in front of the lineup camera with a fixed seed, frozen
  log('abil', await X(fs.readFileSync(__dirname + '/js/abil_setup.js', 'utf8')));
  await SHOT('abil_a0', `window.__view(0);renderer.render(scene,camera)`);
  await SHOT('abil_a1', `window.__view(2);renderer.render(scene,camera)`);
  await SHOT('abil_a2', `window.__view(5);renderer.render(scene,camera)`);
};
