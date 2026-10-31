// Bots feel like real average players, part 3 (lane-botfeel3; measured with work/probe_bot_feel3.mjs, server SpikeSimulation
// Ascent 5v5, seeds 3 / 5, 3000 s on 132dc0e).
//  1. no frozen ult-orb errand: a bot sent to an ult orb walked there with a loose goal (goalPath stops 1.2 m short) but only
//     channelled inside ULT_ORB.r * 0.6 = 0.96 m, so a bot that stopped 0.96-1.2 m off the orb stood still - not
//     channelling, not walking - for the rest of the round (132dc0e seed 3: an attacker Cypher froze in B Main ~60 s while
//     the Spike lay dropped on A: 6 / 22 rounds ended "Time ran out", 4 / 21 on seed 5). Now the errand channels from where
//     goalPath leaves it (ULT_ORB.reach, inside the 1.6 m capture radius) and an errand that has not captured within
//     ULT_ORB.give s is dropped (a player gives up an orb they cannot get).
//  2. a team that just won does not save: BotBrain.teamBuy called 'eco' 55 % of the time for a team at 2500-3900 average
//     whatever the last round did, so the pistol-round winners (3300-3800 each) sat on Classics in the bonus round (132dc0e
//     seed 3 / 5: round 2 attackers 'eco' on both). Now a team on a win (lossStreak 0) with BUYK.bonus+ average buys
//     ('half': SMGs / shotguns / armour, the bonus round), and a full-buy call never leaves a bot standing with a Classic
//     because it is short of a rifle: it takes the best it can afford (BotBrain.buyFor 'full' falls back to the half-buy
//     shop), as players on a full buy do. The losing side keeps its eco / save / force mix.
//  3. the carrier plants: plantGoal took any nav node inside the plant zone, and the carrier walks an exact goal only to 1 m
//     short of it, so a spot within 1 m of the zone's edge left it standing just OUTSIDE the zone - not planting (siteAt false),
//     not walking (arrived) - until the round ran out (132dc0e Ascent seed 5 round 19: the carrier on A's edge 60 s, three
//     attackers alive at 'Time ran out'; Ascent's A centre itself lies on the zone edge). Now a plant spot lies 1.05 m+ inside
//     the zone (every point of a 1.05 m ring is plantable; the nearest such nav node when the drawn spot is not).
import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';
import {ULT_ORB} from './src/ultorbs.js';
import BotBrain from '../vendor/bot-brain.cjs';
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
// ---- 2. team economy: the winners buy, nobody full-buys with a Classic ----
{assert(BotBrain.BUYK&&BotBrain.BUYK.bonus>=2000&&BotBrain.BUYK.bonus<=2900,'BotBrain.BUYK.bonus: average credits from which a winning team buys');
 const calls=(cr,ls,round)=>{const o={};for(let i=0;i<400;i++){const c=BotBrain.teamBuy(cr,ls,round,BotBrain.rng(BotBrain.hash('eco|'+i)),12);o[c]=(o[c]||0)+1;}return o;};
 const win2=calls([3700,3300,3700,3800,3700],0,2),win14=calls([3600,3900,3800,4000,3500],0,14),winMid=calls([2600,2900,2700,3100,3000],0,8);
 for(const [k,o] of [['round 2 pistol winners',win2],['round 14 pistol winners',win14],['a win mid-half',winMid]])assert(!o.eco&&!o.save,k+': never eco / save on a win with money ('+JSON.stringify(o)+')');
 const lose2=calls([2300,2100,2300,2300,2500],1,2);assert((lose2.eco||0)+(lose2.save||0)>=240,'pistol losers still mostly save / eco ('+JSON.stringify(lose2)+')');
 const lose3=calls([3300,3000,3200,3400,3100],1,5);assert(lose3.eco>100,'a team that lost the last round at 3000+ still ecos often ('+JSON.stringify(lose3)+')');
 assert.equal(calls([800,800,800,800,800],0,1).pistol,400,'pistol round');
 // full call, a bot short of a rifle: buys the best it can afford, not heavy armour on a Classic
 const P=BotBrain.personality(7);for(let i=0;i<60;i++){const b=BotBrain.buyFor('full',2600,P,BotBrain.rng(i+1),i%2===0);assert(b.weapon,'full call at 2600: a weapon ('+JSON.stringify(b)+')');}
 for(let i=0;i<60;i++){const b=BotBrain.buyFor('full',4000,P,BotBrain.rng(i+1),false);assert(['Vandal','Phantom','Warden','Operator','Odin'].includes(b.weapon),'full call at 4000: a rifle as before');}}
