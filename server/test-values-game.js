// Game values pinned to their sources (current patch 13.08, retrieved 2026-10-26; full table: work/validation/values-game.md).
// Weapons are covered by test-wiki-weapons.js; ability equip / unequip times by windups.js tests (qa-35).
// Sources:
//  [CR]  https://wiki.playvalorant.com/en-us/Credits                (economy table, cap 9000, survivor 1000)
//  [UN]  https://wiki.playvalorant.com/en-us/Unrated                (buy 30 / 45, round 100, post-round 7, ult point sources)
//  [CO]  https://wiki.playvalorant.com/en-us/Competitive            (overtime 5000, ult 3 short)
//  [SP]  https://valorant.fandom.com/wiki/Spike                     (plant 4, defuse 7 / 3.5 checkpoint, fuse 45)
//  [VG]  https://valorant.gs/rules/                                 (game-file rules: loss streak +500 x2, explosion 3250 uu, DM 540 s)
//  [AR]  https://wiki.playvalorant.com/en-us/Armor_and_Shield       (400/25/66 %, 650/25/100 %/50 pool, 1000/50/66 %)
//  [DM]  https://wiki.playvalorant.com/en-us/Deathmatch             (40 kills or 9 min, 1.5 s respawn)
//  [TDM] https://wiki.playvalorant.com/en-us/Team_Deathmatch        (100 kills or 9.5 min = 75+75+75+345 s, 1.5 s respawn)
//  [AG]  https://valorant.gs/agents/<agent>/                        (game files 13.08: ult points, costs, charges, cooldowns)
//  [P13] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-00/ (initiator signature cooldowns 60 -> 50 s)
//  [P103] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-03/ ("Unrated will still use the original Sudden Death format")
// fog-spec-3 (after bca67c1) moved the "differs / missing" rows into the game and pins them in test-game-rules.js (+ client
// work/test_game_rules.cjs, test_tdm_transitions.cjs, test_offline_overtime.cjs, test_loadout.cjs): TDM 4 stages 75/75/75/345 s
// with per-stage guns, DM health packs, defuse cancel window, Unrated Endgame round 25 (replaces Competitive overtime here),
// Operator second zoom in the spectate pov. Judgment calls (no published number / meaning): the 0.2 s defuse window is read as a
// grace after a KEY RELEASE only (defuser alive, in range, standing, not firing; moving / firing / stepping off drops progress at
// once); the TDM forced switch to the stage gun comes 3 s after the stage change ("a short duration"); a unit already at full
// HP and armour leaves a health pack lying; packs reach a non-killer / non-victim within 12 m only (fog); packs give the game
// files' 50 HP / 25 armour although the wiki says "fully restores".
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SpikeSimulation,buyPhaseSeconds,POST_ROUND,SPIKE_RADIUS} from './src/spike.js';import {ARMOR_BUY,RGN,matchSeconds,Simulation} from './src/simulation.js';
import {BARRIER,SLOW_ORB,PARITY,SMOKE,FAULT,GUIDING,PARANOIA} from './src/abilities.js';import {DEV} from './src/devices.js';import {ULT} from './src/ults.js';
import kits from './src/kits.json' with {type:'json'};
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),b=s.add('b','Sage');s.start(false);b.team=1-a.team;s.atk=a.team;s.buy=0;return {s,a,b};};
// 1. round phases [UN] [SP] [VG]
assert.equal(buyPhaseSeconds(1),45);assert.equal(buyPhaseSeconds(13),45);assert.equal(buyPhaseSeconds(25),45);assert.equal(buyPhaseSeconds(2),30);assert.equal(buyPhaseSeconds(14),30);
assert.equal(POST_ROUND,7,'post-round 7 s [UN]');assert.equal(SPIKE_RADIUS,32.5,'explosion outer radius 3250 uu [VG]');
{const {s}=mk();s.newRound();assert.equal(s.remaining,100,'round 100 s');assert.equal(s.spike.t,45,'fuse 45 s');}
{const src=readFileSync(new URL('./src/spike.js',import.meta.url),'utf8');assert.match(src,/sp\.pt>=4\b/,'plant 4 s [SP]');assert.match(src,/sp\.dt>=7\b/,'defuse 7 s [SP]');assert.match(src,/sp\.dt>=3\.5\?3\.5:0/,'half-defuse checkpoint 3.5 s [SP]');}
// 2. economy [CR] [VG]: start 800, cap 9000, win 3000, loss 1900 / 2400 / 2900 (+500 per loss, max streak 2), reset on a win, overtime 5000
{const {s,a,b}=mk();assert.equal(a.credits,800);a.alive=false;b.alive=false;const seq=[];for(let i=0;i<4;i++){a.credits=0;s.roundDelay=0;s.finishRound(b.team,'Elimination');seq.push(a.credits);}
 assert.deepEqual(seq,[1900,2400,2900,2900],'loss streak 1900/2400/2900 [CR]');a.credits=0;s.roundDelay=0;s.finishRound(a.team,'Elimination');assert.equal(a.credits,3000,'win 3000');
 a.credits=0;s.roundDelay=0;s.finishRound(b.team,'Elimination');assert.equal(a.credits,1900,'a win resets the loss streak');a.credits=8900;s.roundDelay=0;s.finishRound(a.team,'Elimination');assert.equal(a.credits,9000,'cap 9000');}
