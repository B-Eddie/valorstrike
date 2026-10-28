// Online client shows the server's Alarmbot Vulnerable and Trapwire tether status (roundState status.vulnerable /
// status.tether, added server-side in 23f3bf7 but never read by the client): a one-time notice on onset and a
// countdown chip while either lasts, hidden when both end.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const net=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=net.indexOf('function netStatusChips(st){'),j=net.indexOf('\n',i);assert(i>0,'netStatusChips missing');
assert(/mpCliRS=function\(m\)\{[^\n]*if\(NET\.socket&&m\.status\)\{[^\n]*netStatusChips\(st\)/.test(net),'round-state status handler calls netStatusChips');
assert(html.includes(net.slice(i,j)),'index.html carries the generated status chip code');
const els={},said=[];let now=1000;
const document={getElementById:id=>els[id]||null,createElement:t=>({tag:t,style:{},textContent:''}),body:{appendChild:e=>e}};
const NET={};const ctx=vm.createContext({document,performance:{now:()=>now},say:(t,ms)=>said.push(t),Math,NET});
// register the element by id once assigned
const realCreate=document.createElement;document.createElement=t=>{const e=realCreate(t);return new Proxy(e,{set(o,k,v){o[k]=v;if(k==='id')els[v]=o;return true;}});};
vm.runInContext('let netVulnAt=0,netTetherAt=0;'+net.slice(i,j),ctx);
assert.deepEqual([...ctx.netStatusChips({vulnerable:0,tether:0})],[],'nothing active: no chip');assert(!els.netSt,'no element created needlessly');
ctx.netStatusChips({vulnerable:3.6,tether:0});assert.equal(els.netSt.style.display,'block');assert.equal(els.netSt.className,'x-nst','styled by the HUD sheet, no inline red banner');assert.match(els.netSt.textContent,/^VULNERABLE 3\.6s$/);assert.equal(said.length,1);assert.match(said[0],/Vulnerable · taking double damage · 4 s/);
now+=100;ctx.netStatusChips({vulnerable:3.5,tether:2.4});assert.equal(said.length,2,'vulnerable notice not repeated every round-state; tether notice once');assert.match(said[1],/Slowed by Trapwire · move 4 m away/);assert.equal(els.netSt.textContent,'VULNERABLE 3.5s · TRAPWIRE');
now+=100;ctx.netStatusChips({vulnerable:3.4,tether:2.3});assert.equal(said.length,2);
now+=4000;ctx.netStatusChips({vulnerable:0,tether:0});assert.equal(els.netSt.style.display,'none','chip hidden when both end');
ctx.netStatusChips({vulnerable:4,tether:0});assert.equal(said.length,3,'a fresh Alarmbot hit notifies again');
// Spycam dart in me (server status dart / drm, 1.85 s removal channel on h4): the chip says how to remove it, then the channel progress.
now+=6000;ctx.netStatusChips({vulnerable:0,tether:0,dart:1,drm:0});assert.equal(els.netSt.style.display,'block');assert.equal(els.netSt.textContent,'TRACKING DART · HOLD 4 TO REMOVE');
ctx.netStatusChips({vulnerable:0,tether:0,dart:1,drm:.925});assert.equal(els.netSt.textContent,'REMOVING DART 50%');ctx.netStatusChips({vulnerable:0,tether:0,dart:0,drm:0});assert.equal(els.netSt.style.display,'none','removed: chip hidden');
// Jett Tailwind (server status twa / twu: 1 s windup, 7.5 s window)
ctx.netStatusChips({vulnerable:0,tether:0,twa:.6,twu:8.1});assert.equal(els.netSt.style.display,'none','Tailwind is the bar above the E icon (xAbTm, test_hud_ability_timer), not this banner');assert.equal(JSON.stringify(NET.tw),JSON.stringify({a:.6,u:8.1,at:now}));ctx.netStatusChips({vulnerable:0,tether:0,twa:0,twu:6.2});assert.equal(els.netSt.style.display,'none');assert.equal(JSON.stringify(NET.tw),JSON.stringify({a:0,u:6.2,at:now}),'NET.tw: the windup / window as of this frame (online dash prediction reads it)');ctx.netStatusChips({vulnerable:0,tether:0,twa:0,twu:0});assert.equal(els.netSt.style.display,'none');
console.log('Online status: Vulnerable and Trapwire tether notices on onset, countdown chip while active, hidden after; Spycam dart chip (hold 4 / removal %); Tailwind windup / window kept in NET.tw for the E-icon bar (no banner); chip styled by class x-nst');
