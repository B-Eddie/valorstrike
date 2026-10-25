// Offline overtime (VALORANT Competitive, wiki.playvalorant.com/en-us/Competitive): every overtime round starts on 5000 credits
// with ultimate points set 3 short of the ultimate, for the player and for every bot.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a='if (ot) { FV.cr = 5000;',i=html.indexOf(a);assert(i>=0,'overtime block');const j=html.indexOf('// overtime also sets every ult 3 points short',i);assert(j>i&&j-i<600,'ult reset inside the overtime block');
const block=html.slice(i,j);
assert.ok(/const n = FV\.you \+ FV\.them[^\n]*ot = !FV\.sr && !FV\.sw && !over && n >= 24/.test(html),'ot = from 12-12 on (Competitive overtime)');
const KITS={Sova:{u:8},Sage:{u:7},Jett:{u:7}};
const c=vm.createContext({FV:{cr:900,bs:{B1:{cr:100}}},J:{on:true,pick:'Sova',ult:0},KITS,mode:'five',ot:true,UC:{B1:7,A1:0},bots:[{name:'B1',ag:'Sage'}],allies:[{name:'A1',ag:'Jett'}]});
c.window={xBotUC:c.UC,xBotUltCost:n=>KITS[n]?KITS[n].u:0};
vm.runInContext('const jOn = () => J.on && mode === "five"; const K = () => KITS[J.pick] || KITS.Jett; const xAg = (u) => u.ag;\n'+block,c);
assert.equal(c.FV.cr,5000);assert.equal(c.FV.bs.B1.cr,5000);
assert.equal(c.J.ult,5,'Sova (8): 5 points');assert.equal(c.UC.B1,4,'bot Sage (7) with a full ult set to 4');assert.equal(c.UC.A1,4,'ally Jett (7): 4');
console.log('Offline overtime: 5000 credits, player and bot ults set 3 short');
