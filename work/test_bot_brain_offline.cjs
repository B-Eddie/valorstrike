// Offline bots use the shared human-like decisions (vendor/bot-brain.cjs inlined in the BOT VARIETY block, as the server):
// per-fight reaction 180-320 ms around each bot's own mean (scaled by difficulty, +150 ms off-angle), crosshair error that
// settles, own stand-still time, round strategies on the real Ascent / Bind graphs (>= 2 sites and >= 3 plans over 20
// seeded rounds, the bot carrier sent to the strategy site, staged positions that differ), defenders that keep every site
// and rotate on information, the varied route A* honouring the instinct climb rule (dy > 0.321 needs nmClimbOk), and a
// team economy (eco / save rounds buy small). Deterministic: window.xBotSeed fixes the match seed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',i=html.indexOf(A),j=html.indexOf(Z,i);assert(i>=0&&j>i,'bot variety block');
const block=html.slice(i,j+Z.length);assert(/root\.BotBrain=factory\(\)/.test(block),'BotBrain inlined with the block');
assert.equal(block.slice(block.indexOf('// Shared client/server bot decisions'),block.indexOf("return {hash,rng,clamp")),fs.readFileSync(path.join(root,'vendor/bot-brain.cjs'),'utf8').slice(0,fs.readFileSync(path.join(root,'vendor/bot-brain.cjs'),'utf8').indexOf("return {hash,rng,clamp")),'inlined BotBrain == vendor/bot-brain.cjs');
// base loop wiring (enemy + ally bots)
for(const w of ['xbEngage(b, b.pre)','typeof xbRt === "function" ? xbRt(b, D)','xbAimErr(b, aim, D)','(b.see || 0) < (b.stand || 0.35)','xbEngage(a, a.pre)','a.ts * 1000 < xbRt(a, null)','a.ts < (a.stand || 0.35)'])assert(html.includes(w),'wired: '+w);
const out=[];
for(const map of ['ascent','bind']){
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8')),N=nav.nodes;
 const C={key:map,nav,meta,playable:new Uint8Array(N.length),siteGoals:null};
 {let s=0,d=Infinity;for(let k=0;k<N.length;k++){const n=N[k],v=Math.hypot(n[0]-meta.attacker[0],n[2]-meta.attacker[2])+Math.abs(n[1]-meta.attacker[1])*3;if(v<d){d=v;s=k;}}const q=[s];C.playable[s]=1;while(q.length){const a=q.pop();for(const b of nav.adj[a])if(!C.playable[b]){C.playable[b]=1;q.push(b);}}}
 const near=(x,z,y)=>{let b=-1,d=Infinity;for(let k=0;k<N.length;k++){if(!C.playable[k])continue;const n=N[k],v=(n[0]-x)**2+(n[2]-z)**2+(y==null?0:((n[1]-y)*3)**2);if(v<d){d=v;b=k;}}return b;};
 const astar=(C,s,e)=>{const g=new Float64Array(N.length).fill(Infinity),pv=new Int32Array(N.length).fill(-1),cl=new Uint8Array(N.length),h=k=>Math.hypot(N[k][0]-N[e][0],N[k][2]-N[e][2]),open=[[s,h(s)]];g[s]=0;
  while(open.length){let bi=0;for(let k=1;k<open.length;k++)if(open[k][1]<open[bi][1])bi=k;const a=open.splice(bi,1)[0][0];if(cl[a])continue;if(a===e){const p=[];for(let k=e;k>=0;k=pv[k])p.push(k);return p.reverse();}cl[a]=1;
   for(const b of nav.adj[a]){if(cl[b]||!C.playable[b])continue;if(N[b][1]-N[a][1]>.321)continue;const c=g[a]+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+Math.abs(N[a][1]-N[b][1])*.2;if(c<g[b]){g[b]=c;pv[b]=a;open.push([b,c+h(b)]);}}}return [s];};
 let now=0,climbCalls=0;const unit=(name,x,z)=>{const k=near(x,z),n=N[k];return {name,per:{ag:.5,fl:.5,sd:.5},alive:true,see:0,g:{position:{x:n[0],y:n[1],z:n[2]}}};};
 const ctx={Math,Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,performance:{now:()=>now},window:{xBotSeed:1234},mode:'five',running:true,player:{hp:0},allies:[],bots:[],XNF:0,timeLeft:100,
  FV:{you:0,them:0,map,atk:true,dm:false,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>C,
  xGoal:(u,team,atk,o)=>{const s=ctx.FV.sp,p=meta.sites[atk?s.site:'A'];return ctx.x2(o,p[0],p[2]);},nmClimbOk:()=>(climbCalls++,false),
  nmPath:(C,s,e)=>astar(C,s,e),nmNext:(C,u,gx,gz)=>{const p=u.g.position;return ctx.nmPath(C,near(p.x,p.z,p.y),near(gx,gz));},xSmV:(u,dt,vx,vz)=>[vx,vz]};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(block+'\n;globalThis.BotRoutes=BotRoutes;globalThis.BotBrain=BotBrain;globalThis.XBVq=()=>XBV;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
 const NAMES=['Jett','Omen','Raze','Sova','Sage'],sites=Object.keys(meta.sites),siteSet=new Set(),plans=new Set(),defs=new Set(),stageSpread=[];let hops=0,rotated=0;
 for(let r=0;r<20;r++){
  Object.assign(ctx.FV,{you:r,them:0,atk:true});const atk=NAMES.map((n,k)=>unit('Bot '+n,meta.attacker[0]+(k-2)*1.2,meta.attacker[2]));ctx.bots=atk;
  ctx.FV.sp={st:'carry',site:sites[0],c:atk[0]};now=1;ctx.timeLeft=100;
  for(const u of atk)ctx.xGoal(u,atk,true,[0,0]);const S=ctx.XBVq().strat.get(ctx.xbvKey()+'|a');siteSet.add(ctx.FV.sp.site);plans.add(S.plan.type);assert.equal(ctx.FV.sp.site,S.plan.site,'bot carrier heads for the strategy site');
  now=1e5;const goals=new Set();for(const u of atk){const g=ctx.xGoal(u,atk,true,[0,0]);goals.add(Math.round(g[0])+','+Math.round(g[1]));ctx.XNF++;const route=ctx.nmNext(C,u,g[0],g[1]);for(let k=1;k<route.length;k++)if(N[route[k]][1]-N[route[k-1]][1]>.321)hops++;}
  stageSpread.push(goals.size);
  ctx.FV.atk=false;ctx.FV.you=r+100;const def=NAMES.map((n,k)=>unit('Def '+n,meta.defender[0]+(k-2)*1.2,meta.defender[2]));ctx.bots=def;ctx.FV.sp={st:'carry',site:sites[0],c:null};now=1;
  const ds=new Set(def.map(u=>{ctx.xGoal(u,def,false,[0,0]);return ctx.XBVq().plans.get(u).site;}));assert.equal(ds.size,sites.length,'defenders keep every site');defs.add(ctx.XBVq().strat.get(ctx.xbvKey()+'|d').plan.type);
  // information: an enemy seen near a site moves the rotators there after their delay
  const far=sites.find(n=>n!==ctx.XBVq().plans.get(def[0]).site)||sites[0],fc=meta.sites[far];def[0].see=1;def[0].xTt={x:fc[0],z:fc[2]};ctx.XNF++;ctx.xbvInfo(def,C);now=1e7;
  for(const u of def){const P=ctx.XBVq().plans.get(u);if(!P.role.rotator||P.site===far)continue;const g=ctx.xGoal(u,def,false,[0,0]);if(Math.hypot(g[0]-fc[0],g[1]-fc[2])<16)rotated++;}
 }
 assert(siteSet.size>=2&&plans.size>=3,`${map}: 20 seeded rounds, >= 2 sites and >= 3 plans (${[...siteSet]} / ${[...plans]})`);assert(defs.size>=3,`${map}: defence setups vary (${[...defs]})`);
 assert(stageSpread.filter(n=>n>=3).length>=15,`${map}: attackers do not share one goal (${stageSpread})`);assert.equal(hops,0,'varied routes plan no climb the instinct rule rejects');assert(rotated>0,'rotators answer information');
 // reactions: own mean per bot, re-drawn per fight, scaled by difficulty; crosshair error settles
 const rts=[],means=new Set();for(const n of NAMES){const u={name:'Bot '+n};const B=ctx.xbBrain(u);means.add(B.react.toFixed(3));for(let k=0;k<10;k++){ctx.xbEngage(u,k%2===0);rts.push(u.rtE);assert(u.stand>.1&&u.stand<.6,'stand time');}}
 assert(Math.min(...rts)>=.18&&Math.max(...rts)<=.32&&new Set(rts.map(v=>v.toFixed(3))).size>=20,'per-fight reactions 180-320 ms with spread');assert.equal(means.size,5,'own reaction mean per bot');
 const u={name:'Bot Jett',pre:true,rtE:.25};assert.equal(ctx.xbRt(u,{rt:260}),250);assert.equal(ctx.xbRt(u,{rt:520}),500);u.pre=false;assert.equal(ctx.xbRt(u,{rt:260}),400);
 const v=()=>({x:0,y:0,z:-1,normalize(){const l=Math.hypot(this.x,this.y,this.z);this.x/=l;this.y/=l;this.z/=l;return this;}}),w={name:'Bot Omen',see:0};ctx.xbEngage(w,false);
 const err=t=>{w.see=t;const a=v();ctx.xbAimErr(w,a,{ae:1.3});return Math.hypot(a.x,a.y);};assert(err(0)>.005&&err(.6)<err(0)*.6&&err(3)<err(.6),'crosshair error settles');
 out.push(`${map}: sites ${[...siteSet].join('')}, plans ${[...plans].join('/')}, defence ${[...defs].join('/')}, rotations ${rotated}, climb checks ${climbCalls}`);
}
// plan utility: attackers hold smokes / flashes for the execute and throw them toward the site just before it, lurkers stay
// quiet, defenders delay a push on their site, post-plant Killjoy hides Nanoswarms on the Spike and Raze shells it when a
// defender comes for it (stubbed kit casts: the real ones are the existing xBUse / enSmoke / xBFlash / xKnPlace / xRzShells)
{const map='ascent',dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8')),N=nav.nodes;
 const C={key:map,nav,meta,playable:new Uint8Array(N.length).fill(1),siteGoals:null};let now=0;const smokes=[],flashes=[],knives=[],shells=[];
 const near=(x,z)=>{let b=-1,d=Infinity;for(let k=0;k<N.length;k++){const n=N[k],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=k;}}return b;};
 const unit=(name,ag,x,z)=>{const n=N[near(x,z)];return {name,ag,per:{ag:.5,fl:.5,sd:.5},alive:true,see:0,ab:{t:0,flT:0},kc:{c:2,q:2,e:2},g:{position:{x:n[0],y:n[1],z:n[2]}}};};
 const ctx={Math,Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,performance:{now:()=>now},window:{xBotSeed:99},mode:'five',running:true,player:{hp:0},allies:[],bots:[],XNF:0,timeLeft:100,
  FV:{you:0,them:0,map,atk:false,dm:false,buy:0,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>C,xGoal:(u,t,a,o)=>ctx.x2(o,0,0),nmClimbOk:()=>false,xSmV:(u,dt,vx,vz)=>[vx,vz],
  XBK_P:{x:0,z:0},blocked:()=>false,feed:()=>{},xBAtk:al=>ctx.FV.atk===al,xBAg:b=>b.ag,xBCh:b=>b.kc,xBUse:(b,k)=>b.kc[k]>=1?(b.kc[k]--,true):false,
  xBChoke:b=>b.ab.lkt!=null?{x:1e3,z:1e3}:null,/* the base: smoke a last-seen enemy */xBFl:()=>false,xBFlash:(b,al,from,x,z)=>flashes.push([b.name,x,z]),xKnPlace:(b,al,x,z,n)=>{knives.push([x,z]);return n;},xRzShells:(A,x,z)=>shells.push([x,z]),spike:null,
  botAb(b,dt,see,tg,from){const ag=ctx.xBAg(b);if(ag==='Jett'){const q=ctx.xBChoke(b,false,from,b.ab);if(q&&ctx.xBUse(b,'c'))smokes.push([b.name,q.x,q.z]);}if(ag==='Phoenix')ctx.xBFl(b,b.ab,see,false,tg,from,'e',false,0,'orb','Phoenix',800);}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(html.slice(i,j+Z.length)+'\n;globalThis.BotRoutes=BotRoutes;globalThis.BotBrain=BotBrain;globalThis.XBVq=()=>XBV;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
 const sites=Object.keys(meta.sites);let tested=0,held=0,thrown=0,lurkQuiet=0;
 for(let r=0;r<40&&tested<4;r++){Object.assign(ctx.FV,{you:r,them:1,atk:false});const team=[unit('Bot Jett','Jett',meta.attacker[0],meta.attacker[2]),unit('Bot Phoenix','Phoenix',meta.attacker[0]+1,meta.attacker[2]),unit('Bot Sova','Sova',meta.attacker[0]+2,meta.attacker[2]),unit('Bot Omen','Omen',meta.attacker[0]+3,meta.attacker[2]),unit('Bot Sage','Sage',meta.attacker[0]+4,meta.attacker[2])];
  ctx.bots=team;ctx.FV.sp={st:'carry',site:sites[0],c:team[4]};now=1;ctx.timeLeft=100;const S=ctx.xbvStrat(team,true,C),pl=S.plan;if(!pl.utilFirst||pl.type==='rush'||pl.type==='fake')continue;
  for(const u of team)ctx.xbvPlan(u,team,true,C);const jett=team[0],ph=team[1],sc=meta.sites[ctx.FV.sp.site],P=ctx.XBVq().plans.get(jett);
  for(const u of [jett,ph]){const n=N[near(sc[0]+14,sc[2])];Object.assign(u.g.position,{x:n[0],y:n[1],z:n[2]});}
  jett.ab.lkt=0;const s0=smokes.length,f0=flashes.length;ctx.timeLeft=100-Math.max(0,pl.executeAt-8);now+=1e4;ctx.botAb(jett,.05,false,null,jett.g.position);ctx.botAb(ph,.05,false,null,ph.g.position);
  if(smokes.length===s0&&flashes.length===f0)held++;jett.ab.lkt=null;
  ctx.timeLeft=100-(pl.executeAt+.5);now+=1e4;ctx.botAb(jett,.05,false,null,jett.g.position);now+=1e4;ctx.botAb(ph,.05,false,null,ph.g.position);
  const sm=smokes.slice(s0),fl=flashes.slice(f0);if(P.role.lurk){if(!sm.length)lurkQuiet++;}else if(sm.length||fl.length){thrown++;for(const q of sm)assert(Math.hypot(q[1]-sc[0],q[2]-sc[2])<Math.hypot(jett.g.position.x-sc[0],jett.g.position.z-sc[2])+.01,'entry smoke lands toward the site');}
  tested++;}
 assert(tested>=3&&held===tested,'utility-first plans: nothing thrown while defaulting ('+held+'/'+tested+')');assert(thrown>=2,'entry smokes / flashes thrown at the execute ('+thrown+'/'+tested+')');
 const L=ctx.XBVq().ulog||[];assert(L.some(e=>e.phase==='entry'),'utility log names the entry phase');
 // defenders: information at their site -> delay utility toward the attackers
 Object.assign(ctx.FV,{you:50,them:1,atk:true});const def=[unit('Def Jett','Jett',meta.defender[0],meta.defender[2]),unit('Def Phoenix','Phoenix',meta.defender[0]+1,meta.defender[2])];ctx.bots=def;ctx.FV.sp={st:'carry',site:sites[0],c:null};now=5e6;ctx.timeLeft=70;
 for(const u of def){const P=ctx.xbvPlan(u,def,false,C),c=meta.sites[P.site],n=N[near(c[0],c[2])];Object.assign(u.g.position,{x:n[0],y:n[1],z:n[2]});}
 const P0=ctx.XBVq().plans.get(def[0]),c0=meta.sites[P0.site],s1=smokes.length;ctx.botAb(def[0],.05,false,null,def[0].g.position);assert.equal(smokes.length,s1,'no defender utility without information');
 def[0].see=1;def[0].xTt={x:c0[0]+12,z:c0[2]};ctx.XNF++;ctx.xbvInfo(def,C);now+=1e3;def[0].see=0;ctx.botAb(def[0],.05,false,null,def[0].g.position);assert(smokes.length>s1,'defender smokes the push on its site');
 // post-plant
 Object.assign(ctx.FV,{you:60,them:2,atk:false});const kj=unit('Bot Killjoy','Killjoy',0,0),rz=unit('Bot Raze','Raze',0,0);ctx.bots=[kj,rz];const pc=meta.sites[sites[0]];
 for(const u of [kj,rz]){const n=N[near(pc[0]+6,pc[2])];Object.assign(u.g.position,{x:n[0],y:n[1],z:n[2]});}
 ctx.spike={parent:{},position:{x:pc[0],z:pc[2]}};ctx.FV.sp={st:'plant',site:sites[0],x:pc[0],z:pc[2],dt:0,du:null};now+=1e5;ctx.timeLeft=30;
 ctx.botAb(kj,.05,false,null,kj.g.position);ctx.botAb(rz,.05,false,null,rz.g.position);assert.equal(knives.length,1,'post-plant Killjoy hides her Nanoswarms on the Spike once');assert.equal(shells.length,0,'Raze waits for a defender');
 ctx.FV.sp.du={};now+=1e4;ctx.botAb(rz,.05,false,null,rz.g.position);assert.equal(shells.length,1,'Raze shells the Spike when a defender goes for it');
 out.push(`plan utility: held ${held}/${tested}, thrown ${thrown}, lurkers quiet ${lurkQuiet}, log ${L.map(e=>e.phase+':'+e.kind).join(',')}`);}
// team economy: eco / save rounds buy small through the wrapper; full rounds use the shop
{const v=html.slice(i,j+Z.length);let shop=0;const bs={};const ctx={window:{xBotSeed:7},Math,Map,Set,Object,console,mode:'five',XNF:0,FV:{you:3,them:4,map:'ascent',atk:true,dm:false,lsY:2,lsT:0,bs},F_MATES:['M1','M2','M3','M4'],F_EN:['E1','E2','E3','E4','E5'],
  fBotBuy(n){shop++;return bs[n];},xBBuy(){},sbSpend(){},xGoal(){},xSmV(){},performance:{now:()=>0}};ctx.window=Object.assign(ctx,{xBotSeed:7});vm.createContext(ctx);vm.runInContext(v,ctx);
 for(const n of ctx.F_MATES)bs[n]={cr:1200,w:'Classic',arm:0,alive:true};for(const n of ctx.F_EN)bs[n]={cr:6000,w:'Classic',arm:0,alive:true};
 for(const n of ctx.F_EN)ctx.fBotBuy(n);assert.equal(shop,5,'rich team: the regular shop');shop=0;for(const n of ctx.F_MATES){const s=ctx.fBotBuy(n);assert(s.cr>=0&&['Classic','Ghost','Sheriff','Frenzy','Stinger'].includes(s.w),'poor team: eco / save / force buys');}
 assert(['eco','save','force'].includes(ctx.XBVq?ctx.XBVq().call[true].c:vm.runInContext('XBV.call[true].c',ctx)),'poor team call');out.push('economy call (1200 credits, 2 losses): '+vm.runInContext('XBV.call[true].c',ctx));}
console.log('Bot brain (offline): '+out.join('; '));