// 3. armor [AR]
assert.deepEqual({...ARMOR_BUY['Light Armor']},{p:400,a:25});assert.deepEqual({...ARMOR_BUY['Heavy Armor']},{p:1000,a:50});assert.deepEqual({...ARMOR_BUY['Regen Shield']},{p:650,a:25,rg:50});
assert.equal(RGN.cap,25);assert.equal(RGN.pool,50);
// 4. Deathmatch / Team Deathmatch clocks [DM] [TDM] [VG]
assert.equal(matchSeconds('dm'),540,'DM 9 min');assert.equal(matchSeconds('tdm'),570,'TDM 9.5 min');
for(const [mode,secs,kills] of [['dm',540,40],['tdm',570,100]]){const s=new Simulation(W,mode,'ascent',()=>.5);assert.equal(s.remaining,secs);assert.equal(s.maxKills,kills);s.add('p','Jett',true);s.start(false);assert.equal(s.remaining,secs,mode+' start');}
{const src=readFileSync(new URL('./src/simulation.js',import.meta.url),'utf8');assert.match(src,/respawnAt=this\.time\+1\.5;/,'respawn 1.5 s');}
// 5. ult points, ability costs and charges [AG]
const UP={Jett:8,Phoenix:7,Sova:8,Sage:7,Reyna:7,Omen:7,Killjoy:9,Raze:8,Skye:8,Breach:8,Cypher:7,Chamber:8};
for(const [a,n] of Object.entries(UP))assert.equal(kits[a].u,n,a+' ult points');
const BUY={Jett:[['c',200,2],['q',150,1]],Phoenix:[['c',150,1],['q',200,1],['e',250,2]],Sova:[['c',400,1],['q',150,2]],Sage:[['c',300,1],['q',200,2]],Reyna:[['c',250,2],['q',200,2]],Omen:[['c',100,2],['q',250,1],['e',150,2]],Killjoy:[['c',200,2],['q',200,1]],Raze:[['c',300,1],['q',200,2]],Skye:[['c',150,1],['q',300,1],['e',250,2]],Breach:[['c',200,1],['q',250,2]],Cypher:[['c',200,2],['q',100,2]],Chamber:[['c',200,1],['q',100,8]]};
for(const [a,rows] of Object.entries(BUY))for(const [k,cost,max] of rows){assert.equal(kits[a].buy.find(r=>r[0]===k)?.[2],cost,a+' '+k+' cost');assert.equal(kits[a].mx[k],max,a+' '+k+' charges');}
// signature recharge: Sage 45, Omen 40, Chamber 30 (Rendezvous), Sova / Skye / Breach 50 since 13.00 [P13] [AG]
{const src=readFileSync(new URL('./src/abilities.js',import.meta.url),'utf8'),m=src.match(/const seconds=(\{[^}]*\})\[u\.agent\]/);assert.ok(m);assert.deepEqual(Function('return '+m[1])(),{Sage:45,Sova:50,Skye:50,Omen:40,Breach:50,Chamber:30});}
// 6. ability values (wiki ability pages; v11.08 Barrier 300 / 600 HP / 2 s fortify, v13.00 Nanoswarm 5 s, Trapwire 0.7 s)
assert.deepEqual([BARRIER.hp+BARRIER.fort,BARRIER.fortAt,BARRIER.life,BARRIER.segs],[600,2,40,4]);assert.deepEqual([SLOW_ORB.life,SLOW_ORB.factor],[7,.5]);
assert.deepEqual([PARITY.heal.sage,PARITY.heal.life,PARITY.step.range,PARITY.step.time,PARITY.shadows,PARITY.rendezvous,PARITY.rdvTime,PARITY.dashTime,PARITY.tail],[100,5,15,1.2,4,18,1.3,.45,11]);
assert.deepEqual([SMOKE.r.Jett,SMOKE.r.Omen,SMOKE.r.Cypher],[3.35,4.1,3.72]);assert.deepEqual([FAULT.min,FAULT.max,FAULT.charge,FAULT.width,FAULT.concuss],[8,56,1,8,2.5]);
assert.deepEqual([GUIDING.speed,GUIDING.max,GUIDING.ramp,GUIDING.act],[18,2.25,.75,.3]);assert.deepEqual([PARANOIA.speed,PARANOIA.range,PARANOIA.radius,PARANOIA.nearsight],[20,25,4.3,2]);
assert.deepEqual([DEV.nanoswarm.active,DEV.nanoswarm.radius,DEV.nanoswarm.damage,DEV.trapwire.windup,DEV.trapwire.deploy,DEV.alarmbot.speed,DEV.turret.cycle,DEV.reconBolt.radius,DEV.owl.life],[5,4.5,45,.7,1.5,22.5,1.25,30,7]);
assert.deepEqual([ULT.lockdown.radius,ULT.lockdown.detain,ULT.quake.length,ULT.quake.width,ULT.quake.concuss,ULT.fury.damage,ULT.rocket.damage,ULT.seekers.nearsight],[32.5,8,32,18,4,80,150,3]);
console.log('Game values = sources (13.08): phases 45/30, 100, 7, plant 4, defuse 7/3.5, fuse 45; economy 800/9000/3000/1900-2400-2900 (reset on win); armor 400/650/1000; DM 540 s / TDM 570 s, 1.5 s respawn; ult points, ability costs, charges and signature cooldowns of all 12 agents; Barrier/Nanoswarm/Trapwire/etc. ability values');
