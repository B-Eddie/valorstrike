// Rope ascenders (Split): the shared motor's ROPES / ropeStep, the trusted server, and bots.
//  1. Every rope is clear for the climbing capsule from its lower to its upper floor, its step-off point is on the upper
//     floor and clear, and the step-off move (rope -> ledge at ty) never passes through collision.
//  2. A human unit driven through the server (SpikeSimulation, input messages only): Use grabs, W climbs (look-relative:
//     W looking down climbs down), climbing past the top steps off onto the upper floor, reaching the bottom lets go,
//     Jump pushes off, Use again lets go, a respawn / move leaves the rope; no fall damage, no rescue, guard leaves it alone.
//  3. Offline = online: the same input sequence through the motor directly (what the page's moveP does offline) and through
//     the server Simulation give the same positions every tick.
//  4. Spread on a rope: still >= 65 % of the walking spread (patch 6.11), climbing = ground walk / run spread; shotguns 12.09.
//  5. Bots: A* routes over the rope nav links (lower <-> upper floor) and a unit driven by ropeBot climbs every linked rope up
//     and down to the far floor.
//  6. Snapshot rows carry [25] = rope index ([24] = Blade Storm knives) while climbing; fog hides it.
//  7. Buy phase: the bots' buy walk graph (bots.js buyAdj) has no rope links and no buy area reaches the Vent room floor.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';import {weapons} from './src/simulation.js';import {path} from './src/path.js';import {ropeBot} from './src/ropes.js';import {fogRow} from './src/fog.js';
import Motor from './src/motor.cjs';
const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
const W=await loadWorld(assets,'split'),R=W.ropes;
assert.equal(R.length,7,'seven Split ascenders (wiki: 2 Sewer-A Lobby, 1 B Hell-B Tower, 4 Vents)');
for(const key of ['ascent','bind','breeze','haven','lotus'])assert.equal(Motor.ROPES[key],undefined,key+' has no ropes in VALORANT');
// 1. geometry
for(const r of R){for(let y=r.y0;y<=r.y1+.001;y+=.05)assert(!W.blocked(r.x,r.z,.4,y,1.8),r.name+' capsule clear at y '+y.toFixed(2));
 assert(Math.abs(W.ground(r.x,r.z,r.y0+.3)-r.y0)<.1,r.name+' lower floor under the rope');
 assert(Math.abs(W.ground(r.ex,r.ez,r.y1+.3)-r.y1)<.05,r.name+' step-off point on the upper floor');
 for(let k=0;k<=20;k++){const x=r.x+(r.ex-r.x)*k/20,z=r.z+(r.ez-r.z)*k/20;assert(!W.blocked(x,z,.4,r.ty,1.8),r.name+' step-off move clear at '+k/20);}
 assert(r.ty>=r.y1&&r.ty-r.y1<.35,r.name+' ty just above the ledge');}
console.log('ropes: 7 Split ropes clear (capsule, floors, step-off)');
// 2. server, human unit
let seq=1;const fresh=()=>{const s=new SpikeSimulation(W,'five','split',()=>.5);const a=s.add('atk');s.add('def');s.start(false);s.buy=0;s.rescues=0;{const g=s.guard.bind(s);s.guard=u=>{const r=g(u);if(r)s.rescues++;return r;};}return {s,a};};
const yawTo=(u,x,z)=>Math.atan2(-(x-u.x),-(z-u.z));
const put=(s,u,x,y,z)=>{u.x=x;u.y=y;u.z=z;u.vx=u.vy=u.vz=0;u.air=false;u.seq++;};
const run=(s,u,m,secs)=>{let t=0;const tr=[];while(t<secs-1e-9){s.command(u,{t:'in',seq:seq++,r:u.look,p:0,f:0,s:0,...m});s.step(.05);t+=.05;tr.push([u.x,u.y,u.z,u.rope|0]);}return tr;};
{const r=R[1],{s,a}=fresh();put(s,a,r.x-.6,r.y0,r.z);s.step(.05);
 run(s,a,{r:yawTo(a,r.x,r.z)},.2);assert(!a.rope,'no grab without Use');
 run(s,a,{u:1},.05);assert.equal(a.rope,2,'Use near the rope grabs it');assert.equal(a.x,r.x);assert.equal(a.z,r.z);
 const hp=a.hp;let tr=run(s,a,{u:1,f:1,p:0},.4);assert(a.rope===2&&a.y>r.y0+1.6,'W climbs (held Use does not let go): y '+a.y);
 const rate=(tr[7][1]-tr[3][1])/.2;assert(Math.abs(rate-Motor.ROPE.speed)<.05,'climb speed = Operator run '+rate.toFixed(3));
 tr=run(s,a,{f:1,p:-.6},.3);assert(a.rope&&tr[5][1]<tr[1][1],'W looking down climbs down');
 tr=run(s,a,{f:-1,p:-.6},.2);assert(a.rope&&tr[3][1]>tr[0][1],'S looking down climbs up');
 for(let n=0;n<60&&a.rope;n++)run(s,a,{f:1,p:.2},.05);assert(!a.rope,'past the top: off the rope');run(s,a,{f:0},.3);assert(Math.abs(a.x-r.ex)<.6&&Math.abs(a.z-r.ez)<.6&&Math.abs(a.y-r.y1)<.05,'stepped onto the A Lobby floor '+[a.x,a.y,a.z].map(v=>v.toFixed(2)));
 assert.equal(a.hp,hp,'no fall damage');assert.equal(s.rescues,0,'never rescued');
 // from the ledge back down
 run(s,a,{f:0},.5);run(s,a,{u:1},.05);assert.equal(a.rope,2,'Use from the ledge grabs the rope');
 run(s,a,{f:1,p:-.8},2);assert(!a.rope&&Math.abs(a.y-r.y0)<.06,'climbed down and let go on the Sewer floor y '+a.y.toFixed(2));assert.equal(a.hp,hp,'no fall damage down');
 // jump off
 run(s,a,{u:1},.05);run(s,a,{f:1,p:0},.3);const y0=a.y;run(s,a,{j:1},.05);assert(!a.rope,'Jump lets go');assert(a.vy>0||a.y>y0,'Jump pushes up');
 run(s,a,{},1.5);assert(Math.hypot(a.x-r.x,a.z-r.z)>.5,'pushed away from the rope');
 // Use lets go; cooldown
 put(s,a,r.x-.5,r.y0,r.z);s.step(.05);run(s,a,{u:1},.05);run(s,a,{f:1},.3);run(s,a,{u:0},.05);run(s,a,{u:1},.05);assert(!a.rope,'Use again lets go');
 // moved from outside (respawn / rescue): off the rope
 put(s,a,r.x-.5,r.y0,r.z);s.step(.05);run(s,a,{u:0},.4);run(s,a,{u:1},.05);assert(a.rope);s.spawn(a);run(s,a,{},.1);assert(!a.rope,'respawn leaves the rope');
 console.log('ropes: server grab / climb / look-relative / step-off / down / jump-off / let go / respawn OK');}
