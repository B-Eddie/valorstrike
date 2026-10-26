// Human-like bot decisions (vendor/bot-brain.cjs, shared with the offline bots) and their server wiring: per-bot
// personality, per-fight reaction 180-320 ms with jitter, settling crosshair error, taps / bursts / sprays by range,
// varied round strategies (sites, plans, defence setups), a team economy, and reactions to sound and teammates dying.
// Deterministic: seeded test RNG -> botSeed 0, so every run replays the same decisions.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {SpikeSimulation} from './src/spike.js';import {persona,strategy,plan,botView} from './src/bots.js';import {loadWorld} from './src/world.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
// 1. Pure decisions
{const sites=['A','B','C'],last=[],types=new Set(),ss=new Set();for(let r=0;r<20;r++){const p=B.attackPlan(B.hash('t|'+r),sites,{last:last.slice(-4)});last.push(p);types.add(p.type);ss.add(p.site);
  assert.ok(sites.includes(p.site)&&p.executeAt>=0,'plan shape');if(p.type==='fake'||p.type==='lurk')assert.ok(p.rotateAt>p.executeAt&&p.other!==p.site,'fake / lurk rotate to the real site');}
 assert.ok(ss.size>=2&&types.size>=3,'20 seeded rounds: >= 2 sites and >= 3 plans ('+[...ss]+' / '+[...types]+')');
 let same=0;for(let k=1;k<last.length;k++)if(last[k].type===last[k-1].type&&last[k].site===last[k-1].site)same++;assert.ok(same<=3,'rarely the same plan on the same site twice in a row ('+same+')');
 const defs=new Set();for(let r=0;r<20;r++)defs.add(B.defensePlan(B.hash('d|'+r),sites,{}).type);assert.ok(defs.size>=3,'defence setups vary ('+[...defs]+')');
 const P=B.personality(B.hash('Bot Jett')),rr=B.rng(7),re=[];for(let k=0;k<200;k++)re.push(B.reaction(P,rr));
 const mean=re.reduce((s,v)=>s+v,0)/re.length,sd=Math.sqrt(re.reduce((s,v)=>s+(v-mean)**2,0)/re.length);
 assert.ok(Math.min(...re)>=.2&&Math.max(...re)<=.35,'pre-aimed reactions inside 200-350 ms');assert.ok(sd>.01,'reaction jitter per fight (sd '+(sd*1000).toFixed(0)+' ms)');
 const means=new Set();for(const n of ['Sage','Omen','Raze','Sova','Breach','Jett','Reyna','Phoenix'])means.add(B.personality(B.hash(n)).react.toFixed(3));assert.equal(means.size,8,'every bot its own reaction mean');
 const e=B.crosshair(P,B.rng(3),false),a0=Math.hypot(...B.crosshairAt(e,P,0)),a1=Math.hypot(...B.crosshairAt(e,P,.5)),a2=Math.hypot(...B.crosshairAt(e,P,3));
 assert.ok(a0>.008&&a1<a0*.5&&a2<a1&&a2>0,'crosshair error starts off and settles over time ('+[a0,a1,a2].map(v=>v.toFixed(4))+')');
 const pre=Math.hypot(...B.crosshairAt(B.crosshair(P,B.rng(3),true),P,0));assert.ok(pre<a0,'pre-aimed angles start closer');
 const fr=B.rng(5),far={tap:0,burst:0,spray:0},close={tap:0,burst:0,spray:0};for(let k=0;k<300;k++){far[B.firePattern(P,fr,35,true).kind]++;close[B.firePattern(P,fr,6,true).kind]++;}
 /* bots-tune-1: a mix per range band like Gold-Plat bullets (offangle.pro), not one fixed pattern per range */assert.ok(far.tap>close.tap*3&&far.burst>far.spray&&close.spray>close.burst+close.tap&&close.spray>200,'mostly taps / bursts far, mostly sprays close ('+JSON.stringify({far,close})+')');assert.equal(B.firePattern(P,fr,6,false).shots,1,'semi-auto: single shots');
 const calls=new Set(),guns=new Set();for(let r=0;r<40;r++){const c=B.teamBuy([800+r*120,900+r*110,700+r*130,1000+r*100,850+r*120],r%4,3+r,B.rng(r));calls.add(c);const b=B.buyFor(c,800+r*150,P,B.rng(r+99),r%2);if(b.weapon)guns.add(b.weapon);if(b.side)guns.add(b.side);}
 assert.ok(calls.size>=4&&guns.size>=5,'economy calls and guns vary ('+[...calls]+' / '+[...guns]+')');assert.equal(B.teamBuy([800,800,800,800,800],0,1,B.rng(1)),'pistol');
 const atkR=B.roles(B.attackPlan(B.hash('f'),sites,{}),5,1,true,sites,0);assert.equal(atkR.length,5);assert.ok(atkR.filter(r=>r.lurk).length<=1,'at most one lurker');
 out.push('brain: sites '+ss.size+', plans '+types.size+', defence '+defs.size+', reaction sd '+(sd*1000).toFixed(0)+' ms');}
