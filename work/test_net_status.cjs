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
const ctx=vm.createContext({document,performance:{now:()=>now},say:(t,ms)=>said.push(t),Math});
// register the element by id once assigned
const realCreate=document.createElement;document.createElement=t=>{const e=realCreate(t);return new Proxy(e,{set(o,k,v){o[k]=v;if(k==='id')els[v]=o;return true;}});};
vm.runInContext('let netVulnAt=0,netTetherAt=0;'+net.slice(i,j),ctx);
assert.deepEqual([...ctx.netStatusChips({vulnerable:0,tether:0})],[],'nothing active: no chip');assert(!els.netSt,'no element created needlessly');
ctx.netStatusChips({vulnerable:3.6,tether:0});assert.equal(els.netSt.style.display,'block');assert.match(els.netSt.textContent,/^VULNERABLE 3\.6s$/);assert.equal(said.length,1);assert.match(said[0],/Vulnerable · taking double damage · 4 s/);
now+=100;ctx.netStatusChips({vulnerable:3.5,tether:2.4});assert.equal(said.length,2,'vulnerable notice not repeated every round-state; tether notice once');assert.match(said[1],/Slowed by Trapwire · move 4 m away/);assert.equal(els.netSt.textContent,'VULNERABLE 3.5s · TRAPWIRE');
now+=100;ctx.netStatusChips({vulnerable:3.4,tether:2.3});assert.equal(said.length,2);
now+=4000;ctx.netStatusChips({vulnerable:0,tether:0});assert.equal(els.netSt.style.display,'none','chip hidden when both end');
ctx.netStatusChips({vulnerable:4,tether:0});assert.equal(said.length,3,'a fresh Alarmbot hit notifies again');
console.log('Online status: Vulnerable and Trapwire tether notices on onset, countdown chip while active, hidden after');
