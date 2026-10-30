// Server bot aim KPIs (bot-gun, user 2026-10-29: "their aim is like purposely bad ... their aim isn't improving as they
// have more time"). Real Simulation.step bot fights (vendor/bot-brain.cjs aim plan, motor spread / recoil, hitboxes): 20
// duels per range, two bots (Vandal, kept alive, endless magazines) starting 0.3-0.4 rad off each other, 5 s each.
//  - first shot never before the reaction floor (BotBrain.REACT[0]);
//  - an average player's time to the first hit (median): 10 m <= 0.8 s, 15 m 0.55-0.85 s, 20 m <= 1.0 s, never < 0.4 s;
//  - aim improves with time in the fight: hit % 1.5 s+ in >= hit % in 0.5-1 s + 8 points, and the crosshair sits on the
//    body (BotBrain.hitPart of the view ray) at least 20 points more often 1.5 s+ in than 0.5-1 s in (was: hit % fell
//    from ~41 % to ~25 % as sprays chained into one climbing spray and the settled error stayed at 70 %);
//  - headshots modest: 12-38 % of hits.
// The round-start weapon draw (u.fireAt ~1 s at spawn) is not part of a duel: cleared in the first 1.5 s.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {persona} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs');
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach','Bot Phoenix','Bot Cypher','Bot Skye','Bot Killjoy','Bot Jett'];
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
function duels(dist,N=20,secs=5){const shots=[],XH=[],first=[];
 for(let k=0;k<N;k++){const s=new Simulation(G,'tdm','ascent',B.rng(1000+k));s.add('Hold','Jett',true);const a=s.add(NAMES[k%10],'Sage',false),b=s.add(NAMES[(k+3)%10],'Jett',false);s.phase='game';s.remaining=1e9;s.matchLen=1e9+300;s.maxKills=1e9;
  const h=s.units.find(u=>u.human);Object.assign(h,{x:100,z:100,team:0});
  Object.assign(a,{team:0,x:0,y:0,z:0,look:.4,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});Object.assign(b,{team:1,x:0,y:0,z:-dist,look:Math.PI-.3,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});
  for(const u of [a,b]){u.persona=null;persona(s,u).r=B.rng(k*7+3+(u===b?1:0));u.pitch=B.idlePitch(persona(s,u).brain);}
  const last={};for(let i=0;i<secs/.05;i++){for(const u of [a,b]){u.hp=1e9;u.ammo=1e9;if(s.time<1.5&&(u.fireAt||0)-s.time>.3)u.fireAt=s.time;}h.hp=1e9;h.x=100;h.z=100;s.step(.05);
   for(const u of [a,b]){const o=u===a?b:a;if(!u.engagedAt)continue;const cp=Math.cos(u.pitch),v=[-Math.sin(u.look)*cp,Math.sin(u.pitch),-Math.cos(u.look)*cp],ey=u.y+1.6-(u.ch||0),dx=o.x-u.x,dz=o.z-u.z,hl=Math.hypot(v[0],v[2]),q=(dx*v[0]+dz*v[2])/hl/hl,lat=Math.hypot(u.x+v[0]*q-o.x,u.z+v[2]*q-o.z);XH.push({t:s.time-u.engagedAt,on:q>0&&B.hitPart(lat,ey+v[1]*q-o.y,o.ch||0)!=null});}
   for(const e of s.events){if(e[0]==='s'&&(e[1]===a.id||e[1]===b.id)){const u=e[1]===a.id?a:b,r={k,u:u.id,t:u.engagedAt?s.time-u.engagedAt:-1,hit:null};shots.push(r);last[u.id]=r;}if(e[0]==='h'&&last[e[1]])last[e[1]].hit=e[3]?'head':'body';}s.events.length=0;}
  for(const u of [a,b]){const q=shots.filter(x=>x.k===k&&x.u===u.id);if(q.length)first.push({shot:q[0].t,hit:(q.find(x=>x.hit)||{t:secs}).t});}}
 const md=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1];},rate=(lo,hi)=>{const q=shots.filter(x=>x.t>=lo&&x.t<hi);return q.filter(x=>x.hit).length/Math.max(1,q.length);},on=(lo,hi)=>{const q=XH.filter(x=>x.t>=lo&&x.t<hi);return q.filter(x=>x.on).length/Math.max(1,q.length);};
 const hits=shots.filter(x=>x.hit);return {dist,shots:shots.length,minShot:Math.min(...first.map(f=>f.shot)),firstHit:md(first.map(f=>f.hit)),minHit:Math.min(...first.map(f=>f.hit)),early:rate(.5,1),late:rate(1.5,99),onEarly:on(.5,1),onLate:on(1.5,99),hs:hits.filter(x=>x.hit==='head').length/Math.max(1,hits.length)};}
const R=[10,15,20].map(d=>duels(d)),cap={10:[.4,.8+1e-9],15:[.55,.85],20:[.4,1]},f=x=>(100*x).toFixed(0)+'%';
for(const r of R){const tag=r.dist+' m: ';
 assert.ok(r.shots>300,tag+'shots '+r.shots);
 assert.ok(r.minShot>=B.REACT[0]-1e-9,tag+'first shot before the reaction floor: '+r.minShot.toFixed(3)+' s');
 assert.ok(r.firstHit>=cap[r.dist][0]&&r.firstHit<=cap[r.dist][1]&&r.minHit>=.4,tag+'median time to the first hit '+r.firstHit.toFixed(2)+' s (min '+r.minHit.toFixed(2)+'), want '+cap[r.dist].join('-'));
 assert.ok(r.late>=r.early+.08,tag+'hit % rises with time in the fight: '+f(r.early)+' (0.5-1 s) -> '+f(r.late)+' (1.5 s+)');
 assert.ok(r.onLate>=r.onEarly+.2,tag+'crosshair on the body: '+f(r.onEarly)+' (0.5-1 s) -> '+f(r.onLate)+' (1.5 s+)');
 assert.ok(r.hs>=.12&&r.hs<=.38,tag+'headshot share of hits '+f(r.hs));}
console.log('Server bot aim KPIs: '+R.map(r=>r.dist+' m first hit '+r.firstHit.toFixed(2)+' s, hit '+f(r.early)+' -> '+f(r.late)+', on body '+f(r.onEarly)+' -> '+f(r.onLate)+', hs '+f(r.hs)).join('; '));
