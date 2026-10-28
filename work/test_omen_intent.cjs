// Online 5v5 Omen From the Shadows (work/server_runtime.js okFtsAt wrapper): the spot picked on the tactical map goes to the trusted
// server as an intent {t:'ab', k:'x', p:[x, z]} - no optimistic ult spend / channel / teleport on the page; an invalid spot sends
// nothing and keeps the pick open; offline (no socket) falls through to the page's own okFtsAt.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync('work/server_runtime.js','utf8'),a=s.indexOf('const netOmenFts0='),b=s.indexOf('// Anchor placement/',a);assert.ok(a>0&&b>a,'okFtsAt wrapper');
let legacy=0,sent=[],lock=0,no=0;const c={okFtsAt:()=>(legacy++,true),okFtsValid:(x,z)=>x>0?{x,y:7.25,z}:null,sgNo:()=>no++,say:()=>{},NET:{socket:{}},MP:{st:'game',m5:true},J:{pick:'Omen',ftp:true,ult:7},running:true,player:{hp:100},FV:{buy:0},MM:{style:{pointerEvents:'auto'}},netSend:m=>sent.push(m),xPLock:()=>lock++};
vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.pick=okFtsAt;',c);
assert.equal(c.pick(-3,4),false);assert.equal(sent.length,0);assert.equal(no,1);assert.equal(c.J.ftp,true,'invalid spot keeps the pick open');
assert.equal(c.pick(12.345,-8.761),true);assert.equal(sent.length,1);assert.equal(sent[0].t,'ab');assert.equal(sent[0].k,'x');assert.deepEqual(Array.from(sent[0].p),[12.35,-8.76]);
assert.equal(c.J.ult,7);assert.equal(c.J.fts,undefined);assert.equal(c.J.ftp,false);assert.equal(lock,1);assert.equal(legacy,0);
c.J.ftp=true;c.FV.buy=5;assert.equal(c.pick(5,5),false,'no cast in the buy phase');c.FV.buy=0;
c.NET.socket=null;c.pick(1,1);assert.equal(legacy,1);
console.log('Omen online From the Shadows sends the tactical-map spot as intent only (rounded [x, z]); invalid spot / buy phase send nothing; offline falls through');
