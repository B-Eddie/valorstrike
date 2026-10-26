// Top-level function names in the generated index.html must be unique: the page is one classic script, so a second
// `function X` declaration silently replaces the first everywhere (hoisting), including inside the earlier block.
// Regression (hk-30, browser cam1 console "foot planting disabled for a frame ... reading 'scale' at xfPose"): skin finishers'
// xfPose(s, t) replaced foot planting's xfPose(M, dt, C), so foot planting threw on every agent every frame (caught and
// logged once) and never ran in the page; work/test_feet.cjs loads feet_runtime.js alone and could not see it. Finishers' pose
// is now xfnPose. Pinned below: the finisher pose is not called from the foot block and vice versa.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// KNOWN: xFreeMap(o, keep) (useMap, legacy maps) is shadowed by xFreeMap(k, call) (Split / Lotus / Breeze rebuild) since 2eaf3b6;
// the useMap call throws inside its try and frees nothing. Reported, not changed (re-enabling GPU frees there needs its own browser check).
const KNOWN=new Set(['xFreeMap']);
const seen=new Map(),dup=[];
html.split('\n').forEach((l,i)=>{const m=/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/.exec(l);if(!m)return;const n=m[1];if(seen.has(n)){if(!KNOWN.has(n))dup.push(`${n} (lines ${seen.get(n)+1} and ${i+1})`);}else seen.set(n,i);});
assert.deepEqual(dup,[],'duplicate top-level function declarations: '+dup.join(', '));
const feet=fs.readFileSync(path.join(__dirname,'feet_runtime.js'),'utf8'),fin=fs.readFileSync(path.join(__dirname,'finishers_runtime.js'),'utf8');
assert(/function xfPose\(M, dt, C\)/.test(feet)&&/xfPose\(M, M\.sx\.poseDt/.test(feet),'foot planting keeps its xfPose');
assert(/function xfnPose\(s,t\)/.test(fin)&&!/\bxfPose\b/.test(fin),'finishers use xfnPose only');
console.log('global names: '+seen.size+' top-level functions unique (known: '+[...KNOWN].join(', ')+'); foot planting xfPose not shadowed');
