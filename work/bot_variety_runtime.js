// ---- BOT VARIETY ----
// Native-map 5v5 bots stop moving as one blob: per-round plans (own spot inside the site, one lurker on the other site,
// staggered starts by personality, shuffled defender sites with spread holds), lane-varied routes from the shared
// vendor/bot-routes.cjs (seeded per bot and round, penalised where teammates already walk) and teammate spacing while
// moving. Combat, the carrier's plant goal, retakes/defuses and dropped-Spike pickups keep their exact goals.
// Human-like decisions (vendor/bot-brain.cjs, the same module the server bots use; inlined after BotRoutes): a stable
// per-bot personality for the match, a reaction drawn per fight (180-320 ms around the bot's mean, scaled by difficulty),
// crosshair error that settles while tracking, round strategies (attack: default / execute / rush / split / fake / lurk /
// slow; defence: standard / stack / retake / aggressive), defenders rotating on information, a team economy call.
// Seeded: window.xBotSeed fixes the match seed (tests); otherwise a fresh one each match.
var XBV={k:'',plans:new Map(),oth:[],sv:[0,0],budget:{f:-1,n:0},seed:0,fresh:false,brains:new Map(),strat:new Map(),log:{a:[],d:[]},info:null,infoF:-1,call:{}};
function xbvSeed(){if(window.xBotSeed!=null)return window.xBotSeed>>>0;if(FV.you+FV.them===0){if(!XBV.fresh){XBV.fresh=true;XBV.seed=(Math.random()*4294967296)>>>0;XBV.brains.clear();XBV.log={a:[],d:[]};}}else XBV.fresh=false;return XBV.seed;}
function xbBrain(u){if(!u||!window.BotBrain)return null;const sd=xbvSeed();if(u.brain&&u.brainS===sd)return u.brain;const k=(u.name||'')+'|'+sd;let b=XBV.brains.get(k);if(!b){b=BotBrain.personality(BotBrain.hash(k));XBV.brains.set(k,b);}u.brainS=sd;return u.brain=b;}
function xbRand(u){return u.xbr||(u.xbr=BotRoutes.rng(BotRoutes.hash((u.name||'')+'|r|'+xbvSeed()+'|'+xbvKey())));}
// a new fight: reaction (s), crosshair error (smaller when the crosshair was already on the angle), stand-still time before strafing.
// ctx (enemy bots, bots-human-1): {off: |view - enemy| rad, e0y: view minus enemy yaw (signed), d: m, flashed} -> the human aim
// model shared with the server (BotBrain.reaction with off-angle / flash costs, aimPlan flick from where the bot was looking,
// aimHeight body spot, recoilPull, discipline: a sloppy fight fires before the counter-strafe has stopped it).
function xbLvl(){try{return S&&S.diff||'normal';}catch(e){return 'normal';}}
function xbEngage(u,pre,ctx){const B=xbBrain(u);if(!B){u.rtE=.26;u.xhE=null;u.stand=.35;u.xbAP=null;return;}const r=xbRand(u);
 if(ctx){const L=xbLvl(),k=(BotBrain.LEVEL[L]||BotBrain.LEVEL.normal).rt;u.rtE=BotBrain.reaction(B,r,{pre:!!pre,off:ctx.off,flashed:!!ctx.flashed});u.xhE=BotBrain.crosshair(B,r,!!pre);
  u.xbSpot=BotBrain.aimHeight(B,r,L);const d=ctx.d||15,h=BotBrain.AIM_H[u.xbSpot]||1.3;u.xbAP=BotBrain.aimPlan(B,r,ctx.e0y||0,BotBrain.idlePitch(B)-Math.atan2(h-1.6,d),d,{start:u.rtE*k,level:L});
  u.xbPull=BotBrain.recoilPull(B,L);u.xbSl=r()>BotBrain.discipline(B,L);u.stand=B.stand*(.8+r()*.4);u.rtX=1;return;}
 u.rtE=BotBrain.reaction(B,r);u.xhE=BotBrain.crosshair(B,r,!!pre);u.xbAP=null;u.rtX=0;u.stand=B.stand*(.8+r()*.4);}
// reaction gate in ms for difficulty D (normal = the bot's own 180-320 ms draw; +150 ms when it was not pre-aimed). With the
// human aim model (rtX) the draw already holds the off-angle cost.
function xbRt(u,D){const k=(D&&D.rt?D.rt:260)/260;return ((u.rtE||.26)*1000+(u.pre||u.rtX?0:150))*k;}
// A new trigger pull's length and the pause after it (bots-tune-1): BotBrain.firePattern, the server's tap / burst / spray
// mix by range band (semi-auto guns tap); b.xbPz = the pause in s (scaled by the difficulty's cd in the base loop).
function xbBurst(u,d,W){const B=window.BotBrain&&xbBrain(u);if(!B){u.xbPz=null;return d>20?3+Math.floor(Math.random()*3):6+Math.floor(Math.random()*5);}
 const f=BotBrain.firePattern(B,xbRand(u),d,!(W&&W.semi));u.xbPz=f.pause;u.xbPat=f.kind;return f.shots;}
// Visible yaw while fighting: the planned flick (min-jerk, overshoot, correction) at the bot's own turn rate, not a snap.
function xbFaceAim(u,want,dt){const B=xbBrain(u);if(!B||!u.xbAP||!u.g)return want;const e=BotBrain.aimAt(u.xbAP,u.see||0,XB_E);return BotBrain.turnStep(B,u.g.rotation.y,want+e[0],dt,u.xTurnSt||(u.xTurnSt={v:0})).yaw;}
// A new trigger pull: once the bot believes it is on target (end of its flick / correction) or the crosshair passes close.
function xbReady(u,d){if(!u.xbAP)return true;const e=BotBrain.aimAt(u.xbAP,u.see||0,XB_E);return BotBrain.readyToFire(u.xbAP,Math.hypot(e[0],e[1]),d,u.see||0);}
// One shot of an enemy bot with the human aim model: the crosshair sits at the fight's body spot (head / neck / chest) on the
// target's real height (crouch lowers it), spread + spray climb (bSpread, minus the share this bot pulls down), the planned
// flick error and the tracking lag; the ray is then tested against the server's hit volumes (BotBrain.hitPart) at the
// target. Returns 'head' | 'body' | 'legs' | null (miss).
function xbShot(u,tg,from,w,W,d,D){const B=xbBrain(u);if(!B||!u.xbAP)return undefined;const t=tg.t,pl=t===player,fy=pl?(player.y||0):t&&t.g?t.g.position.y:0,ch=pl?(player.ch||0):t&&t.cr?.28:0;
 const h=BotBrain.AIM_H[u.xbSpot]||1.3,aim=(XB_AIM||(XB_AIM=new THREE.Vector3())).set(tg.x-from.x,fy+h-ch*h/1.8-from.y,tg.z-from.z).normalize();
 const sn=u.sn||0;bSpread(u,w,W,aim,d,D);/* spread + uncontrolled climb ... */if(u.xbPull&&sn>0){const k=D&&D.ae?D.ae/1.3:1,r=w==='Vandal'?1:w==='Phantom'?.7:0,ck=u.cr&&!u.mv?.85:1,vy=ck*(r?Math.min(sn,6)*.0065*r:Math.min(sn,6)*.004*(W.rec||1))*k*.6;aim.y-=vy*u.xbPull*BotBrain.sprayFade(sn);/* control fades over a long spray (BotBrain.sprayFade, = server sprayPull) */aim.normalize();}/* ... minus the part this bot drags down */
 const e=BotBrain.aimAt(u.xbAP,u.see||0,XB_E),yaw=Math.atan2(aim.x,aim.z),tm=performance.now()/1000;let lg=0;if(u.xaT!=null&&tm>u.xaT&&tm-u.xaT<.5){const wv=Math.atan2(Math.sin(yaw-u.xaY),Math.cos(yaw-u.xaY))/(tm-u.xaT);lg=Math.max(-3,Math.min(3,wv))*BotBrain.trackLag(B,u.see||0);}u.xaY=yaw;u.xaT=tm;u.xLag=lg;
 const hl=Math.hypot(aim.x,aim.z)||1,hx=-aim.z/hl,hz=aim.x/hl,ey=-e[0]+lg;/* yaw + plan error, minus the lag */aim.x+=hx*ey;aim.z+=hz*ey;aim.y+=e[1];aim.normalize();
 const dx=tg.x-from.x,dz=tg.z-from.z,ah=Math.hypot(aim.x,aim.z)||1e-6,s=(dx*aim.x+dz*aim.z)/ah;if(s<=0)return null;const k2=s/ah,qx=from.x+aim.x*k2,qy=from.y+aim.y*k2,qz=from.z+aim.z*k2;
 const lat=Math.hypot(qx-tg.x,qz-tg.z);return BotBrain.hitPart(lat,qy-fy,ch);}
var XB_AIM=null; // scratch vector, made on first use (the block also runs without THREE in tests)
const XB_E=[0,0];
// settle the crosshair error onto a shot direction (yaw around up, pitch on y), scaled by the difficulty aim error
// + tracking lag (BotBrain.trackLag, as the server): the shot runs behind a target that moves across the crosshair (the aim
// yaw's turn rate since the bot's previous shot times the lag), so strafing targets get missed until the crosshair catches up
function xbAimErr(u,aim,D){if(!u||!u.xhE)return;const B=xbBrain(u);if(!B)return;const e=BotBrain.crosshairAt(u.xhE,B,u.see||u.ts||0,XB_E),k=D&&D.ae?D.ae/1.3:1,hl=Math.hypot(aim.x,aim.z)||1,hx=-aim.z/hl,hz=aim.x/hl;
 const yaw=Math.atan2(aim.x,aim.z),t=performance.now()/1000;let lg=0;if(u.xaT!=null&&t>u.xaT&&t-u.xaT<.5){const w=Math.atan2(Math.sin(yaw-u.xaY),Math.cos(yaw-u.xaY))/(t-u.xaT);lg=Math.max(-3,Math.min(3,w))*BotBrain.trackLag(B,u.see||u.ts||0);}u.xaY=yaw;u.xaT=t;u.xLag=lg;
 aim.x+=hx*(e[0]*k+lg);aim.z+=hz*(e[0]*k+lg);aim.y+=e[1]*k;aim.normalize();}
