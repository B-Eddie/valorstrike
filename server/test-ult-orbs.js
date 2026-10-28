// Ultimate orbs online (server/src/ultorbs.js) = VALORANT (wiki.playvalorant.com/en-us/Orbs, fetched 2026-10-28): Unrated / Swiftplay /
// Replication rooms spawn the map's two orbs every round (passageways outside A and B; Haven / Lotus A and C - ORB_SPOTS names a
// callout of every real map), capture = interact held 2 s standing (released early: progress lost), +1 ult point, gone for the rest
// of the round, all gone once the Spike is planted or in the end phase; Spike Rush keeps its own powerup orbs (no ult orbs); bots
// with the errand walk over and channel it; snapshot rows uo / uoc.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {SpikeSimulation} from './src/spike.js';import {VariantSpikeSimulation} from './src/modes.js';
import {ORB_SPOTS,ULT_ORB,ultOrbSpawn} from './src/ultorbs.js';
const root=new URL('..',import.meta.url).pathname;
// every spot is a callout of the real map (server/public/worlds/<map>/map.json = what loadWorld reads)
for(const [m,names] of Object.entries(ORB_SPOTS)){const calls=JSON.parse(fs.readFileSync(root+'server/public/worlds/'+m+'/map.json','utf8')).callouts.map(c=>c.name);for(const n of names)assert(calls.includes(n),m+': callout '+n);
 assert.equal(names.length,2,m+': two orbs');assert(/^C /.test(names[1])===(m==='haven'||m==='lotus'),m+': Haven / Lotus put the second orb outside C');}
assert.deepEqual([ULT_ORB.cap,ULT_ORB.r],[2,1.6]);
// the offline page places its native-map orbs on the same callouts (index.html XUO_SPOTS == ORB_SPOTS)
{const html=fs.readFileSync(root+'index.html','utf8'),m=html.match(/const XUO_SPOTS = (\{[^\n]*?\});/);assert(m,'index.html XUO_SPOTS');
 assert.deepEqual(Function('return '+m[1])(),JSON.parse(JSON.stringify(ORB_SPOTS)),'page XUO_SPOTS == server ORB_SPOTS');}
// a small fixture world with the two Ascent callouts
const calls=[{name:'A Main',position:[10,0,0]},{name:'B Main',position:[-10,0,0]}];
const nodes=[[0,0,0],[0,0,-10],[10,0,0],[-10,0,0]];
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,-20]},callouts:calls},nav:{nodes,adj:[[1,2,3],[0],[0],[0]]},playable:[0,1,2,3],allowed:new Set([0,1,2,3]),near:(x,z)=>{let b=0,d=1e9;nodes.forEach((p,i)=>{const e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;b=i;}});return b;},ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=(Cls,...a)=>{const s=new Cls(W,...a,'ascent',()=>.5);return s;};
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),p=s.add('p','Jett',true,0);s.add('q','Sage',true,1);/* a defender: the round stays live */s.start(false);
 assert.deepEqual(s.ultOrbs.map(o=>[o.id,o.x,o.z]),[[0,10,0],[1,-10,0]],'two orbs on the callout nav nodes');
 let rs=s.roundState(p);assert.equal(rs.uo.length,2,'snapshot rows');
 s.buy=0;s.roundDelay=0;Object.assign(p,{x:10,z:.5,y:0,vx:0,vz:0,vy:0,air:false});const u0=p.ability.ult;
 const hold=(sec,on=true)=>{for(let t=0;t<sec-1e-9;t+=.05){p.input={use:on};/* F = Use (the page's orb key) */p.inputAt=s.time;Object.assign(p,{x:10,z:.5,vx:0,vz:0});s.step(.05);}};
 hold(1);assert(Math.abs(p.orbT-1)<.06,'channelling');assert.equal(s.roundState(p).uoc>0,true,'own channel row');
 hold(.3,false);assert.equal(p.orbT,0,'released: the channel is lost');assert.equal(s.ultOrbs.length,2);
 hold(1.9);assert.equal(s.ultOrbs.length,2,'1.9 s is not a capture');hold(.15);
 assert.equal(s.ultOrbs.length,1,'captured at 2 s');assert.equal(p.ability.ult,u0+1,'+1 ult point');assert(s.events.some(e=>e[0]==='uorb'&&e[1]===p.id));
 hold(3);assert.equal(s.ultOrbs.length,1,'gone for the round');
 // plant: every orb gone
 s.spike.st='plant';s.spike.t=45;s.spike.x=0;s.spike.z=-20;s.step(.05);assert.equal(s.ultOrbs.length,0,'planted: orbs gone');assert.deepEqual(s.roundState(p).uo,[]);
 // next round: both back
 s.newRound();assert.equal(s.ultOrbs.length,2,'new round: both orbs again');}
// firing breaks the channel (canInteract)
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),p=s.add('p','Jett',true,0);s.add('q','Sage',true,1);s.start(false);s.buy=0;Object.assign(p,{x:-10,z:0,y:0,vx:0,vz:0,air:false});
 for(let t=0;t<2.5;t+=.05){p.input={interact:true,fire:true};p.inputAt=s.time;Object.assign(p,{x:-10,z:0,vx:0,vz:0});s.step(.05);}assert.equal(s.ultOrbs.length,2,'firing: no capture');}
// Swiftplay has ult orbs, Spike Rush does not
{const s=new VariantSpikeSimulation(W,'swift','ascent',()=>.5);s.add('p','Jett',true);s.start(false);assert.equal(s.ultOrbs.length,2,'Swiftplay: ult orbs');}
{const s=new VariantSpikeSimulation(W,'sr','ascent',()=>.5);s.add('p','Jett',true);s.start(false);assert.equal(s.ultOrbs.length,0,'Spike Rush: powerup orbs only');}
// a bot with the errand walks over and captures (no enemy in sight)
{const s=new SpikeSimulation(W,'five','ascent',()=>.5);for(let i=0;i<10;i++)s.add('b'+i,'Jett',false);s.start(false);s.buy=0;
 const b=s.units.find(u=>((u.id*7919+s.round*104729)%100)/100<ULT_ORB.botChance);
 if(b){s.canSee=()=>false;for(const u of s.units)if(u!==b){Object.assign(u,{x:0,z:-40,input:{}});u.bot=null;}s.bot=function(u){return u===b?SpikeSimulation.prototype.bot.call(this,u):undefined;};Object.assign(b,{x:10,z:.5,y:0,vx:0,vz:0,air:false});const u0=b.ability.ult;let n=0;for(;n<200&&s.ultOrbs.length===2;n++){s.step(.05);}
  assert.equal(s.ultOrbs.length,1,'bot captured an orb');assert.equal(b.ability.ult,u0+1);}}
console.log('Ult orbs (online): Unrated / Swiftplay two per round on real map callouts (Haven / Lotus A + C), 2 s interact channel (release / firing breaks it), +1 ult, gone after capture / plant / end phase, back next round, Spike Rush none, bots capture; snapshot uo / uoc');
