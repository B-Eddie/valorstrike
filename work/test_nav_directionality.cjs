// Executes the SHIPPED nmPath + nmClimbOk + nmHeight + nmNear (brace-matched extraction from
// work/native_maps_runtime.js) against real lotus data with the production prebuilt BVH:
// paths must never plan a climb the motor cannot make, smooth ramps must NOT be rejected by
// endpoint dy alone, one-way drops stay routable downward, climbable reachability preserved.
const fs = require('fs'), path = require('path');
const { createRequire } = require('module');
const sreq = createRequire(path.resolve('server/build-world.cjs'));
const THREE = sreq('three'), { MeshBVH } = sreq('three-mesh-bvh');
global.THREE = THREE; global.NM = { routeCache: new Map() };
const src = fs.readFileSync('work/native_maps_runtime.js', 'utf8');
function extract(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) { console.error(name, 'not found in runtime'); process.exit(1); }
  let depth = 0, endI = -1;
  for (let i = start; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { endI = i + 1; break; } }
  if (endI <= start) { console.error(name, 'extraction failed'); process.exit(1); }
  return src.slice(start, endI);
}
global.window = {}; // nmBlocked reads window.ValorantFeel (absent here: no clips in test scope)
const nmQi = src.indexOf('var NM_Q='); const nmQe = src.indexOf('\n', nmQi); eval(src.slice(nmQi, nmQe));
// hark-perf 762e33c: nmNear reads the numeric cell index (NM_NONE + nmCellNum, same line in the runtime)
const nmNi = src.indexOf('const NM_NONE=[];function nmCellNum('); eval(src.slice(nmNi, src.indexOf('\n', nmNi)).replace('const NM_NONE=','var NM_NONE='));
for (const fn of ['nmNear', 'nmHeight', 'nmBlocked', 'nmSegDrop', 'nmClimbOk', 'nmPath']) eval(extract(fn));
// production prebuilt collision + BVH (same files nmCollision fetches)
const W = 'server/public/worlds/lotus/';
const meta = JSON.parse(fs.readFileSync(W + 'meta.json', 'utf8'));
const positions = fs.readFileSync(W + 'position.bin'), index = fs.readFileSync(W + 'index.bin');
const roots = []; for (let i = 0; i < meta.roots; i++) roots.push(fs.readFileSync(W + 'bvh' + i + '.bin'));
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.byteLength / 4), 3));
geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index.buffer, index.byteOffset, index.byteLength / 4), 1));
const rootBufs = roots.map(b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
geometry.boundsTree = MeshBVH.deserialize({ index: geometry.index.array, roots: rootBufs }, geometry, { setIndex: false });
const NAV = JSON.parse(fs.readFileSync(W + 'navigation.json', 'utf8'));
const C = { nav: NAV, bvh: geometry.boundsTree, cells: new Map() };
NAV.nodes.forEach((p, i) => { const k = Math.floor(p[0] / 2) + ',' + Math.floor(p[2] / 2); if (!C.cells.has(k)) C.cells.set(k, []); C.cells.get(k).push(i); });
const N = NAV.nodes;
function checkPath(path, label) {
  if (!path.length) { console.error('FAIL:', label, 'empty path'); process.exitCode = 1; return; }
  for (let k = 1; k < path.length; k++) {
    const dy = N[path[k]][1] - N[path[k - 1]][1];
    if (dy > 0.321 && !nmClimbOk(C, path[k - 1], path[k])) { console.error('FAIL:', label, 'plans unclimbable hop', path[k - 1], '->', path[k], 'dy', dy.toFixed(3)); process.exitCode = 1; return; }
  }
  console.log('PASS:', label, '-', path.length, 'hops, all climbs traversal-verified');
}
// smooth ramps with endpoint dy > 0.321 must NOT be rejected (offline classifier examples)
for (const [a, b, dy] of [[14, 13, 0.37], [35, 54, 0.34], [55, 54, 0.34]]) {
  if (!nmClimbOk(C, a, b)) { console.error('FAIL: smooth ramp edge', a, '->', b, '(endpoint dy', dy + ') falsely rejected'); process.exitCode = 1; }
  else console.log('PASS: smooth ramp edge', a, '->', b, '(endpoint dy', dy + ') kept');
}
// true lips (one-way drops) must be rejected upward
for (const [a, b] of [[3713, 3628], [3628, 3627], [3712, 3626]]) {
  if (nmClimbOk(C, a, b)) { console.error('FAIL: lip edge', a, '->', b, 'not rejected'); process.exitCode = 1; }
  else console.log('PASS: lip edge', a, '->', b, '(dy', (N[b][1] - N[a][1]).toFixed(2) + ') rejected upward');
}
// pocket: honest no-path; outside the pocket, upper band reachable; drops route downward
const pock = nmPath(C, 3713, 3543); console.log('pocket path detail:', JSON.stringify(pock.map((n,i)=>[n, i?+(N[n][1]-N[pock[i-1]][1]).toFixed(2):0, i?nmClimbOk(C,pock[i-1],n):null])));
if (pock.length) checkPath(pock, 'pocket 3713 -> upper 3543');
else console.log('PASS: pocket 3713 -> upper 3543 = no path (true one-way pocket)');
checkPath(nmPath(C, NAV.spawnNodes[0], 3543), 'attacker spawn -> upper band 3543');
checkPath(nmPath(C, NAV.spawnNodes[1], 3626), 'defender spawn -> upper band 3626');
const down = nmPath(C, 3543, 3713);
if (!down.length) { console.error('FAIL: downward path across the one-way drop lost'); process.exitCode = 1; }
else console.log('PASS: upper 3543 -> lower 3713 downward path exists -', down.length, 'hops');
for (const s of ['A', 'B', 'C']) checkPath(nmPath(C, NAV.spawnNodes[0], NAV.siteNodes[s]), 'attacker spawn -> site ' + s);
const a = nmPath(C, 3713, 3543), b = nmPath(C, 3713, 3543);
if (a.join(',') !== b.join(',')) { console.error('FAIL: cached path differs'); process.exitCode = 1; }
console.log('Done.');
