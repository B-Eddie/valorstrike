// Game rules fixed against current sources (fog-spec-3, user 2026-10-26 10:32 "search online for everything that you have ... and
// verify it's right"; table: work/validation/values-game.md). Sources:
//  [DM]  https://wiki.playvalorant.com/en-us/Deathmatch        (a kill drops health kits on the victim's body)
//  [VG]  https://valorant.gs/rules/                            (DeathmatchGameMode Health Pack: Lifespan 8, Health 50, Armor 25,
//                                                               Sphere Radius 50 uu; Spike "Defuse cancel window 0.2s";
//                                                               HURMGameMode Stage 1-3 75s)
//  [TDM] https://wiki.playvalorant.com/en-us/Team_Deathmatch   (four stages 75 / 75 / 75 / 345 s, per-stage guns)
//  [UN]  https://wiki.playvalorant.com/en-us/Unrated           (12-12 -> one Endgame / Sudden Death round, same sides, 5000)
//  [P103] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-03/ ("Unrated will still use the original
//         Sudden Death format"; win-by-two Overtime is Competitive)
import assert from 'node:assert/strict';
import {createSim} from './src/modes.js';
import {Simulation,HEALTH_PACK,TDM_STAGES,TDM_STAGE_AT,tdmStage,tdmAllowed,tdmArmor,RGN} from './src/simulation.js';
import {SpikeSimulation,DEFUSE_CANCEL} from './src/spike.js';
import {fogView} from './src/fog.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
// 1. Deathmatch health packs [DM] [VG]
assert.deepEqual({...HEALTH_PACK},{life:8,hp:50,armor:25,r:.5,cap:100,armorCap:50});
{const s=new Simulation(W,'dm','ascent',()=>.5),a=s.add('a','Jett',true),b=s.add('b','Sage',true),c=s.add('c','Sova',true);s.start(false);
 const park=(u,x,z)=>Object.assign(u,{x,y:0,z,vx:0,vz:0,vy:0,input:{},inputAt:-9,loading:false});park(a,0,0);park(b,20,0);park(c,-20,0);
 // b dies at (20, 0): one pack there
 b.hp=0;b.alive=false;b.deaths++;b.lastKiller=a.id;b.respawnAt=s.time+60;s.step(.05);assert.equal(s.packs.length,1,'a death drops one pack');const k=s.packs[0];assert.deepEqual([k.x,k.z,k.victim,k.killer],[20,0,b.id,a.id]);
 s.step(.05);assert.equal(s.packs.length,1,'one pack per death, not per tick');
 const snap=s.snapshot();assert(Array.isArray(snap.hpk)&&snap.hpk.length===1&&snap.hpk[0][0]===k.id&&snap.hpk[0][3]===20,'snapshot hpk row');assert(snap.hpk[0][6]>7.8&&snap.hpk[0][6]<=8,'seconds left');
 // a full-health unit walks over it: the pack stays
 park(c,20,0);c.hp=100;c.armor=50;s.step(.05);assert.equal(s.packs.length,1,'full HP / armour: the pack stays');
 // a hurt unit 0.8 m away picks it up: +50 HP, +25 armour, capped
 park(c,20.8,0);c.hp=30;c.armor=10;s.step(.05);assert.equal(s.packs.length,0,'picked up within 0.5 m sphere + 0.35 m capsule');assert.equal(c.hp,80);assert.equal(c.armor,35);
 // out of reach (1 m) or 2 m below: no pickup
 park(c,-30,0);b.alive=true;b.hp=100;park(b,20,0);b.hp=0;b.alive=false;b.deaths++;s.step(.05);assert.equal(s.packs.length,1);park(c,21,0);c.hp=10;s.step(.05);assert.equal(s.packs.length,1,'1 m away: not touched');park(c,20,0);c.y=2;s.step(.05);assert.equal(s.packs.length,1,'2 m vertically: not touched');
 c.y=0;c.hp=70;c.armor=40;s.step(.05);assert.equal(c.hp,100,'HP capped at 100');assert.equal(c.armor,50,'armour capped at 50');
 // lifespan 8 s
 b.alive=true;park(b,20,0);b.hp=0;b.alive=false;b.deaths++;s.step(.05);assert.equal(s.packs.length,1);park(c,-30,0);for(let i=0;i<158;i++)s.step(.05);assert.equal(s.packs.length,1,'still there before 8 s');for(let i=0;i<4;i++)s.step(.05);assert.equal(s.packs.length,0,'gone after 8 s');
 // out of bounds deaths drop nothing
 b.alive=true;park(b,20,0);b.hp=0;b.alive=false;b.deaths++;b.packDeaths=b.deaths;s.step(.05);assert.equal(s.packs.length,0,'no pack for an out-of-bounds death');
 // fog: the killer / victim always get it; a far player who had no sight of the victim does not
 b.alive=true;park(b,20,0);b.hp=0;b.alive=false;b.deaths++;b.lastKiller=a.id;s.step(.05);park(c,-60,0);const sn=s.snapshot();
 assert.equal(fogView(s,sn,a).hpk?.length,1,'killer sees the pack');assert.equal(fogView(s,sn,b).hpk?.length,1,'victim sees its pack');
 s.fogPass=null;const far=fogView(s,sn,c);assert(Array.isArray(far.hpk),'filtered list sent');}
{const s=new Simulation(W,'tdm','ascent',()=>.5);s.add('p','Jett',true);s.start(false);assert.equal(s.snapshot().hpk,undefined,'no packs outside Deathmatch');}
// 2. Team Deathmatch stages [TDM] [VG]
assert.deepEqual([...TDM_STAGE_AT],[0,75,150,225]);assert.equal(570-TDM_STAGE_AT[3],345,'Stage 4 345 s');
assert.deepEqual(TDM_STAGES.map(a=>[...a]),[['Classic','Frenzy','Ghost'],['Sheriff','Stinger','Ares'],['Spectre','Ares','Bulldog','Guardian'],['Phantom','Vandal']]);
assert.deepEqual([0,74.9,75,149.9,150,224.9,225,569].map(tdmStage),[0,0,1,1,2,2,3,3]);
assert(tdmAllowed('Ghost',3)&&tdmAllowed('Knife',2)&&!tdmAllowed('Operator',3)&&!tdmAllowed('Stinger',2)&&tdmAllowed('Ares',2));
{const s=new Simulation(W,'tdm','ascent',()=>.5),p=s.add('p','Jett',true);const bots=[];for(let i=0;i<3;i++)bots.push(s.add('b'+i,'Sage',false));s.start(false);
 assert(bots.every(b=>TDM_STAGES[0].includes(b.weapon)),'bots start on a Stage 1 gun');assert.equal(p.weapon,'Classic','humans start on the Classic');
 assert.equal(s.command(p,{t:'equip',w:'Vandal'}),false,'Vandal not before Stage 4');assert.equal(s.command(p,{t:'equip',w:'Ghost'}),true);
 s.remaining=570-75.01;s.step(.05);assert.equal(s.stage,1);assert(bots.every(b=>TDM_STAGES[1].includes(b.weapon)),'bots re-armed for Stage 2');assert.equal(p.weapon,'Ghost','Stage 1 sidearm kept');
 assert.equal(s.command(p,{t:'equip',w:'Stinger'}),true);s.remaining=570-150.01;s.step(.05);assert.equal(p.weapon,'Classic','a Stage 2 gun is not carried into Stage 3');assert.equal(s.command(p,{t:'equip',w:'Stinger'}),false);assert.equal(s.command(p,{t:'equip',w:'Bulldog'}),true);
 s.remaining=570-225.01;s.step(.05);assert(bots.every(b=>['Phantom','Vandal'].includes(b.weapon)),'Stage 4 rifles');assert.equal(s.command(p,{t:'equip',w:'Vandal'}),true);}