// 3. offline (motor directly) = online (server)
for(const k of [1,4,6,0]){const r=R[k],{s,a}=fresh();put(s,a,r.x-.5*(r.ex-r.x)/Math.hypot(r.ex-r.x,r.ez-r.z),r.y0,r.z);s.step(.05);
 const P={x:a.x,y:a.y,z:a.z,vx:0,vy:0,vz:0,air:false,ch:0};const plan=[[{u:1},.05],[{u:1,f:1,p:0},.5],[{f:1,p:-.6},.25],[{f:1,p:.1,w:1},.3],[{f:1,p:.1},2],[{f:1},.3]];
 // drive the server with the same look as the offline unit; compare every tick
 let worst=0;for(const [m,secs] of plan){for(let t=0;t<secs-1e-9;t+=.05){const look=a.look;s.command(a,{t:'in',seq:seq++,r:look,p:m.p||0,f:m.f||0,s:0,u:m.u||0,w:m.w||0});s.step(.05);
  const c=Math.cos(look),sn=Math.sin(look),f=m.f||0;Motor.step(P,{x:-sn*f,z:-c*f,speed:6.75*weapons[a.weapon].runSpeedMultiplier,use:!!m.u,walk:!!m.w,f,pitch:m.p||0},.05,W);worst=Math.max(worst,Math.hypot(P.x-a.x,P.y-a.y,P.z-a.z));}}
 assert(worst<1e-9,r.name+': offline motor = server, worst '+worst);assert(!a.rope&&Math.abs(a.y-r.y1)<.06,r.name+' climbed to the top floor online');}
console.log('ropes: offline = online identical on 4 ropes');
// 4. spread
{const st={rope:1,mv:false,sf:0,air:false},walkK=Motor.SPREAD.Vandal[5];const still=Motor.spread(st,'Vandal'),ground=Motor.spread({mv:false,sf:0},'Vandal');
 const rad=d=>Math.tan(d*Math.PI/180);assert(Math.abs(still-rad(Motor.SPREAD.Vandal[0]+.65*walkK))<1e-12&&ground===rad(Motor.SPREAD.Vandal[0]),'rope still spread = first + 65 % walking');
 assert(Motor.spread({rope:1,mv:true,sf:1},'Vandal')>=Motor.spread({mv:true,sf:1},'Vandal')-1e-12,'climbing = ground run spread');
 assert(Math.abs(Motor.spread({rope:1,mv:false,sf:0},'Judge')-rad(Motor.SPREAD.Judge[0]+.75))<1e-12,'shotgun rope still .75 (12.09)');}
