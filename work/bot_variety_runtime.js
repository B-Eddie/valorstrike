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
// a new fight: reaction (s), crosshair error (smaller when the crosshair was already on the angle), stand-still time before strafing
function xbEngage(u,pre){const B=xbBrain(u);if(!B){u.rtE=.26;u.xhE=null;u.stand=.35;return;}const r=xbRand(u);u.rtE=BotBrain.reaction(B,r);u.xhE=BotBrain.crosshair(B,r,!!pre);u.stand=B.stand*(.8+r()*.4);}
// reaction gate in ms for difficulty D (normal = the bot's own 180-320 ms draw; +150 ms when it was not pre-aimed)
function xbRt(u,D){const k=(D&&D.rt?D.rt:260)/260;return ((u.rtE||.26)*1000+(u.pre?0:150))*k;}
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
 P={seed,rand,go:0,lurk:!!role.lurk,site:role.site,spot:null,post:null,post0:null,role,strat:S.plan.type,stages:(role.stages||[]).map(g=>Object.assign({pt:null},g)),rotD:(S.plan.rotateDelay?S.plan.rotateDelay[0]+rand()*(S.plan.rotateDelay[1]-S.plan.rotateDelay[0]):2)*1000};
 XBV.plans.set(u,P);
 // staggered start: the role's delay, a little longer for cautious players (ms)
 P.delay=atk?((role.delay||0)+(1-per.ag)*.6+rand()*.3)*1000:0;
 if(P.lurk){P.lurkSite=role.stages[0].site;P.lurkUntil=100-role.stages[0].until;}
 if(C.meta.sites[P.site])P.spot=xbvSpot(C,xbvSiteCenter(C,P.site,atk),xbvTeamTaken(team,u,'spot'),rand,atk?{rMin:1.5,rMax:7,gap:3}:role.offAngle?{rMin:6,rMax:14,gap:4}:{rMin:2,rMax:10,gap:4});
 P.spotSite=P.site;return P;
}
// A staged position: the point part of the way along the bot's own nav path from its spawn (or a team spawn) to a site.
function xbvStage(C,u,g,P){
 if(g.pt!==null)return g.pt;g.pt=false;if(typeof nmPath!=='function'||!C.meta.sites[g.site])return false;
 const N=C.nav.nodes,ok=j=>!C.playable||!!C.playable[j],snap=(p,r)=>BotRoutes.spot(C.nav,p,[],P.rand,{rMin:0,rMax:r,gap:0,ok}),pos=u.g.position;
 const base=g.from==='atk'?C.meta.attacker:g.from==='def'?C.meta.defender:[pos.x,pos.y,pos.z],a=snap(base,4),b=snap(xbvSiteCenter(C,g.site,true),4);if(a<0||b<0)return false;
 const path=g.from==='atk'?nmPath(C,b,a):nmPath(C,a,b);if(!path||path.length<2)return false;
 let L=0;for(let k=1;k<path.length;k++)L+=Math.hypot(N[path[k]][0]-N[path[k-1]][0],N[path[k]][2]-N[path[k-1]][2]);
 let d=0,k=1;for(;k<path.length;k++){d+=Math.hypot(N[path[k]][0]-N[path[k-1]][0],N[path[k]][2]-N[path[k-1]][2]);if(d>=L*g.frac)break;}
 const n=N[path[Math.min(k,path.length-1)]],q=snap(n,3),m=q>=0?N[q]:n;return g.pt=[m[0],m[1],m[2]];
}
// Defender information: an enemy seen or heard within 16 m of a site (once per frame); rotators rotate after their delay.
function xbvInfo(team,C){
 const k=xbvKey();if(XBV.info&&XBV.info.k!==k)XBV.info=null;if(XBV.infoF===XNF)return XBV.info;XBV.infoF=XNF;
 for(const d of team){if(!d||!d.alive)continue;let p=null;if(d.see>0){const t=d.xTt||d.xTg;p=t&&(t.g?t.g.position:t);}if(!p&&d.hearT>0&&d.hear)p={x:d.hear[0],z:d.hear[1]};if(!p)continue;
  for(const n of Object.keys(C.meta.sites)){const c=C.meta.sites[n];if(Math.hypot(p.x-c[0],p.z-c[2])<16){const now=performance.now();if(!XBV.info||(XBV.info.site!==n&&now>XBV.info.at+6000))XBV.info={k,site:n,at:now};if(XBV.info.site===n){XBV.info.x=p.x;XBV.info.z=p.z;}break;}}}
 return XBV.info;
}
function xbvSiteCenter(C,name,atk){const g=atk&&C.siteGoals&&C.siteGoals[name],p=C.meta.sites[name];return g?[g[0],p[1],g[1]]:[p[0],p[1],p[2]];}
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
 if(!atk){const I=xbvInfo(team,C),seen=s.seen||(I&&now>=I.at+P.rotD?I.site:null);if(seen&&P.role&&P.role.rotator&&seen!==P.site){site=seen;st=null;}} // rotators answer information
 if(st){const q=xbvStage(C,u,st,P);if(q)return x2(out,q[0],q[2]);} // default / fake / lurk / split / aggressive-push positions
 if(!C.meta.sites[site])return goal.apply(this,arguments);
 if(P.spotSite!==site){P.spotSite=site;P.spot=xbvSpot(C,xbvSiteCenter(C,site,atk),xbvTeamTaken(team,u,'spot'),P.rand,atk?{rMin:1.5,rMax:7,gap:3}:{rMin:2,rMax:10,gap:4});}
 return P.spot?x2(out,P.spot[0],P.spot[2]):goal.apply(this,arguments);
};}
// Lane-varied routes: nmNext's A* result is re-routed once per goal through BotRoutes.route (seeded per bot and round,
// penalised along teammates' routes) and followed from the cache until the goal changes or the unit leaves it.
function xbvPath(C,u,s,e,banned,base){
 const now=performance.now(),N=C.nav.nodes,v=u.xvr;
 if(v&&v.e===e&&v.C===C&&v.k===XBV.k&&now<v.until){
  let k=v.path.indexOf(s,v.i);if(k<0){const q=N[s];for(let j=v.i;j<Math.min(v.path.length,v.i+14);j++){const n=N[v.path[j]];if(Math.hypot(n[0]-q[0],n[2]-q[2])<2.5&&Math.abs(n[1]-q[1])<1.2){k=j;break;}}}
  if(k>=0&&(!banned||!banned.size||v.path.slice(k,k+2).length<2||!banned.has(v.path[k]+'>'+v.path[k+1]))){v.i=k;return v.path.slice(k);}
 }
 const path=base(C,s,e,banned);if(path.length<4)return path;
 if(XBV.budget.f!==XNF){XBV.budget.f=XNF;XBV.budget.n=0;}if(XBV.budget.n>=2)return path;XBV.budget.n++; // at most two varied re-routes per frame
 const team=bots.includes(u)?bots:allies,peers=[];for(const t of team)if(t!==u&&t.alive&&t.xvr&&t.xvr.k===XBV.k)peers.push({path:t.xvr.path.slice(t.xvr.i)});
 const r=BotRoutes.route(C.nav,path,(u.name||'')+'|'+XBV.k+'|'+e,peers,null,banned,typeof nmClimbOk==='function'?(a,b)=>N[b][1]-N[a][1]<=.321||nmClimbOk(C,a,b):null); // the instinct climb rule, as nmPath
 u.xvr={e,C,k:XBV.k,path:r,i:0,until:now+12000};return r.slice();
}
if(typeof nmPath==='function'&&typeof nmNext==='function'){/* native maps present (page harnesses strip them) */const np=nmPath;let cur=null;nmPath=function(C,s,e,banned){return cur&&window.BotRoutes?xbvPath(C,cur,s,e,banned,np):np.apply(this,arguments);};
 const nn=nmNext;nmNext=function(C,u,gx,gz){const prev=cur;cur=mode==='five'&&!FV.dm&&u&&u!==player&&!(u.see>0)?u:null;try{return nn.apply(this,arguments);}finally{cur=prev;}};}
