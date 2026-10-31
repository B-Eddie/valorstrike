// Bot Raze throws her Boom Bot (integrate-15 fix-forward). lane-botutil's held-cast retry put a // comment mid-line in the
// Raze botAb wrapper, which swallowed `const fx = ..., p = new RV(...)`, so the cast threw "p is not defined" every time a bot
// Raze lost sight of an enemy (test_client_abilities: page exception in the Killjoy match leg). This runs the wrapper with stubs.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('// bot Raze (team-agnostic)'), b = html.indexOf('// bot Breach (team-agnostic)', a); assert(a > 0 && b > a, 'Raze botAb block missing');
class RV { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
const fed = [];
const ctx = vm.createContext({ Math: Object.assign(Object.create(Math), { random: () => 0 }), RV, botAb() {}, jOn: () => true, running: true, allies: [],
  xAgOf: (n) => n, xBUse: () => true, xBCh: () => ({ c: 1 }), xFy: () => 0, blocked: () => false, RS: { bb: [] }, xBbShootable: (o) => o,
  rsMesh: (c, s, p) => ({ p }), XBB: { life: 3, hp: 100 }, feed: (t) => fed.push(t), XCUE: { play() {} } });
vm.runInContext(html.slice(a, b), ctx);
const raze = { name: 'Raze', ab: {}, g: {} }, from = { x: 0, y: 0, z: 0 };
ctx.botAb(raze, 0.1, true, { x: 10, z: 0 }, from); // sees the enemy: remembers it
ctx.botAb(raze, 0.1, false, null, from);            // lost it round a corner: Boom Bot down the lane
assert.equal(ctx.RS.bb.length, 1, 'bot Raze throws one Boom Bot toward the enemy she just lost');
assert.ok(ctx.RS.bb[0].dx > 0.99, 'Boom Bot heads toward the last known enemy');
assert.deepEqual(fed, ['Raze ▸ Boom Bot']);
console.log('test_bot_raze_boombot: PASS');
