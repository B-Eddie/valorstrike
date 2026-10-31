// UI lane: element ids the scripts create at runtime (el.id = "...") must not reuse an id already in the page markup.
// Found by the UI tour (2026-10-30): the Phoenix Curveball L/R-click hint was created as id "xCbH", the id of the
// Settings > General > "Colourblind HUD" Off/On segment. Its injected rule #xCbH{position:fixed;left:50%;top:calc(50% + 30px);
// transform:translateX(-50%)...} also styled the settings segment, which floated out of its row over "Enemy highlight colour"
// (Colourblind HUD row left empty), and getElementById("xCbH") in xCbHintTick found the settings segment first, so the
// in-match hint tag never turned on.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const stat=new Map();for(const m of html.matchAll(/<[a-zA-Z][^>]*\sid="([A-Za-z0-9_-]+)"/g))stat.set(m[1],(stat.get(m[1])||0)+1);
const dyn=[...html.matchAll(/\.id\s*=\s*["']([A-Za-z0-9_-]+)["']/g)].map(m=>m[1]);
const clash=[...new Set(dyn.filter(d=>stat.has(d)))];
assert.deepEqual(clash,[],'runtime-created ids that already exist in the markup: '+clash.join(', '));
// the settings colourblind segment keeps its id (settings code / browser_qa_flows click it) and the hint has its own
assert.ok(/<div class="seg" id="xCbH">/.test(html),'settings Colourblind HUD segment #xCbH');
assert.ok(!/st\.textContent = "#xCbH\{/.test(html),'curveball hint CSS must not target #xCbH');
console.log('test_ui_dom_ids ok:',stat.size,'markup ids,',dyn.length,'runtime ids, no clash');