function xbvKey(){return FV.you+'|'+FV.them+'|'+FV.map+'|'+(FV.atk?1:0);}
function xbvTeamTaken(team,u,field){const out=[];for(const v of team){if(v===u)continue;const q=XBV.plans.get(v);if(q&&q[field])out.push(q[field]);}return out;}
// one spread standing spot near a site centre; null when the nav has nothing better than the centre itself
function xbvSpot(C,center,taken,rand,o){const i=BotRoutes.spot(C.nav,center,taken,rand,Object.assign({ok:j=>!C.playable||!!C.playable[j]},o));if(i<0)return null;const p=C.nav.nodes[i];return [p[0],p[1],p[2]];}
// Team strategy for the round (shared BotBrain decisions); a bot carrier is sent to the strategy's site.
function xbvStrat(team,atk,C){
 const k=xbvKey()+'|'+(atk?'a':'d');let S=XBV.strat.get(k);if(S)return S;
 const SS=C?C.meta.sites:SITES,names=Object.keys(SS).filter(n=>/^[ABC]$/.test(n)),seed=BotRoutes.hash(xbvSeed()+'|'+k),log=XBV.log[atk?'a':'d'],s=FV.sp;
 const plan=atk?BotBrain.attackPlan(seed,names,{last:log.slice(-4)}):BotBrain.defensePlan(seed,names,{last:log.slice(-4)});
 const order=team.slice().sort((a,b)=>BotRoutes.hash((a.name||'')+'|'+k)-BotRoutes.hash((b.name||'')+'|'+k)),R=BotBrain.roles(plan,order.length,seed^0x9e3779b9,atk,names,atk?order.indexOf(s.c):-1),roles=new Map();
 order.forEach((v,i)=>roles.set(v,R[i]));log.push({type:plan.type,site:plan.site||plan.stack});if(log.length>8)log.shift();
 if(atk&&s&&s.st==='carry'&&s.c&&s.c!==player&&SS[plan.site])s.site=plan.site;
 S={plan,roles};XBV.strat.set(k,S);if(XBV.strat.size>8)XBV.strat.delete(XBV.strat.keys().next().value);return S;
}
function xbvPlan(u,team,atk,C){
 const k=xbvKey();if(XBV.k!==k){XBV.k=k;XBV.plans.clear();}
 let P=XBV.plans.get(u);if(P)return P;
 const per=u.per||{ag:.5,fl:.5,sd:.5},seed=BotRoutes.hash((u.name||'')+'|'+k+'|'+xbvSeed()),rand=BotRoutes.rng(seed),names=Object.keys(C.meta.sites),S=xbvStrat(team,atk,C);
 const role=S.roles.get(u)||{site:atk?FV.sp.site:names[0],stages:[],delay:0};
 P={seed,rand,go:0,lurk:!!role.lurk,site:role.site,spot:null,post:null,post0:null,role,strat:S.plan.type,stages:(role.stages||[]).map(g=>Object.assign({pt:null},g)),atk,rotD:(BotBrain.RESPOND.delay[0]+rand()*(BotBrain.RESPOND.delay[1]-BotBrain.RESPOND.delay[0]))*1000}; // rotation delay 1.5-4 s (bots-spread-1, as the server)
 XBV.plans.set(u,P);
 // staggered start: the role's delay, a little longer for cautious players (ms)
 P.delay=atk?((role.delay||0)+(1-per.ag)*.6+rand()*.3)*1000:0;
 if(P.lurk){P.lurkSite=role.stages[0].site;P.lurkUntil=100-role.stages[0].until;}
 if(C.meta.sites[P.site])P.spot=xbvSpot(C,xbvSiteCenter(C,P.site,atk),xbvTeamTaken(team,u,'spot'),rand,atk?{rMin:2,rMax:10,gap:4.5}:role.offAngle?{rMin:6,rMax:14,gap:4}:{rMin:2,rMax:10,gap:4});
 P.spotSite=P.site;return P;
}
// A staged position: the point part of the way along the nav path from the team's spawn (or the other team's) to a site or
// 'mid' (the map's middle, xbvMid), `back` m short of it (an entry, its trade partner and an execute line share one path
// and stand GAP m apart along it), kept off the teammates' stage points (bots-spread-1, as the server's stageNode).
function xbvStage(C,u,g,P){
 if(g.pt!==null)return g.pt;g.pt=false;if(g.site==='mid'&&g.avoid&&g.alt){const m=xbvMid(C),c=C.meta.sites[g.avoid];if(m&&c&&Math.hypot(m[0]-c[0],m[2]-c[2])<20)g.site=g.alt;} // the middle is the plan's own site (Haven / Lotus B): map control goes the other way
 if(typeof nmPath!=='function'||!(g.site==='mid'||C.meta.sites[g.site]))return false;
 const N=C.nav.nodes,ok=j=>!C.playable||!!C.playable[j],snap=(p,r)=>BotRoutes.spot(C.nav,p,[],P.rand,{rMin:0,rMax:r,gap:0,ok}),pos=u.g.position;
 const base=g.from==='atk'?C.meta.attacker:g.from==='def'?C.meta.defender:P.atk!=null?(P.atk?C.meta.attacker:C.meta.defender):[pos.x,pos.y,pos.z],a=snap(base,4),b=snap(xbvSiteCenter(C,g.site,true),4);if(a<0||b<0)return false;
 const path=g.from==='atk'?nmPath(C,b,a):nmPath(C,a,b);if(!path||path.length<2)return false;
 let L=0;for(let k=1;k<path.length;k++)L+=Math.hypot(N[path[k]][0]-N[path[k-1]][0],N[path[k]][2]-N[path[k-1]][2]);
 const back=g.back||0,want=g.from==='atk'?Math.min(L,L*g.frac+back):Math.max(0,L*g.frac-back);
 let d=0,k=1;for(;k<path.length;k++){d+=Math.hypot(N[path[k]][0]-N[path[k-1]][0],N[path[k]][2]-N[path[k-1]][2]);if(d>=want)break;}
 const taken=[];for(const [v,Q] of XBV.plans)if(v!==u&&Q.atk===P.atk&&Q.stages)for(const h of Q.stages)if(h.pt)taken.push(h.pt);
 const n=N[path[Math.min(k,path.length-1)]],q=BotRoutes.spot(C.nav,n,taken,P.rand,{rMin:0,rMax:2,gap:2.5,ok}),m=q>=0?N[q]:n;return g.pt=[m[0],m[1],m[2]];
}
// The map's middle (BotBrain.midPoint of the A / B / C sites and both spawns), snapped to a playable nav node; cached per map.
function xbvMid(C){if(C._botMid)return C._botMid;const S={};for(const k of Object.keys(C.meta.sites))if(/^[ABC]$/.test(k))S[k]=C.meta.sites[k];const p=BotBrain.midPoint(S,C.meta.attacker,C.meta.defender),N=C.nav.nodes;let b=-1,bd=Infinity;
 for(let i=0;i<N.length;i++){if(C.playable&&!C.playable[i])continue;const n=N[i],v=Math.hypot(n[0]-p[0],n[2]-p[2])+Math.abs(n[1]-p[1])*3;if(v<bd){bd=v;b=i;}}return C._botMid=b>=0?[N[b][0],N[b][1],N[b][2]]:p;}
// Who rotates on information (as the server's rotates): rotation-eligible defenders (never an anchor; mid / rotator / push /
// retake players always, supports from another site), the BotBrain.RESPOND.rotate nearest to the site, chosen once per site.
function xbvRotLoose(R){return R.slot==='mid'||R.slot==='rot'||R.slot==='push'||R.slot==='retake';}
function xbvRot(team,u,P,I,C){const R=P.role;if(!R||!R.rotator||(!xbvRotLoose(R)&&P.site===I.site))return false;
 if(I.rotK!==I.site){I.rotK=I.site;const c=C.meta.sites[I.site],list=[];for(let k=0;k<team.length;k++){const v=team[k];if(!v||!v.alive||!v.g||v===player)continue;const Q=xbvPlan(v,team,false,C),R2=Q.role;if(!R2||!R2.rotator||(!xbvRotLoose(R2)&&Q.site===I.site))continue;const q=v.g.position;list.push({id:k,d:c?Math.hypot(q.x-c[0],q.z-c[2]):0,v});}
  const go=BotBrain.nearest(list,BotBrain.RESPOND.rotate);I.rot=new Set(list.filter(e=>go.has(e.id)).map(e=>e.v));(XBV.rlog||(XBV.rlog=[])).push({site:I.site,n:I.rot.size,of:list.length});if(XBV.rlog.length>200)XBV.rlog.shift();}
 return I.rot.has(u);}
