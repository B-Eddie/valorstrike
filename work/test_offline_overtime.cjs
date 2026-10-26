// Offline Endgame / Sudden Death (VALORANT Unrated, wiki.playvalorant.com/en-us/Unrated: at 12-12 "a 25th round of Endgame, also
// known as Sudden Death"; teams stay on their second-half sides, everyone gets 5000 credits, the round winner wins the match;
// patch 1.03: win-by-two Overtime is Competitive only, "Unrated will still use the original Sudden Death format"). This game's 5v5
// is Unrated (lobby tab, online room label), so: first to 13, no side swap at round 25, 5000 each, ult points carried over.
// Same rule as the server (spike.js newRound round 25 / step first to 13) and the online host (mp5 fCheck wrapper).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const line=html.split('\n').find((l)=>l.includes('const n = FV.you + FV.them, over = FV.surr ? true'));assert(line,'round end rule line');
const m=line.match(/const n = FV\.you \+ FV\.them, over = (.*?), ot = (.*?), swap = (.*?);/);assert(m,'over / ot / swap expressions');
const rule=(you,them,sw=false,sr=false)=>JSON.parse(vm.runInNewContext('const n = FV.you + FV.them, over = '+m[1]+', ot = '+m[2]+', swap = '+m[3]+'; JSON.stringify({over, ot, swap})',{FV:{you,them,sw,sr,surr:false,srWin:4},FIVE_WIN:13}));
assert.deepEqual(rule(12,12),{over:false,ot:true,swap:false},'12-12: Endgame next, no side swap');
assert.deepEqual(rule(13,12),{over:true,ot:false,swap:false},'13-12 after the Endgame round ends the match');
assert.deepEqual(rule(12,13),{over:true,ot:false,swap:false},'12-13 ends the match');
assert.deepEqual(rule(13,11),{over:true,ot:false,swap:false});
assert.deepEqual(rule(6,6),{over:false,ot:false,swap:true},'half time swap at 12 rounds');
assert.deepEqual(rule(4,4,true),{over:false,ot:false,swap:false},'Swiftplay 4-4: round 9 decides, no swap');
assert.deepEqual(rule(2,2,true),{over:false,ot:false,swap:true},'Swiftplay swap after round 4');
// the Endgame block: 5000 each, loss streaks reset, ults untouched (no "3 short": that is Competitive Overtime)
const a='if (ot) { FV.cr = 5000;',i=html.indexOf(a);assert(i>=0,'Endgame block');const j=html.indexOf('\n',i);const block=html.slice(i,j);
assert(!/K\(\)\.u - 3|xBotUltCost/.test(block),'Endgame must not set ults 3 short');
const c=vm.createContext({FV:{cr:900,lsY:2,lsT:1,bs:{B1:{cr:100},A1:{cr:7000}}},J:{ult:6},ot:true});
vm.runInContext(block.replace(/\/\/.*$/,''),c);
assert.equal(c.FV.cr,5000);assert.equal(c.FV.bs.B1.cr,5000);assert.equal(c.FV.bs.A1.cr,5000);assert.deepEqual([c.FV.lsY,c.FV.lsT],[0,0]);assert.equal(c.J.ult,6,'ult points carried over');
// announcements, online host / client
assert(html.includes('annc("SUDDEN DEATH", 2000'),'12-12 announces Sudden Death');assert(!html.includes('annc("OVERTIME"'),'no Overtime announcement');
assert(html.includes('const over = !!FV.surr || Math.max(FV.you, FV.them) >= FIVE_WIN; // first to 13'),'online host: first to 13');
assert(!/Math\.abs\(FV\.you - FV\.them\) >= 2/.test(html),'no win-by-two anywhere on the page');
assert(html.includes('FV.you + FV.them === 24 && !FV.sw && !FV.sr) ? 45 : 30'),'round 25 keeps the 45 s buy phase');
console.log('Offline Endgame: 12-12 -> one Sudden Death round, same sides, 5000 each, ults carried over, 13-12 wins (host + offline)');
