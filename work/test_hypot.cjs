// perf2: index.html replaces Math.hypot (work/hypot_runtime.js, inserted by work/install_valorant.py as the first inline script, before three.js and the game) with an allocation-free copy of
// V8's algorithm for 2 / 3 arguments. V8's builtin allocates a FixedDoubleArray per call (~30 KB per frame of garbage from
// ~450 call sites in a 5v5). Checks: installed before any other script runs; bit-identical to the engine's own Math.hypot
// (this is V8) for millions of 2- and 3-argument calls (random doubles, raw bit patterns, +-0, +-Infinity, NaN, huge / tiny,
// strings, objects with valueOf - conversion order and count included); other arities unchanged; no allocation per call.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), inspector = require('inspector');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const i0 = html.indexOf('<script>/* perf2: allocation-free Math.hypot.'); assert(i0 > 0, 'Math.hypot patch present in index.html');
const firstScript = html.indexOf('<script'); const between = html.slice(firstScript, i0);
assert(!/<script[^>]*src=/.test(between), 'no external script loads before the Math.hypot patch');
const three = html.indexOf('three.min.js'); assert(three > i0, 'patch runs before three.js');
const code = html.slice(i0 + 8, html.indexOf('</script>', i0));
assert.equal(code, fs.readFileSync(path.join(__dirname, 'hypot_runtime.js'), 'utf8').replace(/\n$/, ''), 'index.html carries work/hypot_runtime.js verbatim (work/install_valorant.py inserts it)');
const ctx = vm.createContext({}); vm.runInContext(code, ctx); const P = vm.runInContext('Math.hypot', ctx), NATIVE = Math.hypot;
assert(P.__xHyp && P !== vm.runInContext('Object.getPrototypeOf(Math)', ctx), 'patched');
vm.runInContext(code, ctx); assert.equal(vm.runInContext('Math.hypot', ctx), P, 'idempotent');
const f = new Float64Array(1), u = new Uint32Array(f.buffer); let seed = 77; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
const SPEC = [0, -0, Infinity, -Infinity, NaN, 1e308, -1e308, 5e-324, 1, -1, 2 ** 52, 1e-300];
const val = (k) => { switch (k % 7) { case 0: return (rnd() - .5) * 200; case 1: return (rnd() - .5) * 1e-3; case 2: return Math.round((rnd() - .5) * 400) / 2; case 3: u[0] = rnd() * 2 ** 32 >>> 0; u[1] = rnd() * 2 ** 32 >>> 0; return f[0]; case 4: return SPEC[Math.floor(rnd() * SPEC.length)]; case 5: return Math.fround((rnd() - .5) * 60); default: return (rnd() - .5) * 1e6; } };
let n2 = 0, n3 = 0;
for (let k = 0; k < 3000000; k++) { const x = val(k), y = val(k * 7 + 3); assert(Object.is(P(x, y), NATIVE(x, y)), 'hypot(' + x + ', ' + y + ')'); n2++;
  if (k % 3 === 0) { const z = val(k * 13 + 5); assert(Object.is(P(x, y, z), NATIVE(x, y, z)), 'hypot(' + x + ', ' + y + ', ' + z + ')'); n3++; } }
for (const a of [[], [3], [-0], [NaN], [1, 2, 3, 4], ['3', '4'], [' 5 ', null], [undefined, 1], [true, '0x10'], [[], [2]], [{}, 1], [Infinity, NaN], [NaN, -Infinity, 1]])
  assert(Object.is(P(...a), NATIVE(...a)), 'hypot(' + JSON.stringify(a) + ')');
// conversion order / count, and a throwing valueOf propagates after the earlier ones ran
const log = []; const o = (t, v) => ({ valueOf() { log.push(t); return v; } });
P(o('a', 3), o('b', 4), o('c', 12)); const pl = log.splice(0); NATIVE(o('a', 3), o('b', 4), o('c', 12)); assert.deepEqual(pl, log.splice(0), 'ToNumber order');
assert.throws(() => P(o('x', 1), { valueOf() { throw Error('boom'); } }), /boom/); assert.throws(() => P(1n, 2), (e) => e.name === 'TypeError'); assert.throws(() => P(Symbol(), 2), (e) => e.name === 'TypeError'); // the vm realm's TypeError
// allocation: sampled heap over 200k calls (engine builtin vs patch)
const sess = new inspector.Session(); sess.connect(); sess.post('HeapProfiler.enable');
const bytes = (fn) => { fn(20000); let tot = 0; sess.post('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); fn(200000);
  sess.post('HeapProfiler.stopSampling', (e, r) => { (function w(nd) { tot += nd.selfSize || 0; for (const c of nd.children || []) w(c); })(r.profile.head); }); return tot / 200000; };
const XS = new Float64Array(1024).map((_, i) => (i - 512) * 0.37);
const run = (h) => (n) => { let s = 0; for (let i = 0; i < n; i++) s += h(XS[i & 1023], XS[(i * 7) & 1023]); return s; };
// each loop runs in the realm of the function it calls (a call across realms is never inlined, so it boxes its arguments)
vm.runInContext('globalThis.__run=function(n){const XS=new Float64Array(1024).map((_,i)=>(i-512)*0.37);let s=0;for(let i=0;i<n;i++)s+=Math.hypot(XS[i&1023],XS[(i*7)&1023]);return s;}', ctx);
const bN = bytes(run(NATIVE)), bP = bytes(ctx.__run);
console.log(`Math.hypot patch: ${n2} two- and ${n3} three-argument calls bit-identical to the engine builtin; ${bN.toFixed(1)} -> ${bP.toFixed(2)} B allocated per call`);
// what is left is the boxed return value: a function that reads arguments.length is not inlined (rest parameters would be,
// but could not tell hypot(x) from hypot(x, undefined), which differ); exact arity semantics are kept
// lag lane 2026-11-09: the invariant is "at most the one boxed double per call" (a HeapNumber is 16 B; < 20 B leaves the
// sampler's noise). The old bN / 3 ratio assumed an ~80 B builtin; Node 24's V8 builtin allocates ~48 B, so its third sat at
// ~16.1 B, right on the patch's 16.2-16.5 B, and the test flipped run to run on the same tree (the "environmental" failure).
assert(bP < 20 && bP < bN / 2,'patched Math.hypot allocates ' + bP.toFixed(2) + ' B per call (engine builtin ' + bN.toFixed(1) + ')');