// Defender information: an enemy seen or heard within 16 m of a site (once per frame); rotators rotate after their delay.
function xbvInfo(team,C){
 const k=xbvKey();if(XBV.info&&XBV.info.k!==k)XBV.info=null;if(XBV.infoF===XNF)return XBV.info;XBV.infoF=XNF;
 for(const d of team){if(!d||!d.alive)continue;let p=null;if(d.see>0){const t=d.xTt||d.xTg;p=t&&(t.g?t.g.position:t);}if(!p&&d.hearT>0&&d.hear)p={x:d.hear[0],z:d.hear[1]};if(!p)continue;
  for(const n of Object.keys(C.meta.sites)){const c=C.meta.sites[n];if(Math.hypot(p.x-c[0],p.z-c[2])<16){const now=performance.now();if(!XBV.info||(XBV.info.site!==n&&now>XBV.info.at+6000))XBV.info={k,site:n,at:now};if(XBV.info.site===n){XBV.info.x=p.x;XBV.info.z=p.z;}break;}}}
 return XBV.info;
}
function xbvSiteCenter(C,name,atk){if(name==='mid')return xbvMid(C);const g=atk&&C.siteGoals&&C.siteGoals[name],p=C.meta.sites[name];return g?[g[0],p[1],g[1]]:[p[0],p[1],p[2]];}
{const goal=xGoal;xGoal=function(u,team,atk,out){
 const C=typeof nmActive==='function'&&nmActive(),s=FV.sp;
 if(!C||mode!=='five'||FV.dm||!window.BotRoutes||!s||!u||!u.g||!C.meta||!C.meta.sites)return goal.apply(this,arguments);
 if(atk&&s.st==='plant'){ // post-plant: spread spots around the Spike instead of one stack
  const P=xbvPlan(u,team,atk,C);if(!P.post||P.post0!==s.x+','+s.z){P.post0=s.x+','+s.z;P.post=xbvSpot(C,[s.x,s.y||u.g.position.y,s.z],xbvTeamTaken(team,u,'post'),P.rand,{rMin:3,rMax:9,gap:3.5});}
  return P.post?x2(out,P.post[0],P.post[2]):goal.apply(this,arguments);}
 if(s.st==='plant'||s.st==='drop'||(atk&&s.st!=='carry'))return goal.apply(this,arguments); // retake/defuse, pickups: exact goals
 const P=xbvPlan(u,team,atk,C),now=performance.now(),p=u.g.position,rt=100-timeLeft;let st=null;for(const g of P.stages)if(rt<g.until){st=g;break;}
 if(atk&&u===s.c){const q=st&&xbvStage(C,u,st,P);return q?x2(out,q[0],q[2]):goal.apply(this,arguments);} // the carrier: staged with its group, then the exact plant goal
 if(!P.go)P.go=now+(P.delay||0);if(now<P.go)return x2(out,p.x,p.z); // staggered start: hold at spawn
 let site=atk?s.site:P.site;
 if(!atk){let I=xbvInfo(team,C);if(!I&&s.seen){if(!s.seenI||s.seenI.site!==s.seen||s.seenI.k!==xbvKey())s.seenI={k:xbvKey(),site:s.seen,at:now};I=s.seenI;}
  if(I&&I.site&&xbvRot(team,u,P,I,C)&&now>=I.at+P.rotD){site=I.site;st=null;P.rotSite=site;}} // only the nearest RESPOND.rotate eligible defenders answer information, after their delay; the rest hold their areas
 if(st){const q=xbvStage(C,u,st,P);if(q)return x2(out,q[0],q[2]);} // default / fake / lurk / split / aggressive-push positions
 if(!C.meta.sites[site])return goal.apply(this,arguments);
 if(P.spotSite!==site){P.spotSite=site;P.spot=xbvSpot(C,xbvSiteCenter(C,site,atk),xbvTeamTaken(team,u,'spot'),P.rand,atk?{rMin:2,rMax:10,gap:4.5}:{rMin:2,rMax:10,gap:4});}
 return P.spot?x2(out,P.spot[0],P.spot[2]):goal.apply(this,arguments);
};}
// Lane-varied routes: nmNext's A* result is re-routed once per goal through BotRoutes.route (seeded per bot and round,
// penalised along teammates' routes) and followed from the cache until the goal changes or the unit leaves it.
// the index of the node of path (from i0 to i1) nearest to node s, within r m and on its floor; -1 if none
function xbvOnPath(N,path,s,i0,i1,r){const q=N[s];let k=-1,bd=r;for(let j=i0;j<Math.min(path.length,i1);j++){const n=N[path[j]],d=Math.hypot(n[0]-q[0],n[2]-q[2]);if(d<bd&&Math.abs(n[1]-q[1])<1.2){bd=d;k=j;}}return k;}
function xbvPath(C,u,s,e,banned,base){
 const now=performance.now(),N=C.nav.nodes,v=u.xvr;
 if(v&&v.e===e&&v.C===C&&v.k===XBV.k&&now<v.until){
  let k=v.path.indexOf(s,v.i);if(k<0)k=xbvOnPath(N,v.path,s,Math.max(0,v.i-6),v.i+14,2.5);/* a few nodes back too: a body pushed back by spacing stays on its lane */
  if(k>=0&&(!banned||!banned.size||v.path.slice(k,k+2).length<2||!banned.has(v.path[k]+'>'+v.path[k+1]))){v.i=k;return v.path.slice(k);}
 }
 const path=base(C,s,e,banned);if(path.length<4)return path;
 if(XBV.budget.f!==XNF){XBV.budget.f=XNF;XBV.budget.n=0;}if(XBV.budget.n>=2){/* over budget: keep the lane already chosen for this goal (returning the plain A* here and the varied lane next time flip-flopped a bot between two routes: Breeze defender ramp) */if(v&&v.e===e&&v.C===C&&v.k===XBV.k){const k=xbvOnPath(N,v.path,s,0,v.path.length,4);if(k>=0){v.i=k;return v.path.slice(k);}}return path;}XBV.budget.n++; // at most two varied re-routes per frame
 const team=bots.includes(u)?bots:allies,peers=[];for(const t of team)if(t!==u&&t.alive&&t.xvr&&t.xvr.k===XBV.k)peers.push({path:t.xvr.path.slice(t.xvr.i)});
 const r=BotRoutes.route(C.nav,path,(u.name||'')+'|'+XBV.k+'|'+e,peers,null,banned,typeof nmClimbOk==='function'?(a,b)=>N[b][1]-N[a][1]<=.321||nmClimbOk(C,a,b):null); // the instinct climb rule, as nmPath
 u.xvr={e,C,k:XBV.k,path:r,i:0,until:now+12000};return r.slice();
}
if(typeof nmPath==='function'&&typeof nmNext==='function'){/* native maps present (page harnesses strip them) */const np=nmPath;let cur=null;nmPath=function(C,s,e,banned){return cur&&window.BotRoutes?xbvPath(C,cur,s,e,banned,np):np.apply(this,arguments);};
 const nn=nmNext;nmNext=function(C,u,gx,gz){const prev=cur;cur=mode==='five'&&!FV.dm&&u&&u!==player&&!(u.see>0)?u:null;try{return nn.apply(this,arguments);}finally{cur=prev;}};}
// Teammate spacing while walking (not while fighting): soft steer away from teammates closer than 1.8 m.
{const sm=xSmV;xSmV=function(u,dt,vx,vz,speed){
 if((vx||vz)&&!(u.see>0)&&window.BotRoutes&&running&&mode==='five'&&typeof nmActive==='function'&&nmActive()){
  const team=bots.indexOf(u)>=0?bots:allies,o=XBV.oth;o.length=0;for(const t of team)if(t!==u&&t.alive&&t.g)o.push(t.g.position);if(team===allies&&player&&player.hp>0)o.push(player);
  if(o.length){const r=BotRoutes.steer(u.g.position,o,vx,vz,team.indexOf(u),1.8,XBV.sv);vx=r[0];vz=r[1];}
  // trade spacing (bots-spread-1, as the server): a moving teammate a few metres ahead on the same heading -> ease off to
  // walking pace until the gap opens, so an execute walks in a line ~3 m apart instead of nose to tail (not the carrier, not in
  // the buy phase: the barrier line-up keeps its own spacing)
  if(window.BotBrain&&!(FV.buy>0)&&!(FV.sp&&FV.sp.c===u)){const M=XBV.fm||(XBV.fm=[]);M.length=0;for(const t of team)if(t!==u&&t.alive&&t.g&&(t.spd||0)>1)M.push([t.g.position.x,t.g.position.z,performance.now()-(t.xFol||-1e9)<300?9:t.spd]);/* a mate held back by its own follow counts as running */if(M.length){const k=BotBrain.follow(u.g.position.x,u.g.position.z,vx,vz,M);if(k<1){vx*=k;vz*=k;u.xFol=performance.now();}}}}
 return sm.call(this,u,dt,vx,vz,speed);};}
// Trades (bots-spread-1, as the server's botSense): when a teammate dies, at most BotBrain.RESPOND.trade of the mates within
// 15 m (the nearest; mates already trading / pushing count) push the killer's spot for 4 s, the second one GAP m to the
// side of it; everyone else holds where they stand facing the fight for 1.2 s (was: every mate within 15 m ran at the
// killer's spot, so one pick pulled the whole team into one clump). Native-map / scripted 5v5 with BotBrain only.
if(typeof xTradeChk==='function'){const tc0=xTradeChk;xTradeChk=function(team,foes,live){
 if(!window.BotBrain||mode!=='five'||FV.dm)return tc0.apply(this,arguments);const now=performance.now(),T=XBV.tq||(XBV.tq=[0,0]);
 for(let i=0;i<team.length;i++){const u=team[i];
  if(u.wasA&&!u.alive){const q=u.g.position;let kx=0,kz=0,has=false,kd=1e9;
   for(let j=0;j<foes.length;j++){const f=foes[j];if(live&&!f.alive)continue;const fx=live?f.g.position.x:f.x,fz=live?f.g.position.z:f.z,d=Math.hypot(fx-q.x,fz-q.z);if(d<kd){kd=d;kx=fx;kz=fz;has=true;}}
   if(has){const near=[];let busy=0;for(let j=0;j<team.length;j++){const m=team[j];if(!m.alive||m===u)continue;if(m.trT>0){busy++;continue;}const d=Math.hypot(m.g.position.x-q.x,m.g.position.z-q.z);if(d<15)near.push({id:j,d,m});}
    const go=BotBrain.nearest(near,BotBrain.RESPOND.trade-busy);let k=busy;near.sort((a,b)=>a.d-b.d);
    for(const c of near){const m=c.m;if(go.has(c.id)){const t=BotBrain.tradeSpot(k++,m.g.position.x,m.g.position.z,kx,kz,T);m.tr=[t[0],t[1]];m.trT=4;m.np=null;m.xHold=null;}
     else{m.xHold={until:now+1200,x:kx,z:kz};m.hear=m.hear||[0,0];m.hear[0]=kx;m.hear[1]=kz;m.hearT=Math.max(m.hearT||0,1.2);}}
    (XBV.tlog||(XBV.tlog=[])).push({n:near.length,go:go.size});if(XBV.tlog.length>200)XBV.tlog.shift();}}
  u.wasA=u.alive;}};}
// Stable personalities: the per-round xPer roll keeps its lane offset, aggression / flank / strafe rhythm come from the
// bot's match personality, so a bot plays like itself every round.
if(typeof fSpawn==='function'){const fs0=fSpawn;fSpawn=function(){const r=fs0.apply(this,arguments);try{if(window.BotBrain&&mode==='five'&&!FV.dm)for(const u of bots.concat(allies)){const B=xbBrain(u);if(B&&u.per){u.per.ag=Math.max(.15,B.aggression);u.per.fl=Math.min(.99,(B.seed%1000)/1000*.6+B.patience*.4);u.per.cd=.7+B.strafeRhythm;}}}catch(e){}return r;};}
// Team economy: one call per team and round (pistol / full / half / force / eco / save from the team's credits and loss
// streak). Pistol / eco / save rounds buy small (Ghost, Sheriff, Frenzy, Stinger, light armor) or nothing; full / half /
// force keep the varied shop above. Hosted seats, Swiftplay / custom buys and missing economy entries pass straight through.
if(typeof fBotBuy==='function'){const fb0=fBotBuy;fBotBuy=function(n){
 const s=FV.bs&&FV.bs[n];if(!s||!window.BotBrain||mode!=='five'||FV.dm||(typeof srOn==='function'&&srOn())||(typeof mp5H==='function'&&mp5H())||typeof F_MATES==='undefined')return fb0.apply(this,arguments);
 const mates=F_MATES.includes(n),team=mates?F_MATES:F_EN,key=xbvKey()+'|'+(mates?1:0);
 if(!XBV.call[mates]||XBV.call[mates].k!==key){const cr=team.map(m=>FV.bs[m]?FV.bs[m].cr:800),rd=FV.you+FV.them+1;XBV.call[mates]={k:key,c:BotBrain.teamBuy(cr,(mates?FV.lsY:FV.lsT)||0,rd,BotRoutes.rng(BotRoutes.hash(xbvSeed()+'|buy|'+key)),12)};}
 const call=XBV.call[mates].c;if(call!=='pistol'&&call!=='eco'&&call!=='save')return fb0.apply(this,arguments);
 if(!s.alive){s.w='Classic';s.arm=0;s.rgn=undefined;}const c0=s.cr,def=mates?!FV.atk:FV.atk,B=xbBrain({name:n})||BotBrain.personality(BotRoutes.hash(n));
 if(s.w==='Classic'){const b=BotBrain.buyFor(call,s.cr,B,BotRoutes.rng(BotRoutes.hash(xbvSeed()+'|'+n+'|'+key)),def),cost={Ghost:500,Sheriff:800,Frenzy:450,Stinger:1100};
  for(const w of [b.weapon,b.side])if(w&&cost[w]&&s.cr>=cost[w]){s.cr-=cost[w];s.w=w;}
  if(b.armor==='light'&&(s.arm||0)<25&&s.cr>=400){s.cr-=400;s.arm=25;s.rgn=undefined;}}
 try{xBBuy(n,s);}catch(e){}try{sbSpend(n,c0-s.cr);}catch(e){}return s;};}
