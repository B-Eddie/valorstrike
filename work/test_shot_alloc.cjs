// Per-shot allocation regression (damage-lag pass): shoot()/xPellets ran
// solids.concat(bots.filter(...).flatMap(...)) (+ a second concat when dropped guns were live)
// per bullet - several large arrays per shot at 10-14 rounds/s. Target lists must come from the
// pooled xTgtA/xTgtB scratch via xShotTgts, with no concat/filter/flatMap on the hot path.
const fs=require('fs'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const fn=(name)=>{const a=s.indexOf('function '+name+'(');assert(a>=0,name);let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&!--d)break;}return s.slice(a,i+1);};
const shoot=fn('shoot'),pel=fn('xPellets'),tg=fn('xShotTgts');
assert.doesNotMatch(shoot,/\.concat\(|\.filter\(|\.flatMap\(/,'shoot() allocates per shot');
assert.doesNotMatch(pel,/\.concat\(/,'xPellets() concats per shot');
assert.match(shoot,/xShotTgts\(targets\)/,'shoot raycasts via the pooled helper');
assert.match(pel,/xShotTgts\(targets\)/,'xPellets raycasts via the pooled helper');
assert.match(shoot,/xTgtA/,'shoot builds into the pooled xTgtA scratch');
assert.doesNotMatch(shoot,/new THREE\.Vector2\(0, 0\)/,'shoot reuses a scratch Vector2');
assert.match(tg,/xTgtB/,'xShotTgts builds the dropped-gun list into pooled xTgtB');
// Layout contract the patched Raycaster.intersectObjects relies on: solids first, hitboxes after.
const order=shoot.indexOf('solids.length')<shoot.indexOf('b.alive');
assert(order,'solids are pushed before bot hitboxes (spatial-cell fast path identity check)');
// repath: the feel layer's gFire (work/feel_runtime.js, the gFire every gun shot runs) built its spread / recoil basis from three
// new Vector3 per shot (right, the world up it crossed with, up); scratch vectors give the same basis.
{const a=s.indexOf('gFire=function(d,w,W){');assert(a>=0,'feel gFire');const g=s.slice(a,s.indexOf('\n};',a));assert.doesNotMatch(g,/new THREE\.Vector3/,'gFire allocates its spread basis per shot');}
console.log('Shot path: pooled target lists (xTgtA/xTgtB via xShotTgts), no per-shot concat/filter/flatMap, scratch Vector2, solids-first layout preserved, feel gFire basis in scratch vectors');
