// Team spread metrics for server Spike bots (deterministic: seeded RNG -> botSeed 0). 5v5 bots, real sight lines.
// Per map and side (attack / defence), over ROUNDS rounds of up to SECS s each (buy phase skipped):
//   pair   mean pairwise distance (m) between living teammates, sampled every 0.25 s until the plant / round end
//   jump   bots of the team within 6 m of its first contact (first time any member sees an enemy) during the next 3 s (max)
//          jumpSolo / jumpGroup: the same max over rounds whose plan spreads the team / attack group hits (GROUP_PLANS:
//          execute / split / lurk / rush, where the team runs in together on purpose)
//   conv   bots within 12 m of that first contact during the next 10 s (max per round, mean over rounds)
//   areas  distinct areas held: regions (nearest of each site / the middle / both spawns) holding a living teammate, mean
//          over the setup window; groups: single-link clusters (link 7 m) over the same window
//          (round time 6 s .. the first contact / plant / 35 s)
//   stack  share of rounds that are true stacks: >= 4 bots within 6 m of one of them for >= 60% of the setup window
//   clump  share of samples from round time 6 s (pre-plant on the server) with >= 4 living bots within 6 m of one of them
//          clumpSpread / clumpGroup: the same share over the rounds whose plan spreads the team / runs it in together (attack
//          GROUP_PLANS, defence 'stack'), as jumpSolo / jumpGroup
//   rotMax / tradeMax  most defenders sent to rotate on one piece of information / most mates trading one death
//   stackOk  of those stacks, how many were plans that call for one (attack execute / rush, defence stack)
// Usage: node tools/bot-spread-metrics.mjs [maps] [rounds] [secs]  (or import {measure}).
import fs from 'node:fs/promises';import {loadWorld} from '../src/world.js';import {SpikeSimulation} from '../src/spike.js';
const here=new URL('..',import.meta.url).pathname;
const assets={async fetch(r){try{return new Response(await fs.readFile(here+'public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
export function clusters(P,link=7){const n=P.length,lab=new Array(n).fill(-1);let c=0;for(let i=0;i<n;i++){if(lab[i]>=0)continue;lab[i]=c;const q=[i];while(q.length){const a=q.pop();for(let j=0;j<n;j++)if(lab[j]<0&&Math.hypot(P[a][0]-P[j][0],P[a][1]-P[j][1])<link){lab[j]=c;q.push(j);}}c++;}
 let big=0;for(let i=0;i<n;i++){let k=0;for(let j=0;j<n;j++)if(Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1])<6)k++;big=Math.max(big,k);}return {n:c,big};} // big: most teammates within 6 m of one of them (itself included)
// regions: the nearest of the map's key points (each site, the middle, both spawns); "areas held" = distinct regions
function keyPoints(M){const S={};for(const k of Object.keys(M.sites))if(/^[ABC]$/.test(k))S[k]=M.sites[k];const mx=(M.attacker[0]+M.defender[0])/2,mz=(M.attacker[2]+M.defender[2])/2;let mid=[mx,mz],bd=25;for(const k in S){const c=S[k],d=Math.hypot(c[0]-mx,c[2]-mz);if(d<bd){bd=d;mid=null;}}
 const out=Object.keys(S).map(k=>[S[k][0],S[k][2]]);if(mid)out.push(mid);out.push([M.attacker[0],M.attacker[2]],[M.defender[0],M.defender[2]]);return out;}
function regions(K,P){const s=new Set();for(const p of P){let b=0,bd=Infinity;K.forEach((k,i)=>{const d=Math.hypot(p[0]-k[0],p[1]-k[1]);if(d<bd){bd=d;b=i;}});s.add(b);}return s.size;}
const STACK_PLANS=new Set(['execute','rush','stack']),GROUP_PLANS=new Set(['execute','split','lurk','rush']);
export async function measure(map,{rounds=8,secs=45,seed0=11}={}){
 const W=await loadWorld(assets,map),KP=keyPoints(W.map);let seed=seed0;
 const S=new SpikeSimulation(W,'five',map,()=>(seed=(seed*16807)%2147483647)/2147483647);S.add('Bot Jett','Jett',false);S.start(true);
 const acc=[0,1].map(()=>({pairS:0,pairN:0,jump:[],jumpS:[],jumpG:[],conv:[],areaS:0,areaN:0,regS:0,clS:0,clN:0,clSS:0,clSN:0,clGS:0,clGN:0,stacks:0,stackOk:0,rounds:0,plans:[],rotMax:0,tradeMax:0}));
 for(let r=0;r<rounds;r++){if(r)S.newRound();S.buy=0;const side=[S.atk,1-S.atk];const st=[0,1].map(()=>({c0:null,jmax:0,cmax:0,setup:0,big4:0,done:false,cS:0,cN:0}));
  for(let t=0;t<secs/.05;t++){S.step(.05);if(S.roundDelay>0||S.phase!=='game')break;
   if(t%5)continue;const rt=t*.05,planted=S.spike.st==='plant';
   for(const team of [0,1]){const U=S.units.filter(u=>u.team===team&&u.alive),A=acc[team],T=st[team],P=U.map(u=>[u.x,u.z]);
    if(!planted){for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){A.pairS+=Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);A.pairN++;}}
    if(P.length>=4&&!planted&&rt>=6){A.clN++;T.cN++;if(clusters(P).big>=4){A.clS++;T.cS++;}}
    if(!T.c0){const c=U.find(u=>u.sawTarget);if(c)T.c0={x:c.x,z:c.z,t:rt};}
    if(T.c0&&rt<=T.c0.t+3){let k=0;for(const p of P)if(Math.hypot(p[0]-T.c0.x,p[1]-T.c0.z)<6)k++;T.jmax=Math.max(T.jmax,k);}
    if(T.c0&&rt<=T.c0.t+10){let k=0;for(const p of P)if(Math.hypot(p[0]-T.c0.x,p[1]-T.c0.z)<12)k++;T.cmax=Math.max(T.cmax,k);}
    if(rt>=6&&!T.c0&&!planted&&rt<35&&P.length>=4){const C=clusters(P);A.areaS+=C.n;A.regS+=regions(KP,P);A.areaN++;T.setup++;if(C.big>=4)T.big4++;}}}
  for(const e of S.rotateLog||[])if(e.round===S.round){const A=acc[1-S.atk];A.rotMax=Math.max(A.rotMax,e.ids.length);}
  for(const e of S.tradeLog||[])if(e.round===S.round){const A=acc[e.team];A.tradeMax=Math.max(A.tradeMax,e.go);}
  for(const team of [0,1]){const A=acc[team],T=st[team],pl=S._strat&&S._strat[team]&&S._strat[team].plan;A.rounds++;if(team===S.atk?pl&&GROUP_PLANS.has(pl.type):pl&&pl.type==='stack'){A.clGS+=T.cS;A.clGN+=T.cN;}else{A.clSS+=T.cS;A.clSN+=T.cN;}if(T.c0){A.jump.push(T.jmax);(team===S.atk&&pl&&GROUP_PLANS.has(pl.type)?A.jumpG:A.jumpS).push(T.jmax);A.conv.push(T.cmax);}
   const stack=T.setup>=8&&T.big4/T.setup>=.6;if(stack){A.stacks++;if(pl&&STACK_PLANS.has(pl.type))A.stackOk++;}A.plans.push((team===S.atk?'A:':'D:')+(pl?pl.type:'?')+(stack?'*':''));}}
 return [0,1].map(team=>{const A=acc[team];return {map,team,pair:A.pairS/Math.max(1,A.pairN),jumpMax:Math.max(0,...A.jump),jumpSolo:Math.max(0,...A.jumpS),jumpGroup:Math.max(0,...A.jumpG),jumpMean:A.jump.reduce((s,v)=>s+v,0)/Math.max(1,A.jump.length),conv:A.conv.reduce((s,v)=>s+v,0)/Math.max(1,A.conv.length),areas:A.regS/Math.max(1,A.areaN),groups:A.areaS/Math.max(1,A.areaN),clump:A.clS/Math.max(1,A.clN),clumpSpread:A.clSS/Math.max(1,A.clSN),clumpGroup:A.clGS/Math.max(1,A.clGN),stack:A.stacks/A.rounds,rotMax:A.rotMax,tradeMax:A.tradeMax,stackOk:A.stackOk,stacks:A.stacks,plans:A.plans.join(' ')};});
}
if(import.meta.url===`file://${process.argv[1]}`){
 const maps=(process.argv[2]||'ascent,bind,haven,split,lotus,breeze').split(','),rounds=+(process.argv[3]||8),secs=+(process.argv[4]||45);
 const J={};for(const m of maps){const t0=Date.now();const RR=await measure(m,{rounds,secs});J[m]=RR;if(process.env.BS_JSON)await fs.writeFile(process.env.BS_JSON,JSON.stringify(J,null,1));for(const r of RR)console.log(`${m} team${r.team} pair ${r.pair.toFixed(1)} m | jump max ${r.jumpMax} mean ${r.jumpMean.toFixed(2)} | conv12m/10s ${r.conv.toFixed(2)} | areas ${r.areas.toFixed(2)} groups ${r.groups.toFixed(2)} | clump ${(100*r.clump).toFixed(0)}% | stacks ${r.stacks}/${rounds} (planned ${r.stackOk}) | ${r.plans}`);console.log(`  (${((Date.now()-t0)/1000).toFixed(1)} s)`);}
}
