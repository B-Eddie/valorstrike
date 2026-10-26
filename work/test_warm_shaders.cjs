// Loading-gate shader warm-up: the full-scene shader compile + a texture-upload render happen
// behind the loading screen (readiness), not on the first playable frame (early-match hitch).
const fs = require('fs'), assert = require('assert/strict');
const s = fs.readFileSync('index.html', 'utf8');

// bridge: defined next to xPrecompile, guarded, runs precompile + one warm render
assert(/window\.xWarmShaders = function \(\) \{\n  if \(!running \|\| xPC\) return;/.test(s), 'xWarmShaders bridge defined with running/xPC guard');
assert(/window\.xWarmShaders[\s\S]{0,220}xPrecompile\(\)/.test(s), 'bridge runs xPrecompile');
assert(/window\.xWarmShaders[\s\S]{0,400}renderer\.render\(scene, camera\)/.test(s), 'bridge runs one warm render (texture upload)');

// gate: warm step sits between the match-build fn and fill()/ready() in the load chain
assert(/var warm = function \(v\) \{ \/\/ compile shaders \+ upload textures behind the overlay/.test(s), 'warm step defined');
assert(/\.then\(warm\)\.then\(function\(v\)\{if\(id===loadId\)\{if\(!title\)fill\(\);ready\(\);\}/.test(s), 'warm runs after fn, before fill/ready');
assert(/xLdSet\("xLdAg", "textContent", "PREPARING/.test(s), 'status text shown while warming');

// unchanged behavior: xGate still fires xPrecompile when xPC is false (probe/direct-start path)
assert(/if \(!running\) xPC = false; else if \(!xPC\) xPrecompile\(\);/.test(s), 'xGate fallback intact');
// hardening: cancel during warm runs nothing (id re-check), hidden-tab rAF starvation cannot stick the overlay (timeout fallback)
assert(/var done = false, fin = function \(\) \{ if \(done\) return; done = true;/.test(s), 'single-fire fin guard');
assert(/if \(id === loadId\) \{ try \{ window\.xWarmShaders\(\); \} catch \(e\) \{\} \}/.test(s), 'load id re-checked at warm time');
assert(/setTimeout\(fin, 4000\)/.test(s), 'timeout fallback when rAF starves (hidden tab)');
console.log('test_warm_shaders PASS');
