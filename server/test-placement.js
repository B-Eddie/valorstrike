// Placed abilities land where the crosshair meets the floor, up to each one's wiki max cast distance (abilities.js PLACE_MAX /
// aimFloor = the page's xAimPlace). User 2026-10-27: "abilities not right"; Valorant (wiki Alarmbot / Turret / Trademark /
// Rendezvous / Barrier_Orb): "her crosshair will be replaced with an indicator to place ... on horizontal terrain", red on an
// unviable spot. Was: Alarmbot / Turret / Trademark down a generic 14 m ray, the Rendezvous anchor at Chamber's feet, the Barrier 2.5 m ahead.
import assert from 'node:assert/strict';import fs from 'node:fs';import {SpikeSimulation} from './src/spike.js';import {PLACE_MAX,aimFloor} from './src/abilities.js';import {loadWorld} from './src/world.js';
assert.deepEqual(PLACE_MAX,{Killjoy:{q:10,e:4.5},Sage:{c:15},Chamber:{c:12,e:8.5}},'wiki max cast distances');
// fixture: open floor y=0 (the ray meets it when aimed down), an optional wall plane z=-wall, an optional leash (playable footprint)
let wall=Infinity,leashMaxR=Infinity;
const ray=(o,d,max=Infinity)=>{let t=Infinity;if(d[1]<0)t=o[1]/-d[1];if(d[2]<0&&Number.isFinite(wall)){const tw=(o[2]+wall)/-d[2];if(tw>=0&&tw<t)t=tw;}return t<=max?t:Infinity;};
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray,leash:(x,z)=>Math.hypot(x,z)<=leashMaxR};
const KIND={Killjoy:{q:'alarmbot',e:'turret'},Sage:{c:'barrier'},Chamber:{c:'trademark'}};
const setup=agent=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent);s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});return {s,u};};
const placed=(s,u,k)=>u.agent==='Chamber'&&k==='e'?u.ability.anchor:s.effects.find(e=>e.kind===KIND[u.agent][k])?.p;
const near=(a,b,m)=>assert.ok(a&&b.every((v,i)=>Math.abs(a[i]-v)<1e-6),m+': '+JSON.stringify(a)+' vs '+JSON.stringify(b));
for(const [agent,keys] of Object.entries(PLACE_MAX))for(const [k,max] of Object.entries(keys)){
 const yOff=agent==='Chamber'&&k==='e'||agent==='Sage'?0:.1;
 // 1. level aim, nothing in the way: the full max distance
 wall=Infinity;leashMaxR=Infinity;{const {s,u}=setup(agent);u.ability[k]=1;assert.equal(s.command(u,{t:'ab',k}),true,agent+' '+k);near(placed(s,u,k),[0,yOff,-max],agent+' '+k+' level aim: max '+max+' m');}
 // 2. aimed down at the floor 3 m ahead: on the floor 0.5 m short of where the aim meets it
 {const {s,u}=setup(agent);u.pitch=-Math.atan2(1.6,3);u.ability[k]=1;assert.equal(s.command(u,{t:'ab',k}),true);const p=placed(s,u,k),L=Math.hypot(1.6,3)-.5;near(p,[0,yOff,-L*Math.cos(u.pitch)],agent+' '+k+' aimed at the floor');}
 // 3. a wall 3 m ahead: 0.5 m short of it, never through it
 wall=3;{const {s,u}=setup(agent);u.ability[k]=1;assert.equal(s.command(u,{t:'ab',k}),true);near(placed(s,u,k),[0,yOff,-2.5],agent+' '+k+' stops short of a wall');}
 // 4. off the playable footprint: refused, the charge stays in hand, nothing placed
 wall=Infinity;leashMaxR=2;{const {s,u}=setup(agent);u.ability[k]=1;const ult=u.ability.ult;assert.equal(s.command(u,{t:'ab',k}),false,agent+' '+k+' unviable spot refused');assert.equal(u.ability[k],1,'charge kept');assert.ok(!placed(s,u,k),'nothing placed');assert.equal(u.ability.ult,ult);}
 leashMaxR=Infinity;}
// Rendezvous: the second E (teleport back) ignores the crosshair - only the first cast places.
{const {s,u}=setup('Chamber');u.ability.e=1;assert.equal(s.command(u,{t:'ab',k:'e'}),true);u.look=Math.PI;s.time+=.5;assert.equal(s.command(u,{t:'ab',k:'e'}),true,'recast teleports even though the crosshair spot behind is fine');near(u.pendingTeleport.p,[0,0,-8.5],'to the anchor');}
// a world without a leash (open-floor fixtures) is all floor
{const {s,u}=setup('Killjoy');delete s.world.leash;assert.ok(aimFloor(s,u,10),'no leash: ground + collision decide');}
console.log('Placement: Alarmbot 10 / Turret 4.5 / Barrier 15 / Trademark 12 / Rendezvous 8.5 m at the crosshair floor point, short of walls, refused off the playable footprint (charge kept)');
// real Ascent: from every attacker-spawn heading, a level Alarmbot cast lands on the leash, inside 10 m, not in a wall
{const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};const w=await loadWorld(assets,'ascent');
 const s=new SpikeSimulation(w,'five','ascent',()=>.5),u=s.add('kj','Killjoy');s.start(false);s.buy=0;s.roundDelay=0;let ok=0,refused=0;
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;Object.assign(u,{look:a,pitch:-.15});const p=aimFloor(s,u,10);if(!p){refused++;continue;}ok++;
  assert.ok(Math.hypot(p[0]-u.x,p[2]-u.z)<=10+1e-6,'within 10 m');assert.ok(w.leash(p[0],p[2],p[1]),'on the playable footprint');assert.equal(w.blocked(p[0],p[2],.3,p[1],1.8),false,'not inside a wall');assert.ok(Math.abs(p[1]-u.y)<4,'on a floor near Killjoy');}
 assert.ok(ok>=8,'most headings from the spawn are placeable ('+ok+' ok, '+refused+' refused)');
 console.log('Ascent attacker spawn: '+ok+'/16 headings placeable, all on the leash, inside 10 m, clear of walls');}
