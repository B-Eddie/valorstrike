import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';
import {tickAbilities,abilityDamage} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
function fixture(){const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('Reyna','Reyna'),v=s.add('enemy');s.start(false);s.buy=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});Object.assign(v,{x:0,y:0,z:-4,armor:0,protectedUntil:0});return {s,u,v};}
function soul(s,u,p=[0,1.2,-4],until=s.time+3){s.effects.push({id:++s.effectSeq,kind:'soul',owner:u.id,team:u.team,p,until,radius:0});}
{
 const {s,u,v}=fixture();assert.equal(s.command(u,{t:'ab',k:'q'}),false);assert.equal(u.ability.q,1);soul(s,v);soul(s,u,[0,1.2,-20]);soul(s,u,[0,1.2,-3],-1);assert.equal(s.command(u,{t:'ab',k:'e'}),false);assert.equal(u.ability.q,1);
 abilityDamage(s,u,v,200);const own=s.effects.filter(e=>e.kind==='soul'&&e.owner===u.id&&e.until>0&&e.p[2]===-4);assert.equal(own.length,1);abilityDamage(s,u,v,200);assert.equal(s.effects.filter(e=>e.p[2]===-4&&e.owner===u.id).length,1);
 assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.equal(u.ability.q,0);u.hp=100;for(let i=0;i<60;i++){s.time+=.05;tickAbilities(s,.05);}assert(Math.abs(u.hp-150)<.001);s.time=10.01;tickAbilities(s,0);assert.equal(u.hp,100);
}
{
 const {s,u,v}=fixture();soul(s,u);assert(s.command(u,{t:'ab',k:'e'}));assert.equal(s.fire(u),false);const ammo=u.ammo,hp=u.hp;abilityDamage(s,v,u,200);assert.equal(u.hp,hp);assert.equal(u.ammo,ammo);s.time=1.6;assert.equal(s.fire(u),true);
}
{
 const {s,u,v}=fixture();u.ability.ult=7;u.hp=20;assert(s.command(u,{t:'ab',k:'x'}));assert.equal(u.hp,20);assert(u.empress);assert.equal(s.command(u,{t:'ab',k:'x'}),false);u.ability.q=0;abilityDamage(s,u,v,200);s.time=1;tickAbilities(s,1);assert(u.hp>20);assert(s.command(u,{t:'ab',k:'e'}));assert.equal(u.ability.q,0);assert(s.roundState(u).reyna.dismiss>0);assert.equal(s.roundState(v).reyna,null);u.alive=false;tickAbilities(s,.05);assert.equal(u.empress,false);assert.equal(u.devour,null);assert.equal(s.effects.filter(e=>e.kind==='soul'&&e.owner===u.id).length,0);s.newRound();assert.equal(u.dismissUntil,0);assert.equal(u.overhealUntil,0);
}
{
 const {s,u,v}=fixture();u.weapon='Vandal';u.ammo=25;v.hp=1;assert(s.fire(u));assert.equal(s.effects.filter(e=>e.kind==='soul'&&e.owner===u.id).length,1);u.pendingTeleport={at:10,p:[0,0,0]};s.time=3;assert.equal(s.fire(u),false);
}
// A heal on an overhealed Reyna (e.g. Sage's heal running when she Devours past 100) clamped her back to 100.
{const {s,u}=fixture();u.hp=130;u.overhealUntil=s.time+10;s.effects.push({id:++s.effectSeq,kind:'heal',owner:u.id,team:u.team,target:u.id,p:[0,0,0],until:s.time+5,radius:8,rate:20});
 for(let i=0;i<20;i++){s.time+=.05;tickAbilities(s,.05);}assert.equal(u.hp,130,'heal leaves an overheal alone');u.hp=60;u.overhealUntil=0;for(let i=0;i<20;i++){s.time+=.05;tickAbilities(s,.05);}assert(Math.abs(u.hp-80)<1e-6,'heal still heals below 100: '+u.hp);}
console.log('Reyna authority: owned nearby unexpired souls, shared charges, +50 Devour/overheal expiry, Dismiss immunity/no attacks, Empress/free casts, gun and ability souls, private state and death/round reset, heals never clamp an overheal');

// Dismiss: 12 m/s top speed (v8.11) whatever the gun, intangible - the 65 % slow and tags do not apply; 1.5 s
{const {s,u,v}=fixture();s.roundDelay=0;Object.assign(v,{x:40,z:-60});u.human=v.human=true;soul(s,u);assert(s.command(u,{t:'ab',k:'e'}));assert.ok(Math.abs(u.dismissUntil-s.time-1.5)<1e-9,'1.5 s');
 u.slowUntil=s.time+5;u.tagUntil=s.time+5;const sp=()=>Math.hypot(u.vx||0,u.vz||0);for(let i=0;i<20;i++){u.input={forward:1};u.inputAt=s.time;s.step(.05);}assert.ok(Math.abs(sp()-12)<.05,'dismissed: 12 m/s, not slowed: '+sp());
 for(let i=0;i<20;i++){u.input={forward:1};u.inputAt=s.time;s.step(.05);}assert.ok(!(u.dismissUntil>s.time)&&sp()<6.75*.35+.05,'after Dismiss the slow is back: '+sp());}
// Empress Combat Stim (v11.08): +10 % fire rate, reload and equip speed (was +15 % fire rate only)
{const {s,u,v}=fixture();const {weapons,reloadTime}=await import('./src/simulation.js');s.roundDelay=0;Object.assign(v,{x:40,z:-60});u.weapon='Vandal';u.ammo=10;u.reserve=50;u.inventory={Vandal:10,Classic:12};u.reserves={Vandal:50,Classic:36};u.primary='Vandal';
 const base=reloadTime(u);u.empress=true;assert.ok(Math.abs(reloadTime(u)-base/1.1)<1e-9,'reload /1.1');
 assert(s.command(u,{t:'equip',w:'Classic'}),'equip');assert.equal(u.weapon,'Classic');assert.ok(Math.abs(u.equipAt-s.time-weapons.Classic.equipTimeSeconds/1.1)<1e-9,'equip /1.1: '+(u.equipAt-s.time));
 u.weapon='Vandal';u.ammo=10;u.fireAt=0;u.equipAt=0;
 const t0=s.time;u.input={fire:true};u.inputAt=s.time;assert(s.fire(u));assert.ok(Math.abs(u.fireAt-t0-1/(weapons.Vandal.fireRate*1.1))<1e-9,'fire rate x1.1: '+(u.fireAt-t0));}
