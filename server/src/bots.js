import BotRoutes from '../../vendor/bot-routes.cjs';
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
 return u.persona={seed,role,r,
  react:pick(r,P.react),aim:pick(r,P.aim),range:[P.range[0]*(.85+r()*.3),P.range[1]*(.85+r()*.3)],
  strafeAmp:pick(r,P.strafe),strafeFreq:1.1+r()*1.8,strafePhase:r()*Math.PI*2,strafe:jig?'jiggle':strafeTypes[Math.floor(r()*2)],
  crouch:r()<P.crouch,crouchRange:8+r()*10,head:P.head,hold:P.hold,flank:r()<P.flank,walk:r()<P.walk,
  repath:.8+r()*.9,accept:.35+r()*.45,jitter:.15+r()*.5,jitterPhase:r()*Math.PI*2,
  aimF:[.7+r()*1.6,2.1+r()*2.4],aimP:[r()*6.283,r()*6.283,r()*6.283,r()*6.283],util:pick(r,P.util)};
}
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
// Per-round plans (Spike): an own standing spot inside the site for every bot, staggered starts by role, at most one
// lurker holding the other site until late in the round, defenders spread round-robin over a per-round shuffled order.
export function plan(sim,u){
 const W=sim.world,round=sim.round||0;if(u.plan&&u.plan.round===round&&u.plan.team===u.team)return u.plan;
 const P=persona(sim,u),sites=Object.keys(W.map.sites),key=sim.map+'|'+round+'|'+u.team,rand=BotRoutes.rng(BotRoutes.hash(u.name+'|'+u.id+'|'+key)),atk=u.team===sim.atk,sp=sim.spike||{};
 const team=sim.units.filter(v=>!v.human&&v.team===u.team).sort((a,b)=>BotRoutes.hash(a.name+'|'+a.id+'|'+key)-BotRoutes.hash(b.name+'|'+b.id+'|'+key));
 const out={round,team:u.team,rand,lurk:false,site:null,spot:-1,spotSite:null,post:-1,post0:null,delay:0};
 if(atk){
  out.delay=P.role==='entry'?0:P.role==='lurker'?1.2+rand()*1.6:.3+rand()*1.4;
  const lurker=team.find(v=>v.id!==sp.carrier&&persona(sim,v).role==='lurker');
  if(lurker===u&&sites.length>1&&team.length>=3){out.lurk=true;const other=sites.filter(n=>n!==sp.site);out.site=other[Math.floor(rand()*other.length)];out.lurkUntil=25+rand()*15;}else out.site=sp.site;
 }else out.site=sites[(team.indexOf(u)+BotRoutes.hash(key)%sites.length)%sites.length];
 return u.plan=out;
}
export function spotNear(sim,u,center,field,o){
 const W=sim.world,bl=blockedNodes(W),taken=[];for(const v of sim.units)if(v!==u&&v.team===u.team&&v.plan&&v.plan.round===u.plan.round&&v.plan[field]>=0)taken.push(W.nav.nodes[v.plan[field]]);
 return BotRoutes.spot(W.nav,center,taken,u.plan.rand,Object.assign({ok:i=>(!W.allowed||W.allowed.has(i))&&!bl[i]},o));
}
