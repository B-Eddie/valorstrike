// TDM abilities and ultimates online = VALORANT (wiki.playvalorant.com/en-us/Team_Deathmatch "Abilities", fetched 2026-10-28; raw
// copy /workspace/work/qa/parity/src/Team_Deathmatch.txt): immediate basic + signature abilities, charges recharge on the TDM
// cooldown table, signature starts full (+50 % of the next when it has two), basics at 50 % progress, ult from kills (3 points)
// and Ultimate Orbs (10) up to the TDM ult cost. Real TDM rooms (createSim('tdm')) through the worker's ability messages.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createSim} from './src/modes.js';import {Simulation} from './src/simulation.js';
import * as T from './src/tdmabil.js';
const {TDM_CD,TDM_ULT,TDM_PTS}=T;
// the wiki tables (12 agents of this game)
assert.deepEqual({c:TDM_CD.Jett.c,q:TDM_CD.Jett.q,e:TDM_CD.Jett.e},{c:29,q:44,e:44},'Jett Cloudburst 29 / Updraft 44 / Tailwind 44');
assert.deepEqual([TDM_CD.Sage.c,TDM_CD.Sage.q,TDM_CD.Sage.e],[94,51,22],'Sage Barrier 94 / Slow 51 / Healing 22');
assert.deepEqual([TDM_CD.Chamber.q,TDM_CD.Cypher.e,TDM_CD.Omen.q],[9,22,73],'Headhunter 9, Spycam 22, Paranoia 73');
assert.deepEqual(TDM_ULT,{Jett:60,Phoenix:70,Sova:70,Sage:50,Reyna:80,Omen:60,Killjoy:90,Raze:80,Skye:70,Breach:90,Cypher:50,Chamber:70},'TDM ult costs');
assert.deepEqual([TDM_PTS.kill,TDM_PTS.orb],[3,10],'3 per kill, 10 per orb');
const nodes=[[0,0,0],[0,0,-10],[0,0,-40]];
const W={map:{attacker:[0,0,0],defender:[0,0,-40],sites:{A:[0,0,0]},callouts:[]},nav:{nodes,adj:[[1],[0,2],[1]]},playable:[0,1,2],allowed:new Set([0,1,2]),near:(x,z)=>z<-25?2:z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const room=(a='Jett',b='Omen')=>{const s=createSim(W,'tdm','ascent',()=>.5);const p=s.add('p',a,true,0),e=s.add('e',b,true,1);s.spawnRooms=false;s.start(false);return {s,p,e};};
const park=(s,u,x,z)=>Object.assign(u,{x,z,y:0,vx:0,vz:0,vy:0,input:{},inputAt:s.time});
const run=(s,sec,f)=>{for(let t=0;t<sec-1e-9;t+=.05){f&&f();s.step(.05);}};
// start charges
{const {s,p,e}=room('Jett','Omen');
 assert.equal(s.tdmAbil,true,'TDM room runs abilities');
 assert.deepEqual([p.ability.c,p.ability.q,p.ability.e,p.ability.ult],[0,0,1,0],'Jett: Tailwind (signature) 1, basics 0, no ult');
 assert.deepEqual([e.ability.c,e.ability.q,e.ability.e],[0,0,1],'Omen: Dark Cover (signature) 1');
 // half way to the first basic charge already: Cloudburst 29 s -> 14.5 s, Updraft 44 s -> 22 s
 run(s,14,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.c,0,'Cloudburst not yet at 14 s');
 run(s,1,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.c,1,'Cloudburst charge at 14.5 s (50 % start)');
 run(s,7.5,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.q,1,'Updraft charge at 22 s');
 // Dark Cover holds 2: the signature's second charge starts at 50 %: 65 s -> 32.5 s
 run(s,11,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(e.ability.e,2,'Dark Cover second charge at 32.5 s');
 run(s,29,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.c,2,'Cloudburst 2nd charge 29 s later (cap 2)');
 run(s,40,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.c,2,'held at the cap');
 // cast through the command: spent, back after its own cooldown
 assert.equal(s.command(p,{t:'ab',k:'q'}),true,'Updraft casts');assert.equal(p.ability.q,0);
 run(s,43,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.q,0,'Updraft not back before 44 s');
 run(s,1.5,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.q,1,'Updraft back after 44 s');}
// no standard restock and no kill refill: Sage's Healing Orb comes back on 22 s (not 45 s); Raze's Paint Shells not after 2 kills
{const {s,p,e}=room('Sage','Raze');
 p.hp=60;assert.equal(s.command(p,{t:'ab',k:'e'}),true,'Healing Orb casts (self, hurt)');assert.equal(p.ability.e,0);
 run(s,22.2,()=>{park(s,p,0,0);park(s,e,0,-40);});assert.equal(p.ability.e,1,'Healing Orb back on the 22 s TDM cooldown');
 e.ability.e=0;e.ability.tdp.e=0;e.kills+=2;s.step(.05);e.kills+=1;s.step(.05);assert.equal(e.ability.e,0,'Paint Shells: no 2-kill refill in TDM');}
// ult: 3 points a kill up to the TDM cost; pips for the page; the cast spends the points
{const {s,p,e}=room('Jett','Omen');
 for(let k=0;k<19;k++){p.kills++;s.step(.05);}assert.equal(p.ability.tp,57,'19 kills = 57 points');assert.equal(p.ability.ult,7,'57/60 = 7 of 8 pips');
 assert.equal(s.command(p,{t:'ab',k:'x'}),false,'no Blade Storm at 57/60');
 p.kills++;s.step(.05);assert.equal(p.ability.tp,60);assert.equal(p.ability.ult,8,'full');
 const rs=s.roundState(p);assert.deepEqual([rs.ab.ult,rs.tp,rs.uc,rs.tab],[8,60,60,1],'round state: pips, points, TDM cost, tab 1');assert(!('sp' in rs),'no Spike row');
 assert(!('sc' in rs)&&!('b' in rs)&&!('me' in rs)&&!('gm' in rs),'no rounds / buy / credits / variant in TDM');
 assert.equal(s.command(p,{t:'ab',k:'x'}),true,'Blade Storm at 60/60');assert.equal(p.ability.bladesActive,true);s.step(.05);
 assert.deepEqual([p.ability.tp,p.ability.ult],[0,0],'points spent');
 T.tdmAddPoints(e,TDM_PTS.orb);assert.deepEqual([e.ability.tp,e.ability.ult],[10,1],'an Ultimate Orb: 10 points (Omen 60: 1 of 7 pips)');
 // abilities survive a respawn; the match goes on (respawn 1.5 s)
 p.hp=0;p.alive=false;p.respawnAt=s.time+1.5;p.ability.c=1;run(s,1.6);assert.equal(p.alive,true,'respawned');assert.equal(p.ability.c>=1,true,'charges kept over a death');
 const snap=s.snapshot();assert(Array.isArray(snap.fx),'effect rows (barriers / devices / Cloudburst) in the TDM snapshot');assert(!('fw' in snap),'no floor guns');}
// a TDM ability kill scores for the team like a gun kill
{const {s,p,e}=room('Raze','Omen');const before=s.scores[0];e.hp=1;e.armor=0;e.rgn=null;park(s,p,0,0);park(s,e,0,-3);
 const fx={id:999,kind:'blast',owner:p.id,ag:'Raze',team:p.team,p:[0,0,-3],until:s.time+1,radius:4,damage:50,at:s.time};s.effects.push(fx);s.step(.05);
 assert.equal(e.alive,false,'ability kill');assert.equal(s.scores[0],before+1,'team score +1');s.step(.05);assert.equal(p.ability.tp,3,'3 points for an ability kill');}
// Deathmatch and bare fixtures: no abilities
{const s=createSim(W,'dm','ascent',()=>.5),u=s.add('p','Jett',true);s.start(false);assert.equal(s.command(u,{t:'ab',k:'e'}),false,'DM: no abilities');assert(!s.tdmAbil);}
{const s=new Simulation(W,'tdm','ascent',()=>.5),u=s.add('p','Jett',true);s.start(false);assert.equal(s.command(u,{t:'ab',k:'e'}),false,'bare Simulation: no abilities');}
// worker: a TDM room answers ability messages (ao + round state) and sends the round state with every state frame
{let now=1_000_000;const FakeDate=class extends Date{static now(){return now;}};
 const source=fs.readFileSync(new URL('./src/worker.js',import.meta.url),'utf8');
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date:FakeDate,URL,performance,setInterval:()=>1,clearInterval(){},Map,JSON,Number,Object,console:{error(){},warn(){},log(){}},kits:JSON.parse(fs.readFileSync(new URL('./src/kits.json',import.meta.url),'utf8'))};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;',context);
 const room=new context.GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}',{status:401})})}});room.advertise=()=>{};room.saveResults=async()=>{};
 room.sim=createSim(W,'tdm','ascent',()=>.5);room.sim.spawnRooms=false;const u=room.sim.add('A','Jett',true,0);u.loading=false;room.sim.add('B','Omen',true,1).loading=false;room.sim.start(false);room.last=now;room.code='TDMAB1';
 const ws={frames:[],closed:null,send(d){this.frames.push(JSON.parse(d));},close(){}};room.sessions.set(ws,{id:'A',u,window:now,count:0,last:now,ready:true,resume:'r-A'});
 await room.message(ws,JSON.stringify({t:'ab',k:'e'}));const ao=ws.frames.find(m=>m.t==='ao');assert(ao&&ao.ok===true&&ao.k==='e','ability reply (ao) in TDM');assert(ao.rs&&ao.rs.ab&&ao.rs.uc===60,'with the round state (ab, TDM ult cost)');
 const ws2={frames:[],closed:null,send(d){this.frames.push(JSON.parse(d));},close(){}};const u2=room.sim.units.find(v=>v.name==='B');room.sessions.set(ws2,{id:'B',u:u2,window:now,count:0,last:now,ready:true,resume:'r-B'});room.begin(ws2,true);const st=ws2.frames.find(m=>m.t==='start');assert(st&&st.tab===1&&st.rs&&st.rs.tab===1,'start: tab 1 + round state');room.sessions.get(ws2).ready=true;
 for(let i=0;i<10;i++){now+=50;room.tick();}
 assert(ws.frames.some(m=>m.t==='s'&&m.rs&&m.rs.ab||m.t==='rs'&&m.ab),'round state flows with the state frames in TDM');
 room.sim.castEvents.push({t:'ac',i:u.id,ag:'Jett',k:'q',o:[0,1.6,0],d:[0,0,-1],p:[0,0,0],ts:0});now+=50;room.tick();assert(ws.frames.some(m=>m.t==='ac'),'cast events reach the TDM room');}
console.log('TDM abilities online: TDM cooldown table recharges (signature full / basics 50 % at start), no restock / kill refill, ult 3 per kill / 10 per orb up to the TDM cost (pips for the page), ability kills score, charges kept over respawns, worker ao / rs / ac in TDM; DM none');
