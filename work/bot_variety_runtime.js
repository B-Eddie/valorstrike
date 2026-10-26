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
function xbAimErr(u,aim,D){if(!u||!u.xhE)return;const B=xbBrain(u);if(!B)return;const e=BotBrain.crosshairAt(u.xhE,B,u.see||u.ts||0,XB_E),k=D&&D.ae?D.ae/1.3:1,hl=Math.hypot(aim.x,aim.z)||1,hx=-aim.z/hl,hz=aim.x/hl;aim.x+=hx*e[0]*k;aim.z+=hz*e[0]*k;aim.y+=e[1]*k;aim.normalize();}
function xbvKey(){return FV.you+'|'+FV.them+'|'+FV.map+'|'+(FV.atk?1:0);}
function xbvTeamTaken(team,u,field){const out=[];for(const v of team){if(v===u)continue;const q=XBV.plans.get(v);if(q&&q[field])out.push(q[field]);}return out;}
// one spread standing spot near a site centre; null when the nav has nothing better than the centre itself
function xbvSpot(C,center,taken,rand,o){const i=BotRoutes.spot(C.nav,center,taken,rand,Object.assign({ok:j=>!C.playable||!!C.playable[j]},o));if(i<0)return null;const p=C.nav.nodes[i];return [p[0],p[1],p[2]];}
// Team strategy for the round (shared BotBrain decisions); a bot carrier is sent to the strategy's site.
function xbvStrat(team,atk,C){
 const k=xbvKey()+'|'+(atk?'a':'d');let S=XBV.strat.get(k);if(S)return S;
 const names=Object.keys(C.meta.sites),seed=BotRoutes.hash(xbvSeed()+'|'+k),log=XBV.log[atk?'a':'d'],s=FV.sp;
 const plan=atk?BotBrain.attackPlan(seed,names,{last:log.slice(-4)}):BotBrain.defensePlan(seed,names,{last:log.slice(-4)});
 const order=team.slice().sort((a,b)=>BotRoutes.hash((a.name||'')+'|'+k)-BotRoutes.hash((b.name||'')+'|'+k)),R=BotBrain.roles(plan,order.length,seed^0x9e3779b9,atk,names,atk?order.indexOf(s.c):-1),roles=new Map();
 order.forEach((v,i)=>roles.set(v,R[i]));log.push({type:plan.type,site:plan.site||plan.stack});if(log.length>8)log.shift();
 if(atk&&s&&s.st==='carry'&&s.c&&s.c!==player&&C.meta.sites[plan.site])s.site=plan.site;
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
  for(const n of Object.keys(C.meta.sites)){const c=C.meta.sites[n];if(Math.hypot(p.x-c[0],p.z-c[2])<16){const now=performance.now();if(!XBV.info||(XBV.info.site!==n&&now>XBV.info.at+6000))XBV.info={k,site:n,at:now};break;}}}
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
// ---- END BOT VARIETY ----
