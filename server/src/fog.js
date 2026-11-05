// Fog of war (anti-wallhack, after Riot's "Demolishing Wallhacks with VALORANT's Fog of War",
// technology.riotgames.com/news/demolishing-wallhacks-valorants-fog-war): the server only sends an enemy's position to a
// team that can see it, hear it, or has it revealed. Identity stays (name, agent, alive, kills), so the scoreboard and the
// alive pips keep working; a hidden row carries no position, aim, HP, ammo, crouch or weapon and
// is flagged [22] = 1 (the page parks that enemy off screen until it is relevant again: server_runtime.js netFog).
//
//  - Sight: a world ray (smokes and Barrier Orbs do not count, as in VALORANT: a smoke edge still shows the body) from a
//    team member's eye to a few points on the enemy's box, both ways, with the box and the eye stretched along their
//    velocity by FOG.ahead s ("look into the future", the article's attempt #2) so an enemy rounding a corner arrives
//    before the client renders it. Hidden pairs are re-tested every other tick (the look-ahead covers the 50 ms).
//  - Hearing: running footsteps within FOG.step m (VALORANT's minimap footstep circle, ~30 m), a gunshot within FOG.shot m
//    for FOG.shotFor s, anyone within FOG.near m.
//  - Reveals: Recon Bolt / Owl dart / Spycam / Alarmbot / Haunt ... (v.revealedUntil, ults.js revealedFor).
//  - Grace: relevant stays relevant FOG.grace s after the last test that saw it (the article: "relevant actors stay relevant
//    for a small amount of time"), so an unpeek does not pop and a killcam / death recap still has its killer.
//  - Your killer stays relevant to you (the victim only) for FOG.killer s after your death.
// Vision is per team (per player in Deathmatch): a teammate's sight is yours (minimap). Enemy devices (deviceRows) and
// Barrier Orbs (fx 'barrier') follow the same sight test; static ones stay once seen, Owl Drone / Blast Pack use the grace.
import {barrierPoints} from './abilities.js';import {hyp2,hyp3} from './hyp.js';/* Math.hypot without the builtin's per-call argument array, bit-identical (hyp.js) */import {devicePoints,DEV_ROWS} from './devices.js';
export {hyp2 as fogHyp2,hyp3 as fogHyp3};
export const FOG=Object.freeze({ahead:.4,pad:.45,grace:1,step:30,run:3.6,shot:50,shotFor:1,near:3,killer:3,devNear:6,cast:30});
const MOVING=new Set(['owl','hunter','blastpack','cloudburst','blast']);
export function fogGroup(sim,u){return sim.mode==='dm'?'u'+u.id:'t'+u.team;}
const rowGroup=(sim,r)=>sim.mode==='dm'?'u'+r[0]:'t'+r[1];
const live=u=>u&&u.alive&&!u.loading;
function eyes(u){const y=u.y+1.6-(u.ch||0),out=[[u.x,y,u.z]],vx=u.vx||0,vz=u.vz||0;if(vx*vx+vz*vz>.25)out.push([u.x+vx*FOG.ahead,y,u.z+vz*FOG.ahead]);return out;}
// points on u's box seen from o: head / chest / knee on the axis, chest+head at the box's sides across the line of sight,
// and the same box FOG.ahead s along its velocity
function points(u,o){let dx=u.x-o[0],dz=u.z-o[2];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const sx=-dz*FOG.pad,sz=dx*FOG.pad,top=1.65-(u.ch||0),y=u.y,out=[[u.x,y+top,u.z],[u.x,y+1.05,u.z],[u.x+sx,y+1.2,u.z+sz],[u.x-sx,y+1.2,u.z-sz],[u.x,y+.4,u.z]];
 const vx=u.vx||0,vz=u.vz||0;if(vx*vx+vz*vz>.25){const x=u.x+vx*FOG.ahead,z=u.z+vz*FOG.ahead;out.push([x,y+top,z],[x+sx,y+1.1,z+sz],[x-sx,y+1.1,z-sz]);}return out;}