// 2. Grid world: per-fight reaction jitter, taps far / spray close, hearing and trades
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
{const first=[],kinds={};for(let k=0;k<12;k++){const s=new Simulation(G,'tdm','ascent',()=>.5),t=s.add('Target','Jett',true),b=s.add('Bot Sage','Sage',false);s.phase='game';const far=k%2?30:6;
  Object.assign(t,{team:1,x:0,y:0,z:-far,hp:1e9});Object.assign(b,{team:0,x:0,y:0,z:0,look:0,weapon:'Spectre',ammo:30,inventory:{Spectre:30}});/* an automatic (TDM bots used to spawn on the Spectre; the Stage 1 guns are now sidearms) */b.persona=null;persona(s,b).r=B.rng(k+1);/* crosshair already on the angle (bots-human-1: an enemy behind costs more reaction plus the turn, pinned in test-bot-human.js) */let f=-1,on=0,flips=0,last=false;
  for(let i=0;i<120;i++){s.time+=.01;s.bot(b);const fire=!!b.input.fire;if(fire&&f<0)f=s.time;if(fire)on++;if(fire!==last)flips++;last=fire;}first.push(+f.toFixed(2));(kinds[far]||(kinds[far]=[])).push([on,flips]);}
 assert.ok(first.every(v=>v>=.2&&v<=.45),'first shot after a 200-350 ms reaction and the flick onto the aim point ('+first+')');assert.ok(new Set(first).size>=4,'reaction re-drawn per fight ('+first+')');
 const avg=L=>L.reduce((s,v)=>s+v[0]/v[1],0)/L.length;assert.ok(avg(kinds[30])<avg(kinds[6]),'trigger held longer per pull up close (spray) than far (taps)');
 out.push('reaction first shots '+[...new Set(first)].sort().join('/')+' s');}
{const s=new SpikeSimulation({...G,ray:(o,d,max)=>max>3?1:Infinity},'five','ascent',()=>.5),b=s.add('Bot Sage','Sage',false),m=s.add('Bot Omen','Omen',false),e=s.add('Enemy','Jett',true);
 s.phase='game';s.round=2;s.atk=1;s.buy=0;Object.assign(b,{team:0,x:0,y:0,z:-10,look:0,alive:true,hp:100});Object.assign(m,{team:0,x:3,y:0,z:-10,alive:true,hp:100});Object.assign(e,{team:1,x:0,y:0,z:4,alive:true,hp:100,shotAt:0});
 s.spike={st:'carry',carrier:e.id,x:0,y:0,z:0,t:45,pt:0,dt:0,site:'A'};s.remaining=80;s.time=5;e.shotAt=5;s.bot(b);if(b.react&&b.react.kind==='hold'){const l0=b.look;assert.ok(Math.abs(l0)<=persona(s,b).brain.turn*.05+1e-9,'turns onto the sound at its own rate, no instant 180');for(let k=0;k<12&&b.react.until>s.time+.06;k++){s.time+=.05;s.bot(b);}}
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
// 5. Turn-rate limit and tracking lag: a bot facing away swings at its own rate (no instant 180) and holds fire until it is
// on target; a strafing target is tracked from slightly behind (misses while the crosshair catches up)
{const s=new Simulation(G,'tdm','ascent',()=>.5),t=s.add('Target','Jett',true),b=s.add('Bot Raze','Raze',false);s.phase='game';
 Object.assign(t,{team:1,x:0,y:0,z:-12,hp:1e9});Object.assign(b,{team:0,x:0,y:0,z:0,look:Math.PI});const P=persona(s,b);let fireTurning=0,looks=[];
 for(let i=0;i<40;i++){/* 2 s: an enemy behind = slower reaction + the swing (bots-human-1); it is heard (a gunshot: bots-perception-2 - a silent enemy behind is never seen) and the view turns at the bot's own rate (botView, as Simulation.step) */s.time+=.05;if(i===0)t.shotAt=s.time;const l0=b.look;s.bot(b);botView(s,b,l0,.05);looks.push(Math.abs(Math.atan2(Math.sin(b.look-l0),Math.cos(b.look-l0))));if(b.input.fire&&b.turnLeft>=.2)fireTurning++;}
 assert.ok(looks[0]<=P.brain.turn*.05+1e-9&&P.brain.turn>=7&&P.brain.turn<=14,'a 180 takes several ticks ('+looks[0].toFixed(2)+' rad in the first 50 ms, '+P.brain.turn.toFixed(1)+' rad/s)');assert.equal(fireTurning,0,'no shots while still swinging');
 assert.ok(Math.abs(Math.atan2(Math.sin(b.look),Math.cos(b.look)))<.2,'on target after the swing');
 for(let i=0;i<20;i++){s.time+=.05;s.bot(b);}/* settle on the still target first */let sum=0,n=0;for(let i=0;i<60;i++){s.time+=.05;t.vx=6;t.vz=0;t.x+=6*.05;s.bot(b);if(i<10)continue;const exact=Math.atan2(-(t.x-b.x),-(t.z-b.z)),err=Math.atan2(Math.sin(b.look-exact),Math.cos(b.look-exact));sum+=err;n++;}
 const lagRad=sum/n;assert.ok(Math.abs(lagRad)>.004,'the crosshair trails a strafing target ('+lagRad.toFixed(4)+' rad)');
 out.push('turn '+P.brain.turn.toFixed(1)+' rad/s, tracking lag '+(Math.abs(lagRad)*1000).toFixed(1)+' mrad');}
// 4. Plan utility ("use utility before entry"): pure timing, then a real Ascent match where casts follow the plan
{const P=B.personality(B.hash('Bot Omen')),ex={type:'execute',utilFirst:true,executeAt:20,site:'A',other:'B'};
 assert.equal(B.utility(P,{atk:true,plan:ex,role:{},rt:10,siteDist:20}),null,'no entry utility while defaulting');
 assert.equal(B.utility(P,{atk:true,plan:ex,role:{},rt:18,siteDist:20}).phase,'entry','entry utility just before the execute');
 assert.equal(B.utility(P,{atk:true,plan:ex,role:{},rt:18,siteDist:40}),null,'not from across the map');
 assert.equal(B.utility(P,{atk:true,plan:ex,role:{lurk:true},rt:30,siteDist:10}),null,'lurkers stay quiet');
 assert.equal(B.utility(P,{atk:true,plan:{...ex,utilFirst:false},role:{},rt:30,siteDist:10}),null,'a dry execute throws nothing first');
 assert.equal(B.utility(P,{atk:true,plan:ex,role:{},rt:30,siteDist:10,used:2}),null,'two entry utilities at most');
 const fk={type:'fake',utilFirst:true,executeAt:10,rotateAt:22,site:'A',other:'B'};assert.equal(B.utility(P,{atk:true,plan:fk,role:{fakeGroup:true},rt:18,otherDist:12}).phase,'fake','fake group throws its utility at the fake site');
 assert.equal(B.utility(P,{atk:true,planted:true,threat:true,spikeDist:9}).phase,'post','post-plant utility when a defender comes for the Spike');
 assert.equal(B.utility(P,{atk:true,planted:true,threat:false,spikeDist:9}),null,'no post-plant utility into nothing');
 assert.equal(B.utility(P,{atk:false,plan:{type:'standard'},info:true,siteDist:12}).phase,'delay','defenders delay a push on their site');
 assert.equal(B.utility(P,{atk:false,plan:{type:'standard'},info:false,siteDist:12}),null,'defenders keep utility without information');
 assert.equal(B.utility(P,{atk:false,planted:true,spikeDist:15}).phase,'retake','defenders utility a retake');
 assert.deepEqual(B.utility(P,{atk:false,planted:true,spikeDist:15}).want.slice(0,2),['flash','recon']);
 const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
 const W=await loadWorld(assets,'ascent');let seed=7;const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);S.start(true);
 const plans=new Map();for(let t=0;t<420/.05;t++){S.step(.05);if(t>=260/.05&&t%20===0){const U=S.utilLog||[];if(U.length>=4&&new Set(U.map(e=>e.phase)).size>=2)break;}/* 260 s, or on to a later round when the spread defence (bots-spread-1) threw fewer delay casts by then */if(S.phase==='game'&&!plans.has(S.round)&&S.buy<=0){const A=strategy(S,S.atk);plans.set(S.round,{plan:A.plan,lurk:new Set(S.units.filter(u=>u.team===S.atk&&plan(S,u).lurk).map(u=>u.id))});}}
 const L=S.utilLog||[],ph=new Set(L.map(e=>e.phase));assert.ok(L.length>=4&&ph.size>=2,'Ascent: bots cast plan utility in several phases ('+L.map(e=>e.phase+':'+e.kind).join(',')+')');
 for(const e of L){const R=plans.get(e.round);if(!R)continue;if(e.phase==='entry'){assert.ok(R.plan.utilFirst&&e.t>=(R.plan.type==='rush'?0:R.plan.executeAt-3)-.01,'entry utility only on utility-first plans, at the execute');assert.ok(!R.lurk.has(e.id),'the lurker throws no entry utility');}}
 const mine=Object.keys(S.units[0].ability||{});assert.ok(mine.includes('c'),'ability charges as before');
 out.push('plan utility '+L.length+' casts ('+[...ph].join('/')+')');}
