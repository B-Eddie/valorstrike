// Floor weapons (#4): server-authoritative death drops, F pick-up swap (old gun lands where the new one lay),
// G drop of the held gun, walk-over pick-up into an empty slot, reach / height / line-of-sight checks,
// refund lock, round reset with the free Classic, bot upgrades and the snapshot/round-state rows clients render.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {FLOOR_LIMIT,floorDrop,floorTick} from './src/floor.js';
let wall=Infinity;const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[20,0,20]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,ray:()=>wall};
const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);
const at=(u,x,z,look=0)=>Object.assign(u,{x,y:0,z,look,input:{},inputAt:s.time});
// Buy phase: a bought gun dropped with G is no longer refundable, and a teammate can pick it up.
a.credits=b.credits=5000;assert.ok(s.command(a,{t:'buy',n:'Vandal'}));at(a,0,0,0);at(b,0,-1.5,0);
assert.equal(s.command(a,{t:'dropw'}),true,'G drops the held Vandal');assert.equal(a.primary,null);assert.equal(a.weapon,'Classic','falls back to the sidearm');
assert.equal(s.floor.length,1);const v=s.floor[0];assert.equal(v.w,'Vandal');assert.ok(Math.abs(v.z+1.2)<1e-9,'dropped 1.2 m ahead (look 0 faces -z)');assert.equal(v.ammo,25);
assert.equal(s.command(a,{t:'sell',n:'Vandal'}),false,'a dropped gun is not refundable');
assert.equal(s.command(b,{t:'pick',id:v.id}),true,'teammate picks it up in the buy phase');assert.equal(b.primary,'Vandal');assert.equal(b.weapon,'Vandal');assert.equal(s.floor.length,0);
assert.equal(s.command(b,{t:'dropw'}),true);assert.equal(b.weapon,'Classic');assert.equal(s.command(b,{t:'dropw'}),false,'sidearms stay in hand');b.equipAt=0;assert.ok(s.command(b,{t:'equip',w:'Knife'}));assert.equal(s.command(b,{t:'dropw'}),false,'the knife cannot be dropped');
// Swap: picking a sidearm drops the current sidearm (with its ammo) where the new one lay.
s.buy=0;const g=floorDrop(s,'Sheriff',3,0,0,4,12,null);at(a,2,0,Math.PI/2);a.ammo=7;a.weapon='Classic';
assert.equal(s.command(a,{t:'pick',id:g.id}),true);assert.equal(a.secondary,'Sheriff');assert.equal(a.weapon,'Sheriff');assert.equal(a.ammo,4);assert.equal(a.reserve,12);
const cl=s.floor.find(d=>d.w==='Classic');assert.ok(cl&&cl.x===3&&cl.z===0&&cl.ammo===7,'old Classic lands where the Sheriff lay, keeping its 7 rounds');
assert.ok(a.fireAt>s.time,'equip time applies after a pick-up');
// Reach, height, line of sight, dead or unknown picks are rejected.
const far=floorDrop(s,'Phantom',10,0,0);assert.equal(s.command(a,{t:'pick',id:far.id}),false,'out of reach');
const high=floorDrop(s,'Odin',2.5,3,0);high.y=3;assert.equal(s.command(a,{t:'pick',id:high.id}),false,'on a ledge above');
const wallGun=floorDrop(s,'Ares',2,0,1.5);wall=.5;assert.equal(s.command(a,{t:'pick',id:wallGun.id}),false,'behind a wall');wall=Infinity;
assert.equal(s.command(a,{t:'pick',id:99999}),false,'unknown id');
// Walk-over into an empty primary slot; the dropper is not instantly re-handed the gun it threw.
s.floor=[];at(a,0,0,0);a.primary=null;at(b,5,5);const ph=floorDrop(s,'Phantom',0,0,-.5,30,90,a.id);s.step(.05);assert.equal(a.primary,null,'dropper grace');
at(b,0,-.4);b.primary=null;s.step(.05);assert.equal(b.primary,'Phantom','walk-over pick-up with an empty slot');assert.equal(s.floor.includes(ph),false);
// Death drops the best gun with its live ammo; the snapshot and private round state carry what clients render.
at(a,20,20);s.floor=[];b.ammo=11;b.weapon='Phantom';b.hp=0;b.alive=false;s.step(.05);const dd=s.floor.find(d=>d.w==='Phantom');assert.ok(dd&&dd.ammo===11,'death drops the primary with its magazine');assert.equal(b.primary,null);
s.step(.05);assert.equal(s.floor.filter(d=>d.w==='Phantom').length,1,'dropped once');
const snap=s.snapshot();assert.deepEqual(snap.fw.find(r=>r[0]===dd.id).slice(1,2),['Phantom']);assert.deepEqual(s.roundState(a).ld,[a.primary,a.secondary]);
// Floor cap, then round reset: floor clears and a survivor without a sidearm gets the Classic back.
for(let i=0;i<40;i++)floorDrop(s,'Spectre',30,0,30);assert.equal(s.floor.length,FLOOR_LIMIT);
a.secondary=null;a.primary=null;s.newRound();assert.equal(s.floor.length,0);assert.equal(a.secondary,'Classic');assert.equal(a.weapon,'Classic');
// Bots trade up to a better primary they walk past and drop the old one.
const t=new SpikeSimulation(W,'five','ascent',()=>.5),h=t.add('h');t.start(true);t.buy=0;const bot=t.units.find(u=>!u.human&&u.team===h.team)||t.units.find(u=>!u.human);
Object.assign(bot,{primary:'Spectre',weapon:'Spectre',x:40,y:0,z:40,inventory:{Spectre:30},reserves:{Spectre:90}});floorDrop(t,'Operator',40.5,0,40);floorTick(t);
assert.equal(bot.primary,'Operator','bot trades up');assert.ok(t.floor.some(d=>d.w==='Spectre'),'and leaves its Spectre');
console.log('Floor weapons: G drop of primaries (no refund; sidearm and knife kept), F swap with old gun left in place, reach/height/LOS checks, walk-over pick-up with dropper grace, death drop once with live ammo, snapshot/round-state rows, cap, round reset with Classic, bot trade-up');
