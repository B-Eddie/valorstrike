// Real Omen module + complete real online rooting function. NoGL, scripted private channel, tracked DOM.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const h=fs.readFileSync('index.html','utf8');
const nodes=[];const document={getElementById:()=>null,createElement:()=>({style:{},remove(){this.gone=true;}}),head:{appendChild(){}},body:{appendChild(n){nodes.push(n);}},querySelectorAll:()=>nodes.filter(n=>!n.gone)};
const c=vm.createContext({document,window:{XHK:[]},requestAnimationFrame:()=>0,performance:{now:()=>0},Math,console,NET:{socket:true},J:{pick:'Omen'},player:{hp:100,x:0,y:0,z:0},netChannel:null,XABA:{ftsT:1},xE:e=>{throw e;},scene:{add(){},remove(){}}});
const mod=fs.readFileSync('work/omen_fx_runtime.js','utf8');vm.runInContext(mod+';omxUseGameTick();',c);
const a=h.indexOf('const XFTS = '),b=h.indexOf('// ---- Surface placement indicators',a);vm.runInContext(h.slice(a,b),c);
const tick=ch=>{c.netChannel=ch;vm.runInContext('xFtsNetTick()',c);};const live=()=>nodes.filter(n=>!n.gone).length;
tick({kind:'shadows',remaining:3.5,shade:false});assert.equal(live(),0,'no Shade during windup');
tick({kind:'shadows',remaining:2,shade:true});assert.equal(live(),1);tick({kind:'shadows',remaining:1.8,shade:true});assert.equal(live(),1,'no duplicate per snapshot/frame');
tick(null);assert.equal(live(),0,'completion/cancel clears immediately');
tick({kind:'shadows',remaining:.6,shade:true});assert.equal(live(),1,'late join reconstructs persistent veil');vm.runInContext('omxTick(.61)',c);assert.equal(live(),0,'remaining server duration, not full replay');tick(null);
tick({kind:'shadows',remaining:2,shade:true});c.player.hp=0;tick(c.netChannel);assert.equal(live(),0,'death clears veil');c.player.hp=100;tick(null);
tick({kind:'shadows',remaining:2,shade:true});c.NET.socket=null;tick(c.netChannel);assert.equal(live(),0,'disconnect clears veil');
c.NET.socket=true;tick(null);tick({kind:'shadows',remaining:2,shade:true});vm.runInContext('omxReset()',c);assert.equal(live(),0,'module reset clears DOM');tick(null);
console.log('Omen online Shade real module/noGL: windup, shade, dedupe, late join TTL, end/cancel, death, disconnect, reset');