// Teammate spacing while walking (not while fighting): soft steer away from teammates closer than 1.8 m.
{const sm=xSmV;xSmV=function(u,dt,vx,vz){
 if((vx||vz)&&!(u.see>0)&&window.BotRoutes&&running&&mode==='five'&&typeof nmActive==='function'&&nmActive()){
  const team=bots.indexOf(u)>=0?bots:allies,o=XBV.oth;o.length=0;for(const t of team)if(t!==u&&t.alive&&t.g)o.push(t.g.position);if(team===allies&&player&&player.hp>0)o.push(player);
  if(o.length){const r=BotRoutes.steer(u.g.position,o,vx,vz,team.indexOf(u),1.8,XBV.sv);vx=r[0];vz=r[1];}}
 return sm.call(this,u,dt,vx,vz);};}
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
const XBV_CAST={Phoenix:{fire:()=>typeof xBHotHands==='function'&&xBHotHands},Sage:{slow:()=>typeof xBSlowOrb==='function'&&xBSlowOrb},Sova:{shock:()=>typeof xBShock==='function'&&xBShock},
 Omen:{flash:()=>typeof xBParanoia==='function'&&xBParanoia},Cypher:{smoke:()=>typeof xBCage==='function'&&xBCage},Skye:{drone:()=>typeof xBTrail==='function'&&xBTrail},Killjoy:{turret:()=>typeof xBTurret==='function'&&xBTurret}};
