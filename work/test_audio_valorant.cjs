// Valorant sound sources (lane-sounds, Jeff 2026-11-03: "Some of them aren't valorant sounds, replace them with actual
// valorant sounds"): the events below played Kenney CC0 placeholders (footsteps impact/footstep_*, headshot
// impact/impactMetal_light_000, landing impactSoft_heavy_000, smoke / flash / teleport / wall scifi/forceField_001-004,
// heal ui/confirmation_001, buy phase ui/open_001, last-10-s tick ui/tick_002). Each now plays a Valorant file
// (SpikeMedia extracted game audio, vlr-guessr lossless footsteps, VallyBoard headshot). Phoenix Blaze calls SFX.wall()
// then SFX.ab("blaze"): the Sage barrier voice is released so it never stacks under Phoenix's own wall.
'use strict';
const assert = require('assert/strict'); const { make } = require('./fake_mix.cjs');
const F = make(), man = F.man, notVal = (k) => /kenney\.nl|opengameart\.org/.test((man.files[k] || {}).source || '');
const want = { 'SFX.land()': 'step/land', 'SFX.smoke()': 'ability/smoke', 'SFX.flash()': 'ability/flash', 'SFX.tp()': 'ability/tp', 'SFX.heal()': 'ability/heal', 'SFX.buy()': 'event/roundNumber', 'SFX.lowT()': 'ui/roundTick', 'xHitSfx(true,false,false)': 'feedback/headshot' };
for (const [call, key] of Object.entries(want)) {
  F.x('gaStop();GA.lastKey=null'); F.x(call); const k = F.x('GA.lastKey');
  assert.equal(k, key, call + ' plays ' + key + ' (got ' + k + ')'); assert(man.files[k] && !notVal(k), call + ': ' + k + ' is a Valorant file');
}
const steps = new Set(); for (let i = 0; i < 10; i++) { F.x('GA.lastKey=null'); F.x('SFX.step({x:4,y:0,z:1,surface:"wood"})'); steps.add(F.x('GA.lastKey')); F.x('SFX.selfStep(1)'); steps.add(F.x('GA.lastKey')); }
assert.deepEqual([...steps].sort(), ['step/boot_000', 'step/boot_001', 'step/boot_002', 'step/boot_003', 'step/boot_004'], 'footsteps rotate the 5 Valorant footfalls: ' + [...steps]);
for (const k of steps) assert(!notVal(k), k);
// Sage Barrier Orb: SFX.wall() alone keeps its voice; Phoenix Blaze (wall + ab blaze) releases it
F.x('gaStop()'); F.x('SFX.wall()'); const sage = F.rec.sources[F.rec.sources.length - 1]; F.x('SFX.ab("dash")'); assert.equal(sage.stopCalledAt, undefined, 'Sage wall keeps playing');
F.x('gaStop()'); F.x('SFX.wall()'); const w = F.rec.sources[F.rec.sources.length - 1]; assert.equal(F.x('GA.lastKey'), 'ability/wall');
F.x('SFX.ab("blaze")'); assert(w.stopCalledAt != null, 'Blaze releases the barrier voice'); assert.equal(F.x('GA.lastKey'), 'ability/blaze');
console.log('audio valorant: ' + Object.keys(want).length + ' events + 5 footfalls play Valorant files; Blaze drops the Sage barrier voice');
