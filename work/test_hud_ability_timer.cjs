// Ability duration / window timers where VALORANT shows them (work/validation/hud-parity-2026-10-28.md): a small bar right
// above that ability's icon (Jett's Tailwind meter moved there from under the crosshair in 2023). Tailwind: white bar filling
// over the 1 s windup, then a teal bar draining over the 7.5 s window; Phoenix Run It Back (10 s) and Sova Owl Drone (7 s)
// the same way. Online Tailwind reads the server status (NET.tw) and no longer shows as the red banner at the bottom of the
// screen. Touch: the E touch button carries the same bar (the desktop ability bar is hidden on touch).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),net=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,'missing '+a);const j=s.indexOf(b,i);assert(j>i,'missing '+b);return s.slice(i,j);};
// fake slot elements
function El(id){this.id=id;this.kids=[];this.cls=new Set();this.vars={};const me=this;
 this.classList={add:(...c)=>c.forEach(k=>me.cls.add(k)),remove:(...c)=>c.forEach(k=>me.cls.delete(k)),contains:k=>me.cls.has(k),toggle:(k,on)=>{if(on===undefined)on=!me.cls.has(k);if(on)me.cls.add(k);else me.cls.delete(k);return on;}};
 this.style={setProperty:(k,v)=>{me.vars[k]=String(v);},getPropertyValue:k=>me.vars[k]||'',removeProperty:k=>{delete me.vars[k];}};}
El.prototype={appendChild(c){this.kids.push(c);return c;},querySelector(s){return s==='.x-tm'?this.kids.find(k=>k.className==='x-tm')||null:null;},setAttribute(){},get isConnected(){return true;}};
const els={jC:new El('jC'),jQ:new El('jQ'),jE:new El('jE'),jX:new El('jX')};
let now=0;const ctx={Math,performance:{now:()=>now},document:{createElement:t=>{const e=new El();e.tag=t;return e;}},$:id=>els[id]||null,J:{pick:'Jett'},XTW:{windup:1,window:7.5},NET:{}};
vm.createContext(ctx);
vm.runInContext(cut(html,'function xAbTmv(','function jTick(dt)'),ctx);
const E=els.jE;
// nothing open: no bar
assert.deepEqual({...ctx.xAbTm()},{});assert(!E.cls.has('x-tmon'),'no timer while Tailwind is not armed');
// offline windup half way: white, half full
ctx.J.tw={arm:.5,t:8};ctx.xAbTm();assert(E.cls.has('x-tmon')&&E.cls.has('x-tmw'),'windup bar shown, windup style');assert.equal(E.vars['--tm'],'0.500');assert.equal(E.kids.filter(k=>k.className==='x-tm').length,1,'one bar element');assert.equal(E.kids[0].tag,'q');
// window: teal, draining
ctx.J.tw={arm:-.1,t:3.75};ctx.xAbTm();assert(E.cls.has('x-tmon')&&!E.cls.has('x-tmw'));assert.equal(E.vars['--tm'],'0.500','3.75 s of 7.5 s left');
ctx.J.tw={arm:-1,t:7.5};ctx.xAbTm();assert.equal(E.vars['--tm'],'1.000');
// faded: bar gone, no extra element made
ctx.J.tw=null;ctx.xAbTm();assert(!E.cls.has('x-tmon')&&!E.cls.has('x-tmw'),'bar hidden when the window ends');assert.equal(E.kids.length,1);
// online: NET.tw {a: windup left, u: windup + window left, at}
ctx.NET={socket:{},tw:{a:.6,u:8.1,at:0}};now=300;ctx.xAbTm();assert(E.cls.has('x-tmw'));assert.equal(E.vars['--tm'],'0.700','0.3 s of the 1 s windup left: 70 % filled');
now=2600;ctx.xAbTm();assert(!E.cls.has('x-tmw')&&E.cls.has('x-tmon'));assert.equal(E.vars['--tm'],(5.5/7.5).toFixed(3),'online window drains from the server value');
now=9000;ctx.xAbTm();assert(!E.cls.has('x-tmon'),'online window over');
ctx.NET={};
// Phoenix Run It Back / Sova drone
ctx.J={pick:'Phoenix',rib:5};ctx.xAbTm();assert(els.jX.cls.has('x-tmon'));assert.equal(els.jX.vars['--tm'],'0.500');ctx.J.rib=0;ctx.xAbTm();assert(!els.jX.cls.has('x-tmon'));
ctx.J={pick:'Sova',dr:{t:3.5}};ctx.xAbTm();assert.equal(els.jC.vars['--tm'],'0.500');assert(!els.jE.cls.has('x-tmon'));
// jTick runs it every frame, ahead of the slot-cache early return
const jt=cut(html,'function jTick(dt)','// ---- Spike in 5v5');assert(/xAbTm\(\);[^\n]*\n[^\n]*const st = JSON\.stringify\(sl\.map/.test(jt)||/xAbTm\(\); const st = JSON\.stringify\(sl\.map/.test(jt),'xAbTm before the slot cache check');
// CSS: bar centred right above the icon (inside the slot, above its top edge), teal draining / white windup, slot corner text hidden
const ci=html.indexOf('<style id="xHudParity">');assert(ci>html.indexOf('<style id="xHudNative">'),'parity styles after xHudNative (win the cascade)');const css=html.slice(ci,html.indexOf('</style>',ci));
assert(/#game \.x-ab \.x-as>\.x-tm\{[^}]*position:absolute;[^}]*left:50%;[^}]*top:-\d+px;[^}]*quotes:none/.test(css),'bar above the icon, centred');
assert(/#game \.x-ab \.x-as\.x-tmon>\.x-tm\{display:block\}/.test(css),'shown only while a timer runs');
assert(/#game \.x-ab \.x-as>\.x-tm::after\{[^}]*transform:scaleX\(var\(--tm,0\)\)[^}]*background:#5feeb8/.test(css),'teal fill scaled by --tm');
assert(/#game \.x-ab \.x-as\.x-tmw>\.x-tm::after\{background:#ece8e1/.test(css),'white windup');
assert(/#game \.x-ab \.x-as\.x-tmon>em\{visibility:hidden\}/.test(css),'no corner countdown text while the bar shows');
assert(/#game \.x-ab \.x-as \.x-pp s\.on\{background:#5feeb8\}/.test(css),'available charges teal (VALORANT), not white');
// online: Tailwind left out of the red status banner
assert(!/TAILWIND/.test(cut(net,'function netStatusChips(st){','\n')),'no Tailwind text in the online status banner');
assert(/NET\.tw=\{a:\+st\.twa\|\|0,u:\+st\.twu\|\|0,at:now\}/.test(net),'NET.tw still fed from the server status');
// touch: E button mirrors the timer (bar above the button), countdown badge dropped while it shows
const tm=html.slice(html.indexOf('setInterval(() => { if (!T.classList.contains("on")) return; xTbIco();'));assert(/b\.classList\.toggle\("tm", tmo\); b\.classList\.toggle\("tmw", !!\(sl && sl\.classList\.contains\("x-tmw"\)\)\); if \(tmo\) b\.style\.setProperty\("--tm", sl\.style\.getPropertyValue\("--tm"\)\);/.test(tm.slice(0,3000)),'touch mirror');
assert(/#xT \.tb\.tm::before\{[^}]*top:-\d+px;[^}]*transform:scaleX\(var\(--tm,0\)\)/.test(css),'touch bar above the button');
console.log('Ability timers: bar above the icon (Tailwind windup white -> 7.5 s window teal, Run It Back, Owl Drone), online from NET.tw (not the red banner), touch E button mirror, teal charges');
