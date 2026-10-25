import assert from 'node:assert/strict';import fs from 'node:fs';import {SpikeSimulation} from './src/spike.js';const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};const s=new SpikeSimulation(W),a=s.add('a'),b=s.add('b');s.start(false);s.buy=0;a.ammo=1;a.reserve=2;assert.equal(s.command(a,{t:'reload'}),true);s.time+=2;s.step(.05);assert.equal(a.ammo,3);assert.equal(a.reserve,0);assert.equal(s.command(a,{t:'reload'}),false);a.credits=9000;s.buy=10;assert.equal(s.command(a,{t:'buy',n:'Vandal'}),true);assert.equal(a.reserve,75);assert.equal(s.command(a,{t:'buy',n:'totally Heavy free'}),false);assert.equal(s.command(a,{t:'equip',w:'Classic'}),true);/* a quick swap back during the Classic's equip time is taken (as the client swaps any time; refusing it left the server on another gun), and the Vandal's own equip time gates its first shot */assert.equal(s.command(a,{t:'equip',w:'Vandal'}),true);assert.equal(a.weapon,'Vandal');assert(a.fireAt>s.time+.5);assert.equal(s.command(a,{t:'equip',w:'Classic'}),true);s.time+=2;assert.equal(s.command(a,{t:'equip',w:'Vandal'}),true);assert.equal(a.reserve,75);for(let i=0;i<11;i++){s.finishRound(i%2,'test');s.roundDelay=0;s.newRound();}assert.equal(s.round,12);s.finishRound(0,'test');s.roundDelay=0;s.newRound();assert.equal(s.round,13);assert.equal(s.atk,1);assert.equal(a.credits,800);assert.equal(a.primary,null);assert.equal(a.armor,0);const t=new SpikeSimulation(W),h=t.add('one');t.start();const teams=t.units.reduce((a,u)=>(a[u.team]++,a),[0,0]);t.add('late');assert.deepEqual(t.units.reduce((a,u)=>(a[u.team]++,a),[0,0]),teams);assert.equal(t.units.find(u=>u.name==='late').alive,false);console.log('Spike edge checks passed: finite reserve/reload, equip lock, armor exact name, halftime reset, balanced late seat waits for next round');

// Refunds may unwind a slot only in reverse order. Otherwise selling an older
// purchase and then the newer one can restore a fully refunded weapon or armor.
const r=new SpikeSimulation(W),p=r.add('refund'),q=r.add('other');r.start(false);assert.equal(p.armor,0);p.credits=9000;
assert.equal(r.command(p,{t:'buy',n:'Vandal'}),true);assert.equal(r.command(p,{t:'buy',n:'Phantom'}),true);
assert.equal(r.command(p,{t:'sell',n:'Vandal'}),false);assert.equal(p.credits,3200);
assert.equal(r.command(p,{t:'sell',n:'Phantom'}),true);assert.equal(p.primary,'Vandal');
assert.equal(r.command(p,{t:'sell',n:'Vandal'}),true);assert.equal(p.primary,null);assert.equal(p.credits,9000);
assert.equal(r.command(p,{t:'buy',n:'Light Shields'}),true);assert.equal(r.command(p,{t:'buy',n:'Heavy Shields'}),true);
assert.equal(r.command(p,{t:'sell',n:'Light Shields'}),false);
assert.equal(r.command(p,{t:'sell',n:'Heavy Shields'}),true);assert.equal(p.armor,25);
assert.equal(r.command(p,{t:'sell',n:'Light Shields'}),true);assert.equal(p.armor,0);assert.equal(p.credits,9000);
r.command(p,{t:'buy',n:'Ghost'});p.loading=true;assert.equal(r.command(p,{t:'sell',n:'Ghost'}),false);p.loading=false;p.alive=false;assert.equal(r.command(p,{t:'sell',n:'Ghost'}),false);p.alive=true;
r.buy=0;r.roundDelay=5;assert.equal(r.command(p,{t:'ab',k:'e'}),false);assert.equal(p.ability.e,1);
console.log('Spike refund regression: no free restored weapon/armor from out-of-order sells; loading/dead refund and post-round ability rejected');