// Plan utility ("use utility before entry", BotBrain.utility, as the server): attackers keep smokes / recon / Fault Line
// for the execute and throw them toward the site just before it (utility-first plans only; lurkers stay quiet), the fake
// group throws its utility at the fake site, post-plant Killjoy hides her Nanoswarms on the Spike and Raze shells it when a
// defender comes for it, defenders delay a push on their site (smoke / flash toward the attackers, Boom Bot after them)
// and flash / recon before a retake. Each cast is the kit's existing bot cast (xBUse charges, enSmoke / xBFlash /
// recon bolt / xKnPlace / xRzShells): no ability values change. Native-map 5v5 only; other modes keep the old triggers.
// agent ability types c / q / e (server/src/abilities.js types) and the offline bot casts (index.html xBHotHands ...) for the
// ones that had no bot path; reach as the server's planUtility
const XBV_TY={Jett:['smoke','updraft','dash'],Phoenix:['wall','fire','flash'],Sova:['drone','shock','recon'],Sage:['wall','slow','heal'],Reyna:['leer','heal','dismiss'],Omen:['teleport','flash','smoke'],Killjoy:['fire','trap','turret'],Raze:['drone','satchel','grenade'],Skye:['heal','drone','flash'],Breach:['shock','flash','stun'],Cypher:['trap','smoke','recon'],Chamber:['trap','headhun','teleport']};
const XBV_CAST={Phoenix:{fire:()=>typeof xBHotHands==='function'&&xBHotHands,wall:()=>typeof xBBlaze==='function'&&xBBlaze},Sage:{slow:()=>typeof xBSlowOrb==='function'&&xBSlowOrb,wall:()=>typeof xBBarrier==='function'&&xBBarrier},Sova:{shock:()=>typeof xBShock==='function'&&xBShock},
 Omen:{flash:()=>typeof xBParanoia==='function'&&xBParanoia},Cypher:{smoke:()=>typeof xBCage==='function'&&xBCage},Skye:{drone:()=>typeof xBTrail==='function'&&xBTrail},Killjoy:{turret:()=>typeof xBTurret==='function'&&xBTurret}};
const XBV_REACH={fire:13,slow:15,shock:40,flash:25,smoke:10,drone:20,turret:30,wall:13};
function xbvUtilX(b){
 const C=typeof nmActive==='function'&&nmActive(),s=FV.sp;if(!C||mode!=='five'||FV.dm||FV.buy>0||!window.BotBrain||!s||!b||!b.g||!C.meta||!C.meta.sites||typeof xBAtk!=='function')return null;
 const al=allies.indexOf(b)>=0,team=al?allies:bots,atk=xBAtk(al),P=xbvPlan(b,team,atk,C),S=xbvStrat(team,atk,C);
 const U=P.util||(P.util={used:0,it:null,at:0,kj:0,rand:BotRoutes.rng(BotRoutes.hash((b.name||'')+'|util|'+xbvKey()+'|'+xbvSeed()))});
 return {C,s,al,team,atk,P,S,U,planted:s.st==='plant',p:b.g.position};}
function xbvUtil(b,see,tg,X){
 X=X||xbvUtilX(b);if(!X)return null;const {C,s,atk,P,S,U,planted,p}=X,now=performance.now();if(U.it&&now<U.it.until)return U.it;if(now<U.at)return null;U.at=now+300+U.rand()*300;
 const sites=C.meta.sites,sc=n=>sites[n]?xbvSiteCenter(C,n,atk):null,dist=c=>c?Math.hypot(c[0]-p.x,c[2]-p.z):Infinity,site=sc(atk?s.site:P.rotSite||P.site),other=sc(S.plan.other);
 const sp=planted&&typeof spike!=='undefined'&&spike&&spike.parent?spike.position:planted&&s.x!=null?{x:s.x,z:s.z}:null,spd=sp?Math.hypot(sp.x-p.x,sp.z-p.z):Infinity;
 let threat=false;if(atk&&sp)threat=!!s.du||s.dt>0||!!(see&&tg&&Math.hypot(tg.x-sp.x,tg.z-sp.z)<12)||!!(b.hearT>0&&b.hear&&Math.hypot(b.hear[0]-sp.x,b.hear[1]-sp.z)<12);
 const I=!atk&&!planted?xbvInfo(X.team,C):null,info=!!(I&&I.site===(P.rotSite||P.site)&&now-I.at<8000);
 const call=BotBrain.utility(xbBrain(b),{atk,plan:S.plan,role:P.role,rt:100-timeLeft,siteDist:dist(site),otherDist:dist(other),planted,spikeDist:spd,threat,info,used:U.used});
 if(!call)return U.it=null;let t=call.aim==='spike'?[sp.x,0,sp.z]:call.aim==='other'?other:call.aim==='info'?(I&&I.x!=null?[I.x,0,I.z]:site):site;if(!t)return U.it=null;
 return U.it={phase:call.phase,want:call.want,x:t[0],z:t[2],until:now+2500};}
function xbvUsed(b,X,it,kind){X.U.used++;X.U.it=null;X.U.at=performance.now()+1200+X.U.rand()*1500;(XBV.ulog||(XBV.ulog=[])).push({name:b.name,phase:it?it.phase:'post',kind,t:100-timeLeft,atk:X.atk});if(XBV.ulog.length>200)XBV.ulog.shift();}
// smokes (Jett Cloudburst, Omen Dark Cover): toward the plan target in the entry / fake / delay / retake phases; attackers on a
// utility-first plan hold them until then
if(typeof xBChoke==='function'){const ch0=xBChoke;xBChoke=function(b,al,from,A){const X=xbvUtilX(b);if(!X)return ch0.apply(this,arguments);const it=xbvUtil(b,false,null,X);
 if(it&&it.want.includes('smoke')){const dx=it.x-from.x,dz=it.z-from.z,l=Math.hypot(dx,dz)||1;if(l<4)return null;const lead=it.phase==='entry'||it.phase==='fake'?6:0;let k=Math.max(3,Math.min(14,l-lead));for(;k>3&&typeof blocked==='function'&&blocked(from.x+dx/l*k,from.z+dz/l*k,0.5,0);k-=2);
  XBK_P.x=from.x+dx/l*k;XBK_P.z=from.z+dz/l*k;X.U.sm=it;return XBK_P;}
 if(X.atk&&!X.planted&&X.S.plan.utilFirst)return null;return ch0.apply(this,arguments);};}
// flashes (Phoenix Curveball, Breach Flashpoint, Skye Guiding Light all go through xBFl): one toward the plan target
if(typeof xBFl==='function'){const f0=xBFl;xBFl=function(b,A,see,peek,tg,from,k,al,col,key,nm,hz){const X=!see?xbvUtilX(b):null,it=X?xbvUtil(b,see,tg,X):null;
 if(it&&it.want.includes('flash')&&(A.flT||0)<=A.t){const l=Math.hypot(it.x-from.x,it.z-from.z);if(l>4&&l<30&&xBUse(b,k)){A.flT=A.t+3;xBFlash(b,al,from,it.x,it.z,col,key,nm,hz);xbvUsed(b,X,it,'flash');return true;}}
 return f0.apply(this,arguments);};}
if(typeof botAb==='function'){const ba0=botAb;botAb=function(b,dt,see,tg,from){
 const X=b&&b.g&&running?xbvUtilX(b):null;if(!X)return ba0.apply(this,arguments);
 const A=b.ab,ag=typeof xBAg==='function'?xBAg(b):null,it=xbvUtil(b,see,tg,X),hold=X.atk&&!X.planted&&X.S.plan.utilFirst&&!it,ch=typeof xBCh==='function'?xBCh(b):null,e0=ch?ch.e:0;
 if(A&&ag==='Sova'&&A.rbT!=null){if(it&&it.want.includes('recon'))A.rbT=Math.min(A.rbT,A.t);else if(hold)A.rbT=Math.max(A.rbT,A.t+.5);} // Recon Bolt at the execute
 if(A&&ag==='Breach'&&A.beT!=null&&hold)A.beT=Math.max(A.beT,A.t+.5); // Fault Line waits for the execute
 if(A&&ag==='Raze'&&it&&it.phase==='delay'&&!see&&A.rzb)A.rlk={x:it.x,z:it.z,t:0}; // defenders: Boom Bot after the push
 X.U.sm=null;const c0=ch?ch.c+ch.q+ch.e:0,r=ba0.apply(this,arguments);
 if(X.U.sm&&ch&&ch.c+ch.q+ch.e<c0)xbvUsed(b,X,X.U.sm,'smoke');else if(ag==='Sova'&&it&&ch&&ch.e<e0)xbvUsed(b,X,it,'recon');
 // the plan's utility with no older bot path (Hot Hands, Slow Orb, Shock Bolt, Paranoia, Cyber Cage, Trailblazer, Turret, Blaze, Barrier Orb):
 // the first wanted type this agent has; a type an older hook owns (xBChoke / xBFl / Recon / Nanoswarm / Paint Shells) waits for it
 if(it&&b.alive&&A&&XBV_CAST[ag]&&ch&&X.U.it===it){const ty=XBV_TY[ag];for(const w of it.want){const i=ty.indexOf(w);if(i<0)continue;const k='cqe'[i],cf=XBV_CAST[ag][w],fn=cf&&cf();
  if(!cf){if(ch[k]>=1)break;continue;}if(!fn||!(ch[k]>=1))continue;
  const l=Math.hypot(it.x-from.x,it.z-from.z),R=XBV_REACH[w];if(l>R+2||(w!=='turret'&&w!=='flash'&&l<2))break;
  if(xBUse(b,k)){fn(b,X.al,from,it.x,it.z);xbvUsed(b,X,it,w);}break;}}
 // post-plant: Killjoy hides her Nanoswarms on the Spike once; Raze shells it when a defender comes for it
 if(X.atk&&X.planted&&b.alive&&A){const sp=typeof spike!=='undefined'&&spike&&spike.parent?spike.position:null;if(sp){const d=Math.hypot(sp.x-X.p.x,sp.z-X.p.z);
  if(ag==='Killjoy'&&!X.U.kj&&d<12){X.U.kj=1;if(xKnPlace(b,X.al,sp.x,sp.z,2,0.5,2.5)){feed("Killjoy ▸ Nanoswarm");xbvUsed(b,X,null,'fire');}}
  if(ag==='Raze'&&it&&it.phase==='post'&&d<16&&xBUse(b,'e')){xRzShells(A,sp.x,sp.z);xbvUsed(b,X,it,'grenade');}}}
 return r;};}