// ---- 3. the carrier plants: no standing on the plant-zone edge ----
{const fsp=(await import('node:fs/promises')).default,{loadWorld}=await import('./src/world.js');
 const assets={async fetch(r){try{return new Response(await fsp.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
 const RING=[];for(let k=0;k<8;k++)RING.push([Math.cos(k*Math.PI/4),Math.sin(k*Math.PI/4)]);
 let picks=0,shallow=[];
 for(const map of ['ascent','bind','haven']){const W=await loadWorld(assets,map),S=new SpikeSimulation(W,'five',map,()=>.5);S.start(true);S.buy=0;S.roundDelay=0;
  for(const site of Object.keys(W.map.sites))for(let rd=1;rd<=24;rd++){S.round=rd;S.spike.site=site;for(const team of [0,1]){const u=S.units.find(v=>v.team===team);S.atk=team;u.plan=null;const L=(await import('./src/bots.js')).plan(S,u);L.plantSite=null;const p=S.plantGoal(u);
    assert(p,map+' '+site+' round '+rd+': a plant spot');picks++;const bad=RING.filter(([dx,dz])=>S.siteAt({x:p[0]+dx*1.05,y:p[1],z:p[2]+dz*1.05})!==site).length;if(bad)shallow.push(map+' '+site+' r'+rd+' t'+team+' '+bad+'/8');}}}
 assert.equal(shallow.length,0,'every plant spot lies 1.05 m+ inside the plant zone (goalPath stops an exact goal up to 1 m short): '+shallow.length+'/'+picks+' on the edge, e.g. '+shallow.slice(0,4).join(', '));
 // Ascent seed 5 round 19 (132dc0e): the carrier froze at (46.0, -27.0) on A, just outside the zone, for 60 s. From there it now plants.
 {const W=await loadWorld(assets,'ascent'),S=new SpikeSimulation(W,'five','ascent',()=>.5);S.start(true);S.buy=0;S.roundDelay=0;S.canSee=()=>false;
  for(let rd=1;rd<=8;rd++){S.round=rd;const car=S.units.find(v=>v.team===S.atk);for(const u of S.units){u.plan=null;u.react=null;if(u!==car)Object.assign(u,{x:0,z:u.team===S.atk?50:-50,input:{}});}
   S.spike={st:'carry',carrier:car.id,x:46,y:10.07,z:-27,t:45,pt:0,dt:0,site:'A'};Object.assign(car,{x:46,y:10.07,z:-27,vx:0,vz:0,vy:0,air:false,alive:true,hp:100});car.orbR=S.round;car.orbGo=null;
   S.bot=function(u){return u===car?SpikeSimulation.prototype.bot.call(this,u):undefined;};let n=0;for(;n<240&&S.spike.st==='carry';n++)S.step(.05);
   assert.equal(S.spike.st,'plant','round '+rd+': the carrier at the A edge planted within 12 s (was: stood still outside the zone)');}}}
console.log('Bot feel 3: (3) every plant spot 1.05 m+ inside the zone, the carrier never stands on the edge; (2) a team on a win buys (bonus round, no eco / save), a full call short of a rifle buys the best it can afford; (1) ult-orb errand never freezes 0.96-1.2 m off the orb (channels from goalPath\'s stop, gives up after ULT_ORB.give s)');
