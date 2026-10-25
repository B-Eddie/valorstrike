import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,PROFILE_ORDER} from './src/bots.js';
// Open 15 x 15 grid (2 m), sight limited to 12 m so bots must route before they engage.
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const W={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[0,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>max>12?1:Infinity};
function run(botName,steps=240,sightSteps=0){const s=new Simulation(W,'tdm','ascent',()=>.5),t=s.add('Target','Jett',true),b=s.add(botName,'Sage',false);s.phase='game';s.remaining=570;
 Object.assign(t,{team:1,x:14,y:0,z:-28,hp:1e9,protectedUntil:1e9});Object.assign(b,{team:0,x:-14,y:0,z:0,look:0,vx:0,vz:0,protectedUntil:0});
 const track=[],acts=[];for(let i=0;i<steps;i++){s.step(.05);t.hp=1e9;t.x=14;t.z=-28;track.push([b.x,b.z]);acts.push([b.input.forward||0,b.input.side||0,b.input.duck?1:0,b.input.walk?1:0,b.input.fire?1:0,(+b.look).toFixed(1)].join(''));/* heading too: two bots can both hold forward the whole run and still steer differently */}
 return {track,acts,P:persona(s,b),b};}
const dev=(A,B)=>Math.max(...A.track.map((p,i)=>Math.hypot(p[0]-B.track[i][0],p[1]-B.track[i][1])));
// 1. Same name/id/map replays exactly (deterministic seeds, independent of the shared weapon RNG).
{const a=run('Bot Sage'),b=run('Bot Sage');assert.deepEqual(a.track,b.track);assert.deepEqual(a.acts,b.acts);}
// 2. Identical starting conditions, different bots: paths and actions diverge.
{const names=['Bot Sage','Bot Omen','Bot Raze','Bot Sova'],runs=names.map(n=>run(n));let maxDev=0,diffActs=0;
 for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){maxDev=Math.max(maxDev,dev(runs[i],runs[j]));if(runs[i].acts.join()!==runs[j].acts.join())diffActs++;}
 assert.ok(maxDev>1.5,'bot paths diverge by more than 1.5 m (got '+maxDev.toFixed(2)+')');assert.equal(diffActs,6,'every pair acts differently');
 const reacts=new Set(runs.map(r=>r.P.react.toFixed(3))),aims=new Set(runs.map(r=>r.P.aim.toFixed(4)));assert.equal(reacts.size,4);assert.equal(aims.size,4);
 for(const r of runs)assert.ok(Math.hypot(r.b.x+14,r.b.z)>4,'each bot still makes progress toward its target');}
// 3. Engagement: same target in sight, different bots strafe, crouch, react and miss differently.
{const seq=name=>{const s=new Simulation({...W,ray:()=>Infinity},'tdm','ascent',()=>.5),t=s.add('Target','Jett',true),b=s.add(name,'Sage',false);s.phase='game';Object.assign(t,{team:1,x:0,y:0,z:-10,hp:1e9,protectedUntil:1e9});Object.assign(b,{team:0,x:0,y:0,z:0});const out=[];for(let i=0;i<60;i++){s.time+=.05;s.bot(b);out.push([+b.look.toFixed(4),+b.pitch.toFixed(4),b.input.side||0,b.input.fire?1:0,b.input.duck?1:0]);}return out;};
 const a=seq('Bot Sage'),b=seq('Bot Omen');assert.notDeepEqual(a,b);assert.ok(a.some((r,i)=>r[2]!==b[i][2]),'strafe patterns differ');assert.ok(a.some((r,i)=>r[0]!==b[i][0]),'aim error differs');
 const first=new Set(['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach'].map(n=>seq(n).findIndex(r=>r[3])));assert.ok(first.size>1,'first-shot timing differs between bots');assert.ok(!first.has(0),'no bot fires before its reaction time');}
// 4. A filled match mixes all four roles on each team, deterministically.
{const s=new Simulation(W,'tdm','haven',()=>.5);s.add('Human','Jett',true);s.start(true);const bots=s.units.filter(u=>!u.human);for(const u of bots)persona(s,u);
 for(const team of [0,1]){const roles=new Set(bots.filter(u=>u.team===team).map(u=>u.persona.role));assert.ok(roles.size>=Math.min(4,bots.filter(u=>u.team===team).length),'team '+team+' mixes roles');}
 assert.deepEqual([...new Set(bots.map(u=>u.persona.role))].sort(),[...PROFILE_ORDER].sort());}
// 5. Spike bots keep exact goals for the spike but spread out inside the site.
{const S=new SpikeSimulation(W,'five','ascent',()=>.5),a=S.add('Bot A','Sage',false),b=S.add('Bot B','Omen',false);a.team=b.team=S.atk;persona(S,a);persona(S,b);S.goalPath(a,{x:0,y:0,z:-14});S.goalPath(b,{x:0,y:0,z:-14});assert.notDeepEqual(a.goalOff,b.goalOff);
 const c=S.add('Bot C','Raze',false);persona(S,c);S.goalPath(c,{x:0,y:0,z:-14},false);assert.equal(c.goalOff,undefined);}
console.log('Bots: deterministic per-bot seeds; identical starts diverge in path and actions; distinct reaction/aim/strafe/crouch; mixed roles per team; spike goals spread but exact for the spike');