// Sound reactions (BotBrain.onSound, as the server's botSense): a bot that hears a gunshot / running footsteps out of a
// fight either turns to it and keeps going (xFace already does), stops and holds that angle for 0.6 s + up to 1.2 s by
// patience, or pushes a close gunshot. Not the Spike carrier, not attackers fetching a dropped Spike, not a late retake.
var XBH={k:null,w:null};
function xbvSound(p,kind){
 if(!p||!running||mode!=='five'||FV.dm||!window.BotBrain)return;const now=performance.now(),s=FV.sp||{};
 for(const L of [bots,allies])for(const u of L){if(!u||!u.alive||!u.g||!(u.hearT>=1.2)||!u.hear||u.hear[0]!==p.x||u.hear[1]!==p.z||u.see>0||(u.xHeardAt&&now-u.xHeardAt<1500))continue;
  const atk=typeof xBAtk==='function'?xBAtk(L===allies):false;if(s.c===u||(atk&&s.st==='drop')||(!atk&&s.st==='plant'&&s.t<15))continue;
  u.xHeardAt=now;const B=xbBrain(u);if(!B)continue;const r=xbRand(u),q=u.g.position,d=Math.hypot(p.x-q.x,p.z-q.z);let c=BotBrain.onSound(B,r,kind,d);
  if(c==='push'&&L.some(t=>t!==u&&t.alive&&t.trT>0))c='hold';/* one pusher / trader at a time per team (BotBrain.RESPOND.push): the rest hold the angle */u.xSnd=c;
  if(c==='push'){u.tr=[p.x,p.z];u.trT=2+r();u.xHold=null;}
  else if(c==='hold'){const dur=.6+B.patience*1.2;u.xHold={until:now+dur*1000,x:p.x,z:p.z};u.hearT=Math.max(u.hearT,dur);}
  else u.xHold=null;}
}
if(typeof SFX!=='undefined')['at','step'].forEach(k=>{const f=SFX[k];if(f)SFX[k]=function(p,w){const k0=XBH.k,w0=XBH.w;XBH.k=k==='at'?'shot':'step';XBH.w=k==='at'?w:null;try{return f.apply(this,arguments);}finally{XBH.k=k0;XBH.w=w0;}};});
// the player's own running steps (SFX.selfStep: never walking / crouching) are heard by enemy bots like a bot's (bots-perception-2)
if(typeof SFX!=='undefined'&&SFX.selfStep){const f=SFX.selfStep;SFX.selfStep=function(){const r=f.apply(this,arguments);try{if(running&&player&&player.hp>0&&typeof xHear==='function'){const k0=XBH.k;XBH.k='step';try{xHear({x:player.x,z:player.z});}finally{XBH.k=k0;}}}catch(e){}return r;};}
// a bot's ability cast is heard within 30 m by the other team
if(typeof xBUse==='function'){const f=xBUse;xBUse=function(b){const r=f.apply(this,arguments);try{if(r&&b&&b.g)xbvCast(b.g.position);}catch(e){}return r;};}
// ... and so is the player's (bots-tune-1): any charge or the ult spent this frame (quick-cast, equip-flow release, recast)
function xbvCast(p){if(!p||typeof xHear!=='function')return;const k0=XBH.k,w0=XBH.w;XBH.k='cast';XBH.w=null;try{xHear({x:p.x,y:p.y||0,z:p.z});}finally{XBH.k=k0;XBH.w=w0;}}
function xbvPCast(){if(typeof J==='undefined'||!J||typeof player==='undefined'||!player)return;const n=(+J.c||0)+(+J.q||0)+(+J.e||0),u=+J.ult||0,was=XBH.pc;XBH.pc={n,u,live:running&&player.hp>0&&!(mode==='five'&&(FV.buy>0||FV.esc))};
 if(was&&was.live&&XBH.pc.live&&(n<was.n||u<was.u))xbvCast({x:player.x,y:player.y||0,z:player.z});}
if(typeof tick==='function'){const t0=tick;tick=function(){const r=t0.apply(this,arguments);try{xbvPCast();}catch(e){}return r;};}
if(typeof xHear==='function'){const h0=xHear;xHear=function(p){const r=h0.apply(this,arguments);try{xbvHearMem(p,XBH.k||'shot',xbEarW());}catch(e){}try{xbvSound(p,XBH.k||'shot');}catch(e){}return r;};}
// holding: stand still (goal = where it stands) while it faces the sound; a fight or a trade ends it
{const g0=xGoal;xGoal=function(u,team,atk,out){if(u&&u.xHold&&u.g&&!(u.see>0)&&mode==='five'){if(performance.now()<u.xHold.until){const p=u.g.position;if(u.hearT>0){u.hear=u.hear||[0,0];u.hear[0]=u.xHold.x;u.hear[1]=u.xHold.z;}return x2(out,p.x,p.z);}u.xHold=null;}return g0.apply(this,arguments);};}
// Turn-rate limit per bot (BotBrain personality turn 7-14 rad/s, as the server; was 12 rad/s for every bot) and no shot
// while the body is still swinging onto the target (xbTurned: rendered yaw within 0.3 rad of the aim): no instant 180s.
if(typeof xBotYaw==='function'){xBotYaw=function(dt){if(!dt)return;const now=performance.now();
 for(const L of [typeof bots!=='undefined'?bots:[],typeof allies!=='undefined'?allies:[]])for(const u of L){if(!u||!u.g||u.nt)continue;const t=u.g.rotation.y;if(u.xyw==null||!u.alive){u.xyw=t;u.xywT=now;continue;}
  const B=window.BotBrain&&xbBrain(u),m=(B&&B.turn||12)*dt;let d=xAng(t-u.xyw)*Math.min(1,dt*14);d=Math.max(-m,Math.min(m,d));u.xyw+=d;u.xywT=now;u.g.rotation.y=u.xyw;}};}
function xbTurned(u){if(!u||!u.g||u.xyw==null||!(performance.now()-(u.xywT||0)<250))return true;return Math.abs(xAng(u.g.rotation.y-u.xyw))<.3;} // rotation.y: the yaw the AI just chose this frame
if(typeof botCanShoot==='function'){const cs0=botCanShoot;botCanShoot=function(b){return cs0.apply(this,arguments)&&xbTurned(b);};}
// Older scripted maps (no native nav graph: page harnesses, fallback maps): the same BotBrain round strategy picks the
// attackers' site (was Math.random at round start) and the scripted route to it (was xaPick's Math.random), attackers on a
// default / slow / split / fake / execute plan hold their staged point (part of the way from where they start to the site,
// collision-checked) until the plan's time, the plan's lurker waits off the other site until its rotate time, and defender
// holds are a seeded shuffle per round (was xShuf). Everything else stays the scripted logic (routes, jumps, holds, retakes).
// The base "last living non-carrier lurks" rule is off while the plan runs the round: the plan's own lurker (lurk plans
// only) is the one lurker, and once its stage ends it takes no scripted route (straight A* from the other site to the site).
function xbvScripted(){const s=FV.sp;return mode==='five'&&!FV.dm&&!!window.BotBrain&&!!s&&typeof SITES!=='undefined'&&!!SITES&&!(typeof nmActive==='function'&&nmActive());}
if(typeof xLurk==='function'){const lk0=xLurk;xLurk=function(u,team,s){return xbvScripted()?false:lk0.apply(this,arguments);};}
{const gs0=xGoal;xGoal=function(u,team,atk,out){
 const s=FV.sp;if(!u||!u.g||!xbvScripted())return gs0.apply(this,arguments);
 try{const k=xbvKey(),rand=BotRoutes.rng(BotRoutes.hash(xbvSeed()+'|xs|'+k+'|'+(atk?'a':'d')));
  if(!atk){if(s.xsK!==k&&s.st==='carry'){s.xsK=k;const o=[0,1,2,3,4];for(let i=4;i>0;i--){const j=Math.floor(rand()*(i+1));[o[i],o[j]]=[o[j],o[i]];}s.ho=o;if(s.dh==null)s.dh=rand()<.5;}return gs0.apply(this,arguments);}
  if(s.st!=='carry')return gs0.apply(this,arguments);
  const S=xbvStrat(team,true,null),pl=S.plan;if(s.xsA!==k){s.xsA=k;s.lr=1;if(s.c&&s.c!==player&&SITES[pl.site]){s.site=pl.site;const L=((typeof XA!=='undefined'&&XA[FV.map])||{})[s.site]||[],ok=L.filter(n=>typeof XR!=='undefined'&&XR[n]&&XR[n].length);if(ok.length)s.xr=ok[Math.floor(rand()*ok.length)];}}
  const role=S.roles.get(u),rt=100-timeLeft,p=u.g.position;if(!role||u===s.c)return gs0.apply(this,arguments);
  const st=(role.stages||[]).find(g=>rt<g.until);if(st&&SITES[st.site]){const b=u.xsB&&u.xsB.k===k?u.xsB:(u.xsB={k,x:p.x,z:p.z,pt:null});
   if(!b.pt){const c=SITES[st.site],f=role.lurk?1:st.frac;let x=b.x+(c[0]-b.x)*f,z=b.z+(c[1]-b.z)*f;for(let n=0;n<6&&typeof blocked==='function'&&blocked(x,z,0.45);n++){x+=(b.x-x)*.2;z+=(b.z-z)*.2;}b.pt=[x,z+(role.lurk?3:0)];}
   return x2(out,b.pt[0],b.pt[1]);}
  if(role.lurk&&u.xsL!==k){u.xsL=k;u.xr=[];} // the plan's lurker rotates in from where it waited
  const r=gs0.apply(this,arguments),b=u.xsB;if(b&&b.k===k&&!b.trim&&u.xr&&u.xr.length&&SITES[s.site]){b.trim=1;const c=SITES[s.site],dh=(x,z)=>Math.hypot(c[0]-x,c[1]-z),me=dh(p.x,p.z);while(u.xr.length>1&&!u.xr[0][2]&&dh(u.xr[0][0],u.xr[0][1])>me)u.xr.shift();} // from the staged point: skip the scripted waypoints already behind it
  return r;
 }catch(e){}
 return gs0.apply(this,arguments);};}