const XBV_REACH={fire:13,slow:15,shock:40,flash:25,smoke:10,drone:20,turret:30};
function xbvUtilX(b){
 const C=typeof nmActive==='function'&&nmActive(),s=FV.sp;if(!C||mode!=='five'||FV.dm||FV.buy>0||!window.BotBrain||!s||!b||!b.g||!C.meta||!C.meta.sites||typeof xBAtk!=='function')return null;
 const al=allies.indexOf(b)>=0,team=al?allies:bots,atk=xBAtk(al),P=xbvPlan(b,team,atk,C),S=xbvStrat(team,atk,C);
 const U=P.util||(P.util={used:0,it:null,at:0,kj:0,rand:BotRoutes.rng(BotRoutes.hash((b.name||'')+'|util|'+xbvKey()+'|'+xbvSeed()))});
 return {C,s,al,team,atk,P,S,U,planted:s.st==='plant',p:b.g.position};}
function xbvUtil(b,see,tg,X){
 X=X||xbvUtilX(b);if(!X)return null;const {C,s,atk,P,S,U,planted,p}=X,now=performance.now();if(U.it&&now<U.it.until)return U.it;if(now<U.at)return null;U.at=now+300+U.rand()*300;
 const sites=C.meta.sites,sc=n=>sites[n]?xbvSiteCenter(C,n,atk):null,dist=c=>c?Math.hypot(c[0]-p.x,c[2]-p.z):Infinity,site=sc(atk?s.site:P.site),other=sc(S.plan.other);
 const sp=planted&&typeof spike!=='undefined'&&spike&&spike.parent?spike.position:planted&&s.x!=null?{x:s.x,z:s.z}:null,spd=sp?Math.hypot(sp.x-p.x,sp.z-p.z):Infinity;
 let threat=false;if(atk&&sp)threat=!!s.du||s.dt>0||!!(see&&tg&&Math.hypot(tg.x-sp.x,tg.z-sp.z)<12)||!!(b.hearT>0&&b.hear&&Math.hypot(b.hear[0]-sp.x,b.hear[1]-sp.z)<12);
 const I=!atk&&!planted?xbvInfo(X.team,C):null,info=!!(I&&I.site===P.site&&now-I.at<8000);
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
 // the plan's utility with no older bot path (Hot Hands, Slow Orb, Shock Bolt, Paranoia, Cyber Cage, Trailblazer, Turret):
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
var XBH={k:null};
function xbvSound(p,kind){
 if(!p||!running||mode!=='five'||FV.dm||!window.BotBrain)return;const now=performance.now(),s=FV.sp||{};
 for(const L of [bots,allies])for(const u of L){if(!u||!u.alive||!u.g||!(u.hearT>=1.2)||!u.hear||u.hear[0]!==p.x||u.hear[1]!==p.z||u.see>0||(u.xHeardAt&&now-u.xHeardAt<1500))continue;
  const atk=typeof xBAtk==='function'?xBAtk(L===allies):false;if(s.c===u||(atk&&s.st==='drop')||(!atk&&s.st==='plant'&&s.t<15))continue;
  u.xHeardAt=now;const B=xbBrain(u);if(!B)continue;const r=xbRand(u),q=u.g.position,d=Math.hypot(p.x-q.x,p.z-q.z),c=BotBrain.onSound(B,r,kind,d);u.xSnd=c;
  if(c==='push'){u.tr=[p.x,p.z];u.trT=2+r();u.xHold=null;}
  else if(c==='hold'){const dur=.6+B.patience*1.2;u.xHold={until:now+dur*1000,x:p.x,z:p.z};u.hearT=Math.max(u.hearT,dur);}
  else u.xHold=null;}
}
if(typeof SFX!=='undefined')['at','step'].forEach(k=>{const f=SFX[k];if(f)SFX[k]=function(p){const k0=XBH.k;XBH.k=k==='at'?'shot':'step';try{return f.apply(this,arguments);}finally{XBH.k=k0;}};});
if(typeof xHear==='function'){const h0=xHear;xHear=function(p){const r=h0.apply(this,arguments);try{xbvSound(p,XBH.k||'step');}catch(e){}return r;};}
// holding: stand still (goal = where it stands) while it faces the sound; a fight or a trade ends it
{const g0=xGoal;xGoal=function(u,team,atk,out){if(u&&u.xHold&&u.g&&!(u.see>0)&&mode==='five'){if(performance.now()<u.xHold.until){const p=u.g.position;if(u.hearT>0){u.hear=u.hear||[0,0];u.hear[0]=u.xHold.x;u.hear[1]=u.xHold.z;}return x2(out,p.x,p.z);}u.xHold=null;}return g0.apply(this,arguments);};}
// Turn-rate limit per bot (BotBrain personality turn 7-14 rad/s, as the server; was 12 rad/s for every bot) and no shot
// while the body is still swinging onto the target (xbTurned: rendered yaw within 0.3 rad of the aim): no instant 180s.
if(typeof xBotYaw==='function'){xBotYaw=function(dt){if(!dt)return;const now=performance.now();
 for(const L of [typeof bots!=='undefined'?bots:[],typeof allies!=='undefined'?allies:[]])for(const u of L){if(!u||!u.g)continue;const t=u.g.rotation.y;if(u.xyw==null||!u.alive){u.xyw=t;u.xywT=now;continue;}
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
// ---- END BOT VARIETY ----
