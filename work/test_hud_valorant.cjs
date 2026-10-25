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
// vitals: shield icon state from the armour value (hidden at 0, dashed = light shield); health underline mirrors #xHp
assert(/ar\.classList\.toggle\("x-z", an <= 0\); ar\.classList\.toggle\("x-lt", an > 0 && an <= 25\);/.test(html)&&/#game \.x-bl #xArm\.x-z\{visibility:hidden\}/.test(css),'shield icon states');
// abilities: slot ids + children the game and hark-abil write (key label <b>, name <span>, charges <em>, pips .x-pp) unchanged
assert(/<div class="x-as" id="jC"><i><\/i><b>C<\/b><span>Cloudburst<\/span><em><\/em><\/div>/.test(html),'ability slot markup');
assert(/#game \.x-ab \.x-as\.x-eq,#game \.x-ab #jX\.x-eq\{box-shadow:inset 0 0 0 2px/.test(css),'hark-abil equipped-slot outline kept');
assert(/#game \.x-ab \.x-as>span:not\(\.x-pp\):not\(#xPips\)\{position:absolute!important/.test(css),'only the name span is visually hidden (pips stay)');
assert(/@media \(max-width:820px\),\(pointer:coarse\)\{[^}]*?\}?[\s\S]*?#game \.x-ab \.x-as \.x-pp\{bottom:14px;display:flex\}/.test(css),'compact screens show the charge pips (#xHudV hid every slot span)');
console.log('HUD v2: shield states, ability slot hooks + equipped outline, charge pips on compact screens');
// ammo + credits: no panels, credits glyph drawn (Oswald has no U+00A4), desktop ammo right of the abilities
assert(/#game #xCr small::before\{content:"";[^}]*background:url\("data:image\/svg\+xml/.test(css)&&/#game \.hud\.x-br\{position:fixed;left:calc\(50% \+ 168px\)/.test(css),'ammo / credits');
console.log('HUD v2: ammo beside the abilities on desktop, credits glyph');
// kill feed: kill rows tagged kf--k with portrait initials (data-a / --c), Valorant skull headshot, wallbang mark from shoot()
assert(/const d = kfGet\("kf kf--k"/.test(html)&&/s\.dataset\.a = String\(pa\)\[0\]\.toUpperCase\(\)/.test(html),'kill row class + portrait data');
assert(/const KF_WB = '<svg class="kf__wb"/.test(html)&&/\(wb \? KF_WB : ""\) \+ \(hs \? KF_HS : ""\)/.test(html)&&/if \(wk < 1\) \{ xWB\.on = true;/.test(html)&&/xWB\.on = false; const d = kfGet/.test(html),'wallbang mark wired (set on a wall-penetrating player shot, consumed by the next kill row)');
assert(/#game #feed \.kf--k>\.kf__n:first-child::before,#game #feed \.kf--k>\.kf__n:nth-child\(3\)::after\{content:attr\(data-a\)/.test(css)&&/#game #feed \.kf--k\.kf--mine\{box-shadow:inset 0 0 0 2px #f2dc8b/.test(css),'kill feed styles');
console.log('HUD v2: kill feed portraits, skull headshot, wallbang mark, own-kill outline');
