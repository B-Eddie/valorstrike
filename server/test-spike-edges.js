import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};const s=new SpikeSimulation(W),a=s.add('a'),b=s.add('b');s.start(false);s.buy=0;a.ammo=1;a.reserve=2;assert.equal(s.command(a,{t:'reload'}),true);s.time+=2;s.step(.05);assert.equal(a.ammo,3);assert.equal(a.reserve,0);assert.equal(s.command(a,{t:'reload'}),false);a.credits=9000;s.buy=10;assert.equal(s.command(a,{t:'buy',n:'Vandal'}),true);assert.equal(a.reserve,75);assert.equal(s.command(a,{t:'buy',n:'totally Heavy free'}),false);assert.equal(s.command(a,{t:'equip',w:'Classic'}),true);assert.equal(s.command(a,{t:'equip',w:'Vandal'}),false);s.time+=2;assert.equal(s.command(a,{t:'equip',w:'Vandal'}),true);assert.equal(a.reserve,75);for(let i=0;i<11;i++){s.finishRound(i%2,'test');s.roundDelay=0;s.newRound();}assert.equal(s.round,12);s.finishRound(0,'test');s.roundDelay=0;s.newRound();assert.equal(s.round,13);assert.equal(s.atk,1);assert.equal(a.credits,800);assert.equal(a.primary,null);assert.equal(a.armor,0);const t=new SpikeSimulation(W),h=t.add('one');t.start();const teams=t.units.reduce((a,u)=>(a[u.team]++,a),[0,0]);t.add('late');assert.deepEqual(t.units.reduce((a,u)=>(a[u.team]++,a),[0,0]),teams);assert.equal(t.units.find(u=>u.name==='late').alive,false);console.log('Spike edge checks passed: finite reserve/reload, equip lock, armor exact name, halftime reset, balanced late seat waits for next round');

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
Object.assign(killer,{x:0,y:0,z:0,look:0,pitch:0,weapon:'Bucky',ammo:5,fireAt:0,input:{},credits:0,roundKills:0});killer.ability.ult=5;
for(const v of [v1,v2])Object.assign(v,{team:1,x:0,y:0,z:-2,armor:0,hp:1,protectedUntil:0});
assert.equal(k.fire(killer),true);assert.equal(killer.kills,2);assert.equal(killer.credits,400);assert.equal(killer.roundKills,2);assert.equal(killer.ability.ult,6);
console.log('Spike weapon rewards: each shotgun kill credited, agent ult cap respected');

const dr=new SpikeSimulation(W),dropper=dr.add('dropper'),defender=dr.add('defender');dr.start(false);
assert.equal(dr.command(dropper,{t:'buy',n:'ab:c'}),true);assert.equal(dropper.ability.c,1);assert.equal(dr.command(dropper,{t:'sell',n:'ab:c'}),true);assert.equal(dropper.ability.c,0);assert.equal(dropper.credits,800);assert.equal(dr.command(dropper,{t:'sell',n:'ab:c'}),false);
dr.buy=0;assert.equal(dr.command(dropper,{t:'drop'}),true);dr.step(.05);assert.equal(dr.spike.st,'drop');dr.time=1.1;dr.step(.05);assert.equal(dr.spike.st,'carry');assert.equal(dr.spike.carrier,dropper.id);
console.log('Spike drop survives next tick without auto-pickup by sender; ability refund changes charge/credits exactly once');

const hidden=dr.roundState(defender).sp;assert.equal(hidden[1],-1);assert.equal(hidden[2],0);assert.equal(hidden[3],0);assert.equal(hidden[7],'');dr.spike.st='plant';assert.equal(dr.roundState(defender).sp[2],dr.spike.x);assert.equal(dr.roundState(defender).sp[8],1);console.log('Defenders do not receive hidden Spike carrier/site/coordinates before plant');
const bw={...W,map:{...W.map,attacker:[0,0,50],defender:[0,0,-50]}},bs=new SpikeSimulation(bw),bu=bs.add('buy'),bd=bs.add('def');bs.start(false);bs.motorFn=(u)=>{u.z=u.team===bs.atk?40:-40;u.x=20;u.vz=6;};bs.step(.05);assert.equal(bu.z,43);assert.equal(bd.z,-43);assert.equal(bu.x,20);assert.equal(bu.vz,0);bs.buy=0;bs.motorFn=u=>{u.z=u.team===bs.atk?40:-40;};bs.step(.05);assert.equal(bu.z,40);assert.equal(bd.z,-40);console.log('Buy-phase server boundary matches client/native visual zedge, not unrelated12m spawn circle; releases at phaseend');
const wb={...bw,blocked:(x,z)=>x===20&&z===43},bc=new SpikeSimulation(wb),bp=bc.add('p');bc.add('q');bc.start(false);const prior=[bp.x,bp.y,bp.z];bc.motorFn=u=>{u.x=20;u.z=40;u.vz=5;};bc.step(.05);assert.deepEqual([bp.x,bp.y,bp.z],prior);assert.equal(bp.vz,0);console.log('Buy-boundary projection never places capsule into world solid');
