// Bot "feels like an average player" probe, part 3 (lane-botfeel3), SERVER SpikeSimulation 5v5 (all bots), Ascent.
// Measurement only, no asserts. Beyond probe_bot_feel.cjs (fights / reloads / trades) it logs the team-level and
// crosshair behaviours:
//   crosshair: at the first tick a bot sees an enemy (a new fight), the yaw / pitch between where it looked and the enemy's
//     head (deg) - a player who walks with the crosshair on likely angles at head height starts a fight a few deg off;
//     share of fight starts with |yaw| < 10 deg / pitch within 3 deg of the head
//   economy: team buy calls per round; per team-round the split of primaries (rifle+ / smg-shotgun / pistol only),
//     "mixed" team-rounds (a rifle next to a pistol-only mate outside a pistol round); hopeless attackers: pre-plant
//     attacker deaths with under 20 s on the round clock while outnumbered by 2+ (a real player saves the gun), and
//     attackers alive at time-out (they saved)
//   routes: each bot's first 35 s of action as a set of 5 m cells; mean Jaccard overlap between same-side mates heading for
//     the same site that round, and of a bot with itself on the same side + site in other rounds (lower = more variety)
//   rotations: per round before the plant, defenders whose distance to the attacked site shrank 12 m+ before ANY defender
//     had information on that site (sim.atkInfo) = omniscient rotations; info->move delay median
//   ROOT=<worktree> SECS=1500 SEED=7 JSON=out.json node work/probe_bot_feel3.mjs
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
const ROOT=process.env.ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),SECS=+(process.env.SECS||1500),SEED=+(process.env.SEED||7);
const imp=p=>import(pathToFileURL(path.join(ROOT,'server',p)).href);
const {SpikeSimulation}=await imp('src/spike.js');const {loadWorld}=await imp('src/world.js');
process.chdir(path.join(ROOT,'server'));
const assets={async fetch(r){try{return new Response(await fs.readFile('public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
const W=await loadWorld(assets,process.env.MAP||'ascent');let seed=SEED;const S=new SpikeSimulation(W,'five',process.env.MAP||'ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);S.start(true);
const RIFLE=new Set(['Warden','Vandal','Phantom','Bulldog','Guardian','Operator','Odin','Ares','Marshal','Outlaw']),SMG=new Set(['Spectre','Stinger','Judge','Bucky']);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),deg=r=>r*180/Math.PI;
const ARR=[],XH=[],ECO=[],DEATH=[],ROUT={},ROT=[],TOUT=[];let cur=null;
const wasSee=new Map();
const kill0=S.finishRound.bind(S);S.finishRound=function(w,text){if(cur&&!(S.roundDelay>0))cur.end={w,text,alive:S.units.filter(u=>u.alive).map(u=>({id:u.id,team:u.team,primary:u.primary}))};return kill0(w,text);};
const rt0=()=>S.time-cur.t0;const roundLen=()=>100;
function newRound(){const sites=W.map.sites;cur={round:S.round,atk:S.atk,site:S.spike.site,t0:S.time,pos:{},dmax:{},movedAt:{},info:null,plantAt:null,end:null};
 for(const team of [0,1]){const L=S.units.filter(u=>u.team===team);const k={rifle:0,smg:0,pistol:0};for(const u of L){const p=u.primary;if(p&&RIFLE.has(p))k.rifle++;else if(p&&SMG.has(p))k.smg++;else k.pistol++;}
  ECO.push({round:S.round,team,atk:team===S.atk,call:(S.teamCall||{})[team]||null,ls:(S.losses||[])[team]||0,...k,mixed:S.round!==1&&S.round!==13&&k.rifle>0&&k.pistol>0,cr:L.map(u=>u.roundCr)});}}
function finish(){cur.done=1;
  for(const team of [0,1]){const ids=S.units.filter(u=>u.team===team).map(u=>u.id);
   for(const id of ids){const a=cur.pos[id];if(!a)continue;const key=team+'|'+(team===cur.atk?'A':'D')+'|'+cur.site;(ROUT[key]||(ROUT[key]=[])).push({round:cur.round,id,cells:[...a]});}}
  for(const id in (cur.arr||{}))ARR.push({round:cur.round,id:+id,arr:cur.arr[id],info:cur.info,pre:cur.info==null||cur.arr[id]<cur.info});
  for(const u of S.units)if(u.team!==cur.atk&&cur.movedAt[u.id]!=null)ROT.push({round:cur.round,id:u.id,moved:cur.movedAt[u.id],info:cur.info,pre:cur.info==null||cur.movedAt[u.id]<cur.info});
  TOUT.push({round:cur.round,text:cur.end.text,w:cur.end.w,atk:cur.atk,atkAlive:cur.end.alive.filter(a=>a.team===cur.atk).length,plant:cur.plantAt});}
let lastRound=-1,steps=Math.round(SECS/.05);
for(let t=0;t<steps;t++){S.step(.05);
 if(S.phase!=='game')break;
 if(cur&&cur.end&&!cur.done)finish();
 if(S.buy>0||S.roundDelay>0){wasSee.clear();continue;}
 if(S.round!==lastRound){lastRound=S.round;newRound();}
 const r=rt0(),site=W.map.sites[cur.site];
 if(S.spike.st==='plant'&&cur.plantAt==null)cur.plantAt=r;
 if(cur.info==null&&S.atkInfo&&S.atkInfo.round===S.round&&S.atkInfo.site===cur.site)cur.info=r;
 {const na=S.units.filter(u=>u.alive&&u.team===cur.atk).length,nd=S.units.filter(u=>u.alive&&u.team!==cur.atk).length;for(const u of S.units){const was=cur.alive?.[u.id];if(was&&!u.alive&&u.team===cur.atk&&cur.plantAt==null)DEATH.push({round:cur.round,r:+r.toFixed(1),left:+(S.remaining??0).toFixed(1),atk:na+1,def:nd,gun:u.primaryPre||null});}cur.alive={};for(const u of S.units){cur.alive[u.id]=u.alive;u.primaryPre=u.primary;}}
 for(const u of S.units){if(!u.alive)continue;
  // crosshair at a new sighting
  const s=!!u.sawTarget,w=wasSee.get(u.id);wasSee.set(u.id,s);
  const fresh=S.time-(u.lastSeeT??-9)>2;if(s)u.lastSeeT=S.time;
  if(s&&!w&&fresh){const e=S.units.find(v=>v.id===u.aimTarget);if(e){const d=Math.hypot(e.x-u.x,e.z-u.z),b=Math.atan2(u.x-e.x,u.z-e.z),eye=u.y+1.6-(u.ch||0),hp=Math.atan2(e.y+1.8-(e.ch||0)-eye,d);
   XH.push({team:u.team,yaw:+deg(wrap((u.lookPre??u.look)-b)).toFixed(2),pitch:+deg((u.pitchPre??u.pitch??0)-hp).toFixed(2),d:+d.toFixed(1),moving:Math.hypot(u.vx||0,u.vz||0)>.8});}}
  // routes (first 35 s)
  if(r<=35&&Math.round(r/.05)%10===0){const k=cur.round+'|'+u.id;(cur.pos[u.id]||(cur.pos[u.id]=new Set())).add(Math.round(u.x/5)+','+Math.round(u.z/5));}
  // rotations (defenders, pre-plant)
  if(u.team!==cur.atk&&cur.plantAt==null&&site&&r>3&&u.plan&&u.plan.round===S.round&&u.plan.site&&u.plan.site!==cur.site&&!u.plan.rotSite0){const d0=Math.hypot(u.x-site[0],u.z-site[2]);if(cur.far==null)cur.far={};if(r>=15&&r<16&&d0>30)cur.far[u.id]=1;if(cur.far[u.id]&&d0<22&&!(cur.arr||(cur.arr={}))[u.id])cur.arr[u.id]=r;}
  if(u.team!==cur.atk&&cur.plantAt==null&&site&&r>3){const d=Math.hypot(u.x-site[0],u.z-site[2]);const m=cur.dmax[u.id];if(m==null||d>m)cur.dmax[u.id]=d;else if(m-d>=12&&cur.movedAt[u.id]==null&&r>10)cur.movedAt[u.id]=r;}}
 // per-tick: remember look before a fight snaps it (sawTarget turns true inside bot(); record look each tick for unseen bots)
 for(const u of S.units){if(!u.sawTarget){u.lookPre=u.look;u.pitchPre=u.pitch;}}
}
// deaths of attackers pre-plant, late and outnumbered: from the kill events
// (recompute from a second hook-free pass would be costly; use roundEvents-free approach: track alive counts per tick)
const J=(a,b)=>{const A=new Set(a);let i=0;for(const x of b)if(A.has(x))i++;const u=A.size+b.length-i;return u?i/u:0;};
let mates=[],self=[];
for(const key in ROUT){const L=ROUT[key],by=new Map();for(const e of L){(by.get(e.round)||by.set(e.round,[]).get(e.round)).push(e);}
 for(const [,E] of by)for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++)mates.push(J(E[i].cells,E[j].cells));
 const byId=new Map();for(const e of L)(byId.get(e.id)||byId.set(e.id,[]).get(e.id)).push(e);for(const [,E] of byId)for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++)self.push(J(E[i].cells,E[j].cells));}
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?+s[Math.floor(s.length/2)].toFixed(3):null;},mean=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null,pc=(a,b)=>b?+(a/b*100).toFixed(1):null;
const ay=XH.map(x=>Math.abs(x.yaw)),ap=XH.map(x=>Math.abs(x.pitch)),mv=XH.filter(x=>x.moving);
const calls={};for(const e of ECO){const k=(e.atk?'A':'D')+':'+e.call;calls[k]=(calls[k]||0)+1;}
const out={seed:SEED,secs:SECS,side:'server',rounds:TOUT.length,
 xhFights:XH.length,xhYawMedDeg:med(ay),xhPitchMedDeg:med(ap),xhYawUnder10Pct:pc(ay.filter(x=>x<10).length,ay.length),xhPitchWithin3Pct:pc(ap.filter(x=>x<3).length,ap.length),xhMovingYawMedDeg:med(mv.map(x=>Math.abs(x.yaw))),xhPitchSignedMed:med(XH.map(x=>x.pitch)),
 ecoCalls:calls,ecoWinnerSaveCalls:ECO.filter(e=>e.round!==1&&e.round!==13&&e.ls===0&&(e.call==='eco'||e.call==='save')).length,ecoWinnerRounds:ECO.filter(e=>e.round!==1&&e.round!==13&&e.ls===0).length,ecoMixedPct:pc(ECO.filter(e=>e.mixed).length,ECO.filter(e=>e.round!==1&&e.round!==13).length),
 timeouts:TOUT.filter(t=>t.text==='Time ran out').length,atkAliveAtTimeout:TOUT.filter(t=>t.text==='Time ran out').map(t=>t.atkAlive),endings:TOUT.map(t=>t.text),
 routeMateJaccardMean:mean(mates),routeSelfJaccardMean:mean(self),routePairsMates:mates.length,routePairsSelf:self.length,
 atkPrePlantDeaths:DEATH.length,hopelessDeaths:DEATH.filter(d=>d.left<20&&d.def-(d.atk-1)>=2).length,hopelessRifleDeaths:DEATH.filter(d=>d.left<20&&d.def-(d.atk-1)>=2&&d.gun).length,lateDeathsUnder20:DEATH.filter(d=>d.left<20).length,
 rotArrivals:ARR.length,rotArrivalsPreInfo:ARR.filter(a=>a.pre).length,rotInfoToArriveMed:med(ARR.filter(a=>!a.pre).map(a=>a.arr-a.info)),
 rotations:ROT.length,rotationsPreInfo:ROT.filter(r=>r.pre).length,rotInfoToMoveMed:med(ROT.filter(r=>!r.pre&&r.info!=null).map(r=>r.moved-r.info)),
 eco:ECO,deaths:DEATH,rot:ROT,arr:ARR,xh:XH.slice(0,400)};
if(process.env.JSON)await fs.writeFile(process.env.JSON,JSON.stringify(out,null,1));const o2={...out};delete o2.eco;delete o2.xh;console.log(JSON.stringify(o2));process.exit(0);