// 3. Defuse cancel window [VG]
assert.equal(DEFUSE_CANCEL,.2);
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),b=s.add('b','Sage');s.start(false);b.team=1-a.team;s.atk=a.team;s.buy=0;
 Object.assign(s.spike,{st:'plant',site:'A',x:0,y:0,z:0,t:45,dt:0,defuser:null});Object.assign(a,{x:30,y:0,z:30,alive:true});Object.assign(b,{x:0,y:0,z:0,alive:true,input:{interact:true}});
 for(let i=0;i<20;i++){b.inputAt=s.time;s.step(.05);}const d1=s.spike.dt;assert(d1>.9&&d1<1.1,'1 s in: '+d1);
 b.input={};s.step(.05);s.step(.05);s.step(.05);assert.equal(s.spike.dt,d1,'0.15 s let-go: progress held');b.input={interact:true};b.inputAt=s.time;s.step(.05);assert(s.spike.dt>d1,'back on the key inside 0.2 s: the defuse goes on');
 b.input={};for(let i=0;i<5;i++)s.step(.05);assert.equal(s.spike.dt,0,'0.25 s let-go before the half: progress lost');
 // the window is for a key release only: moving off, firing or stepping out of range drops progress on the same tick
 const hold=(n)=>{for(let i=0;i<n;i++){b.input={interact:true};b.inputAt=s.time;s.step(.05);}};hold(10);assert(s.spike.dt>.4);b.input={forward:1};b.inputAt=s.time;s.step(.05);assert.equal(s.spike.dt,0,'moving off: no window');Object.assign(b,{x:0,z:0,vx:0,vz:0});
 hold(80);assert(s.spike.dt>=3.5&&s.spike.dt<7,'past the half: '+s.spike.dt);b.input={fire:true};b.inputAt=s.time;s.step(.05);assert.equal(s.spike.dt,3.5,'firing: straight to the checkpoint');
 hold(2);b.input={};b.x=3;s.step(.05);assert.equal(s.spike.dt,3.5,'out of range: no window');b.x=0;
 hold(2);const d2=s.spike.dt;b.input={};b.inputAt=s.time;s.step(.05);assert.equal(s.spike.dt,d2,'a plain release past the half still gets the window');}
