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
// team economy: eco / save rounds buy small through the wrapper; full rounds use the shop
{const v=html.slice(i,j+Z.length);let shop=0;const bs={};const ctx={window:{xBotSeed:7},Math,Map,Set,Object,console,mode:'five',XNF:0,FV:{you:3,them:4,map:'ascent',atk:true,dm:false,lsY:2,lsT:0,bs},F_MATES:['M1','M2','M3','M4'],F_EN:['E1','E2','E3','E4','E5'],
  fBotBuy(n){shop++;return bs[n];},xBBuy(){},sbSpend(){},xGoal(){},xSmV(){},performance:{now:()=>0}};ctx.window=Object.assign(ctx,{xBotSeed:7});vm.createContext(ctx);vm.runInContext(v,ctx);
 for(const n of ctx.F_MATES)bs[n]={cr:1200,w:'Classic',arm:0,alive:true};for(const n of ctx.F_EN)bs[n]={cr:6000,w:'Classic',arm:0,alive:true};
 for(const n of ctx.F_EN)ctx.fBotBuy(n);assert.equal(shop,5,'rich team: the regular shop');shop=0;for(const n of ctx.F_MATES){const s=ctx.fBotBuy(n);assert(s.cr>=0&&['Classic','Ghost','Sheriff','Frenzy','Stinger'].includes(s.w),'poor team: eco / save / force buys');}
 assert(['eco','save','force'].includes(ctx.XBVq?ctx.XBVq().call[true].c:vm.runInContext('XBV.call[true].c',ctx)),'poor team call');out.push('economy call (1200 credits, 2 losses): '+vm.runInContext('XBV.call[true].c',ctx));}
console.log('Bot brain (offline): '+out.join('; '));
