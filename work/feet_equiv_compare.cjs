// Compares two work/bench_feet.cjs REC files (before / after a foot-planting change, same map / seed / frames): every
// frame, every agent slot, the world matrices of the Splitter, hips, knees and feet and the two smoothed foot offsets.
//   node work/feet_equiv_compare.cjs before.bin after.bin [tol=1e-5]
// Exit 1 when a slot is present in one recording and not the other, or any value differs by more than tol.
const fs = require('fs');
const [a, b] = process.argv.slice(2, 4).map((p) => { const B = fs.readFileSync(p); return new Float64Array(B.buffer, B.byteOffset, B.byteLength / 8); });
const tol = +(process.argv[4] || 1e-5), PER = 7 * 16 + 2, SLOTS = 10, F = SLOTS * PER;
if (a.length !== b.length) { console.error('length differs', a.length, b.length); process.exit(1); }
let max = 0, diff = 0, nanMis = 0, vals = 0, slots = 0, at = null, firstDiff = null;
for (let i = 0; i < a.length; i++) {
  const x = a[i], y = b[i];
  if (Number.isNaN(x) || Number.isNaN(y)) { if (Number.isNaN(x) !== Number.isNaN(y)) { nanMis++; if (!at) at = i; } continue; }
  vals++; if (i % PER === 0) slots++;
  if (!Object.is(x, y)) { diff++; const d = Math.abs(x - y); if (firstDiff == null) firstDiff = i; if (d > max) { max = d; at = i; } }
}
const where = (i) => i == null ? '-' : `frame ${Math.floor(i / F)} slot ${Math.floor((i % F) / PER)} value ${(i % F) % PER}`;
console.log(JSON.stringify({ frames: a.length / F, agentFrames: slots, values: vals, bitIdentical: diff === 0 && nanMis === 0, differing: diff, maxAbsDiff: max, presenceMismatch: nanMis, worst: where(at), first: where(firstDiff) }));
process.exit(nanMis === 0 && max <= tol ? 0 : 1);