export function segClear(sim,o,p){const q=[p[0]-o[0],p[1]-o[1],p[2]-o[2]],len=Math.hypot(q[0],q[1],q[2]);if(len<.05)return true;const w=sim.baseWorld||sim.world,r=w&&w.ray;/* the map only: Barrier Orbs and smokes never hide (conservative, and a device is never behind its own barrier) */if(typeof r!=='function')return true;return r(o,[q[0]/len,q[1]/len,q[2]/len],len-.05)===Infinity;}
export function pairSees(sim,a,b){const w=sim.baseWorld||sim.world;if(w&&typeof w.rayClear==='function'&&w.rayS&&typeof w.ray==='function')return pairSeesF(sim,w,a,b)||pairSeesF(sim,w,b,a);for(const [s,t] of [[a,b],[b,a]])for(const e of eyes(s))for(const p of points(t,e)){sim.fogRays=(sim.fogRays||0)+1;if(segClear(sim,e,p))return true;}return false;}
// perf3: pairSees without its per-call arrays (eyes, points, the ray's offset / direction: ~200 KB per server tick in a 5v5):
// the same eyes and points, written out into scratch buffers in the same order, each test segClear's arithmetic with the
// ray handed to the world through its ray state (world.rayS / rayClear = ray(o, d, len - .05) === Infinity)
const FE=new Float64Array(6),FP=new Float64Array(24);
function pairSeesF(sim,w,s,t){const ne=eyesF(s);for(let i=0;i<ne;i++){const np=pointsF(t,i),ex=FE[i*3],ey=FE[i*3+1],ez=FE[i*3+2];
  for(let k=0;k<np;k++){sim.fogRays=(sim.fogRays||0)+1;const q0=FP[k*3]-ex,q1=FP[k*3+1]-ey,q2=FP[k*3+2]-ez,len=hyp3(q0,q1,q2);if(len<.05)return true;
   const R=w.rayS;R.ox=ex;R.oy=ey;R.oz=ez;R.dx=q0/len;R.dy=q1/len;R.dz=q2/len;R.max=len-.05;if(w.rayClear())return true;}}return false;}
// eyes(u) into FE (count)
function eyesF(u){const y=u.y+1.6-(u.ch||0),vx=u.vx||0,vz=u.vz||0;FE[0]=u.x;FE[1]=y;FE[2]=u.z;if(vx*vx+vz*vz>.25){FE[3]=u.x+vx*FOG.ahead;FE[4]=y;FE[5]=u.z+vz*FOG.ahead;return 2;}return 1;}
// points(u, eye i of FE) into FP (count)
function pointsF(u,i){let dx=u.x-FE[i*3],dz=u.z-FE[i*3+2];const l=hyp2(dx,dz)||1;dx/=l;dz/=l;const sx=-dz*FOG.pad,sz=dx*FOG.pad,top=1.65-(u.ch||0),y=u.y;
 FP[0]=u.x;FP[1]=y+top;FP[2]=u.z;FP[3]=u.x;FP[4]=y+1.05;FP[5]=u.z;FP[6]=u.x+sx;FP[7]=y+1.2;FP[8]=u.z+sz;FP[9]=u.x-sx;FP[10]=y+1.2;FP[11]=u.z-sz;FP[12]=u.x;FP[13]=y+.4;FP[14]=u.z;
 const vx=u.vx||0,vz=u.vz||0;if(vx*vx+vz*vz>.25){const x=u.x+vx*FOG.ahead,z=u.z+vz*FOG.ahead;FP[15]=x;FP[16]=y+top;FP[17]=z;FP[18]=x+sx;FP[19]=y+1.1;FP[20]=z+sz;FP[21]=x-sx;FP[22]=y+1.1;FP[23]=z-sz;return 8;}return 5;}
