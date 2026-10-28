// Floor-gun pickup prompt styled and placed as VALORANT's interaction prompt (work/validation/hud-parity-2026-10-28.md,
// patch 8.07: contrast added, short text, no skin names): centred just below the crosshair, a filled light key cap with a dark
// letter, uppercase text in the HUD face with a soft contrast plate, no boxed dark panel; touch shows no key cap (USE button).
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>=0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing '+b);return html.slice(i,j);};
const fn=cut('function xdPrompt()','(function xdPromptLoop');
// markup: class-styled (no inline panel), key cap element, weapon name only (no skin)
assert(/el\.className = "x-int";/.test(fn),'prompt uses the x-int class');
assert(!/el\.style\.cssText =/.test(fn),'no inline panel styling');
assert(/el\.innerHTML = '<b class="x-key">F<\/b><span><\/span>';/.test(fn),'key cap + label');
assert(/const text = "Pick up " \+ d\.w;/.test(fn),'"Pick up <weapon>" (no skin name)');
assert(/el\.style\.display = "none";/.test(fn),'created hidden');
const ci=html.indexOf('<style id="xHudParity">');assert(ci>0,'parity style block');const css=html.slice(ci,html.indexOf('</style>',ci));
const rule=sel=>{const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\#]/g,'\\$&')+'\\{([^}]*)\\}'));assert(m,'rule '+sel);return m[1];};
const p=rule('#xdPrompt.x-int');
assert(/position:fixed/.test(p)&&/left:50%/.test(p)&&/transform:translateX\(-50%\)/.test(p),'centred horizontally');
const top=p.match(/top:calc\(50% \+ max\((\d+)px,(\d+)vh\)\)/);assert(top,'top below the screen centre (crosshair)');
// below the crosshair's default extent (outer lines end ~14 px out, ring <= 100 px is drawn inside #cross) and well above the
// ability bar (bottom 18 px + 70 px slot + 9 px timer) on 720p / 1080p
for(const h of [720,1080]){const y=h/2+Math.max(+top[1],h*top[2]/100);assert(y-h/2>=50,'clear of the crosshair at '+h+'p');assert(y+24<h-18-70-12,'above the ability bar at '+h+'p ('+y+')');}
assert(/text-transform:uppercase/.test(p)&&/font:[^;]*var\(--hf/.test(p),'HUD face, uppercase');
assert(/text-shadow:/.test(p)&&/background:linear-gradient\(90deg,transparent/.test(p),'soft contrast plate, not a boxed panel');
assert(!/border:/.test(p),'no border box');
const k=rule('#xdPrompt .x-key');assert(/background:#ece8e1/.test(k)&&/color:#0f1923/.test(k),'filled light key cap, dark letter');
assert(/@media \(pointer:coarse\)\{[^{}]*#xdPrompt \.x-key\{display:none\}/.test(css),'touch: no keyboard key cap');
console.log('Pickup prompt: VALORANT interaction prompt (centred below crosshair, filled key cap, uppercase HUD face, contrast plate; no key on touch)');