// 5. bots
{const links=[...W.ropeLinks.values()];assert(links.length>=12,'rope nav links for 6+ ropes: '+links.length);let climbed=0;
 for(const L of links){const r=R[L.k],N=W.nav.nodes,{s}=fresh();const u={id:99,x:0,y:0,z:0,vx:0,vy:0,vz:0,look:0,pitch:0,alive:true,input:{},ch:0};
  // start 3 m out on the link's floor, on a node a route reaches the link from
  const a=N[L.a];let st=-1,bd=Infinity;for(let i=0;i<N.length;i++){if(!W.allowed.has(i)||Math.abs(N[i][1]-a[1])>.3)continue;const d=Math.hypot(N[i][0]-a[0],N[i][2]-a[2]);if(d>2.5&&d<4&&d<bd&&path(W,i,L.a).length){bd=d;st=i;}}
  assert(st>=0,'start node for '+r.name);Object.assign(u,{x:N[st][0],y:N[st][1],z:N[st][2]});u.route=path(W,st,L.a).concat(L.b);
  const i0=u.route.indexOf(L.a);assert(i0>=0&&u.route[i0+1]===L.b,'route uses the rope link '+r.name);
  let t=0,used=false;s.time=0;while(t<12){const n=N[u.route[0]];if(u.route.length>1&&Math.hypot(n[0]-u.x,n[2]-u.z)<.7&&Math.abs(n[1]-u.y)<1.2)u.route.shift();
   const m=N[u.route[0]];u.input={forward:1};u.look=Math.atan2(u.x-m[0],u.z-m[2]);u.inputAt=s.time;ropeBot(s,u);const i=u.input,c=Math.cos(u.look),sn=Math.sin(u.look),f=i.forward||0;
   Motor.step(u,{x:-sn*f,z:-c*f,speed:5.4,use:i.use,walk:i.walk,climb:i.climb,f,pitch:0},.05,W);s.time+=.05;t+=.05;if(u.rope)used=true;
   const b=N[L.b];if(!u.rope&&used&&Math.abs(u.y-b[1])<.3&&Math.hypot(u.x-b[0],u.z-b[2])<2.5)break;}
  assert(used,'bot grabbed '+r.name+(L.up?' (up)':' (down)'));const b=N[L.b];assert(Math.abs(u.y-b[1])<.3,'bot reached the '+(L.up?'upper':'lower')+' floor of '+r.name+' y '+u.y.toFixed(2));climbed++;}
 // A* itself takes the ropes: out of the Vent room (only left by rope) and from the Sewer up to A Lobby
 {const N=W.nav.nodes,from=W.near(13.5,-12,6.5),to=W.near(10,-10,10.5),p=path(W,from,to);assert(p.length&&p.some((a,i)=>W.ropeLinks.has(a+'>'+p[i+1])),'Vent room -> Mid Vent routes over a rope');
  assert(W.allowed.has(from),'Vent room floor is playable (reached by rope)');const q=path(W,W.near(39,14,3.05),W.near(44,13.5,7));assert(q.some((a,i)=>W.ropeLinks.has(a+'>'+q[i+1])),'Sewer -> A Lobby routes over a rope');}
 console.log('ropes: bots climbed '+climbed+' rope links ('+links.length/2+' ropes, up and down)');}
// 6. rows
{const r=R[3],{s,a}=fresh();put(s,a,r.x,r.y0,r.z);s.step(.05);run(s,a,{u:1},.05);run(s,a,{f:1},.2);const row=s.rows().find(x=>x[0]===a.id);assert.equal(row.length,26);assert.equal(row[25],4,'row [25] rope index');assert.equal(row[24],0,'[24] Blade Storm knives untouched');assert.equal(fogRow(row)[25],0,'fog hides the rope');
 run(s,a,{f:1},2);assert.equal(s.rows().find(x=>x[0]===a.id)[25],0,'off the rope: 0');}
// 7. buy phase: bots.js buyMill only walks (no Use / climb), so the buy walk graph (buyAdj) drops the rope links: Split
// defenders headed for Mid Vent used to drop into the Vent room and stand below the ledge all buy phase (test-bot-buy-phase)
{let seed=7;const s=new SpikeSimulation(W,'five','split',()=>(seed=(seed*16807)%2147483647)/2147483647);s.start(true);for(let k=0;k<40;k++)s.step(.05);
 const Ts=Object.values(s._buyT||{}),vent=W.near(13.5,-12,6.5);assert.equal(Ts.length,2,'both teams mill');
 for(const T of Ts){for(const [k,l] of W.ropeLinks)assert(!T.adj[l.a].includes(l.b),'buy walk graph drops rope link '+k);assert(!T.area.f[vent],'Vent room floor outside every buy area');}
 for(const l of W.ropeLinks.values())assert(W.nav.adj[l.a].includes(l.b),'the round graph keeps the rope links');
 for(let k=0;k<200&&s.buy>0;k++)s.step(.05);assert(s.units.every(u=>!u.rope),'nobody on a rope in the buy phase');
 for(const u of s.units)if(!u.human&&u.buyMill&&u.buyMill.spot)assert(u.buyMill.spot[1]>8||u.buyMill.spot[1]<7||Math.hypot(u.buyMill.spot[0]-13.5,u.buyMill.spot[2]+12)>4,'no buy spot in the Vent room');}
console.log('ropes: buy phase walk graph without rope links');
console.log('ropes: all checks passed');
