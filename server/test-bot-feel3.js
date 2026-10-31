// Bots feel like real average players, part 3 (lane-botfeel3; measured with work/probe_bot_feel3.mjs, server SpikeSimulation
// Ascent 5v5, seeds 3 / 5, 3000 s on 132dc0e).
//  1. no frozen ult-orb errand: a bot sent to an ult orb walked there with a loose goal (goalPath stops 1.2 m short) but only
//     channelled inside ULT_ORB.r * 0.6 = 0.96 m, so a bot that stopped 0.96-1.2 m off the orb stood still - not
//     channelling, not walking - for the rest of the round (132dc0e seed 3: an attacker Cypher froze in B Main ~60 s while
//     the Spike lay dropped on A: 6 / 22 rounds ended "Time ran out", 4 / 21 on seed 5). Now the errand channels from where
//     goalPath leaves it (ULT_ORB.reach, inside the 1.6 m capture radius) and an errand that has not captured within
//     ULT_ORB.give s is dropped (a player gives up an orb they cannot get).
import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';
import {ULT_ORB} from './src/ultorbs.js';
// ---- 1. ult-orb errand ----
{const calls=[{name:'A Main',position:[10,0,0]},{name:'B Main',position:[-10,0,0]}],nodes=[[0,0,0],[0,0,-10],[10,0,0],[-10,0,0],[10,0,1.15]];
 const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,-20]},callouts:calls},nav:{nodes,adj:[[1,2,3],[0],[0,4],[0],[2]]},playable:[0,1,2,3,4],allowed:new Set([0,1,2,3,4]),near:(x,z)=>{let b=0,d=1e9;nodes.forEach((p,i)=>{const e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;b=i;}});return b;},ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 assert(ULT_ORB.reach>1.2&&ULT_ORB.reach<ULT_ORB.r,'ULT_ORB.reach: past goalPath\'s 1.2 m loose stop, inside the 1.6 m capture radius');assert(ULT_ORB.give>=8&&ULT_ORB.give<=20,'ULT_ORB.give: s an errand may take');
 const run=(z0,label)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5);for(let i=0;i<10;i++)s.add('b'+i,'Jett',false);s.start(false);s.buy=0;s.roundDelay=0;
  const b=s.units.find(u=>((u.id*7919+s.round*104729)%100)/100<ULT_ORB.botChance);assert(b,'a bot with the errand');s.canSee=()=>false;
  for(const u of s.units)if(u!==b)Object.assign(u,{x:0,z:-40,input:{}});s.bot=function(u){return u===b?SpikeSimulation.prototype.bot.call(this,u):undefined;};
  Object.assign(b,{x:10,z:z0,y:0,vx:0,vz:0,air:false,react:null});const u0=b.ability.ult;let n=0;for(;n<120&&s.ultOrbs.length===2;n++)s.step(.05);
  assert.equal(s.ultOrbs.length,1,label+': the bot captured the orb within 6 s (was: stood still 0.96-1.2 m off it all round)');assert.equal(b.ability.ult,u0+1,label+': +1 ult');};
 run(1.15,'stopped 1.15 m off the orb');run(1.05,'1.05 m off');run(.5,'0.5 m off');
 // an orb it cannot get to (channel never starts: kept off it by something) is given up after ULT_ORB.give s
 {const s=new SpikeSimulation(W,'five','ascent',()=>.5);for(let i=0;i<10;i++)s.add('b'+i,'Jett',false);s.start(false);s.buy=0;s.roundDelay=0;
  const b=s.units.find(u=>((u.id*7919+s.round*104729)%100)/100<ULT_ORB.botChance);s.canSee=()=>false;for(const u of s.units)if(u!==b)Object.assign(u,{x:0,z:-40,input:{}});
  s.bot=function(u){if(u!==b)return;SpikeSimulation.prototype.bot.call(this,u);Object.assign(u,{x:10,z:3,vx:0,vz:0});/* pinned 3 m away */};Object.assign(b,{x:10,z:3,y:0,vx:0,vz:0,air:false,react:null});
  for(let t=0;t<ULT_ORB.give+1;t+=.05)s.step(.05);assert.equal(b.orbGo,null,'an orb errand that never captures is dropped after ULT_ORB.give s');}}
console.log('Bot feel 3: (1) ult-orb errand never freezes 0.96-1.2 m off the orb (channels from goalPath\'s stop, gives up after ULT_ORB.give s)');