const near3=(a,b,r)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2<=r*r;
// Iso Kill Contract: duel pairs see each other through the arena's own geometry, not the match map's. baseWorld
// rays 10000 units outside the map are meaningless (the victim's snapshot masked Iso at 0,0,0 for the whole duel);
// sim.world is the arena-wrapped world (arena.js), so its ray honours the cell walls and cover blocks exactly.
function pairSeesDuel(sim,a,b){const w=sim.world;for(const [s,t]of[[a,b],[b,a]])for(const e of eyes(s))for(const p of points(t,e)){const q=[p[0]-e[0],p[1]-e[1],p[2]-e[2]],len=Math.hypot(q[0],q[1],q[2]);if(len<.05)return true;if(typeof w.ray==='function'&&w.ray(e,[q[0]/len,q[1]/len,q[2]/len],len-.05)===Infinity)return true;}return false;}
// One pass per simulation time: which enemy ids (and which enemy effect ids to hide) each group gets.
export function fogPass(sim,snap){const F=sim.fog||(sim.fog={t:-1,n:0,pairs:new Map(),rel:new Map(),hide:new Map()});if(F.t===sim.time)return F;F.t=sim.time;F.n++;const now=sim.time,U=sim.units,byName=new Map(U.map(u=>[u.name,u]));
 for(const e of sim.castEvents||[]){if(e&&e.t==='ac'&&e.sub!=='boom'){const u=U.find(v=>v.id===e.i);if(u)u.fogCastAt=now;}}/* a cast is heard like a gunshot (FOG.cast m) */
 for(const e of (snap&&snap.ev)||[]){if(!Array.isArray(e))continue;if(e[0]==='s'){const u=U.find(v=>v.id===e[1]);if(u)u.fogShotAt=now;}else if(e[0]==='k'){const k=byName.get(e[1]),v=byName.get(e[2]);if(k&&v&&k!==v)v.fogKiller={id:k.id,until:now+FOG.killer};}}
 const groups=new Set(U.map(u=>fogGroup(sim,u)));for(const g of groups){if(!F.rel.has(g))F.rel.set(g,new Map());}const rel=F.rel,mark=(g,id,t=now+FOG.grace)=>{const m=rel.get(g);if(m&&!(m.get(id)>=t))m.set(id,t);};
 for(const u of U){if(u.alive)u.fogDeadAt=undefined;else if(u.fogDeadAt===undefined)u.fogDeadAt=now;}/* death time: a dead enemy row is sent only to a group it was relevant to when it died */
 const L=U.filter(live);
 for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j],ga=fogGroup(sim,a),gb=fogGroup(sim,b);if(ga===gb)continue;
  const key=a.id<b.id?a.id+':'+b.id:b.id+':'+a.id,last=F.pairs.get(key)??-1e9;let seen=false;
  const duelPair=a.isoDuel&&b.isoDuel&&a.isoDuel.foe===b.id&&b.isoDuel.foe===a.id;/* Kill Contract: mutual arena visibility */
  if(duelPair)seen=pairSeesDuel(sim,a,b);else if(near3(a,b,FOG.near))seen=true;else if(now-last<=FOG.grace||((F.n+a.id+b.id)&1)===0)seen=pairSees(sim,a,b);
  const ad=(a.driftUntil||0)>now,bd=(b.driftUntil||0)>now;/* Dimensional Drift (wiki): unseen by enemies - no sight or proximity relevance TO a drifter, and he does not body-block; he still sees out */
  if(seen){F.pairs.set(key,now);if(!bd)mark(ga,b.id);if(!ad)mark(gb,a.id);}}
 for(const v of L){const g=fogGroup(sim,v),run=typeof sim.loud==='function'?sim.loud(v):Math.hypot(v.vx||0,v.vz||0)>FOG.run&&!(v.input&&(v.input.walk||v.input.duck))/* the row's [23] footsteps flag */,shot=now-(v.fogShotAt??-1e9)<=FOG.shotFor,cast=now-(v.fogCastAt??-1e9)<=FOG.shotFor,rev=(v.revealedUntil||0)>now;
  const vd=(v.driftUntil||0)>now;/* drift: intangible ("no longer revealed to enemies"), footsteps heard within 15 m (wiki Dimensional Drift update history), cast audio cues still carry */
  for(const a of L){const ga=fogGroup(sim,a);if(ga===g)continue;if((!vd&&rev)||(run&&near3(a,v,vd?15:FOG.step))||(!vd&&shot&&near3(a,v,FOG.shot))||(cast&&near3(a,v,FOG.cast)))mark(ga,v.id,rev&&!vd?Math.max(now,v.revealedUntil):now+FOG.grace);}}
 // enemy devices / barriers
 for(const g of groups)F.hide.set(g,new Set());
 for(const e of sim.effects||[]){const dev=DEV_ROWS.has(e.kind),bar=e.kind==='barrier',cb=e.kind==='cloudburst'||(e.kind==='blast'&&(e.ag==='Clove'||e.ag==='Harbor'))/* Jett's Cloudburst in flight (fx 'cb' s 0): it leaves the caster's eye; Clove's Meddle blast row (impact point) is gated the same way */;if(!(dev||bar||cb)||!Array.isArray(e.p))continue;const pts=cb?[e.p.slice()]:bar?(e.hp>0?barrierPoints(e):[]):devicePoints(e).concat(e.field&&Array.isArray(e.fp)?[[e.fp[0],e.fp[1]+.3,e.fp[2]]]:[]);if(!pts.length)pts.push([e.p[0],e.p[1]+.3,e.p[2]]);
  e.fogSeen||(e.fogSeen=new Map());const ownG=sim.mode==='dm'?'u'+e.owner:'t'+e.team;
  for(const g of groups){if(g===ownG)continue;const sticky=!MOVING.has(e.kind);if(sticky&&e.fogSeen.has(g))continue;let seen=false;
   for(const a of L){if(fogGroup(sim,a)!==g)continue;if(pts.some(p=>(a.x-p[0])**2+(a.z-p[2])**2<=FOG.devNear*FOG.devNear&&Math.abs(a.y-p[1])<4)){seen=true;break;}const E=eyes(a);if(E.some(o=>pts.some(p=>segClear(sim,o,p)))){seen=true;break;}}
   if(seen)e.fogSeen.set(g,now+FOG.grace);if(!(e.fogSeen.get(g)>=now))F.hide.get(g).add(e.id);}}
 // floor guns (Spike mode fw rows): one an enemy dropped (a G drop, its death drop, a swap) is a position - it reaches a
 // group once one of its live members has seen the spot (sticky, like a static device); own-team and ownerless drops always
 F.hideFw=new Map();for(const g of groups)F.hideFw.set(g,new Set());
 for(const d of sim.floor||[]){if(!d||d.dropper==null||![d.x,d.y,d.z].every(Number.isFinite))continue;const o=U.find(u=>u.id===d.dropper);if(!o)continue;const og=fogGroup(sim,o);d.fogSeen||(d.fogSeen=new Set());const p=[d.x,d.y+.3,d.z];
  for(const g of groups){if(g===og||d.fogSeen.has(g))continue;let seen=false;for(const a of L){if(fogGroup(sim,a)!==g)continue;if((a.x-p[0])**2+(a.z-p[2])**2<=FOG.devNear*FOG.devNear&&Math.abs(a.y-p[1])<4||eyes(a).some(e=>segClear(sim,e,p))){seen=true;break;}}
   if(seen)d.fogSeen.add(g);else F.hideFw.get(g).add(d.id);}}
 // forget pair stamps of departed units
 if(F.n%200===0){const ids=new Set(U.map(u=>u.id));for(const k of F.pairs.keys()){const [x,y]=k.split(':').map(Number);if(!ids.has(x)||!ids.has(y))F.pairs.delete(k);}for(const m of rel.values())for(const id of m.keys())if(!ids.has(id))m.delete(id);}
 return F;}
