import BotRoutes from '../../vendor/bot-routes.cjs';
import BotBrain from '../../vendor/bot-brain.cjs';
import SpawnBarriers from '../../vendor/spawn-barriers.cjs';
import {blockedNodes} from './path.js';
// Server-authoritative bot personalities. Every bot gets a deterministic seed (its name, id and the map), its own
// random stream, a role profile and per-bot jittered traits, so bots under identical conditions still move,
// aim, peek, route and use utility differently, while the same bot replays identically (stable tests).
export const PROFILE_ORDER=['entry','anchor','lurker','support'];
// Ranges are [min,max]; each bot draws its own value inside them.
export const PROFILES={
 entry:  {react:[.13,.21],aim:[.012,.024],range:[3,9],  strafe:[.55,.9], crouch:.12,jiggle:.1, hold:0,  flank:0,  head:.55,walk:0,  util:[.15,.6]},
 anchor: {react:[.19,.29],aim:[.006,.014],range:[16,32],strafe:[.15,.35],crouch:.55,jiggle:.6, hold:.7, flank:0,  head:.65,walk:.6, util:[.6,1.6]},
 lurker: {react:[.22,.33],aim:[.01,.02],  range:[9,18], strafe:[.3,.6],  crouch:.3, jiggle:.35,hold:.25,flank:1,  head:.45,walk:.85,util:[1,2.5]},
 support:{react:[.21,.31],aim:[.014,.027],range:[11,20],strafe:[.35,.6], crouch:.25,jiggle:.2, hold:.35,flank:.3, head:.35,walk:.3, util:[.4,1.2]}
};
export function hash(s){let h=2166136261>>>0;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const pick=(r,[a,b])=>a+(b-a)*r();
// Lazily attaches u.persona. Profiles rotate per team (seeded by map) so a team always mixes roles.
export function persona(sim,u){
 if(u.persona)return u.persona;
 const seed=hash(u.name+'|'+u.id+'|'+sim.map),r=rng(seed),slot=sim.units.filter(v=>!v.human&&v.team===u.team&&v.persona).length,role=PROFILE_ORDER[(slot+hash(sim.map+'|'+u.team))%PROFILE_ORDER.length],P=PROFILES[role];
 const strafeTypes=['sine','switch','jiggle'],jig=r()<P.jiggle;
 const out={seed,role,r,
  react:pick(r,P.react),aim:pick(r,P.aim),range:[P.range[0]*(.85+r()*.3),P.range[1]*(.85+r()*.3)],
  strafeAmp:pick(r,P.strafe),strafeFreq:1.1+r()*1.8,strafePhase:r()*Math.PI*2,strafe:jig?'jiggle':strafeTypes[Math.floor(r()*2)],
  crouch:r()<P.crouch,crouchRange:8+r()*10,head:P.head,hold:P.hold,flank:r()<P.flank,walk:r()<P.walk,
  repath:.8+r()*.9,accept:.35+r()*.45,jitter:.15+r()*.5,jitterPhase:r()*Math.PI*2,
  aimF:[.7+r()*1.6,2.1+r()*2.4],aimP:[r()*6.283,r()*6.283,r()*6.283,r()*6.283],util:pick(r,P.util),
  // shared human-like traits (vendor/bot-brain.cjs, same as the offline bots): reaction 180-320 ms re-drawn per fight
  // around this bot's own mean, crosshair error that settles, fire rhythm, peeks, trade / fall-back / sound reactions
  brain:BotBrain.personality(hash('brain|'+u.name+'|'+u.id+'|'+sim.map+'|'+botSeed(sim)),role)};
 out.react=out.brain.react;out.head=Math.min(.75,(P.head+out.brain.head)/2);return u.persona=out;
}
// Match seed for bot decisions: random per room in production (sim.random is Math.random there), 0 under a seeded
// test RNG (or set sim.botSeed) so tests replay exactly. Never drawn from sim.random: that stream belongs to the shots.
export function botSeed(sim){if(sim.botSeed==null)sim.botSeed=sim.random===Math.random?(Math.random()*4294967296)>>>0:0;return sim.botSeed;}
// Per-engagement reaction (seconds) and crosshair error; called when a bot first sees its target.
// ctx (or a boolean: pre-aimed): {pre, off: rad between the view and the enemy, flashed, dist, e0y / e0p: crosshair minus the aim
// point (rad)}. The reaction grows off-angle / after a flash (BotBrain.reaction); the crosshair then follows a human flick
// (BotBrain.aimPlan: min-jerk, overshoot, correction, resting error) that starts when the reaction ends.
export function engage(sim,u,P,ctx){if(typeof ctx!=='object'||!ctx)ctx={pre:!!ctx};const B=P.brain,r=P.r;u.reactNow=BotBrain.reaction(B,r,ctx);u.xhE=BotBrain.crosshair(B,r,!!ctx.pre);u.aimPlan=BotBrain.aimPlan(B,r,ctx.e0y||0,ctx.e0p||0,ctx.dist||15,{start:u.reactNow,moving:!!ctx.moving});u.firePat=null;u.fireUntil=0;u.pauseUntil=0;u.crouchFight=r()<(P.crouch?.45+B.crouchSpray*.5:B.crouchSpray*.4);u.stopShoot=r()<BotBrain.discipline(B);return u.reactNow;}
const XH=[0,0];
export function crosshairErr(u,P,t){return u.xhE?BotBrain.crosshairAt(u.xhE,P.brain,t,XH):(XH[0]=XH[1]=0,XH);}
// Trigger discipline: taps far, bursts mid, sprays close, with pauses between; true while the trigger should be held.
export function trigger(sim,u,P,dist,auto,rate){const t=sim.time;if(t<u.fireUntil)return true;if(t<u.pauseUntil)return false;
 const f=BotBrain.firePattern(P.brain,P.r,dist,auto);u.firePat=f;u.fireUntil=t+Math.max(.04,(f.shots-.5)/Math.max(1,rate||8));u.pauseUntil=u.fireUntil+f.pause;return true;}
// Smoothly varying aim error (radians) that settles while a bot keeps tracking the same engagement.
export function aimError(P,t,engaged){const settle=.35+.65/(1+engaged*1.6),a=P.aimF[0],b=P.aimF[1];return [P.aim*settle*(Math.sin(t*a+P.aimP[0])+.5*Math.sin(t*b+P.aimP[1])),P.aim*.7*settle*(Math.sin(t*a*.83+P.aimP[2])+.5*Math.sin(t*b*1.21+P.aimP[3]))];}
// Lateral input while engaged: sine weave, random direction switches, or jiggle peeks (bursts then pauses).
export function strafe(sim,u,P){
 const t=sim.time;
 if(P.strafe==='sine')return Math.sin(t*P.strafeFreq+P.strafePhase)>0?P.strafeAmp:-P.strafeAmp;
 if(!(t<u.strafeUntil)){
  if(P.strafe==='jiggle'){u.strafeMove=!u.strafeMove;u.strafeDir=u.strafeMove?-(u.strafeDir||1):0;u.strafeUntil=t+(u.strafeMove?.14+P.r()*.18:.25+P.r()*.45);}
  else{u.strafeDir=P.r()<.5?-1:1;u.strafeUntil=t+.35+P.r()*1.1;}
 }
 return (u.strafeDir||0)*(P.strafe==='jiggle'?1:P.strafeAmp);
}
// Lurkers (and some supports) route through a flank waypoint beside the line to their target.
export function flankNode(sim,u,target){
 const W=sim.world,P=u.persona,dx=target.x-u.x,dz=target.z-u.z,len=Math.hypot(dx,dz)||1,side=P.r()<.5?-1:1;let best=-1,score=Infinity;
 const list=W.playable||[];if(!list.length)return -1;
 for(let k=0;k<16;k++){const i=list[Math.floor(P.r()*list.length)],n=W.nav.nodes[i];if(!n)continue;const ox=n[0]-target.x,oz=n[2]-target.z,d=Math.hypot(ox,oz),lateral=(ox*dz-oz*dx)/len*side;if(d<6||d>24||lateral<2)continue;const s=Math.abs(d-14)-lateral*.3;if(s<score){score=s;best=i;}}
 return best;
}

// ---- Route variety and spacing (shared with the offline client through vendor/bot-routes.cjs) ----
// Routes: the A* route is re-routed once per goal through BotRoutes.route (lanes seeded by bot, round and goal, cost
// added where teammates already walk) and followed from that cache until the goal moves more than 6 m, the bot leaves
// it, or the round changes. At most two re-routes per simulation tick; past that a bot keeps the plain route this tick.
export function variedPath(sim,u,start,goal,find){
 const W=sim.world,N=W.nav.nodes,round=sim.round||0,c=u.vroute;
 if(c&&c.round===round&&c.team===u.team&&N[c.goal]&&N[goal]&&Math.hypot(N[c.goal][0]-N[goal][0],N[c.goal][2]-N[goal][2])<6&&Math.abs(N[c.goal][1]-N[goal][1])<2){
  let k=c.path.indexOf(start,c.i);if(k<0){const q=N[start];for(let j=c.i;j<Math.min(c.path.length,c.i+14);j++){const n=N[c.path[j]];if(Math.hypot(n[0]-q[0],n[2]-q[2])<2.5&&Math.abs(n[1]-q[1])<1.2){k=j;break;}}}
  if(k>=0&&k<c.path.length-1){c.i=k;return c.path.slice(k);}
 }
 const base=find(W,start,goal);if(base.length<4)return base;
 if(sim._vrT!==sim.time){sim._vrT=sim.time;sim._vrN=0;}if(sim._vrN>=2)return base;sim._vrN++;
 const bl=blockedNodes(W),inBase=new Set(base),allowed=W.allowed,peers=[];
 for(const v of sim.units)if(v!==u&&v.alive&&v.team===u.team&&v.vroute&&v.vroute.round===round)peers.push({path:v.vroute.path.slice(v.vroute.i)});
 const r=BotRoutes.route(W.nav,base,u.name+'|'+u.id+'|'+sim.map+'|'+round+'|'+goal,peers,i=>(!allowed||allowed.has(i))&&(!bl[i]||inBase.has(i)),null);
 u.vroute={goal,round,team:u.team,path:r,i:0};sim.routeStats&&sim.routeStats.push(r);return r.slice();
}
// Spacing: while walking a route, a bot steers away from teammates closer than 1.8 m (soft, deterministic right of way).
const SPACE_OUT=[0,0],SPACE_LIST=[];
export function spaceLook(sim,u){SPACE_LIST.length=0;for(const v of sim.units)if(v!==u&&v.alive&&!v.loading&&v.team===u.team&&Math.abs(v.x-u.x)<1.8&&Math.abs(v.z-u.z)<1.8)SPACE_LIST.push(v);if(!SPACE_LIST.length)return;
 const r=BotRoutes.steer(u,SPACE_LIST,-Math.sin(u.look),-Math.cos(u.look),u.id|0,1.8,SPACE_OUT);u.look=Math.atan2(-r[0],-r[1]);}
// Per-round team strategy (Spike), shared decisions with the offline bots (vendor/bot-brain.cjs): attackers pick a site
// and a plan (default, execute, rush, split, fake, lurk, slow) weighted away from what they just ran; defenders pick a
// setup (standard, stack, retake, aggressive early push). Each bot gets its role: delay, staged positions (a point part of
// the way along its own path to a site, held until a round time), lurker / fake group / rotator / off-angle flags.
export function strategy(sim,team){
 const round=sim.round||0,key=sim.map+'|'+round+'|'+team;sim._strat||(sim._strat={});const S=sim._strat[team];if(S&&S.key===key)return S;
 const sites=Object.keys(sim.world.map.sites),atk=team===sim.atk,seed=BotBrain.hash(botSeed(sim)+'|'+key),log=(sim.stratLog||(sim.stratLog=[[],[]]))[team]||(sim.stratLog[team]=[]);
 const ctx={eco:sim.teamCall&&sim.teamCall[team],last:log.slice(-4)};
 const plan=atk?BotBrain.attackPlan(seed,sites,ctx):BotBrain.defensePlan(seed,sites,ctx);
 const members=sim.units.filter(v=>!v.human&&v.team===team).sort((a,b)=>BotRoutes.hash(a.name+'|'+a.id+'|'+key)-BotRoutes.hash(b.name+'|'+b.id+'|'+key));
 const sp=sim.spike||{},ci=atk?members.findIndex(v=>v.id===sp.carrier):-1,R=BotBrain.roles(plan,members.length,seed^0x9e3779b9,atk,sites,ci),roles=new Map();members.forEach((v,k)=>roles.set(v.id,R[k]));
 log.push({type:plan.type,site:plan.site||plan.stack});if(log.length>8)log.shift();
 return sim._strat[team]={key,plan,roles,members};
}
export function plan(sim,u){
 const round=sim.round||0;if(u.plan&&u.plan.round===round&&u.plan.team===u.team)return u.plan;
 const key=sim.map+'|'+round+'|'+u.team,rand=BotRoutes.rng(BotRoutes.hash(u.name+'|'+u.id+'|'+key+'|'+botSeed(sim))),atk=u.team===sim.atk,S=strategy(sim,u.team);
 const role=S.roles.get(u.id)||{site:atk?(sim.spike||{}).site:Object.keys(sim.world.map.sites)[0],stages:[],delay:0};
 const out={round,team:u.team,rand,role,strat:S.plan.type,lurk:!!role.lurk,site:role.site,stages:role.stages.map(g=>({...g,node:-1})),spot:-1,spotSite:null,post:-1,post0:null,delay:role.delay||0,walk:!!role.walk};
 if(role.lurk){out.lurkSite=role.stages[0].site;out.lurkUntil=100-role.stages[0].until;}
 return u.plan=out;
}
// Round time (seconds since the buy phase ended) for stage timings.
export const roundTime=sim=>100-(sim.remaining??100);
// The node part of the way along a bot's own path from its spawn to a site (frac 1 = the site): a reachable "default"
// position, a fake / lurk spot, an aggressive defender's push spot (from 'atk': from the site toward the attackers).
export function stageNode(sim,u,g,find){
 if(g.node>=0)return g.node;const W=sim.world,N=W.nav.nodes;if(g.site==='mid'&&g.avoid&&g.alt){const m=sitePoint(sim,'mid'),c=W.map.sites[g.avoid];if(m&&c&&Math.hypot(m[0]-c[0],m[2]-c[2])<20)g.site=g.alt;}/* the middle is the plan's own site (Haven / Lotus B): map control goes the other way */
 const site=sitePoint(sim,g.site);if(!site)return g.node=-2;
 // the path starts from the team's own spawn (not wherever the bot stands), so an entry, its trade partner and an execute
 // line share one path and `back` spaces them along it exactly (bots-spread-1)
 const atk=u.team===sim.atk,base=g.from==='atk'?W.map.attacker:g.from==='def'?W.map.defender:atk?W.map.attacker:W.map.defender,a=base?W.near(base[0],base[2],base[1]):W.near(u.x,u.z,u.y),b=W.near(site[0],site[2],site[1]);
 const p=g.from==='atk'?find(W,b,a):find(W,a,b);if(!p||p.length<2)return g.node=-2;
 let L=0;for(let k=1;k<p.length;k++)L+=Math.hypot(N[p[k]][0]-N[p[k-1]][0],N[p[k]][2]-N[p[k-1]][2]);
 const back=g.back||0,want=g.from==='atk'?Math.min(L,L*g.frac+back):Math.max(0,L*g.frac-back);let d=0,k=1;for(;k<p.length;k++){d+=Math.hypot(N[p[k]][0]-N[p[k-1]][0],N[p[k]][2]-N[p[k-1]][2]);if(d>=want)break;}
 let i=p[Math.min(k,p.length-1)];
 // a little spread so two bots on the same stage do not stand on one node: kept off the teammates' stage spots
 const taken=[];for(const v of sim.units){if(v===u||v.team!==u.team||!v.plan||v.plan.round!==u.plan.round)continue;for(const h of v.plan.stages||[])if(h.node>=0)taken.push(N[h.node]);}
 const q=BotRoutes.spot(W.nav,N[i],taken,u.plan.rand,{rMin:0,rMax:2,gap:2.5,ok:j=>!W.allowed||W.allowed.has(j)});if(q>=0)i=q;
 return g.node=i;
}
// A stage's target point: a site, or 'mid' = the map's middle (BotBrain.midPoint, snapped to a playable nav node; cached).
export function sitePoint(sim,name){const W=sim.world,M=W.map;if(name!=='mid')return M.sites[name];if(W._botMid)return W._botMid;
 const p=BotBrain.midPoint(M.sites,M.attacker,M.defender),N=W.nav.nodes;let best=-1,bd=Infinity;for(const i of W.playable||[]){const n=N[i];if(W.allowed&&!W.allowed.has(i))continue;const v=Math.hypot(n[0]-p[0],n[2]-p[2])+Math.abs(n[1]-p[1])*3;if(v<bd){bd=v;best=i;}}
 return W._botMid=best>=0?[N[best][0],N[best][1],N[best][2]]:p;}
export function spotNear(sim,u,center,field,o){
 const W=sim.world,bl=blockedNodes(W),taken=[];for(const v of sim.units)if(v!==u&&v.team===u.team&&v.plan&&v.plan.round===u.plan.round&&v.plan[field]>=0)taken.push(W.nav.nodes[v.plan[field]]);
 const also=o&&o.also;return BotRoutes.spot(W.nav,center,taken,u.plan.rand,Object.assign({},o,{ok:i=>(!W.allowed||W.allowed.has(i))&&!bl[i]&&(!also||also(i))})); // o.also: an extra node filter (post-plant: sight of the Spike)
}

// ---- Buy phase: bots mill around spawn, then line up at the spawn barrier (shared logic vendor/bot-brain.cjs buy*,
// the offline bots run the same in work/bot_variety_runtime.js xbbTick). After the instant buy (autoBuy, unchanged) a
// bot stands a moment (the buy menu), walks a few short legs around its spawn with pauses and look-arounds, then walks to
// a spot 0.55-0.95 m inside the spawn wall (vendor/spawn-barriers.cjs: Valorant's barrier panels in the spawn's real
// exits) its planned route (round strategy: stage / site) crosses, staggered 0.9 m+ from its teammates' spots, faces out
// along that route and peeks a little along the wall until it drops. It walks only on the spawn's own nav region (never
// across a wall, 0.5 m+ from every wall); the walls are solid for it like for everyone (spike.js world.blocked) and a
// move that would end within BUY_IN of one goes back (buyClamp), so it never touches or crosses them. sim.buyMill=false
// turns it off (bots then stand at their spawn spot as before).
const BUY_IN=.42;
export function buyWalls(sim,team){const W=sim.world,side=team===sim.atk?'atk':'def';return SpawnBarriers.pieces(W.map.key).filter(p=>p.side===side);}
function buyTeam(sim,team){
 const W=sim.world,M=W.map,atk=team===sim.atk,key=sim.map+'|'+(sim.round||0)+'|'+team+'|'+(atk?1:0),T=(sim._buyT||(sim._buyT={}));
 if(T[team]&&T[team].key===key)return T[team];
 const anchor=atk?M.attacker:M.defender,walls=buyWalls(sim,team),N=W.nav.nodes,start=W.near(anchor[0],anchor[2],anchor[1]);
 const area=BotBrain.buyArea(N,W.nav.adj,start,walls,i=>!W.allowed||W.allowed.has(i));
 return T[team]={key,walls,area,spots:[],bl:blockedNodes(W)};
}
const BUY_RING=[[.15,0],[-.15,0],[0,.15],[0,-.15]];
function buyOk(W,A,y0){return (x,z)=>{const nr=BotBrain.buyNear(A.walls,x,z);if(nr&&(nr.d<BUY_IN+.05||!nr.inside&&nr.d<1.5))return null;const i=W.near(x,z,y0);if(i<0||!A.area.f[i])return null;const n=W.nav.nodes[i];if(Math.hypot(n[0]-x,n[2]-z)>.9||Math.abs(n[1]-y0)>2.5)return null;
 const y=W.ground(x,z,n[1]+.3);if(!(Math.abs(y-n[1])<.45)||W.blocked(x,z,.5,y,1.8))return null;for(const o of BUY_RING)if(W.blocked(x+o[0],z+o[1],.4,y,1.8))return null;/* = page xbbOk: no step lip within the arrival slack */if(W.leash&&!W.leash(x,z,y,n[0],n[2]))return null;
 for(let k=1;k<4;k++){const t=k/4;if(W.blocked(n[0]+(x-n[0])*t,n[2]+(z-n[2])*t,.4,y,1.8))return null;}return [y,i];};}
function buyInit(sim,u){
 const W=sim.world,N=W.nav.nodes,A=buyTeam(sim,u.team),key=A.key;if(u.buyMill&&u.buyMill.key===key)return u.buyMill;
 const rand=BotBrain.rng(BotBrain.hash('buy|'+u.name+'|'+u.id+'|'+key+'|'+botSeed(sim))),start=W.near(u.x,u.z,u.y),out={key,st:BotBrain.buyNew(persona(sim,u).brain,rand),spot:null,face:[0,u.team===sim.atk?-1:1],route:[],rg:null,stuck:0,last:[u.x,u.z],off:!A.area.f[start]||!A.walls.length};
 if(!out.off){
  // the bot's first round goal: the strategy's first staged position (its site) or its site; the full-map route there
  const L=plan(sim,u),atk=u.team===sim.atk,g=L.stages&&L.stages[0]?L.stages[0].site:atk?(sim.spike||{}).site:L.site,site=(g==='mid'?sitePoint(sim,'mid'):W.map.sites[g])||W.map.sites[Object.keys(W.map.sites)[0]];/* a mid player lines up at the exit toward mid */
  const path=site?sim.findPath(W,start,W.near(site[0],site[2],site[1])):null;let ex=site?BotBrain.buyExit(N,path,A.walls):null;
  /* its goal inside its own area (a defender's own site): it walks there and holds instead of lining up */
  const h=!ex&&BotBrain.buyHold(N,path,A.area,A.walls,A.spots,(x,z,y)=>buyOk(W,A,y)(x,z),i=>!!A.bl[i]);if(h){out.spot=h.p;out.node=h.node;out.hold=true;A.spots.push(h.p);out.face=h.face;return u.buyMill=out;}
  if(!ex){/* no route out through a wall: the wall nearest the bot */const nr=BotBrain.buyNear(A.walls,u.x,u.z),w=nr.w;ex={x:w.ax+w.tx*nr.t,y:w.y0!=null?w.y0+.4:u.y,z:w.az+w.tz*nr.t,dx:-w.nx,dz:-w.nz,w};/* the wall's floor, not the bot's (a far wall can sit on another level) */}
  const sp=BotBrain.buySpot(ex,A.walls,A.spots,rand,buyOk(W,A,ex.y));
  if(sp){out.spot=sp.p;out.node=sp.node;A.spots.push(sp.p);out.face=[ex.dx,ex.dz];}
 }
 return u.buyMill=out;
}
// One buy-phase tick for bot u -> movement {x, z, walk} (a world-space unit vector or zero; the caller runs the motor).
const BUY_V=[0,0];
export function buyMill(sim,u,dt){
 if(sim.buyMill===false)return null;const W=sim.world,M=W.map;if(!M||!M.attacker||!M.defender||!W.nav)return null;
 const B=buyInit(sim,u);if(B.off){u.input={};u.inputAt=sim.time;return null;}
 const A=buyTeam(sim,u.team),N=W.nav.nodes,mates=sim.units.filter(v=>v!==u&&v.alive&&v.team===u.team);
 const c={dt,left:sim.buy,pos:[u.x,u.z],spot:B.spot,face:B.face,
  wander:()=>{const av=mates.map(v=>[v.x,v.z]);for(const v of mates){const g=v.buyMill&&v.buyMill.st.goal;if(g)av.push([g[0],g[2]]);}const i=BotBrain.buyWander(N,A.area,[u.x,u.z],B.st.rand,av,A.walls,j=>!A.bl[j]);return i>=0?N[i]:null;},
  free:(x,z)=>!!buyOk(W,A,u.y)(x,z)&&mates.every(v=>{const m=v.buyMill,q=m&&m.spot,g=m&&m.st.goal;return Math.hypot(v.x-x,v.z-z)>1.05&&!(q&&Math.hypot(q[0]-x,q[2]-z)<1.05)&&!(g&&Math.hypot(g[0]-x,g[2]-z)<1.05);})};/* a peek never steps toward where a teammate stands, will stand or is peeking */
 const d=BotBrain.buyTick(B.st,c);u.inputAt=sim.time;
 if(d.face)u.look=BotBrain.turnStep(persona(sim,u).brain,u.look||0,Math.atan2(-d.face[0],-d.face[1]),dt*.6).yaw;
 if(!d.goal){B.rg=null;B.route.length=0;B.stuck=0;u.input={};return {x:0,z:0,walk:false};}
 const g=d.goal;if(B.rg!==g){B.rg=g;const a=W.near(u.x,u.z,u.y),b=W.near(g[0],g[2],g[1]);const occ=[];for(const v of mates){occ.push([v.x,v.z]);if(v.buyMill&&v.buyMill.spot)occ.push([v.buyMill.spot[0],v.buyMill.spot[2]]);}/* walk around teammates and their spots, not through them */B.route=BotBrain.buyRoute(N,W.nav.adj,A.area,a,b,i=>(A.bl[i]?8:0)+(B.bad&&B.bad.has(i)?6:0)+(occ.some(o=>Math.abs(o[0]-N[i][0])<1.1&&Math.abs(o[1]-N[i][2])<1.1)?5:0));B.stuck=0;B.last=[u.x,u.z];}
 // no progress for 0.6 s (a prop corner the motor cannot slide past): re-route around the next node (it costs 6 m
 // more from now on) after a short sidestep in the free direction nearest the goal's; a wander leg that keeps failing ends
 if(Math.hypot(u.x-B.last[0],u.z-B.last[1])>.25){B.last=[u.x,u.z];B.stuck=0;}else if((B.stuck+=dt)>.6){B.stuck=0;if(B.route.length)(B.bad||(B.bad=new Set())).add(B.route[0]);B.rg=null;B.fails=(B.fails||0)+1;if(B.st.mode==='mill'&&B.fails>1)B.st.legT=99;
  const gx=g[0]-u.x,gz=g[2]-u.z,gl=Math.hypot(gx,gz)||1;let best=null,bd=-2;for(let k=0;k<16;k++){const a=k*Math.PI/8,ex=Math.sin(a),ez=Math.cos(a);if(W.blocked(u.x+ex*.3,u.z+ez*.3,.4,u.y,1.8)||buyTooClose(A.walls,u.x+ex*.3,u.z+ez*.3))continue;const dot=(ex*gx+ez*gz)/gl;if(dot>bd){bd=dot;best=[ex,ez];}}
  if(best)B.esc={v:best,until:sim.time+.3};
  // the way to its barrier spot is shut (a one-wide corridor of teammates): it takes the nearest free spot from here instead
  if(B.st.mode==='go'&&B.fails>=2&&B.spot&&!B.hold){const k=A.spots.indexOf(B.spot),rest=A.spots.filter(p=>p!==B.spot),nr=BotBrain.buyNear(A.walls,u.x,u.z),sp=nr&&BotBrain.buySpot({x:nr.w.ax+nr.w.tx*nr.t,z:nr.w.az+nr.w.tz*nr.t,w:nr.w},A.walls,rest,B.st.rand,buyOk(W,A,u.y));if(sp&&Math.hypot(sp.p[0]-u.x,sp.p[2]-u.z)<Math.hypot(B.spot[0]-u.x,B.spot[2]-u.z)){if(k>=0)A.spots[k]=sp.p;B.spot=sp.p;B.node=sp.node;B.fails=0;}}}
 if(B.esc&&sim.time<B.esc.until){u.input={forward:1,walk:false};return {x:B.esc.v[0],z:B.esc.v[1],walk:false};}
 const t=BotBrain.buyNext(N,B.route,u.x,u.z,g[0],g[2],BUY_V),l0=Math.hypot(t[0]-u.x,t[1]-u.z)||1,v=BotBrain.buySep(u.x,u.z,mates.map(m=>[m.x,m.z]),(t[0]-u.x)/l0,(t[1]-u.z)/l0,BUY_V),dx=v[0],dz=v[1],l=Math.hypot(dx,dz)||1;
 if(!d.face)u.look=BotBrain.turnStep(persona(sim,u).brain,u.look||0,Math.atan2(-dx,-dz),dt).yaw;
 u.input={forward:1,walk:!!d.walk};return {x:dx/l,z:dz/l,walk:!!d.walk};
}
// After the motor: a bot never ends within BUY_IN m of (or past) a spawn wall: such a move goes back.
function buyTooClose(walls,x,z){const nr=BotBrain.buyNear(walls,x,z);return !!nr&&(nr.d<BUY_IN||!nr.inside&&nr.d<1.5);}
export function buyClamp(sim,u,old){
 if(!u.buyMill||u.buyMill.off)return;const A=buyTeam(sim,u.team);if(!buyTooClose(A.walls,u.x,u.z))return;[u.x,u.y,u.z]=old;u.vx=u.vz=0;
}
// Round start: the round's own bot logic takes over from wherever the bot stands.
export function buyEnd(sim){for(const u of sim.units){if(u.human||!u.buyMill)continue;u.buyMill=null;u.input={};}}
// ---- Perception (bots-perception-2, vendor/bot-brain.cjs SENSE) ----
// Once per simulation time: what every bot hears. A gunshot (map-wide; Ghost / Spectre / Phantom within 40 m), an ability
// cast within 30 m, running footsteps within 30 m (Simulation.loud: walking / crouching are silent), anyone within 2 m. A
// heard enemy goes into the bot's memory (u.mem) at a spot off by up to 8 % of the range (BotBrain.earSpot); contacts of
// dead enemies are dropped. Sight is noted by Simulation.bot itself.
const HEARD_CAST=new WeakSet();
const ear=(a,b,t,k)=>BotBrain.hash(a+'|'+b+'|'+Math.round(t*10)+'|'+k)/4294967296;
export function hearTick(sim){if(sim._hearT===sim.time)return;sim._hearT=sim.time;const U=sim.units,now=sim.time;
 for(const e of sim.castEvents||[])if(e&&typeof e==='object'&&e.t==='ac'&&!HEARD_CAST.has(e)){HEARD_CAST.add(e);const c=U.find(v=>v.id===e.i);if(c)c.castAt=now;}
 for(const m of U){if(m.human||!m.alive||m.loading)continue;const mem=m.mem||(m.mem=BotBrain.memNew());
  for(const id in mem.c){const v=U.find(w=>String(w.id)===id);if(!v||!v.alive)delete mem.c[id];}
  for(const e of U){if(e===m||!e.alive||e.loading||(sim.mode!=='dm'&&e.team===m.team))continue;const d=Math.hypot(e.x-m.x,e.z-m.z,e.y-m.y);let k=null;
   if(e.shotAt>now-.12&&BotBrain.audible('shot',d,e.weapon))k='shot';else if(e.castAt>now-.12&&BotBrain.audible('cast',d))k='cast';else if(BotBrain.audible('near',d))k='near';else if(BotBrain.audible('step',d)&&typeof sim.loud==='function'&&sim.loud(e))k='step';
   if(!k)continue;const p=BotBrain.earSpot(e.x,e.z,m.x,m.z,ear(m.id,e.id,now,1),ear(m.id,e.id,now,2));const c=BotBrain.memNote(mem,e.id,p[0],e.y,p[1],now,'heard');if(c.kind==='heard')c.how=k;}}}
// After a bot's tick (not in a fight): its view turns at its own turn rate (BotBrain.turnStep: no snap onto a path heading,
// no instant 180) toward the freshest contact it heard or last saw within BotBrain.SENSE.glance s (the crosshair waits on that
// spot at head height: a re-peek there is pre-aimed), else along its way. The movement keeps its world direction:
// forward / side are re-expressed in the new view.
export function botView(sim,u,L0,dt){if(u.human||!u.alive||u.sawTarget||!u.input||!Number.isFinite(L0)||!(dt>0))return;const P=persona(sim,u),B=P.brain;
 let want=u.look;const c=u.mem&&BotBrain.memBest(u.mem,sim.time,u.x,u.z,BotBrain.SENSE.glance),cd=c?Math.hypot(c.x-u.x,c.z-u.z):0;
 if(c&&cd>.8&&cd<45){want=Math.atan2(u.x-c.x,u.z-c.z);u.pitch=Math.atan2((c.y??u.y)+BotBrain.AIM_H.head-(u.y+1.6-(u.ch||0)),cd)+BotBrain.idlePitch(B)-Math.atan2(BotBrain.AIM_H.head-1.6,15);u.viewAt=c.id;}else u.viewAt=null;
 if(!Number.isFinite(want))return;const L=u.look,V=BotBrain.wrapA(BotBrain.turnStep(B,L0,want,dt).yaw),f=u.input.forward||0,s=u.input.side||0;u.look=V;
 if(f||s){const wx=-Math.sin(L)*f+Math.cos(L)*s,wz=-Math.cos(L)*f-Math.sin(L)*s;u.input.forward=-Math.sin(V)*wx-Math.cos(V)*wz;u.input.side=Math.cos(V)*wx-Math.sin(V)*wz;}}
