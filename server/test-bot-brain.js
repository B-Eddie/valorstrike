// Human-like bot decisions (vendor/bot-brain.cjs, shared with the offline bots) and their server wiring: per-bot
// personality, per-fight reaction 180-320 ms with jitter, settling crosshair error, taps / bursts / sprays by range,
// varied round strategies (sites, plans, defence setups), a team economy, and reactions to sound and teammates dying.
// Deterministic: seeded test RNG -> botSeed 0, so every run replays the same decisions.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,strategy,plan} from './src/bots.js';import {loadWorld} from './src/world.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
// 1. Pure decisions
{const sites=['A','B','C'],last=[],types=new Set(),ss=new Set();for(let r=0;r<20;r++){const p=B.attackPlan(B.hash('t|'+r),sites,{last:last.slice(-4)});last.push(p);types.add(p.type);ss.add(p.site);
  assert.ok(sites.includes(p.site)&&p.executeAt>=0,'plan shape');if(p.type==='fake'||p.type==='lurk')assert.ok(p.rotateAt>p.executeAt&&p.other!==p.site,'fake / lurk rotate to the real site');}
 assert.ok(ss.size>=2&&types.size>=3,'20 seeded rounds: >= 2 sites and >= 3 plans ('+[...ss]+' / '+[...types]+')');
 let same=0;for(let k=1;k<last.length;k++)if(last[k].type===last[k-1].type&&last[k].site===last[k-1].site)same++;assert.ok(same<=3,'rarely the same plan on the same site twice in a row ('+same+')');
 const defs=new Set();for(let r=0;r<20;r++)defs.add(B.defensePlan(B.hash('d|'+r),sites,{}).type);assert.ok(defs.size>=3,'defence setups vary ('+[...defs]+')');
 const P=B.personality(B.hash('Bot Jett')),rr=B.rng(7),re=[];for(let k=0;k<200;k++)re.push(B.reaction(P,rr));
 const mean=re.reduce((s,v)=>s+v,0)/re.length,sd=Math.sqrt(re.reduce((s,v)=>s+(v-mean)**2,0)/re.length);
 assert.ok(Math.min(...re)>=.18&&Math.max(...re)<=.32,'reactions inside 180-320 ms');assert.ok(sd>.01,'reaction jitter per fight (sd '+(sd*1000).toFixed(0)+' ms)');
 const means=new Set();for(const n of ['Sage','Omen','Raze','Sova','Breach','Jett','Reyna','Phoenix'])means.add(B.personality(B.hash(n)).react.toFixed(3));assert.equal(means.size,8,'every bot its own reaction mean');
 const e=B.crosshair(P,B.rng(3),false),a0=Math.hypot(...B.crosshairAt(e,P,0)),a1=Math.hypot(...B.crosshairAt(e,P,.5)),a2=Math.hypot(...B.crosshairAt(e,P,3));
 assert.ok(a0>.008&&a1<a0*.5&&a2<a1&&a2>0,'crosshair error starts off and settles over time ('+[a0,a1,a2].map(v=>v.toFixed(4))+')');
 const pre=Math.hypot(...B.crosshairAt(B.crosshair(P,B.rng(3),true),P,0));assert.ok(pre<a0,'pre-aimed angles start closer');
 const fr=B.rng(5),far=new Set(),close=new Set();for(let k=0;k<30;k++){far.add(B.firePattern(P,fr,35,true).kind);close.add(B.firePattern(P,fr,6,true).kind);}
 assert.ok(!far.has('spray')&&close.has('spray')&&!close.has('tap'),'taps / bursts far, sprays close');assert.equal(B.firePattern(P,fr,6,false).shots,1,'semi-auto: single shots');
 const calls=new Set(),guns=new Set();for(let r=0;r<40;r++){const c=B.teamBuy([800+r*120,900+r*110,700+r*130,1000+r*100,850+r*120],r%4,3+r,B.rng(r));calls.add(c);const b=B.buyFor(c,800+r*150,P,B.rng(r+99),r%2);if(b.weapon)guns.add(b.weapon);if(b.side)guns.add(b.side);}
 assert.ok(calls.size>=4&&guns.size>=5,'economy calls and guns vary ('+[...calls]+' / '+[...guns]+')');assert.equal(B.teamBuy([800,800,800,800,800],0,1,B.rng(1)),'pistol');
 const atkR=B.roles(B.attackPlan(B.hash('f'),sites,{}),5,1,true,sites,0);assert.equal(atkR.length,5);assert.ok(atkR.filter(r=>r.lurk).length<=1,'at most one lurker');
 out.push('brain: sites '+ss.size+', plans '+types.size+', defence '+defs.size+', reaction sd '+(sd*1000).toFixed(0)+' ms');}