// A team with nobody left in the round (Spike mode: every member dead, no Phoenix inside Run It Back - spike.js's own
// elimination test). It used to get the whole frame so its spectator camera could follow the enemies; VALORANT never
// lets the dead spectate an enemy (only living teammates, first person), so an eliminated team keeps the fog like
// everyone else (user, 2026-10-26: "You shouldn't be able to spectate enemy"). Kept for tests / tools only.
export function fogEliminated(sim,g){if(sim.mode!=='five')return false;let any=false;for(const u of sim.units){if(fogGroup(sim,u)!==g)continue;any=true;if(u.alive||u.runItBack)return false;}return any;}
// A hidden enemy row: identity, team, alive and input seq stay; position, aim, HP, armour, ammo, crouch, Regen pool,
// input timing and the weapon ([11] = '': what an unseen enemy holds is not ours to know - VALORANT shows enemy guns only
// in the world when seen and in the kill feed; a hidden shooter's shot never reaches us, fogView drops it) go; [22] = 1.
export function fogRow(r){const o=r.slice();o[11]='';o[4]=o[5]=o[6]=o[7]=0;o[8]=o[10]?100:0;o[9]=0;o[15]=o[16]=0;o[17]=o[18]=0;o[19]=o[20]=0;o[21]=-1;o[22]=1;if(o.length>23)o[23]=0;if(o.length>24)o[24]=0;/* Blade Storm knives */if(o.length>25)o[25]=0;/* rope ascender */if(o.length>26)o[26]=0;/* Spike action */return o;}
// The snapshot (or any frame with unit rows u and effect rows fx) as viewer may receive it.
export function fogView(sim,snap,viewer){if(!snap||!viewer||sim.phase!=='game'||sim.fogOff)return snap;const F=fogPass(sim,snap),g=fogGroup(sim,viewer),rel=F.rel.get(g),now=sim.time,kill=viewer.fogKiller&&viewer.fogKiller.until>=now?viewer.fogKiller.id:-1,hide=F.hide.get(g);
 const byId=new Map(sim.units.map(u=>[u.id,u])),seen=r=>{if(r[10])return rel&&rel.get(r[0])>=now;const u=byId.get(r[0]),d=u&&u.fogDeadAt;/* dead: only if it was relevant to us when it died (its corpse / death spot) */return d!==undefined&&rel&&rel.get(r[0])>=d;};
 const out={...snap};if(Array.isArray(snap.u))out.u=snap.u.map(r=>!Array.isArray(r)||r[0]===viewer.id||rowGroup(sim,r)===g||r[0]===kill||seen(r)?r:fogRow(r));
 if(Array.isArray(snap.ev)&&Array.isArray(out.u)){const hid=new Set(out.u.filter(r=>Array.isArray(r)&&r[22]===1).map(r=>r[0]));if(hid.size){const grp=new Map(snap.u.filter(Array.isArray).map(r=>[r[0],rowGroup(sim,r)]));/* a hit on a hidden enemy by someone outside our group: its damage would give away the HP the row hides, and its blood would land at a stale spot */const outsider=id=>id!==viewer.id&&grp.get(id)!==g;
  out.ev=snap.ev.filter(e=>!(Array.isArray(e)&&(e[0]==='h'&&hid.has(e[2])&&outsider(e[1])/* a gunshot ('s') of a hidden enemy: it is out of hearing range (a shot within FOG.shot m makes the shooter relevant this very pass), so no cue at all */||e[0]==='s'&&hid.has(e[1])&&outsider(e[1])/* a finisher ('fin') carries the victim's death spot */||e[0]==='fin'&&hid.has(e[3])&&outsider(e[3])&&e[2]!==viewer.id)));}}
 /* Deathmatch health packs lie on the victim's death spot: sent if the viewer killed or was the victim, the victim was relevant to
  the viewer when it died (as its corpse row), or the pack is within 12 m of the viewer (no line test: a near pack may be seen) */
 if(Array.isArray(snap.hpk)){const PK=new Map((sim.packs||[]).map(k=>[k.id,k]));out.hpk=snap.hpk.filter(r=>{if(!Array.isArray(r))return false;const k=PK.get(r[0]);return r[1]===viewer.id||r[2]===viewer.id||!!k&&rel&&rel.get(r[1])>=k.at-.05||Math.hypot(r[3]-viewer.x,r[5]-viewer.z)<=12;});}
 const hideFw=F.hideFw&&F.hideFw.get(g);if(Array.isArray(snap.fw)&&hideFw&&hideFw.size)out.fw=snap.fw.filter(r=>!(Array.isArray(r)&&hideFw.has(r[0])));
 if(Array.isArray(snap.fx))out.fx=snap.fx.filter(r=>{if(r&&r.kind==='shear'){const ow=r.o!=null?byId.get(r.o):null;if(!ow||fogGroup(sim,ow)!==g)return false;/* Vyse Shear: a hidden trap - the enemy team never gets the row until it triggers into a barrier (wiki) */}return !(r&&hide&&hide.size&&hide.has(r.id)&&(r.kind==='dev'||r.kind==='barrier'||r.kind==='cb'&&r.s===0||r.kind==='blast'&&(r.ag==='Clove'||r.ag==='Harbor')));});return out;}
