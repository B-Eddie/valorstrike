// Offline Swiftplay economy + ult rules = VALORANT (vs-lane-parity 2026-10-28).
// Sources: wiki.playvalorant.com/en-us/Swiftplay ("All player start each half with two points for their ultimate. Agents with
// 9-point ultimate start with three points. No credit bonuses for loss streaks." Credits by round in the half: 1 = 800,
// 2 = +2400 (+600 bonus if team won previous round), 3 = +4250, 4 = +4250, Endgame = 5000), wiki Credits (Swiftplay table:
// second round of the half 2,400 after a loss / 3,000 after a win; kill 200 and plant 300 still paid), Riot's 2022 year-end post
// (playvalorant.com/en-us/news/game-updates/valorant-2022-year-end: "2 Ult points granted at the start of each half",
// "Sudden death overtime"). The server already plays this (server/src/modes.js VARIANT_RULES.swift); this pins the offline page.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=(name)=>{const i=html.indexOf('function '+name+'(');assert(i>=0,name+' defined');let d=0,j=html.indexOf('{',i);for(let k=j;k<html.length;k++){if(html[k]==='{')d++;else if(html[k]==='}'&&--d===0)return html.slice(i,k+1);}throw Error(name);};
// 1. credits for the next round of a Swiftplay half
const ctx=vm.createContext({});vm.runInContext('function capC(n){return Math.min(9000,n);}'+fn('fSwCr'),ctx);
const cr=(c,rih,won)=>vm.runInContext(`fSwCr(${c},${rih},${won})`,ctx);
assert.equal(cr(0,2,false),2400,'round 2 after losing the pistol: +2400');
assert.equal(cr(0,2,true),3000,'round 2 after winning the pistol: +2400 +600');
assert.equal(cr(200,3,true),4450,'round 3: +4250 on top of what is left (win or loss alike)');
assert.equal(cr(200,3,false),4450,'round 3: no loss bonus difference');
assert.equal(cr(100,4,false),4350,'round 4: +4250');
assert.equal(cr(8000,4,true),9000,'capped at 9000');
// 2. fCheck uses it for Swiftplay; the old 4000 + win/loss bonus rule is gone
const chk=fn('fCheck');
assert(!/FV\.sw \? 4000/.test(chk),'no flat 4000 + round bonus in Swiftplay');
assert(/fSwCr\(/.test(chk),'fCheck pays Swiftplay credits through fSwCr');
assert(!/FV\.sw && !over\) \{ try \{ jUlt\(\)/.test(chk),'no +1 ult point after every Swiftplay round');
// Endgame (4-4): everyone 5000, loss streaks reset
assert(/FV\.sw && n === 8/.test(chk),'Swiftplay 4-4 Endgame branch');
const e=chk.match(/if \(swEnd\) \{[^\n]*?\}/);assert(e,'Endgame credits block');
const c2=vm.createContext({FV:{cr:120,lsY:2,lsT:0,bs:{B1:{cr:9000},A1:{cr:50}}},swEnd:true});vm.runInContext(e[0],c2);
assert.deepEqual([c2.FV.cr,c2.FV.bs.B1.cr,c2.FV.bs.A1.cr],[5000,5000,5000]);
// 3. buy phase 45 s on the first round of each Swiftplay half (= Unrated / server buyPhaseSeconds(rih===1))
const rr=fn('fRound'),b=rr.match(/FV\.buy = (.*?) \? 45 : 30;/);assert(b,'buy-phase rule');
const buy=(you,them,sw)=>vm.runInNewContext(`(${b[1]}) ? 45 : 30`,{FV:{you,them,sw,sr:false,rep:false}});
assert.equal(buy(0,0,true),45);assert.equal(buy(3,1,true),45,'Swiftplay round 5 (second half) 45 s');assert.equal(buy(2,1,true),30);assert.equal(buy(4,4,true),30);
assert.equal(buy(7,5,false),45,'Unrated round 13 unchanged');assert.equal(buy(2,2,false),30,'Unrated round 5 unchanged');
// 4. ult points at the start of each half: 2, or 3 for a 9-point ultimate; never lowers a higher charge
const c3=vm.createContext({});vm.runInContext(fn('fSwUlt'),c3);
assert.equal(vm.runInContext('fSwUlt(0,7)',c3),2);assert.equal(vm.runInContext('fSwUlt(0,8)',c3),2);assert.equal(vm.runInContext('fSwUlt(1,9)',c3),3);
assert.equal(vm.runInContext('fSwUlt(5,7)',c3),5,'kept when higher');
assert(/fSwHalf/.test(html)&&/function fSwHalf\(/.test(html),'half-start grant wired');
const h=fn('fSwHalf');assert(/% 4 === 0/.test(h)&&/< 8/.test(h),'rounds 1 and 5 only (not the Endgame)');
console.log('Offline Swiftplay: 800 / +2400 (+600) / +4250 / +4250, Endgame 5000, 45 s first buy of each half, 2 (3) ult points each half');
// 5. the real page (page_harness): Swiftplay rounds 1 -> 2 -> 3, credits and ult points as above (skip with SW_NO_PAGE=1)
if(!process.env.SW_NO_PAGE){const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:7}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const live=async()=>{for(let i=0;i<200&&!xe('running');i++)await adv(200);assert(xe('running'),'round live');};
 (async()=>{xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=1;xLob0=false;startFive();true');await adv(400);await live();
  assert.equal(xe('FV.sw'),true);assert.equal(xe('FV.cr'),800,'round 1: 800');assert.equal(xe('J.ult'),2,'Jett (8-point ult) starts the half with 2');
  const bu=JSON.parse(xe('JSON.stringify(Object.values(window.xBotUC))'));assert(bu.length>=9&&bu.every(v=>v>=2),'every bot starts the half with >= 2 ult points: '+bu);
  assert.equal(xe('FV.buy>30'),true,'round 1 buy 45 s');
  xe('FV.cr=300;Object.values(FV.bs).forEach(s=>s.cr=300);FV.buy=0;FV.det=0;FV.sp.st="";fCheck(true,"Test");true');
  assert.equal(xe('FV.cr'),3300,'won the pistol: 300 + 2400 + 600');await live();
  assert.equal(xe('J.ult'),2,'no ult point just for playing a round');
  xe('FV.cr=100;FV.buy=0;FV.det=0;FV.sp.st="";fCheck(false,"Test");true');assert.equal(xe('FV.cr'),4350,'round 3 after a loss: 100 + 4250 (no loss bonus)');
  console.log('page: R1 800 / J.ult 2 / bots >= 2, R2 3300, R3 4350');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});}
