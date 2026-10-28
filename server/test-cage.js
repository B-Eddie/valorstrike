// Cypher Cyber Cage (wiki.playvalorant.com/en-us/Cyber_Cage): "INSTANTLY toss the cyber cage in front of Cypher. ACTIVATE to create a zone
// that blocks vision"; "tossing forward a cyber cage as a projectile. Once it lands on horizontal terrain, it turns invisible and remains
// indefinitely"; activated it forms the 3.72 m hollow cylinder for 7.25 s. Activation (Valorant): Q while looking at a placed cage activates
// it; with no charge left Q activates the cage nearest the crosshair. Was: Q placed an already-active cage 15 m ahead.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,smokeBlocks,CAGE} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,
 ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;return t<=max?t:Infinity;}};
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('cy','Cypher'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;u.human=human;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const cages=(s,u)=>s.effects.filter(e=>e.kind==='cage'&&e.owner===u.id),smokes=s=>s.effects.filter(e=>e.kind==='smoke'&&e.cyl);
assert.ok(CAGE.speed>0&&CAGE.g>0);
// 1. Q tosses a cage (charge spent, no smoke yet); it flies and lands on the floor ahead, then waits inactive
{const {s,u}=setup();u.ability.q=2;assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.equal(u.ability.q,1);assert.equal(smokes(s).length,0,'not active');
 const c=cages(s,u)[0];assert.ok(c&&!c.landed,'in flight');tick(s,3);assert.ok(c.landed,'landed');assert.ok(Math.abs(c.p[1])<.05,'on the floor');const d=-c.p[2];assert.ok(d>2&&d<15,'a toss in front: '+d.toFixed(2)+' m');assert.ok(Math.abs(c.p[0])<1e-6);
 tick(s,30);assert.equal(smokes(s).length,0,'stays inactive indefinitely');assert.ok(cages(s,u).length===1);
 // 2. looking at it, Q activates it (no charge spent): the 3.72 m cylinder for 7.25 s; the cage is used
 const e=[0,1.6,0];u.pitch=Math.atan2(c.p[1]-e[1],d);assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.equal(u.ability.q,1,'activation spends nothing');const z=smokes(s)[0];assert.ok(z,'active');
 assert.equal(z.radius,3.72);assert.ok(Math.abs(z.until-s.time-7.25)<1e-6,'7.25 s');assert.deepEqual(z.p.map(n=>+n.toFixed(4)),c.p.map(n=>+n.toFixed(4)),'at the cage');assert.equal(cages(s,u).length,0,'used up');
 assert.equal(s.castEvents.filter(v=>v.ag==='Cypher'&&v.k==='q').length,1,'one cast event, at activation (the clients draw the cylinder then)');}
// 3. looking away with a charge left: Q tosses another (does not activate the first); with none left Q activates the nearest to the crosshair
{const {s,u}=setup();u.ability.q=2;s.command(u,{t:'ab',k:'q'});tick(s,3);u.look=Math.PI/2;s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.equal(u.ability.q,0);tick(s,3);assert.equal(cages(s,u).length,2);assert.equal(smokes(s).length,0);
 u.look=Math.PI/2-.3;s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'q'}),true,'no charge: activates the nearest to the crosshair');const z=smokes(s)[0];assert.ok(z&&z.p[0]<-2,'the one to the left (look PI/2)');assert.equal(cages(s,u).length,1);
 s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.equal(cages(s,u).length,0);s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'q'}),false,'nothing left');}
// 4. a bot's cage activates when it lands (bots have no crosshair flow); round reset clears them; Cypher dead: cannot activate
{const {s,u}=setup(false);u.ability.q=1;s.command(u,{t:'ab',k:'q'});tick(s,3);assert.equal(smokes(s).length,1,'bot cage: active on landing');}
{const {s,u}=setup();u.ability.q=1;s.command(u,{t:'ab',k:'q'});tick(s,3);u.alive=false;assert.equal(s.command(u,{t:'ab',k:'q'}),false);u.alive=true;s.newRound();assert.equal(cages(s,u).length,0,'gone next round');}
// 5. an active cage blocks sight through its wall
{const {s,u}=setup(false);u.ability.q=1;s.command(u,{t:'ab',k:'q'});tick(s,3);const z=smokes(s)[0];assert.ok(smokeBlocks(s,[z.p[0]+10,1.5,z.p[2]],[-1,0,0],20),'blocks sight across it');}
console.log('Cyber Cage: instant toss lands on the floor ahead and waits inactive; Q at it (or with no charge, the nearest to the crosshair) activates 3.72 m / 7.25 s; bot cages activate on landing; cleared each round');