// 4. Unrated Endgame [UN] [P103] (test-economy / test-parity-rules / test-spike-accept cover the round flow)
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),b=s.add('b','Sage');s.start(false);b.team=1-a.team;s.atk=a.team;
 s.round=24;s.roundScores=[12,12];a.ability.ult=3;const atk=s.atk;s.newRound();assert.equal(s.round,25);assert.equal(s.atk,atk,'same sides');assert.equal(a.credits,5000);assert.equal(a.ability.ult,3,'ult points carried over');
 s.roundScores=[13,12];s.roundDelay=.01;s.step(.05);assert.equal(s.phase,'post','13-12 wins');}
// 5. spectate pov: an Operator teammate on the second zoom reports ADS 2 (input az)
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),m=s.add('m','Sage');s.start(false);m.team=a.team;a.alive=false;m.alive=true;m.weapon='Operator';
 assert(s.command(m,{t:'in',seq:1,r:0,p:0,ads:1,az:1}));assert.equal(m.input.zoom2,true);assert.deepEqual(s.roundState(a).pov[m.id][0],2,'Operator second zoom');
 assert(s.command(m,{t:'in',seq:2,r:0,p:0,ads:1}));assert.equal(s.roundState(a).pov[m.id][0],1,'first zoom');
 assert(s.command(m,{t:'in',seq:3,r:0,p:0,ads:0,az:1}));assert.equal(m.input.zoom2,false,'az without ads is ignored');assert.equal(s.roundState(a).pov[m.id][0],0);
 m.weapon='Vandal';assert(s.command(m,{t:'in',seq:4,r:0,p:0,ads:1,az:1}));assert.equal(s.roundState(a).pov[m.id][0],1,'only the Operator has a second zoom');}
// TDM armour by loadout (wiki Team_Deathmatch Loadout tables, vs-lane-parity 2026-10-28): "The amount of armor or shield a player
// has each stage depends on the gun they have chosen for that stage." S1 Classic Regen Shield, Frenzy / Ghost none; S2 Sheriff
// Light, Stinger Heavy, Ares Light; S3 Spectre / Ares / Bulldog Heavy, Guardian Light; S4 Phantom / Vandal Heavy.
{const A=(st,w)=>JSON.stringify(tdmArmor(st,w));
 assert.equal(A(0,'Classic'),JSON.stringify({a:25,rg:RGN.pool}),'Stage 1 Classic: Regen Shield');assert.equal(A(0,'Ghost'),'{"a":0,"rg":null}');assert.equal(A(0,'Frenzy'),'{"a":0,"rg":null}');
 assert.equal(A(1,'Sheriff'),'{"a":25,"rg":null}');assert.equal(A(1,'Stinger'),'{"a":50,"rg":null}');assert.equal(A(1,'Ares'),'{"a":25,"rg":null}');
 assert.equal(A(2,'Ares'),'{"a":50,"rg":null}','Ares is Heavy in Stage 3');assert.equal(A(2,'Guardian'),'{"a":25,"rg":null}');assert.equal(A(2,'Spectre'),'{"a":50,"rg":null}');assert.equal(A(2,'Bulldog'),'{"a":50,"rg":null}');
 assert.equal(A(3,'Vandal'),'{"a":50,"rg":null}');assert.equal(A(3,'Phantom'),'{"a":50,"rg":null}');
 assert.equal(A(2,'Classic'),A(0,'Classic'),'no stage pick yet: the Stage 1 sidearm\'s armour');assert.equal(A(3,'Ghost'),A(0,'Ghost'));
 const s=createSim(W,'tdm','ascent',()=>.5),p=s.add('p','Jett',true),b=s.add('b0','Sage',false);assert.equal(s.loadoutArmor,true,'TDM rooms (createSim) use loadout armour');s.start(false);
 assert.equal(p.armor,25,'human on the Classic: 25 Regen Shield');assert.equal(p.rgn,RGN.pool);b.weapon='Ghost';s.spawn(b);assert.equal(b.armor,0,'Ghost: no armour');assert.equal(b.rgn,null);
 s.remaining=570-225.01;s.step(.05);assert(['Phantom','Vandal'].includes(b.weapon));assert.equal(b.armor,50,'Stage 4 re-arm brings Heavy');
 assert(s.command(p,{t:'equip',w:'Vandal'}));p.armor=10;s.spawn(p);assert.equal(p.armor,50,'Stage 4 respawn with the Vandal: Heavy');assert.equal(p.rgn,null);
 const d=new Simulation(W,'dm','ascent',()=>.5),q=d.add('q','Jett',true);d.start(false);assert.equal(q.armor,50,'Deathmatch keeps Heavy');}
console.log('Game rules: DM health packs (8 s, +50 HP / +25 armour, 0.5 m sphere, victim spot, fog), TDM 4 stages 75/75/75/345 s with per-stage guns (server re-arm, equip rule), defuse cancel window 0.2 s, Unrated Endgame round 25 (same sides, 5000, ults kept, 13-12), Operator second zoom in spectate pov');
