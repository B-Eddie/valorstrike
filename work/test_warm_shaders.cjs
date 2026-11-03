// Loading-gate shader warm-up: the full-scene shader compile + a texture-upload render happen
// behind the loading screen (readiness), not on the first playable frame (early-match hitch).
const fs = require('fs'), assert = require('assert/strict');
const s = fs.readFileSync('index.html', 'utf8');

// bridge: defined next to xPrecompile, guarded, runs precompile + one warm render
// gpu lane step 4 (c6464d2): the bridge no longer returns when xPC is set (xGate precompiles on the first running frame, before the
// gate built the held rigs / agent bodies); it builds the agent bodies (xVisB, dt 0), clears xPC and precompiles again over everything
assert(/window\.xWarmShaders = function \(\) \{\n  if \(!running\) return;/.test(s), 'xWarmShaders bridge defined with running guard');
assert(/window\.xWarmShaders[\s\S]{0,600}xPC = false; try \{ xPrecompile\(\); \}/.test(s), 'bridge clears xPC and runs xPrecompile');
assert(/window\.xWarmShaders[\s\S]{0,400}renderer\.render\(scene, camera\)/.test(s), 'bridge runs one warm render (texture upload)');

// gate: warm step sits between the match-build fn and fill()/ready() in the load chain
assert(/var warm = function \(v\) \{ \/\/ compile shaders \+ upload textures behind the overlay/.test(s), 'warm step defined');
assert(/\.then\(warm\)\.then\(function\(v\)\{if\(id===loadId\)\{if\(!title\)fill\(\);ready\(\);/.test(s), 'warm runs after fn, before fill/ready');
assert(/xLdSet\("xLdAg", "textContent", "PREPARING/.test(s), 'status text shown while warming');

// unchanged behavior: xGate still fires xPrecompile when xPC is false (probe/direct-start path)
// iOS warm crash: not while the gate's overlay is up (its warm step precompiles after the staged upload)
assert(/if \(!running\) xPC = false; else if \(!xPC && !window\.xLdOn\) xPrecompile\(\);/.test(s), 'xGate fallback intact (outside the loading gate)');
assert(/window\.xWarmStaged\(function \(\) \{ return id === loadId; \}\)[\s\S]{0,300}window\.xWarmShaders\(\)/.test(s), 'the gate stages the uploads (xWarmStaged) before the warm step');
// hardening: cancel during warm runs nothing (id re-check), hidden-tab rAF starvation cannot stick the overlay (timeout fallback)
assert(/var done = false, fin = function \(\) \{ if \(done\) return; done = true;/.test(s), 'single-fire fin guard');
assert(/if \(id === loadId\) \{ try \{ window\.xWarmShaders\(\); \} catch \(e\) \{\} \}/.test(s), 'load id re-checked at warm time');
assert(/setTimeout\(fin, 4000\)/.test(s), 'timeout fallback when rAF starves (hidden tab)');
console.log('test_warm_shaders PASS');