const k=new SpikeSimulation(W,'five','ascent',()=>.5),killer=k.add('killer','Phoenix'),v1=k.add('v1'),v2=k.add('v2');k.start(false);k.buy=0;
Object.assign(killer,{x:0,y:0,z:0,look:0,pitch:Math.atan2(-.6,2),weapon:'Bucky',ammo:5,fireAt:0,input:{},credits:0,roundKills:0});killer.ability.ult=6;
for(const v of [v1,v2])Object.assign(v,{team:1,x:0,y:0,z:-2,armor:0,hp:1,protectedUntil:0});
assert.equal(k.fire(killer),true);assert.equal(killer.kills,2);assert.equal(killer.credits,400);assert.equal(killer.roundKills,2);assert.equal(killer.ability.ult,7);
console.log('Spike weapon rewards: each shotgun kill credited, agent ult cap respected');

const dr=new SpikeSimulation(W),dropper=dr.add('dropper'),defender=dr.add('defender');dr.start(false);
assert.equal(dr.command(dropper,{t:'buy',n:'ab:c'}),true);assert.equal(dropper.ability.c,1);assert.equal(dr.command(dropper,{t:'sell',n:'ab:c'}),true);assert.equal(dropper.ability.c,0);assert.equal(dropper.credits,800);assert.equal(dr.command(dropper,{t:'sell',n:'ab:c'}),false);
dr.buy=0;assert.equal(dr.command(dropper,{t:'drop'}),true);dr.step(.05);assert.equal(dr.spike.st,'drop');dr.time=1.1;dr.step(.05);assert.equal(dr.spike.st,'carry');assert.equal(dr.spike.carrier,dropper.id);
console.log('Spike drop survives next tick without auto-pickup by sender; ability refund changes charge/credits exactly once');

const hidden=dr.roundState(defender).sp;assert.equal(hidden[1],-1);assert.equal(hidden[2],0);assert.equal(hidden[3],0);assert.equal(hidden[7],'');dr.spike.st='plant';assert.equal(dr.roundState(defender).sp[2],dr.spike.x);assert.equal(dr.roundState(defender).sp[8],1);console.log('Defenders do not receive hidden Spike carrier/site/coordinates before plant');
const bw={...W,map:{...W.map,attacker:[0,0,50],defender:[0,0,-50]}},bs=new SpikeSimulation(bw),bu=bs.add('buy'),bd=bs.add('def');bs.start(false);bs.motorFn=(u)=>{u.z=u.team===bs.atk?40:-40;u.x=20;u.vz=6;};bs.step(.05);assert.equal(bu.z,43);assert.equal(bd.z,-43);assert.equal(bu.x,20);assert.equal(bu.vz,0);bs.buy=0;bs.motorFn=u=>{u.z=u.team===bs.atk?40:-40;};bs.step(.05);assert.equal(bu.z,40);assert.equal(bd.z,-40);console.log('Buy-phase server boundary matches client/native visual zedge, not unrelated12m spawn circle; releases at phaseend');
const wb={...bw,blocked:(x,z)=>x===20&&z===43},bc=new SpikeSimulation(wb),bp=bc.add('p');bc.add('q');bc.start(false);const prior=[bp.x,bp.y,bp.z];bc.motorFn=u=>{u.x=20;u.z=40;u.vz=5;};bc.step(.05);assert.deepEqual([bp.x,bp.y,bp.z],prior);assert.equal(bp.vz,0);console.log('Buy-boundary projection never places capsule into world solid');