// Spike play (BotBrain plantSpot / postPlant / postPlay / retake, as the server): the bot carrier plants on its round's
// spot (default near the centre, safe toward the attackers' entrance, open toward the defenders: nav-snapped and inside the
// plant zone; on native maps), plants there or after 3 s in the site / when time is short / in a fight; post-plant attackers
// take crossfire slots around the Spike (spread angles from their side, close or far, a node that sees the Spike), go stop a
// defuse they can reach and hide when the fuse beats any defuse; defenders play the fuse: save (eta + defuse beats it),
// wait off the site for a mate with time to spare, retake, and on the Spike defuse ninja / stick / tap once, or clear first.
const XBV_RUN=5.4; // m/s on foot (rifle run), for the fuse arithmetic
function xbvSp(){const s=FV.sp;return mode==='five'&&!FV.dm&&!!window.BotBrain&&!!s;}
function xbvPlantPt(C,u,s){
 const k=xbvKey()+'|'+s.site;if(s.xpK===k)return s.xpP;s.xpK=k;s.xpP=null;const S=C.meta.sites,c=xbvSiteCenter(C,s.site,true);if(!S[s.site])return null;
 const r=BotRoutes.rng(BotRoutes.hash(xbvSeed()+'|plant|'+k)),Q=BotBrain.plantSpot(r,xbBrain(u)),to=Q.kind==='safe'?C.meta.attacker:Q.kind==='open'?C.meta.defender:null;
 let dx,dz;if(to){dx=to[0]-c[0];dz=to[2]-c[2];}else{const a=r()*Math.PI*2;dx=Math.cos(a);dz=Math.sin(a);}const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
 for(const f of [1,.7,.4,0]){const q=xbvSpot(C,[c[0]+(dx*Q.r-dz*Q.side*1.5)*f,c[1],c[2]+(dz*Q.r+dx*Q.side*1.5)*f],[],r,{rMin:0,rMax:1.2,gap:0});if(q&&(typeof inSite!=='function'||inSite({x:q[0],z:q[2]})===s.site)){s.xpP=q;s.xpKind=f?Q.kind:'default';break;}}
 if(s.xpP){(XBV.plog||(XBV.plog=[])).push({k,site:s.site,kind:s.xpKind,p:s.xpP.slice()});if(XBV.plog.length>100)XBV.plog.shift();}return s.xpP;}
if(typeof xPlantOk==='function'){const po0=xPlantOk;xPlantOk=function(c,p){const s=FV.sp;if(!xbvSp()||!c||c===player||!s.xpP||s.xpK!==xbvKey()+'|'+s.site)return po0.apply(this,arguments);
 const now=performance.now();if(s.xpIn==null||s.xpInK!==s.xpK){s.xpIn=now;s.xpInK=s.xpK;}return Math.hypot(s.xpP[0]-p.x,s.xpP[2]-p.z)<1.6||now-s.xpIn>3000||timeLeft<15||c.see>0;};}
function xbvPostPt(C,u,team,s,far){
 const k=xbvKey()+'|'+s.x+','+s.z,S=XBV.post&&XBV.post.k===k?XBV.post:(XBV.post={k,slots:null,order:team.slice().sort((a,b)=>BotRoutes.hash((a.name||'')+'|'+k)-BotRoutes.hash((b.name||'')+'|'+k))});
 if(!S.slots)S.slots=BotBrain.postPlant(S.order.length,BotRoutes.rng(BotRoutes.hash(xbvSeed()+'|post|'+k)));
 const i=Math.max(0,S.order.indexOf(u)),q=S.slots[i%Math.max(1,S.slots.length)]||{ang:0,r:7},A=C.meta.attacker,P=xbvPlan(u,team,true,C);let bx=A[0]-s.x,bz=A[2]-s.z;const bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;
 const ca=Math.cos(q.ang),sa=Math.sin(q.ang),dx=bx*ca-bz*sa,dz=bx*sa+bz*ca,r=far?15:q.r,y=s.y||u.g.position.y,pt=[s.x+dx*r,y,s.z+dz*r],N=C.nav.nodes;
 const sees=j=>{if(typeof los!=='function'||typeof RV==='undefined')return true;const n=N[j];return los(new RV(n[0],n[1]+1.5,n[2]),new RV(s.x,y+.5,s.z));},ok=j=>(!C.playable||!!C.playable[j])&&(far||sees(j));
 let p=xbvSpot(C,pt,xbvTeamTaken(team,u,far?'hide':'post'),P.rand,{rMin:0,rMax:far?5:3.5,gap:2.5,ok});if(!p&&!far)p=xbvSpot(C,[s.x,y,s.z],xbvTeamTaken(team,u,'post'),P.rand,{rMin:3,rMax:9,gap:3.5,ok});if(!p&&!far)p=xbvSpot(C,[s.x,y,s.z],xbvTeamTaken(team,u,'post'),P.rand,{rMin:3,rMax:9,gap:3.5});
 if(!far){P.postSlot=q;(XBV.polog||(XBV.polog=[])).push({k,name:u.name,ang:q.ang,r:q.r,far:q.far});if(XBV.polog.length>200)XBV.polog.shift();}return p;}
// a defender's retake call, re-thought every 0.5 s (what this bot's team knows: attackers seen / heard near the Spike in the last 3 s)
function xbvRetake(u,team){
 const s=FV.sp,now=performance.now(),k=xbvKey();if(u.xRet&&u.xRet.k===k&&now<u.xRet.at)return u.xRet.c;const sp={x:s.x,z:s.z},defP=!FV.atk&&player&&player.hp>0,atkL=(FV.atk?[player].concat(allies):bots).filter(v=>v&&(v===player?v.hp>0:v.alive));
 let mates=defP?1:0,grouped=0;const p=u.g.position;for(const v of team)if(v&&v.alive){mates++;if(v!==u&&Math.hypot(v.g.position.x-p.x,v.g.position.z-p.z)<12)grouped++;}if(defP&&Math.hypot(player.x-p.x,player.z-p.z)<12)grouped++;
 const R=u.xRet&&u.xRet.k===k?u.xRet:{k,seenAt:-1e9,tapped:false,tapAt:null,r:BotRoutes.rng(BotRoutes.hash((u.name||'')+'|ret|'+k+'|'+xbvSeed()))};
 for(const d of team){if(!d||!d.alive)continue;let q=null;if(d.see>0){const t=d.xTt||d.xTg;q=t&&(t.g?t.g.position:t);}if(!q&&d.hearT>0&&d.hear)q={x:d.hear[0],z:d.hear[1]};if(q&&Math.hypot(q.x-sp.x,q.z-sp.z)<12)R.seenAt=now;}
 const dist=Math.hypot(p.x-sp.x,p.z-sp.z),c=BotBrain.retake(xbBrain(u),R.r,{left:timeLeft,eta:dist*1.25/XBV_RUN,half:s.dt>=3.5,mates,enemies:atkL.length,grouped,seen:now-R.seenAt<3000,at:dist<3.2,tapped:R.tapped});
 if(c.style==='tap'&&R.tapAt==null)R.tapAt=now;R.c=c;R.at=now+500;u.xRet=R;(XBV.rlog||(XBV.rlog=[])).push({name:u.name,t:+timeLeft.toFixed(1),act:c.act,style:c.style});if(XBV.rlog.length>200)XBV.rlog.shift();return c;}
if(typeof xDefOk==='function'){const do0=xDefOk;xDefOk=function(x,safe){if(!xbvSp()||!x||x===player||!x.g||FV.sp.st!=='plant')return do0.apply(this,arguments);
 const team=bots.includes(x)?bots:allies,c=xbvRetake(x,team),R=x.xRet;if(c.act==='save'||c.act==='clear')return false;
 if(R.tapAt!=null&&!R.tapped){const e=performance.now()-R.tapAt;if(e<800)return true;if(e<2000)return false;R.tapped=true;R.at=0;}return true;};}
{const sg0=xGoal;xGoal=function(u,team,atk,out){
 const s=FV.sp;if(!xbvSp()||!u||!u.g||u===player||s.st!=='plant'&&!(atk&&s.st==='carry'&&u===s.c))return sg0.apply(this,arguments);
 try{const C=typeof nmActive==='function'&&nmActive(),p=u.g.position;
  if(atk&&s.st==='carry'){if(!C||!C.meta||!C.meta.sites)return sg0.apply(this,arguments);const r=sg0.apply(this,arguments);if(!r||!C.meta.sites[s.site])return r;const q=xbvPlantPt(C,u,s),c=xbvSiteCenter(C,s.site,true),m=C.meta.sites[s.site];
   // the carrier's last leg (the base / staged goal is the site itself): its plant spot instead
   if(q&&(Math.hypot(r[0]-c[0],r[1]-c[2])<8||Math.hypot(r[0]-m[0],r[1]-m[2])<8)&&Math.hypot(p.x-c[0],p.z-c[2])<30)return x2(out,q[0],q[2]);return r;}
  if(atk){if(!C||!C.meta||!C.meta.sites)return sg0.apply(this,arguments);const P=xbvPlan(u,team,true,C),k=xbvKey()+'|'+s.x+','+s.z;
   if(P.post0!==k){P.post0=k;P.post=xbvPostPt(C,u,team,s,false);P.hide=null;}
   const du=!!s.du,pp=P.postAct=BotBrain.postPlay(xbBrain(u),{left:timeLeft,defusing:du,dt:s.dt||0,eta:Math.hypot(p.x-s.x,p.z-s.z)*1.25/XBV_RUN});
   if(pp==='stop')return x2(out,s.x,s.z);if(pp==='hide'){if(P.hide==null)P.hide=xbvPostPt(C,u,team,s,true)||false;if(P.hide)return x2(out,P.hide[0],P.hide[2]);}
   return P.post?x2(out,P.post[0],P.post[2]):sg0.apply(this,arguments);}
  const R=xbvRetake(u,team);if(R.act!=='save'&&R.act!=='wait')return sg0.apply(this,arguments);
  const dx=p.x-s.x,dz=p.z-s.z,l=Math.hypot(dx,dz)||1,want=R.act==='save'?22:14;if(l>=want-1)return x2(out,p.x,p.z); // far enough: hold here
  let x=s.x+dx/l*want,z=s.z+dz/l*want;if(C&&C.nav){const q=xbvSpot(C,[x,p.y,z],[],BotRoutes.rng(BotRoutes.hash(u.name+'|hold')),{rMin:0,rMax:3,gap:0});if(q){x=q[0];z=q[2];}}
  else for(let n=0;n<6&&typeof blocked==='function'&&blocked(x,z,0.45);n++){x+=(p.x-x)*.25;z+=(p.z-z)*.25;}
  return x2(out,x,z);
 }catch(e){}
 return sg0.apply(this,arguments);};}
