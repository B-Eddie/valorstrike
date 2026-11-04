// All-six-map coverage for the corrected climb filter: spawn->every site on every map,
// asserting no planned hop is both dy>0.321 AND nmSegDrop-rejected (the planner's own rule),
// plus cold-memo vs warm first-route timing (memoization is not evidence of first-route cost).
const fs = require('fs'), path = require('path');
const { createRequire } = require('module');
const sreq = createRequire(path.resolve('server/build-world.cjs'));
const THREE = sreq('three'), { MeshBVH } = sreq('three-mesh-bvh');
global.THREE = THREE; global.NM = { routeCache: new Map() };
global.window = {};
const src = fs.readFileSync('work/native_maps_runtime.js', 'utf8');
function extract(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) { console.error(name, 'not found'); process.exit(1); }
  let depth = 0, endI = -1;
  for (let i = start; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { endI = i + 1; break; } }
  return src.slice(start, endI);
}
const nmQi = src.indexOf('var NM_Q='); eval(src.slice(nmQi, src.indexOf('\n', nmQi)));
// hark-perf 762e33c: nmNear reads the numeric cell index (NM_NONE + nmCellNum, same line in the runtime)
const nmNi = src.indexOf('const NM_NONE=[];function nmCellNum('); eval(src.slice(nmNi, src.indexOf('\n', nmNi)).replace('const NM_NONE=','var NM_NONE='));
for (const fn of ['nmCellGrid', 'nmNear', 'nmHeight', 'nmBlocked', 'nmSegDrop', 'nmClimbOk', 'nmPath']) eval(extract(fn));
function loadMap(map) {
  const W = 'server/public/worlds/' + map + '/';
  const meta = JSON.parse(fs.readFileSync(W + 'meta.json', 'utf8'));
  const positions = fs.readFileSync(W + 'position.bin'), index = fs.readFileSync(W + 'index.bin');
  const roots = []; for (let i = 0; i < meta.roots; i++) { const b = fs.readFileSync(W + 'bvh' + i + '.bin'); roots.push(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.buffer, positions.byteOffset, positions.byteLength / 4), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index.buffer, index.byteOffset, index.byteLength / 4), 1));
  geometry.boundsTree = MeshBVH.deserialize({ index: geometry.index.array, roots }, geometry, { setIndex: false });
  const NAV = JSON.parse(fs.readFileSync(W + 'navigation.json', 'utf8'));
  const C = { nav: NAV, bvh: geometry.boundsTree, cells: new Map() };
  NAV.nodes.forEach((p, i) => { const k = Math.floor(p[0] / 2) + ',' + Math.floor(p[2] / 2); if (!C.cells.has(k)) C.cells.set(k, []); C.cells.get(k).push(i); });
  return C;
}
let fail = 0;
for (const map of ['ascent', 'bind', 'breeze', 'haven', 'lotus', 'split']) {
  const C = loadMap(map), NAV = C.nav, N = NAV.nodes;
  NM.routeCache.clear();
  const t0 = performance.now();
  const first = nmPath(C, NAV.spawnNodes[0], NAV.siteNodes.A);
  const coldMs = performance.now() - t0;
  const memoSize = C.climbMemo ? C.climbMemo.size : 0;
  const t1 = performance.now();
  nmPath(C, NAV.spawnNodes[0], NAV.siteNodes.A);
  const warmMs = performance.now() - t1;
  let checked = 0;
  const routes = [first, ...Object.values(NAV.siteNodes).map(site => nmPath(C, NAV.spawnNodes[1], site))];
  for (const path of routes) {
    if (!path.length) { console.error('FAIL', map, 'empty path'); fail = 1; continue; }
    for (let k = 1; k < path.length; k++) {
      const dy = N[path[k]][1] - N[path[k - 1]][1];
      if (dy > 0.321) { checked++; if (!nmClimbOk(C, path[k - 1], path[k])) { console.error('FAIL', map, 'plans unclimbable hop', path[k - 1], '->', path[k], 'dy', dy.toFixed(3)); fail = 1; } }
    }
  }
  console.log((fail ? 'FAIL ' : 'PASS ') + map + ': ' + (1 + Object.keys(NAV.siteNodes).length) + ' routes, dy>0.321 hops verified ' + checked + ', cold first-route ' + coldMs.toFixed(0) + 'ms (climb checks ' + memoSize + '), warm ' + warmMs.toFixed(1) + 'ms');
}
process.exitCode = fail;
console.log('Done.');
