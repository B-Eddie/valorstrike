import BotRoutes from '../../vendor/bot-routes.cjs';
import BotBrain from '../../vendor/bot-brain.cjs';
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
 if(g.node>=0)return g.node;const W=sim.world,N=W.nav.nodes,site=W.map.sites[g.site];if(!site)return g.node=-2;
 const base=g.from==='atk'?W.map.attacker:g.from==='def'?W.map.defender:null,a=base?W.near(base[0],base[2],base[1]):W.near(u.x,u.z,u.y),b=W.near(site[0],site[2],site[1]);
 const p=g.from==='atk'?find(W,b,a):find(W,a,b);if(!p||p.length<2)return g.node=-2;
 let L=0;for(let k=1;k<p.length;k++)L+=Math.hypot(N[p[k]][0]-N[p[k-1]][0],N[p[k]][2]-N[p[k-1]][2]);
 const want=L*(g.from==='atk'?g.frac:g.frac);let d=0,k=1;for(;k<p.length;k++){d+=Math.hypot(N[p[k]][0]-N[p[k-1]][0],N[p[k]][2]-N[p[k-1]][2]);if(d>=want)break;}
 let i=p[Math.min(k,p.length-1)];
 // a little spread so two bots on the same stage do not stand on one node
 const q=BotRoutes.spot(W.nav,N[i],[],u.plan.rand,{rMin:0,rMax:3,gap:0,ok:j=>!W.allowed||W.allowed.has(j)});if(q>=0)i=q;
 return g.node=i;
}
export function spotNear(sim,u,center,field,o){
 const W=sim.world,bl=blockedNodes(W),taken=[];for(const v of sim.units)if(v!==u&&v.team===u.team&&v.plan&&v.plan.round===u.plan.round&&v.plan[field]>=0)taken.push(W.nav.nodes[v.plan[field]]);
 const also=o&&o.also;return BotRoutes.spot(W.nav,center,taken,u.plan.rand,Object.assign({},o,{ok:i=>(!W.allowed||W.allowed.has(i))&&!bl[i]&&(!also||also(i))})); // o.also: an extra node filter (post-plant: sight of the Spike)
}
