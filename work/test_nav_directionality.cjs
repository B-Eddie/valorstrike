// Executes the SHIPPED nmPath (extracted from work/native_maps_runtime.js) against the real
// lotus navigation.json: paths must never plan a climb the motor cannot make (dy > 0.321),
// while one-way drops stay routable downward and climbable reachability is preserved.
const fs = require('fs');
const src = fs.readFileSync('work/native_maps_runtime.js', 'utf8');
const start = src.indexOf('function nmPath(C,start,end,banned){');
let depth = 0, endI = -1;
for (let i = start; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { endI = i + 1; break; } }
const m = endI > start ? [src.slice(start, endI)] : null;
if (!m) { console.error('nmPath not found in runtime'); process.exit(1); }
global.NM = { routeCache: new Map() };
eval(m[0]);
const NAV = JSON.parse(fs.readFileSync('server/public/worlds/lotus/navigation.json', 'utf8'));
const C = { nav: NAV };
const ok = i => !NAV.valid || NAV.valid[i];
const N = NAV.nodes;
function checkPath(path, label) {
  if (!path.length) { console.error('FAIL:', label, 'empty path'); process.exitCode = 1; return; }
  for (let k = 1; k < path.length; k++) {
    const dy = N[path[k]][1] - N[path[k-1]][1];
    if (dy > 0.321) { console.error('FAIL:', label, 'plans impossible climb at hop', path[k-1], '->', path[k], 'dy', dy.toFixed(3)); process.exitCode = 1; return; }
  }
  console.log('PASS:', label, '-', path.length, 'hops, all climbs within the 0.321 limit');
}
// the step's lower band is a true one-way pocket: every exit climbs >0.321 (verified by BFS),
// so from inside it the honest answer is NO path (today's behavior is a stall-ban loop).
const pock = nmPath(C, 3713, 3543);
if (pock.length) checkPath(pock, 'pocket 3713 -> upper 3543');
else console.log('PASS: pocket 3713 -> upper 3543 = no path (true one-way pocket; replaces stall-ban loop with honest no-route)');
// from OUTSIDE the pocket, the upper band must remain reachable with all-climbable hops
checkPath(nmPath(C, NAV.spawnNodes[0], 3543), 'attacker spawn -> upper band 3543');
checkPath(nmPath(C, NAV.spawnNodes[1], 3626), 'defender spawn -> upper band 3626');
// down across the step stays allowed (drops traversable)
const down = nmPath(C, 3543, 3713);
if (!down.length) { console.error('FAIL: downward path across the one-way drop lost'); process.exitCode = 1; }
else console.log('PASS: upper 3543 -> lower 3713 downward path exists -', down.length, 'hops');
// spawns -> each site stays reachable (nmEnsure's own validation criterion)
for (const s of ['A', 'B', 'C']) checkPath(nmPath(C, NAV.spawnNodes[0], NAV.siteNodes[s]), 'attacker spawn -> site ' + s);
// cache consistency: second call identical
const a = nmPath(C, 3713, 3543), b = nmPath(C, 3713, 3543);
if (a.join(',') !== b.join(',')) { console.error('FAIL: cached path differs'); process.exitCode = 1; }
console.log('Done.');
