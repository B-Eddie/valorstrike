// Combat hitches (user, 17 Nov 2026: "lag spikes, especially when the player gets shot at"). Measured in real Chrome, M1 @2x,
// offline 5v5 Ascent through the load gate; each item was a 30-110 ms frame:
//  A. round / first-blood banner: no forced reflow (void offsetWidth) mid-tick; the fade-in starts from @starting-style.
//  B. the banner subtitle font ("VS Hud") is loaded at boot, not on the first-blood / death frame.
//  C. glyph fallback warm-up: ▸ ◆ ◎ ... are laid out once per HUD font combo in idle time outside a match (the OS fallback-font
//     lookup was 35-60 ms inside the death frame's layout).
//  D. the barrier countdown measures the banner's glyphs only while the countdown shows (the observer fired on every banner).
//  E. concussed bar restart and spike-plant timer check: no forced layout.
//  F. three r149 draws transparent DoubleSide materials twice and re-resolves their program each pass: flat map cards and the
//     hit impact are single pass.
//  G. no online-count fetch during a match.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = (nm) => { const i = html.indexOf('\nfunction ' + nm + '('); assert(i >= 0, nm + ' missing'); let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && !--d) break; } return html.slice(i + 1, j + 1); };
// A
assert(!/offsetWidth/.test(body('annNext')), 'annNext forces no reflow');
assert(/@starting-style\{\.x-ann\.on\{opacity:0;transform:translateY\(-14px\)\}\}/.test(html), 'banner fade-in from @starting-style');
// B
assert(/document\.fonts\.load\(f\)/.test(html) && /'16px "VS Hud"'/.test(html) && /'16px "VS Title"'/.test(html), 'HUD fonts loaded at boot');
// C
const gw = html.slice(html.indexOf('// Glyph fallback warm-up'), html.indexOf('// Glyph fallback warm-up') + 4000);
assert(gw.length > 1000, 'glyph warm-up block present');
for (const ch of '▸◆◎·★✓') assert(gw.includes(ch), 'warm-up covers ' + ch);
assert(/if \(typeof running !== "undefined" && running\)/.test(gw), 'warm-up never runs inside a match');
assert(/requestIdleCallback/.test(gw), 'warm-up in idle time');
// every non-ASCII glyph the page's markup / scripts use is in the warm-up set (a new symbol in a HUD string must be added there)
const set = gw.match(/const CH = "([^"]+)"/)[1], used = new Set();
for (const ch of html.replace(/base64,[A-Za-z0-9+/=]+/g, '')) { const c = ch.codePointAt(0); if (c > 126 && c !== 0xfeff && c !== 0xa0) used.add(ch); }
const missing = [...used].filter((ch) => !set.includes(ch));
assert.deepEqual(missing, [], 'glyphs used but not warmed: ' + missing.join(' '));
// D
assert(/if \(aOn && n > 0\) \{ const gb = xAnnBottom\(an\)/.test(html), 'glyph measure only while the countdown shows');
// E
assert(!/void b\.offsetWidth/.test(html), 'concussed bar restarts without a reflow');
assert(/t\.checkVisibility \? t\.checkVisibility\(\)/.test(html), 'plant timer check without forced layout');
// F
const nm = fs.readFileSync(path.join(__dirname, 'native_maps_runtime.js'), 'utf8');
for (const [n, s] of [['index.html', html], ['native_maps_runtime.js', nm]]) assert(/new THREE\.MeshLambertMaterial\(\{name:m\.name,color:m\.color,map:m\.map,side:THREE\.DoubleSide,forceSinglePass:true/.test(s), n + ': map materials single pass');
assert(html.includes(nm.trimEnd()), 'native_maps_runtime.js generated verbatim');
assert(/side:T\.DoubleSide,forceSinglePass:true\}\)/.test(fs.readFileSync(path.join(root, 'vendor', 'hit-impact.js'), 'utf8')), 'hit impact single pass');
// G
assert(/async function netPresenceRefresh\(\)\{if\(document\.hidden\|\|\(typeof running!=='undefined'&&running\)\)return;/.test(html), 'no online-count fetch while a match runs');
console.log('combat hitch: OK (banner without reflow, HUD fonts at boot, glyph fallback warm-up covers ' + used.size + ' glyphs, countdown measure gated, no forced layout on concuss / plant, single-pass map cards + hit impact, no directory poll in a match)');