// Buy phase (native-map 5v5, as the server's bots.js buyMill; shared logic vendor/bot-brain.cjs buy*): after their buy
// (fBotBuy, unchanged) the bots stand a moment, walk a few short legs around spawn with pauses and look-arounds, then walk
// to a spot 0.55-0.7 m inside the spawn wall (vendor/spawn-barriers.cjs: Valorant's barrier panels in the spawn's real
// exits, solid in the buy phase through nmBlocked) their planned route (xbvPlan: stage / site) crosses, staggered from
// their teammates' spots (a second row 0.75 m back in a full doorway), face out along that route and peek a little along
// the wall until it drops. They walk only on the spawn's own nav region (never across a wall, 0.5 m+ from every wall)
// and every step keeps them 0.42 m from the walls, so they never touch or cross one; the round's own logic (xGoal, staggered starts, utility) takes over from there when it drops.
var XBYM={k:'',T:{},bl:null,blC:null,V:[0,0]};
const XBYM_IN=.42;
function xbbOn(){return !!(window.BotBrain&&window.xBuyMill!==false&&running&&mode==='five'&&!FV.dm&&FV.buy>0&&typeof nmActive==='function'&&nmActive()&&!(typeof srOn==='function'&&srOn())&&!(typeof MP!=='undefined'&&MP&&MP.cl));}/* an online client draws the host's / server's bots */
function xbbBl(C,i){if(XBYM.blC!==C){XBYM.blC=C;XBYM.bl=new Map();}let v=XBYM.bl.get(i);if(v===undefined){const n=C.nav.nodes[i];v=nmBlocked(C,n[0],n[2],.3,n[1])?1:0;XBYM.bl.set(i,v);}return v;}
function xbbTeam(C,atk){const k=xbvKey()+'|'+(atk?1:0);if(XBYM.k!==xbvKey()){XBYM.k=xbvKey();XBYM.T={};}let T=XBYM.T[k];if(T)return T;
 const M=C.meta,a=atk?M.attacker:M.defender,walls=window.SpawnBarriers?SpawnBarriers.pieces(C.key).filter(q=>q.side===(atk?'atk':'def')):[];
 return XBYM.T[k]={walls,area:BotBrain.buyArea(C.nav.nodes,C.nav.adj,nmNear(C,a[0],a[2],a[1]),walls,i=>!C.playable||!!C.playable[i]),spots:[]};}
const XBB_RING=[[.15,0],[-.15,0],[0,.15],[0,-.15]];
function xbbClose(T,x,z){const nr=BotBrain.buyNear(T.walls,x,z);return !!nr&&(nr.d<XBYM_IN||!nr.inside&&nr.d<1.5);}
function xbbOk(C,T,y0){return (x,z)=>{{const nr=BotBrain.buyNear(T.walls,x,z);if(nr&&(nr.d<XBYM_IN+.05||!nr.inside&&nr.d<1.5))return null;}const i=nmNear(C,x,z,y0);if(i<0||!T.area.f[i])return null;const n=C.nav.nodes[i];if(Math.hypot(n[0]-x,n[2]-z)>.9||Math.abs(n[1]-y0)>2.5)return null;
 let y;try{y=nmHeight(C,x,z,n[1]+.3);}catch(e){return null;}if(!(Math.abs(y-n[1])<.45)||nmBlocked(C,x,z,.5,y)||!nmLeash(C,x,z,y,n[0],n[2]))return null;
 for(let k=0;k<4;k++)if(nmBlocked(C,x+XBB_RING[k][0],z+XBB_RING[k][1],.4,y))return null;/* no step lip within the arrival slack: a .5 capsule can clear a low step that a body stopping .15 m off the spot stands in */
 for(let k=1;k<4;k++){const t=k/4;if(nmBlocked(C,n[0]+(x-n[0])*t,n[2]+(z-n[2])*t,.4,y))return null;}return [y,i];};}
function xbbInit(C,u,team,atk){const T=xbbTeam(C,atk),key=XBYM.k+'|'+(atk?1:0);if(u.xbb&&u.xbb.key===key)return u.xbb;u.smMotor=null;u.svx=u.svz=0;/* a new buy phase starts from rest (the round reset put it in spawn) */const p=u.g.position,N=C.nav.nodes;
 const rand=BotRoutes.rng(BotRoutes.hash('buy|'+(u.name||'')+'|'+key+'|'+xbvSeed())),start=nmNear(C,p.x,p.z,p.y),B={key,st:BotBrain.buyNew(xbBrain(u),rand),spot:null,face:[0,atk?-1:1],route:[],rg:null,stuck:0,last:[p.x,p.z],fails:0,bad:null,esc:null,off:!(start>=0&&T.area.f[start])||!T.walls.length};
 if(!B.off){let site=null;try{const P=xbvPlan(u,team,atk,C),g=P.stages&&P.stages[0]?P.stages[0].site:atk?FV.sp.site:P.site;site=(g==='mid'?xbvMid(C):C.meta.sites[g])||C.meta.sites[Object.keys(C.meta.sites)[0]];}catch(e){}/* a mid player lines up at the exit toward mid (= server sitePoint) */
  const path=site?nmPath(C,start,nmNear(C,site[0],site[2],site[1])):null;let exit=site?BotBrain.buyExit(N,path,T.walls):null;
  /* its goal inside its own area (a defender's own site): it walks there and holds instead of lining up */
  const h=!exit&&BotBrain.buyHold(N,path,T.area,T.walls,T.spots,(x,z,y)=>xbbOk(C,T,y)(x,z),i=>xbbBl(C,i));if(h){B.spot=h.p;B.hold=true;T.spots.push(h.p);B.face=h.face;return u.xbb=B;}
  if(!exit){/* no route out through a wall: the wall nearest the bot */const nr=BotBrain.buyNear(T.walls,p.x,p.z),w=nr.w;exit={x:w.ax+w.tx*nr.t,y:w.y0!=null?w.y0+.4:p.y,z:w.az+w.tz*nr.t,dx:-w.nx,dz:-w.nz,w};/* the wall's floor, not the bot's (a far wall can sit on another level) */}
  const sp=BotBrain.buySpot(exit,T.walls,T.spots,rand,xbbOk(C,T,exit.y));if(sp){B.spot=sp.p;T.spots.push(sp.p);B.face=[exit.dx,exit.dz];}}
 return u.xbb=B;}
function xbbStep(C,u,team,atk,dt){
 const B=xbbInit(C,u,team,atk),p=u.g.position;if(B.off||!dt)return;const T=xbbTeam(C,atk),N=C.nav.nodes;
 const mates=team.filter(v=>v!==u&&v.alive&&v.g).map(v=>({x:v.g.position.x,z:v.g.position.z,m:v.xbb}));if(team===allies&&player&&player.hp>0)mates.push({x:player.x,z:player.z,m:null});
 const ok=xbbOk(C,T,p.y),c={dt,left:FV.buy,pos:[p.x,p.z],spot:B.spot,face:B.face,
  wander:()=>{const av=mates.map(v=>[v.x,v.z]);for(const v of mates){const g=v.m&&v.m.st.goal;if(g)av.push([g[0],g[2]]);}const i=BotBrain.buyWander(N,T.area,[p.x,p.z],B.st.rand,av,T.walls,j=>!xbbBl(C,j));return i>=0?N[i]:null;},
  free:(x,z)=>!!ok(x,z)&&mates.every(v=>{const q=v.m&&v.m.spot,g=v.m&&v.m.st.goal;return Math.hypot(v.x-x,v.z-z)>1.05&&!(q&&Math.hypot(q[0]-x,q[2]-z)<1.05)&&!(g&&Math.hypot(g[0]-x,g[2]-z)<1.05);})};
 const d=BotBrain.buyTick(B.st,c),turn=(fx,fz,k)=>{const t=Math.atan2(fx,fz);u.g.rotation.y+=xAng(t-u.g.rotation.y)*Math.min(1,dt*k);};
 if(d.face)turn(d.face[0],d.face[1],3.5);
 let vx=0,vz=0,walk=!!d.walk;
 if(d.goal){const g=d.goal;if(B.rg!==g){B.rg=g;const occ=[];for(const v of mates){occ.push([v.x,v.z]);if(v.m&&v.m.spot)occ.push([v.m.spot[0],v.m.spot[2]]);}
   B.route=BotBrain.buyRoute(N,C.nav.adj,T.area,nmNear(C,p.x,p.z,p.y),nmNear(C,g[0],g[2],g[1]),i=>(xbbBl(C,i)?8:0)+(B.bad&&B.bad.has(i)?6:0)+(occ.some(o=>Math.abs(o[0]-N[i][0])<1.1&&Math.abs(o[1]-N[i][2])<1.1)?5:0));B.stuck=0;B.last=[p.x,p.z];}
  if(Math.hypot(p.x-B.last[0],p.z-B.last[1])>.25){B.last=[p.x,p.z];B.stuck=0;}else if((B.stuck+=dt)>.6){B.stuck=0;if(B.route.length)(B.bad||(B.bad=new Set())).add(B.route[0]);B.rg=null;B.fails++;if(B.st.mode==='mill'&&B.fails>1)B.st.legT=99;
   const gx=g[0]-p.x,gz=g[2]-p.z,gl=Math.hypot(gx,gz)||1;let best=null,bd=-2;for(let k=0;k<16;k++){const a=k*Math.PI/8,ex=Math.sin(a),ez=Math.cos(a);if(blocked(p.x+ex*.3,p.z+ez*.3,.45,p.y)||xbbClose(T,p.x+ex*.3,p.z+ez*.3))continue;const dot=(ex*gx+ez*gz)/gl;if(dot>bd){bd=dot;best=[ex,ez];}}
   if(best)B.esc={v:best,until:FV.buy-.3};
   if(B.st.mode==='go'&&B.fails>=2&&B.spot&&!B.hold){const k=T.spots.indexOf(B.spot),nr=BotBrain.buyNear(T.walls,p.x,p.z),sp=nr&&BotBrain.buySpot({x:nr.w.ax+nr.w.tx*nr.t,z:nr.w.az+nr.w.tz*nr.t,w:nr.w},T.walls,T.spots.filter(q=>q!==B.spot),B.st.rand,ok);if(sp&&Math.hypot(sp.p[0]-p.x,sp.p[2]-p.z)<Math.hypot(B.spot[0]-p.x,B.spot[2]-p.z)){if(k>=0)T.spots[k]=sp.p;B.spot=sp.p;B.fails=0;}}}
  if(B.esc&&FV.buy>B.esc.until){vx=B.esc.v[0];vz=B.esc.v[1];walk=false;}
  else{const t=BotBrain.buyNext(N,B.route,p.x,p.z,g[0],g[2],XBYM.V),l0=Math.hypot(t[0]-p.x,t[1]-p.z)||1,v=BotBrain.buySep(p.x,p.z,mates.map(m=>[m.x,m.z]),(t[0]-p.x)/l0,(t[1]-p.z)/l0,XBYM.V);vx=v[0];vz=v[1];}
  if(!d.face&&(vx||vz))turn(vx,vz,8);}
 else{B.rg=null;B.route.length=0;B.stuck=0;}
 // move like the round's bots (weapon run speed, walk x0.6, axis-separated against blocked()), never within XBYM_IN of a spawn wall.
 // Acceleration / stop through the shared motor like the round's bots (83b0d90 xSmV: groundMove on u.smMotor in m/s, 128 Hz
 // sub-steps), without xSmV's teammate spacing steer (the line-up stands 0.75 m apart on purpose); a blocked axis stops it.
 const D=typeof DIFF!=='undefined'&&DIFF[S.diff]||{speed:1},run=botRun(u,walk)*Math.min(1,D.speed||1),bs=run*dt,x0=p.x,z0=p.z,VFm=window.ValorantFeel,Pm=VFm&&VFm.groundMove&&run>1e-6?(u.smMotor||(u.smMotor={vx:0,vz:0})):null;
 if(Pm){const l=Math.hypot(vx,vz);if(l>1){vx/=l;vz/=l;}const parts=Math.max(1,Math.ceil(dt*128)),h=dt/parts;let dx=0,dz=0;for(let i=0;i<parts;i++){const v=VFm.groundMove(Pm,vx*run,vz*run,run/VFm.C.accelTime,h);dx+=v.dx;dz+=v.dz;}vx=dx/bs;vz=dz/bs;u.svx=Pm.vx/run;u.svz=Pm.vz/run;}
 // a step is taken only where the capsule also stands clear on the floor it lands on or a step up from it (no embedding in a
 // spawn rim / ledge lip). Stepping down, the floor is the highest under the capsule's footprint (0.42 m, as the motor's support), so a bot
 // walking off a ledge stays on it until clear of the lip instead of snapping into it; a bot already embedded (spawned on
 // a lip) moves as the round's bots do until it is clear.
 const strict=!nmBlocked(C,p.x,p.z,.4,p.y),floor=(x,z)=>{let y=nmHeight(C,x,z,p.y+.01);if(y<p.y-.05)for(let k=0;k<8;k++){const a=k*Math.PI/4;let q;try{q=nmHeight(C,x+Math.cos(a)*.42,z+Math.sin(a)*.42,p.y+.01);}catch(e){continue;}if(q<=p.y+.05&&q>y)y=q;}return y;};
 const step=(x,z)=>{if(blocked(x,z,.45,p.y))return false;let y;try{y=floor(x,z);}catch(e){return false;}if(!(y>p.y-1.2)||(strict&&nmBlocked(C,x,z,.4,y)&&nmBlocked(C,x,z,.4,y+.32)))return false;p.x=x;p.z=z;p.y=y;return true;};
 if(vx){const x=p.x+vx*bs;if(!(!xbbClose(T,x,p.z)&&step(x,p.z))&&Pm)Pm.vx=0;}
 if(vz){const z=p.z+vz*bs;if(!(!xbbClose(T,p.x,z)&&step(p.x,z))&&Pm)Pm.vz=0;}
 u.spd=Pm?Math.hypot(Pm.vx,Pm.vz):Math.hypot(p.x-x0,p.z-z0)/dt;u.sf=u.spd/botRun(u,false);u.mv=u.spd>.05;u.wk=walk?1:0;if(typeof botStep==='function')botStep(u,dt,Math.hypot(p.x-x0,p.z-z0),walk,u.spd);}/* footsteps: the shared rule (1.85 m stride while running) */