// A cast event ('ac': caster id, agent, key, eye o, aim d, effect point p) as viewer may receive it. The caster's own team
// (or the caster, in Deathmatch), and a group the caster is relevant to (seen, heard - a cast is heard within FOG.cast m
// like a gunshot -, revealed, your killer) get it whole. Anyone else never gets the caster's eye or aim: if the effect
// point p is in sight of one of the group's live members (a smoke landing on site, a wall going up) the event keeps p
// only, flagged fog:1 (the page draws the effect there, server_runtime.js netCastFog); otherwise it is cut to
// {t,i,ag,k,ts,fog:1} - no position at all.
export function fogCast(sim,ev,viewer){if(!ev||ev.t!=='ac'||!viewer||sim.phase!=='game'||sim.fogOff)return ev;const c=sim.units.find(u=>u.id===ev.i);if(!c||c===viewer)return ev;const g=fogGroup(sim,viewer);if(fogGroup(sim,c)===g)return ev;
 const F=fogPass(sim,{ev:[]}),now=sim.time,rel=F.rel.get(g),kill=viewer.fogKiller&&viewer.fogKiller.until>=now?viewer.fogKiller.id:-1;const strict=['stepout','stepin','shadeout','shadein'].includes(ev.sub);/* Omen Step: each point is shown only where the viewer's team can see it - being heard / seeing the caster elsewhere must not reveal the other point */if(!strict&&(c.id===kill||(rel&&rel.get(c.id)>=now)))return ev;
 const out={t:'ac',i:ev.i,ag:ev.ag,k:ev.k,ts:ev.ts,fog:1};if(ev.sub)out.sub=ev.sub;const p=ev.p;
 if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)){const q=[p[0],p[1]+1,p[2]];if(sim.units.some(a=>live(a)&&fogGroup(sim,a)===g&&(near3(a,{x:p[0],y:p[1],z:p[2]},FOG.devNear)||eyes(a).some(e=>segClear(sim,e,q)))))out.p=p.slice();}
 return out;}