// A loading human holds the Spike buy phase for at most LOAD_GRACE (15 s), not for everyone up to the 180 s load timeout.
// Still loading when the buy phase ends: out for the round (dead, spike handed on), back next round. A joiner mid-game
// (already out for the round) never holds it.
{const s=new SpikeSimulation(W),h=s.add('loader','Jett',true),a2=s.add('mate'),d1=s.add('def1'),d2=s.add('def2');s.start(false);
 for(const u of [h,a2])u.team=s.atk;for(const u of [d1,d2])u.team=1-s.atk;s.spike.carrier=h.id;h.loading=true;
 const run=sec=>{for(let i=0;i<Math.round(sec/.05);i++)s.step(.05);};
 run(10);assert.equal(s.buy,20,'held while the loader is inside the grace');run(10);assert.ok(s.buy<20&&s.buy>14,'grace capped at 15 s: buy '+s.buy);
 run(16);assert.equal(s.buy,0);assert.equal(h.alive,false,'still loading at round start: out for the round');assert.equal(s.round,1);
 assert.ok(a2.alive&&s.spike.carrier===a2.id,'spike handed to a teammate who is in the round');
 h.loading=false;run(1);assert.equal(h.alive,false,'finishing the load mid-round spectates');
 s.finishRound(0,'QA');run(5.2);assert.equal(s.round,2);assert.equal(h.alive,true,'back next round');
 const late=s.add('late','Sage',true);late.loading=true;const b0=s.buy;run(2);assert.ok(s.buy<b0-1.9,'mid-game joiner does not hold the round');
 const bL=s.buy;h.loading=true;run(14);assert.equal(s.buy,bL,'a loader alive in the round holds within its grace');run(4);assert.ok(Math.abs(bL-s.buy-3)<.11,'released after 15 s: '+(bL-s.buy));
 h.loadSince=null;const bR=s.buy;run(2);assert.ok(bR-s.buy>1.9,'per-round budget (15 s) spent: no further hold this round');
 console.log('Spike loading hold: capped at 15 s per player and per round, late loader sits the round out and returns next round');}

// Soak (seed 8): Spike rounds ended "Defenders eliminated" with almost no kills. Every mid-round leave put a dead bot in
// the seat, and every rejoin into a full room removed the first bot on the team even when it was alive. Now the seat bot
// takes over the leaver's living body, and a rejoin gives up a dead bot before a living one.
{const s=new SpikeSimulation(W),h=s.add('Leaver','Jett',true);for(let i=0;i<9;i++)s.add('Bot '+i,'Sage',false);s.start(false);s.buy=0;
 const team=h.team;Object.assign(h,{x:0,y:0,z:-3,hp:61,armor:25,weapon:'Vandal',primary:'Vandal',ammo:17,credits:2300});h.inventory={Vandal:17,Classic:12};
 s.release(h);s.units=s.units.filter(u=>u!==h);const b=s.add('Bot Jett','Jett',false,team);assert.equal(b.team,team);assert.equal(b.alive,false,'a seat bot added mid-round starts out');
 assert.equal(s.takeOver(b,h),true);assert.ok(b.alive&&b.hp===61&&b.armor===25&&b.weapon==='Vandal'&&b.ammo===17&&b.z===-3&&b.inventory.Classic===12,'seat bot carries on with the leaver\'s body');
 assert(fs.readFileSync(new URL('./src/worker.js',import.meta.url),'utf8').includes('this.sim.takeOver?.(b,s.u)'),'room drop hands the body to the seat bot');
 const mates=s.units.filter(u=>!u.human&&u.team===team&&u!==b);mates[0].alive=true;mates[1].alive=false;mates[1].hp=0;const order=s.units.indexOf(mates[0])<s.units.indexOf(mates[1]);assert(order,'living bot comes first');
 const back=s.add('Leaver','Jett',true,team);assert.equal(back.team,team);assert(s.units.includes(mates[0])&&!s.units.includes(mates[1]),'rejoin replaced the dead bot, the living one keeps playing');
 const dead=s.units.find(u=>!u.alive&&u.human);assert(!s.takeOver(s.units.find(u=>!u.human),dead||back),'no take-over of a dead body');
 console.log('Spike seats: a leaver\'s seat bot takes over the living body; a rejoin gives up a dead bot before a living one');}