// 2. Grid world: per-fight reaction jitter, taps far / spray close, hearing and trades
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
{const first=[],kinds={};for(let k=0;k<12;k++){const s=new Simulation(G,'tdm','ascent',()=>.5),t=s.add('Target','Jett',true),b=s.add('Bot Sage','Sage',false);s.phase='game';const far=k%2?30:6;
  Object.assign(t,{team:1,x:0,y:0,z:-far,hp:1e9});Object.assign(b,{team:0,x:0,y:0,z:0,look:Math.PI});b.persona=null;persona(s,b).r=B.rng(k+1);let f=-1,on=0,flips=0,last=false;
  for(let i=0;i<120;i++){s.time+=.01;s.bot(b);const fire=!!b.input.fire;if(fire&&f<0)f=s.time;if(fire)on++;if(fire!==last)flips++;last=fire;}first.push(+f.toFixed(2));(kinds[far]||(kinds[far]=[])).push([on,flips]);}
 assert.ok(first.every(v=>v>=.18&&v<=.34),'first shot after a 180-320 ms reaction ('+first+')');assert.ok(new Set(first).size>=4,'reaction re-drawn per fight ('+first+')');
 const avg=L=>L.reduce((s,v)=>s+v[0]/v[1],0)/L.length;assert.ok(avg(kinds[30])<avg(kinds[6]),'trigger held longer per pull up close (spray) than far (taps)');
 out.push('reaction first shots '+[...new Set(first)].sort().join('/')+' s');}
{const s=new SpikeSimulation({...G,ray:(o,d,max)=>max>3?1:Infinity},'five','ascent',()=>.5),b=s.add('Bot Sage','Sage',false),m=s.add('Bot Omen','Omen',false),e=s.add('Enemy','Jett',true);
 s.phase='game';s.round=2;s.atk=1;s.buy=0;Object.assign(b,{team:0,x:0,y:0,z:-10,look:0,alive:true,hp:100});Object.assign(m,{team:0,x:3,y:0,z:-10,alive:true,hp:100});Object.assign(e,{team:1,x:0,y:0,z:4,alive:true,hp:100,shotAt:0});
 s.spike={st:'carry',carrier:e.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s.remaining=80;s.time=5;e.shotAt=5;s.bot(b);
 assert.ok(b.react&&['hold','push'].includes(b.react.kind),'a gunshot behind the bot gets a reaction');if(b.react.kind==='hold')assert.ok(Math.abs(Math.atan2(Math.sin(b.look-Math.atan2(b.x-e.x,b.z-e.z)),Math.cos(b.look-Math.atan2(b.x-e.x,b.z-e.z))))<.01,'holds the angle the shot came from');
 const react=new Set();for(let k=0;k<16;k++){const s2=new SpikeSimulation({...G,ray:()=>1},'five','ascent',()=>.5),a=s2.add('Bot '+k,'Sage',false),c=s2.add('Bot X'+k,'Omen',false),f=s2.add('Enemy','Jett',true);s2.phase='game';s2.round=2;s2.atk=1;s2.buy=0;
  Object.assign(a,{team:0,x:0,y:0,z:-10,alive:true,hp:100});Object.assign(c,{team:0,x:4,y:0,z:-10,alive:true,hp:100});Object.assign(f,{team:1,x:4,y:0,z:-24,alive:true,hp:100});s2.spike={st:'carry',carrier:f.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s2.remaining=80;
  s2.time=1;s2.botSense();c.alive=false;c.hp=0;s2.time=1.05;s2.botSense();react.add(a.react?a.react.kind:'hold');}
 assert.ok(react.has('trade')&&react.size>=2,'teammate deaths: trade / fall back / hold vary ('+[...react]+')');out.push('mate death reactions '+[...react]);}
// 3. Real map (Ascent): 20 rounds of round setup: sites, plans, defence setups, buys, staged goals
{const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
 const W={...(await loadWorld(assets,'ascent')),ray:()=>0};let seed=5;const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);S.start(true);
 const sites=new Set(),plans=new Set(),defs=new Set(),guns=new Set(),calls=new Set(),stageSpread=[];
 for(let r=0;r<20;r++){if(r)S.newRound();for(const u of S.units)u.credits=[800,1900,2600,4200,6000][(r+u.id)%5];S.teamCall=null;S._callK=null;S.buy=30;
  for(const u of S.units){u.purchases=[];u.primary=null;u.secondary='Classic';u.armor=0;S.autoBuy(u);if(u.primary)guns.add(u.primary);if(u.secondary!=='Classic')guns.add(u.secondary);}for(const c of Object.values(S.teamCall))calls.add(c);
  S.buy=0;const A=strategy(S,S.atk),D=strategy(S,1-S.atk);sites.add(S.spike.site);assert.equal(S.spike.site,A.plan.site,'the carrier heads for the strategy site');plans.add(A.plan.type);defs.add(D.plan.type);
  const atk=S.units.filter(u=>u.team===S.atk);for(const u of atk)plan(S,u);const ex=new Set(atk.map(u=>u.plan.stages.length?u.plan.stages[0].site+u.plan.stages[0].frac.toFixed(2):'site'));stageSpread.push(ex.size);
  const dsites=new Set(S.units.filter(u=>u.team!==S.atk).map(u=>plan(S,u).site));assert.equal(dsites.size,Object.keys(W.map.sites).length,'every site keeps a defender');}
 assert.ok(sites.size>=2&&plans.size>=3,'Ascent, 20 rounds: >= 2 sites, >= 3 attack plans ('+[...sites]+' / '+[...plans]+')');assert.ok(defs.size>=3,'defence setups vary ('+[...defs]+')');
 assert.ok(guns.size>=5&&calls.size>=3,'bot buys vary ('+[...guns]+' / '+[...calls]+')');assert.ok(stageSpread.filter(n=>n>=2).length>=10,'attackers do not all share one staged position ('+stageSpread+')');
 out.push('ascent 20 rounds: sites '+[...sites].join('')+', plans '+[...plans].join('/')+', defence '+[...defs].join('/')+', guns '+guns.size+', calls '+[...calls].join('/'));
 // determinism: the same seed replays the same strategies
 const replay=async()=>{let sd=5;const T=new SpikeSimulation(W,'five','ascent',()=>(sd=(sd*16807)%2147483647)/2147483647);T.start(true);const L=[];for(let r=0;r<6;r++){if(r)T.newRound();L.push(T.spike.site+strategy(T,T.atk).plan.type+strategy(T,1-T.atk).plan.type);}return L.join();};
 assert.equal(await replay(),await replay(),'seeded: identical strategies on replay');}
console.log('Bot brain: '+out.join('; '));