function xbbTick(dt){const C=nmActive();if(!C||!C.nav||!C.meta||!C.meta.attacker)return;
 for(const [team,atk] of [[bots,!FV.atk],[allies,!!FV.atk]])for(const u of team){if(!u||!u.alive||!u.g||u.nt||u.det>0)continue;try{xbbStep(C,u,team,atk,dt);}catch(e){u.xbb=Object.assign(u.xbb||{},{off:true});}}}
function xbbEnd(){for(const u of bots.concat(allies))if(u){u.xbb=null;u.mv=false;u.spd=0;}}
if(typeof fiveTick==='function'){const ft0=fiveTick;fiveTick=function(dt){const on=xbbOn(),r=ft0.apply(this,arguments);if(on){try{xbbTick(window.xLdOn?0:Math.min(.1,dt||0));}catch(e){}if(!(FV.buy>0))xbbEnd();}return r;};}
// ---- Perception (bots-perception-2; vendor/bot-brain.cjs SENSE / inView / audible / mem*, as the server's Simulation.bot,
// bots.js hearTick / botView). Enemy and ally bots see an enemy only inside the 103 deg view cone (xbInView) with a clear
// line; a shot needs a fresh, uncached line to the target that frame (xbLosNow: the 100 ms los cache never lets a burst
// go on into a wall the target just stepped behind, and a fight ends the frame sight is lost). What a bot hears (running
// footsteps within 30 m - the player's own included - gunshots across the map, suppressed Ghost / Spectre / Phantom
// within 40 m, a bot's ability cast within 30 m) or last saw goes into u.xMem; out of a fight it looks at the freshest
// contact at its own turn rate (xbFaceTo, xFace) and Deathmatch bots hunt it (xbHunt) or roam the spawn points - never
// where an enemy really is.
function xbNow(){return performance.now()/1000;}
function xbInView(u,dx,dz,d){if(!window.BotBrain||!u||!u.g)return true;return BotBrain.inView(u.g.rotation.y-Math.atan2(dx,dz),d);}
function xbLosNow(from,eye){return typeof losRaw==='function'?losRaw(from,eye):true;}
function xbMem(u){return u.xMem||(u.xMem=BotBrain.memNew());}
function xbId(t){return t===player?'player':(t&&t.name)||'?';}
function xbLive(id){if(id==='player')return !!player&&player.hp>0;for(const L of [bots,allies])for(const u of L)if(u&&u.name===id)return !!u.alive;return false;}
function xbSeen(u,t,x,y,z){if(!window.BotBrain||!u)return;BotBrain.memNote(xbMem(u),xbId(t),x,y||0,z,xbNow(),'seen');}
function xbBest(u,age){if(!window.BotBrain||!u||!u.xMem||!u.g)return null;const m=u.xMem;for(const id in m.c)if(!xbLive(id))delete m.c[id];const p=u.g.position;return BotBrain.memBest(m,xbNow(),p.x,p.z,age);}
function xbGlance(u){const c=xbBest(u,window.BotBrain?BotBrain.SENSE.glance:0);if(!c)return null;const p=u.g.position,d=Math.hypot(c.x-p.x,c.z-p.z);return d>.8&&d<45?c:null;}
function xbFaceTo(u,want,dt){const B=xbBrain(u);if(!B||!u.g)return null;return BotBrain.turnStep(B,u.g.rotation.y,want,dt,u.xTurnSt||(u.xTurnSt={v:0})).yaw;}
// out of a fight in Deathmatch / TDM: the freshest contact (BotBrain.SENSE.hunt s), else a spawn point 15 m+ away (new one
// on arrival or after 15 s); other modes keep their own goals.
function xbHunt(u,tg,out){const c=xbBest(u,window.BotBrain?BotBrain.SENSE.hunt:0);if(c)return x2(out,c.x,c.z);const p=u.g.position,now=xbNow();
 if(mode==='five'&&FV.dm&&typeof dmPts==='function'){let r=u.xRoam;if(!r||Math.hypot(r[0]-p.x,r[1]-p.z)<2.5||now>(u.xRoamT||0)){const P=dmPts()||[];r=null;for(let k=0;k<12&&P.length;k++){const q=P[Math.floor(Math.random()*P.length)];if(Math.hypot(q[0]-p.x,q[1]-p.z)>=15){r=q;break;}}if(!r&&P.length)r=P[0];u.xRoam=r;u.xRoamT=now+15;}if(r)return x2(out,r[0],r[1]);}
 return x2(out,tg.x,tg.z);}
// what an unsighted bot knows of the nearest threat for its peek / creep logic: [dx, dz, dist] toward the freshest contact,
// or nothing known (dist 1e9: no jiggle, no creeping up on an enemy it has not seen or heard).
function xbKnown(u,p){const c=xbBest(u,window.BotBrain?BotBrain.SENSE.hunt:0);if(!c)return [0,0,1e9];const dx=c.x-p.x,dz=c.z-p.z;return [dx,dz,Math.hypot(dx,dz)||.01];}
// what an unsighted bot's ability logic (botAb, both teams) gets as its target: the freshest contact it saw / heard
// (BotBrain.SENSE.hunt s), shaped like a base-loop target {x, y, z, t: null, mem: 1}, or null - never the nearest real enemy.
function xbAbKnown(u){const c=u&&u.g?xbBest(u,window.BotBrain?BotBrain.SENSE.hunt:0):null;if(!c)return null;const o=u.xAbK||(u.xAbK={x:0,y:0,z:0,t:null,mem:1});o.x=c.x;o.y=c.y||0;o.z=c.z;return o;}
// hearing range for the turn / hold / push reaction (base xHear -> xbvSound): BotBrain.reactR, the server botSense's ranges -
// a gunshot within 35 m (suppressed too), running footsteps / an ability cast within the 30 m sound circle; every
// audible sound also goes into memory (xbvHearMem), map-wide shots included.
function xbEarR(){const k=XBH.k||'shot';if(!window.BotBrain)return k==='shot'?35:25;return BotBrain.reactR(k,k==='shot'?xbEarW():null);}
// the gun of a heard shot: SFX.at passes it; the player's own shots (shoot -> xHear, no XBH.k) are the player's gun
function xbEarW(){return XBH.w||(!XBH.k&&typeof wName==='function'?wName():null);}
function xbvHearMem(p,kind,w){if(!p||!window.BotBrain)return;let src=null,srcBot=false;
 if(player&&player.hp>0&&Math.hypot(player.x-p.x,player.z-p.z)<.6)src='player';
 for(const L of [bots,allies])for(const u of L){if(src||!u||!u.alive||!u.g)continue;if(Math.hypot(u.g.position.x-p.x,u.g.position.z-p.z)<.6){src=u.name;srcBot=L===bots;}}
 if(!src)return;if(src==='player'&&kind==='shot'&&!w&&typeof wName==='function')w=wName();const lis=srcBot?allies:bots,now=xbNow(),k=kind==='shot'?'shot':kind==='cast'?'cast':'step';
 for(const u of lis){if(!u||!u.alive||!u.g)continue;const q=u.g.position,d=Math.hypot(q.x-p.x,q.z-p.z);if(!BotBrain.audible(k,d,w))continue;const e=BotBrain.earSpot(p.x,p.z,q.x,q.z,Math.random(),Math.random());BotBrain.memNote(xbMem(u),src,e[0],p.y||0,e[1],now,'heard');}}
// ---- END BOT VARIETY ----
