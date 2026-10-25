// ---- BOT VARIETY ----
// Native-map 5v5 bots stop moving as one blob: per-round plans (own spot inside the site, one lurker on the other site,
// staggered starts by personality, shuffled defender sites with spread holds), lane-varied routes from the shared
// vendor/bot-routes.cjs (seeded per bot and round, penalised where teammates already walk) and teammate spacing while
// moving. Combat, the carrier's plant goal, retakes/defuses and dropped-Spike pickups keep their exact goals.
var XBV={k:'',plans:new Map(),oth:[],sv:[0,0],budget:{f:-1,n:0}};
function xbvKey(){return FV.you+'|'+FV.them+'|'+FV.map+'|'+(FV.atk?1:0);}
function xbvTeamTaken(team,u,field){const out=[];for(const v of team){if(v===u)continue;const q=XBV.plans.get(v);if(q&&q[field])out.push(q[field]);}return out;}
// one spread standing spot near a site centre; null when the nav has nothing better than the centre itself
function xbvSpot(C,center,taken,rand,o){const i=BotRoutes.spot(C.nav,center,taken,rand,Object.assign({ok:j=>!C.playable||!!C.playable[j]},o));if(i<0)return null;const p=C.nav.nodes[i];return [p[0],p[1],p[2]];}
function xbvPlan(u,team,atk,C){
 const k=xbvKey();if(XBV.k!==k){XBV.k=k;XBV.plans.clear();}
 let P=XBV.plans.get(u);if(P)return P;
 const per=u.per||{ag:.5,fl:.5,sd:.5},seed=BotRoutes.hash((u.name||'')+'|'+k),rand=BotRoutes.rng(seed),names=Object.keys(C.meta.sites),s=FV.sp;
 P={seed,rand,go:0,lurk:false,site:null,spot:null,post:null,post0:null};XBV.plans.set(u,P);
 if(atk){
  // staggered start: entry-minded bots go at once, the rest leave spawn 0.4-3.2 s later
  P.delay=per.ag>.75?0:(.4+(1-per.ag)*2.2+rand()*.6)*1000;
  // one lurker per round: the most flank-minded non-carrier (fl > 0.6) on a team of four or more holds the other site
  const cand=team.filter(v=>v.alive&&v!==s.c&&v.per&&v.per.fl>.6).sort((a,b)=>b.per.fl-a.per.fl)[0];
  if(cand===u&&team.length>=4&&names.length>1){P.lurk=true;const other=names.filter(n=>n!==s.site);P.site=other[Math.floor(rand()*other.length)];P.lurkUntil=25+rand()*15;}
  else P.site=s.site;
 }else{
  // defenders: a per-round shuffled seat order spread round-robin over the sites (who anchors where changes every round)
  const order=team.slice().sort((a,b)=>BotRoutes.hash((a.name||'')+'|'+k)-BotRoutes.hash((b.name||'')+'|'+k)),rot=BotRoutes.hash(k)%names.length;
  P.site=names[(order.indexOf(u)+rot)%names.length];P.delay=0;
 }
 return P;
}
function xbvSiteCenter(C,name,atk){const g=atk&&C.siteGoals&&C.siteGoals[name],p=C.meta.sites[name];return g?[g[0],p[1],g[1]]:[p[0],p[1],p[2]];}
{const goal=xGoal;xGoal=function(u,team,atk,out){
 const C=typeof nmActive==='function'&&nmActive(),s=FV.sp;
 if(!C||mode!=='five'||FV.dm||!window.BotRoutes||!s||!u||!u.g||!C.meta||!C.meta.sites)return goal.apply(this,arguments);
 if(atk&&s.st==='plant'){ // post-plant: spread spots around the Spike instead of one stack
  const P=xbvPlan(u,team,atk,C);if(!P.post||P.post0!==s.x+','+s.z){P.post0=s.x+','+s.z;P.post=xbvSpot(C,[s.x,s.y||u.g.position.y,s.z],xbvTeamTaken(team,u,'post'),P.rand,{rMin:3,rMax:9,gap:3.5});}
  return P.post?x2(out,P.post[0],P.post[2]):goal.apply(this,arguments);}
 if(s.st==='plant'||s.st==='drop'||(atk&&(s.st!=='carry'||u===s.c)))return goal.apply(this,arguments); // retake/defuse, pickups, the carrier: exact goals
 const P=xbvPlan(u,team,atk,C),now=performance.now(),p=u.g.position;
 if(!P.go)P.go=now+(P.delay||0);if(now<P.go)return x2(out,p.x,p.z); // staggered start: hold at spawn
 let site=atk?P.site:(s.seen||P.site);if(atk&&P.lurk&&(timeLeft<P.lurkUntil))site=s.site; // the lurker rotates in late
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
 const r=BotRoutes.route(C.nav,path,(u.name||'')+'|'+XBV.k+'|'+e,peers,null,banned);
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
// ---- END BOT VARIETY ----
