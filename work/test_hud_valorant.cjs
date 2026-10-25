// HUD v2 (Valorant in-game HUD layout, <style id="xHudV2">): static guards. Browser evidence: work/browser_hud_valorant.cjs.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i1=html.indexOf('<style id="xHudV">'),i2=html.indexOf('<style id="xHudV2">');assert(i1>0&&i2>i1,'xHudV2 follows xHudV (its rules must win the cascade)');
const css=html.slice(i2,html.indexOf('</style>',i2));
// fonts: bundled OFL fonts as data URIs, nothing fetched
for(const f of ['VS Hud','VS Title'])assert(new RegExp('@font-face\\{font-family:"'+f+'";src:url\\(data:font/woff2;base64,[A-Za-z0-9+/=]{2000,}\\)').test(css),f+' embedded');
assert(!/url\((["']?)https?:/.test(css)&&!/fonts\.googleapis|fonts\.gstatic/.test(html),'no network fonts');
// top bar: portraits carry agent initial + colour, dead / ult classes; 5v5 built from the scoreboard teams at most 4 Hz or on a death
assert(/xHud\.pk0 !== ka \+ ke/.test(html)&&/data-a="\$\{ag\[0\]\.toUpperCase\(\)\}"/.test(html)&&/\$\{ur \? " ult" : ""\}/.test(html),'portrait markup');
assert(/#game \.x-top \.x-pp i\.ult\{/.test(css)&&/#game \.x-top \.x-pp i\.dead\{/.test(css)&&/#game \.x-top \.x-pp i::before\{content:attr\(data-a\)/.test(css),'portrait styles');
// buy phase: clock only in the hex timer, BUY PHASE label under the bar
assert(/setT\("xTm", duel \? clk\(du\.t\) : bp \? clk\(FV\.buy\) : clk\(timeLeft\)\)/.test(html)&&/\.x-top\.x-bpo::before\{content:"BUY PHASE"/.test(css),'buy-phase timer');
// the Spike icon still replaces the clock (.x-spk ::after) and is not clipped: the hex is drawn by ::before, not clip-path on #xTm
assert(!/#game \.x-top \.x-tm\{[^}]*clip-path/.test(css)&&/#game \.x-top \.x-tm::before\{[^}]*clip-path/.test(css),'timer hex on ::before');
console.log('HUD v2: xHudV2 after xHudV, bundled fonts (no network), portraits (agent / dead / ult), buy-phase timer + label, Spike slot intact');