// 6. Spike play: plant spots vary (default / safe / open), post-plant crossfire (spread angles, close + far), defenders
// play the fuse (save when eta + defuse beats it, wait for a mate with time to spare, ninja / stick / tap / clear on the
// Spike), attackers stop a defuse they can reach or hide when the fuse beats any defuse
{const kinds=new Set();for(let k=0;k<60;k++){const q=B.plantSpot(B.rng(B.hash('p'+k)),null);kinds.add(q.kind);assert.ok(q.kind==='default'?q.r<=2:q.r>=2.5&&q.r<=5.5,'plant distance by kind');}
 assert.equal(kinds.size,3,'plant spots: default, safe and open all occur');
 for(let k=0;k<20;k++){const P=B.postPlant(5,B.rng(k+1)),a=P.map(q=>q.ang).sort((x,y)=>x-y),nf=P.filter(q=>q.far).length;for(let i=1;i<a.length;i++)assert.ok(a[i]-a[i-1]>.25,'crossfire angles spread');
  assert.ok(a[4]-a[0]>1.6,'crossfire covers > 90 degrees');assert.ok(nf>=1&&nf<=2,'one or two far (playing time)');for(const q of P)assert.ok(q.far?q.r>=11&&q.r<=17:q.r>=5&&q.r<=9,'post range');}
 const P=B.personality(B.hash('Bot Sage')),R=B.rng(9),C=(o)=>B.retake(P,R,{left:30,eta:2,half:false,mates:3,enemies:2,grouped:1,seen:false,at:false,tapped:false,...o});
 assert.equal(C({left:8,eta:2}).act,'save','no time: eta + 7 s defuse beats the fuse -> save');assert.equal(C({left:8,eta:2,half:true}).act,'go','half kept: 3.5 s is enough -> go');
 assert.equal(C({grouped:0,left:30}).act,'wait','alone with time to spare: wait for a mate');assert.equal(C({grouped:0,left:13}).act,'go','alone, the fuse forces the retake');
 assert.equal(C({mates:1,enemies:4,left:12,eta:3}).act==='save'||P.patience<=.35,true,'1v4 with little time: save');
 assert.deepEqual(C({at:true,eta:0}),{act:'defuse',style:'ninja'},'on the Spike, nobody seen: ninja defuse');assert.deepEqual(C({at:true,eta:0,seen:true,half:true}),{act:'defuse',style:'stick'},'half done: stick');
 assert.deepEqual(C({at:true,eta:0,seen:true,left:8}),{act:'defuse',style:'stick'},'no time to fight first: stick');
 const sty=new Set();for(let k=0;k<40;k++)sty.add(C({at:true,eta:0,seen:true,left:30}).act+'/'+C({at:true,eta:0,seen:true,left:30}).style);assert.ok(sty.has('defuse/tap')&&sty.has('clear/null'),'attackers around with time: tap the defuse or clear first ('+[...sty]+')');
 assert.equal(C({at:true,eta:0,seen:true,left:30,tapped:true}).style!=='tap',true,'one tap only');
 assert.equal(B.postPlay(P,{left:3,defusing:false,dt:0,eta:2}),'hide','the fuse beats any defuse: hide');assert.equal(B.postPlay(P,{left:20,defusing:true,dt:2,eta:3}),'stop','a defuse in reach: stop it');
 assert.equal(B.postPlay(P,{left:20,defusing:true,dt:5,eta:4}),'hold','too far to stop it: hold');assert.equal(B.postPlay(P,{left:20,defusing:false,dt:0,eta:3}),'hold','no defuse: hold the post');
 // real Ascent match: plant spots, post-plant slots and retake calls from the sim
 const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
 const W=await loadWorld(assets,'ascent');let seed=11;const S=new SpikeSimulation(W,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);S.qaBuy=2;S.start(true);const real=[];let st0='';
 for(let t=0;t<1500/.05&&real.length<5;t++){S.step(.05);if(S.spike.st==='plant'&&st0!=='plant')real.push({round:S.round,site:S.spike.site,x:S.spike.x,z:S.spike.z});st0=S.spike.st;}
 const PL=S.plantLog||[],pk=new Set(PL.map(e=>e.kind)),ps=new Set(PL.map(e=>e.p.map(Math.round).join(',')));assert.ok(PL.length>=4&&pk.size>=2&&ps.size>=3,'Ascent: plant spots vary ('+PL.map(e=>e.site+':'+e.kind).join(',')+')');
 let onSpot=0;for(const r of real){const e=PL.find(q=>q.round===r.round);if(e&&Math.hypot(e.p[0]-r.x,e.p[2]-r.z)<2.5)onSpot++;}assert.ok(real.length>=3&&onSpot>=2,'carriers plant on their chosen spot ('+onSpot+'/'+real.length+')');
 for(const e of PL)assert.equal(S.siteAt({x:e.p[0],y:e.p[1],z:e.p[2]}),e.site,'every plant spot is inside its plant zone');
 const PO=S.postLog||[];if(PO.length){const byR=new Map();for(const e of PO){if(!byR.has(e.round))byR.set(e.round,[]);byR.get(e.round).push(e);}for(const L of byR.values()){const a=new Set(L.map(e=>e.ang.toFixed(2)));assert.equal(a.size,L.length,'each attacker its own crossfire slot');}}
 // a staged plant: B site, fuse / defuse states, one defender and one attacker
 const site=W.map.sites.B,unitOf=team=>S.units.find(u=>u.team===team&&!u.human),d=unitOf(1-S.atk),a=unitOf(S.atk);for(const u of S.units)if(u!==d&&u!==a)Object.assign(u,{alive:false});
 S.buy=0;S.roundDelay=0;S.phase='game';Object.assign(S.spike,{st:'plant',site:'B',x:site[0],y:site[1],z:site[2],t:30,dt:0,defuser:null});Object.assign(a,{alive:true,hp:100,x:site[0]+30,y:site[1],z:site[2]+30,shotAt:-9});
 const at=(t,dt,o)=>{Object.assign(d,{alive:true,hp:100,x:site[0]+.5,y:site[1],z:site[2],plan:null},o||{});Object.assign(S.spike,{t,dt});S.time+=1;S.bot(d);return d.input.interact===true;};
 assert.equal(at(30,0),true,'nobody seen: ninja defuse at once');assert.equal(at(4,0),false,'4 s on the fuse and no half: save, no defuse');assert.equal(at(4,3.5),true,'half kept: 3.5 s fits in 4 s, stick');
 Object.assign(a,{x:site[0]+6,z:site[2]+6});let taps=0,clears=0;const r0=S.round;for(let k=0;k<12;k++){S.round=r0+100+k;S.time+=1;a.shotAt=S.time+2;d.plan=null;at(30,0);const c=d.plan.ret;if(c.style==='tap')taps++;if(c.act==='clear')clears++;}S.round=r0;assert.ok(taps+clears===12&&taps>0&&clears>0,'attacker shooting near the Spike: tap or clear first ('+taps+' / '+clears+')');
 Object.assign(a,{x:site[0]+3,z:site[2]+3,plan:null});Object.assign(S.spike,{t:20,dt:2,defuser:d.id});S.bot(a);assert.equal(a.plan.postAct,'stop','a defuse in reach: the attacker goes to stop it');
 Object.assign(S.spike,{t:2.5,dt:0,defuser:null});a.plan.post0=null;S.bot(a);assert.equal(a.plan.postAct,'hide','the fuse beats any defuse: the attacker hides');
 out.push('spike play: plants '+PL.map(e=>e.kind).join('/')+', post slots '+PO.length+', tap '+taps+' clear '+clears);}
console.log('Bot brain: '+out.join('; '));
