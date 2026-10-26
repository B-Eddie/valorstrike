// Offline (index.html) 5v5 bot team-spread harness: runs the shipped BOT VARIETY block (with the inlined vendor/bot-routes.cjs
// + vendor/bot-brain.cjs), the native-map base goal (native_maps_runtime xGoal wrapper) and the base trade / hearing code
// (index.html xTradeChk / xHear) on the real nav graph, with a small kinematic stand-in for the page loop: units follow
// nmNext toward xGoal (or their trade spot) at 5.4 m/s through the block's xSmV spacing hook, stop and fight what they
// can see (line of sight through the server's collision world for the same map: same coordinates and nav), fire a shot
// sound every 0.3 s while fighting (xHear -> sound reactions) and one side of a duel dies after a seeded 0.6-1.6 s
// (xTrade reactions). Deterministic (window.xBotSeed). Metrics as server/tools/bot-spread-metrics.mjs:
//   rounds end at the plant stand-in (the carrier within 6 m of its site) or an elimination; pair (mean pairwise teammate distance), jumpMax / jumpMean (bots within 6 m of the team's first contact in the next
//   3 s), conv (within 12 m in 10 s), areas (distinct regions held: nearest site / middle / spawn) and groups (single-link 7 m clusters) in the setup window, stacks (biggest cluster >= 4
//   for >= 60% of the setup window).
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
function clusters(P,link=7){const n=P.length,lab=new Array(n).fill(-1);let c=0;for(let i=0;i<n;i++){if(lab[i]>=0)continue;lab[i]=c;const q=[i];while(q.length){const a=q.pop();for(let j=0;j<n;j++)if(lab[j]<0&&Math.hypot(P[a][0]-P[j][0],P[a][1]-P[j][1])<link){lab[j]=c;q.push(j);}}c++;}
 let big=0;for(let i=0;i<n;i++){let k=0;for(let j=0;j<n;j++)if(Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1])<6)k++;big=Math.max(big,k);}return {n:c,big};} // big: most teammates within 6 m of one of them (itself included)
// regions: the nearest of the map's key points (each site, the middle, both spawns); "areas held" = distinct regions
function keyPoints(M){const S={};for(const k of Object.keys(M.sites))if(/^[ABC]$/.test(k))S[k]=M.sites[k];const mx=(M.attacker[0]+M.defender[0])/2,mz=(M.attacker[2]+M.defender[2])/2;let mid=[mx,mz],bd=25;for(const k in S){const c=S[k],d=Math.hypot(c[0]-mx,c[2]-mz);if(d<bd){bd=d;mid=null;}}
 const out=Object.keys(S).map(k=>[S[k][0],S[k][2]]);if(mid)out.push(mid);out.push([M.attacker[0],M.attacker[2]],[M.defender[0],M.defender[2]]);return out;}
function regions(K,P){const s=new Set();for(const p of P){let b=0,bd=Infinity;K.forEach((k,i)=>{const d=Math.hypot(p[0]-k[0],p[1]-k[1]);if(d<bd){bd=d;b=i;}});s.add(b);}return s.size;}
const STACK_PLANS=new Set(['execute','rush','stack']);
let WORLDS={};
async function world(map){if(WORLDS[map])return WORLDS[map];const {loadWorld}=await import(path.join(root,'server/src/world.js'));const fsp=require('fs/promises');
 return WORLDS[map]=await loadWorld({async fetch(r){try{return new Response(await fsp.readFile(path.join(root,'server/public',new URL(r.url).pathname)));}catch(e){return new Response('',{status:404});}}},map);}
function cut(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+1);if(i<0||j<0)throw Error('slice '+a);return src.slice(i,j);}
async function measureOffline(map,{rounds=8,secs=45,seed=1234,html}={}){
 html=html||fs.readFileSync(path.join(root,'index.html'),'utf8');const W=await world(map);
 const A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',block=html.slice(html.indexOf(A),html.indexOf(Z)+Z.length);
 const nmGoal=cut(html,"{const goal=xGoal;xGoal=function(u,team,atk,out){const C=nmActive();","\n");
 const base=cut(html,'function xTradeChk(','function xHear(')+cut(html,'function xHear(','\nif (typeof SFX');
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8')),N=nav.nodes;
 const C={key:map,nav,meta,playable:new Uint8Array(N.length),siteGoals:null};
 {let s=0,d=Infinity;for(let k=0;k<N.length;k++){const n=N[k],v=Math.hypot(n[0]-meta.attacker[0],n[2]-meta.attacker[2])+Math.abs(n[1]-meta.attacker[1])*3;if(v<d){d=v;s=k;}}const q=[s];C.playable[s]=1;while(q.length){const a=q.pop();for(const b of nav.adj[a])if(!C.playable[b]){C.playable[b]=1;q.push(b);}}}
 // grid for nearest-node lookups
 const G=new Map(),cell=4,gk=(x,z)=>Math.floor(x/cell)+','+Math.floor(z/cell);for(let k=0;k<N.length;k++){if(!C.playable[k])continue;const key=gk(N[k][0],N[k][2]);let L=G.get(key);if(!L)G.set(key,L=[]);L.push(k);}
 const near=(x,z,y)=>{let b=-1,d=Infinity;for(let r=0;r<6&&b<0;r++){const cx=Math.floor(x/cell),cz=Math.floor(z/cell);for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const L=G.get((cx+i)+','+(cz+j));if(L)for(const k of L){const n=N[k],v=(n[0]-x)**2+(n[2]-z)**2+(y==null?0:((n[1]-y)*3)**2);if(v<d){d=v;b=k;}}}}return b;};
 // climbs: the page plans a rise over 0.321 m only where nmClimbOk's chord sampling allows it (smooth ramps / stairs); stand-in: a slope of at most 0.7 and under 1 m per edge
 const climbOk=(a,b)=>{const dy=N[b][1]-N[a][1];if(dy<=.321)return true;const L=Math.hypot(N[b][0]-N[a][0],N[b][2]-N[a][2]);return dy<1&&dy<=L*.7;};
 const astar=(C,s,e,banned)=>{const g=new Map(),pv=new Map(),cl=new Set(),h=k=>Math.hypot(N[k][0]-N[e][0],N[k][2]-N[e][2]),H=[];g.set(s,0); // binary-heap A* (instinct climb rule dy <= 0.321)
  const push=(k,f)=>{H.push([k,f]);let i=H.length-1;while(i){const q=(i-1)>>1;if(H[q][1]<=H[i][1])break;[H[q],H[i]]=[H[i],H[q]];i=q;}},pop=()=>{const top=H[0],l=H.pop();if(H.length){H[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<H.length&&H[a][1]<H[m][1])m=a;if(b<H.length&&H[b][1]<H[m][1])m=b;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m;}}return top;};
  push(s,h(s));while(H.length){const a=pop()[0];if(cl.has(a))continue;if(a===e){const p=[];for(let k=e;k!=null;k=pv.get(k))p.push(k);return p.reverse();}cl.add(a);
   for(const b of nav.adj[a]){if(cl.has(b)||!C.playable[b])continue;if(!climbOk(a,b))continue;if(banned&&banned.has&&banned.has(a+'>'+b))continue;const c=g.get(a)+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+Math.abs(N[a][1]-N[b][1])*.2;if(c<(g.get(b)??Infinity)){g.set(b,c);pv.set(b,a);push(b,c+h(b));}}}return [s];};
 const pc=new Map(),apath=(C,s,e,b)=>{const k=s+'>'+e;if(!b||!b.size){let p=pc.get(k);if(!p){p=astar(C,s,e);pc.set(k,p);}return p.slice();}return astar(C,s,e,b);};
 let now=0;const ctx={Math,Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,JSON,console,performance:{now:()=>now},window:{xBotSeed:seed},mode:'five',running:true,player:{hp:0,x:1e4,z:1e4},allies:[],bots:[],XNF:0,timeLeft:100,
  FV:{you:0,them:0,map,atk:true,dm:false,sp:null,buy:0},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>C,nmClimbOk:(C,a,b)=>climbOk(a,b),nmNear:(C,x,z,y)=>near(x,z,y),
  xGoal:()=>null,nmPath:apath,nmNext:(C,u,gx,gz)=>{const p=u.g.position;return ctx.nmPath(C,near(p.x,p.z,p.y),near(gx,gz));},xSmV:(u,dt,vx,vz)=>[vx,vz],blocked:()=>false,feed:()=>{},SFX:undefined};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(nmGoal+'\n'+base+'\n'+block+'\n;globalThis.BotRoutes=BotRoutes;globalThis.BotBrain=BotBrain;globalThis.XBVq=()=>XBV;globalThis.XBHq=()=>XBH;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
 const KP=keyPoints(meta),NAMES=['Jett','Omen','Raze','Sova','Sage'],sites=Object.keys(meta.sites),dt=.1,rand=ctx.BotRoutes.rng(seed^0x2545f491);
 const acc=[0,1].map(()=>({pairS:0,pairN:0,jump:[],conv:[],areaS:0,areaN:0,regS:0,dS:0,dN:0,clS:0,clN:0,stacks:0,stackOk:0,rounds:0,plans:[]}));
 const los=(a,b)=>{const o=[a.x,a.y+1.6,a.z],d=[b.x-a.x,b.y-a.y,b.z-a.z],l=Math.hypot(...d);if(l>55)return false;return !(W.ray(o,d.map(v=>v/l),l)<l-.3);};
 for(let r=0;r<rounds;r++){
  const allyAtk=r%2===0;Object.assign(ctx.FV,{you:r,them:0,atk:allyAtk});ctx.XNF++;
  const mk=(pref,anchor)=>NAMES.map((n,k)=>{const q=near(anchor[0]+(k-2)*1.2,anchor[2],anchor[1]),p=N[q];return {name:pref+' '+n,per:{ag:.5,fl:.5,sd:.5},alive:true,hp:100,see:0,wasA:true,g:{position:{x:p[0],y:p[1],z:p[2]},rotation:{y:0}}};});
  const allies=mk('Ally',allyAtk?meta.attacker:meta.defender),bots=mk('Bot',allyAtk?meta.defender:meta.attacker);ctx.allies=allies;ctx.bots=bots;
  const atkT=allyAtk?allies:bots;ctx.FV.sp={st:'carry',site:sites[r%sites.length],c:atkT[0]};now=1000;ctx.timeLeft=100;
  const teams=[allies,bots],teamAtk=[allyAtk,!allyAtk],st=[0,1].map(()=>({c0:null,jmax:0,cmax:0,setup:0,big4:0}));
  for(const u of allies.concat(bots)){u.path=null;u.pathAt=0;u.tt=null;u.ttk=.6+rand();u.shotT=0;}
  for(let t=0;t<secs/dt;t++){now+=dt*1000;ctx.timeLeft=100-t*dt;ctx.XNF++;const rt=t*dt;
   for(let ti=0;ti<2;ti++){const team=teams[ti],foes=teams[1-ti];for(const u of team){if(!u.alive)continue;const p=u.g.position;
     let tg=null,td=Infinity;for(const f of foes){if(!f.alive)continue;const q=f.g.position,d=Math.hypot(q.x-p.x,q.z-p.z);if(d<td&&los(p,q)){td=d;tg=f;}}
     if(tg){u.spd=0;u.see+=dt;u.xTt=tg;u.xTg=tg;u.shotT-=dt;if(u.shotT<=0){u.shotT=.3;ctx.XBHq().k='shot';try{ctx.xHear({x:p.x,z:p.z});}finally{ctx.XBHq().k=null;}}
      if(u.tt!==tg){u.tt=tg;u.ttT=0;}u.ttT+=dt;if(u.ttT>=u.ttk&&tg.alive){tg.alive=false;tg.hp=0;u.tt=null;u.ttk=.6+rand();}continue;}
     u.see=0;u.xTt=null;u.tt=null;
     let gx,gz;if(u.trT>0){u.trT-=dt;[gx,gz]=u.tr;}else{const o=ctx.xGoal(u,team,teamAtk[ti],[0,0]);if(!o)continue;[gx,gz]=o;}
     if(process.env.OFF_GOAL&&r===+process.env.OFF_GOAL&&t%50===0)console.log('GOAL r'+r,rt.toFixed(0),u.name,teamAtk[ti]?'atk':'def',gx.toFixed(1),gz.toFixed(1),'at',p.x.toFixed(1),p.z.toFixed(1),'path',(u.path||[]).length);
     if(Math.hypot(gx-p.x,gz-p.z)<.6){u.spd=0;continue;}
     if(!u.path||now>u.pathAt||u.pg!==gx+','+gz){u.path=ctx.nmNext(C,u,gx,gz);u.pathAt=now+500;u.pg=gx+','+gz;}
     while(u.path.length>1&&Math.hypot(N[u.path[0]][0]-p.x,N[u.path[0]][2]-p.z)<.8)u.path.shift();
     const n=u.path.length>1||Math.hypot(N[u.path[0]][0]-gx,N[u.path[0]][2]-gz)>1?N[u.path[0]]:[gx,p.y,gz];let vx=n[0]-p.x,vz=n[2]-p.z;const l=Math.hypot(vx,vz)||1;vx/=l;vz/=l;
     const v=ctx.xSmV(u,dt,vx,vz,5.4),m=Math.min(l,5.4*dt);p.x+=v[0]*m;p.z+=v[1]*m;u.spd=Math.hypot(v[0],v[1])*m/dt;if(n[1]!=null)p.y+=(n[1]-p.y)*.5;}}
   ctx.xTradeChk(allies,bots,true);ctx.xTradeChk(bots,allies,true);
   if(t%2===0){for(let ti=0;ti<2;ti++){const U=teams[ti].filter(u=>u.alive),T=st[ti],A=acc[ti],P=U.map(u=>[u.g.position.x,u.g.position.z]);
     for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){A.pairS+=Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);A.pairN++;}
     if(P.length>=4&&rt>=6){A.clN++;if(clusters(P).big>=4){A.clS++;if(process.env.OFF_DEBUG){const pl=(ctx.XBVq().strat.get(ctx.xbvKey()+'|'+(teamAtk[ti]?'a':'d'))||{}).plan||{};(T.dbg||(T.dbg=[])).push(rt.toFixed(0)+(T.c0?'c':'')+(ctx.FV.sp.st==='plant'?'p':''));T.pl=(teamAtk[ti]?'A:':'D:')+pl.type+'@'+(pl.executeAt||0).toFixed(0);}}}
     if(!T.c0){const c=U.find(u=>u.see>0);if(c)T.c0={x:c.g.position.x,z:c.g.position.z,t:rt};}
     if(process.env.OFF_REG&&!teamAtk[ti]&&Math.abs(rt-20)<.05){const lab=P.map(p=>{let b=0,bd=Infinity;KP.forEach((k,i)=>{const d=Math.hypot(p[0]-k[0],p[1]-k[1]);if(d<bd){bd=d;b=i;}});return b;});const S=ctx.XBVq().strat.get(ctx.xbvKey()+'|d');console.log('REG r'+r,S&&S.plan.type,S&&S.roles&&[...S.roles].map(([u,e])=>e.slot+':'+e.site+(e.stages[0]?'/'+e.stages[0].site:'')).join(' '),'labels',lab.join(''),'KP',JSON.stringify(KP.map(k=>k.map(v=>Math.round(v)))),'P',P.map(p=>p.map(v=>Math.round(v)).join(',')).join(' '));}
     if(T.c0&&rt<=T.c0.t+3){let k=0;for(const p of P)if(Math.hypot(p[0]-T.c0.x,p[1]-T.c0.z)<6)k++;T.jmax=Math.max(T.jmax,k);if(process.env.OFF_DEBUG&&k>=4)console.log('JUMP r'+r,'site',ctx.FV.sp.site,JSON.stringify(meta.sites[ctx.FV.sp.site]),'pos',U.map(u=>u.g.position.x.toFixed(0)+','+u.g.position.z.toFixed(0)).join(' '),'carrier',ctx.FV.sp.c.name,ctx.FV.sp.c.alive,'team'+ti,teamAtk[ti]?'atk':'def',(ctx.XBVq().strat.get(ctx.xbvKey()+'|'+(teamAtk[ti]?'a':'d'))||{plan:{}}).plan.type,'rt',rt.toFixed(1),'c0',T.c0.t.toFixed(1),U.map(u=>u.name+':'+(u.trT>0?'TR':'')+(u.see>0?'S':'')+(u.xHold?'H':'')).join(' '));}
     if(T.c0&&rt<=T.c0.t+10){let k=0;for(const p of P)if(Math.hypot(p[0]-T.c0.x,p[1]-T.c0.z)<12)k++;T.cmax=Math.max(T.cmax,k);}
     if(rt>=6&&!T.c0&&rt<35&&P.length>=4){const c=clusters(P),rg=regions(KP,P);A.areaS+=c.n;A.regS+=rg;A.areaN++;if(!teamAtk[ti]){A.dS+=rg;A.dN++;}T.setup++;if(c.big>=4)T.big4++;}}}
   if(!allies.some(u=>u.alive)||!bots.some(u=>u.alive))break;
   {const c=ctx.FV.sp.c,sc=meta.sites[ctx.FV.sp.site];if(c&&c.alive&&sc&&Math.hypot(c.g.position.x-sc[0],c.g.position.z-sc[2])<6)break;} /* the carrier reached its site: the plant (post-plant play is not modelled here, as the server measure stops at the plant) */}
  if(process.env.OFF_DEBUG)for(const T of st)if(T.dbg)console.log('r'+r,T.pl,T.dbg.join(' '));
  for(let ti=0;ti<2;ti++){const A=acc[ti],T=st[ti],S=ctx.XBVq().strat.get(ctx.xbvKey()+'|'+(teamAtk[ti]?'a':'d')),pl=S&&S.plan;A.rounds++;if(T.c0){A.jump.push(T.jmax);A.conv.push(T.cmax);}
   const stack=T.setup>=8&&T.big4/T.setup>=.6;if(stack){A.stacks++;if(pl&&STACK_PLANS.has(pl.type))A.stackOk++;}A.plans.push((teamAtk[ti]?'A:':'D:')+(pl?pl.type:'?')+(stack?'*':''));}}
 // per side: attack rows from both teams merged would hide a side; report per team (team 0 = allies attack on even rounds)
 return [0,1].map(ti=>{const A=acc[ti];return {map,team:ti,pair:A.pairS/Math.max(1,A.pairN),jumpMax:Math.max(0,...A.jump),jumpMean:A.jump.reduce((s,v)=>s+v,0)/Math.max(1,A.jump.length),conv:A.conv.reduce((s,v)=>s+v,0)/Math.max(1,A.conv.length),areas:A.regS/Math.max(1,A.areaN),areasDef:A.dS/Math.max(1,A.dN),groups:A.areaS/Math.max(1,A.areaN),clump:A.clS/Math.max(1,A.clN),stack:A.stacks/A.rounds,stacks:A.stacks,stackOk:A.stackOk,plans:A.plans.join(' ')};});
}
module.exports={measureOffline,clusters};
if(require.main===module)(async()=>{const maps=(process.argv[2]||'ascent,bind,haven,split,lotus,breeze').split(','),rounds=+(process.argv[3]||8),secs=+(process.argv[4]||45),J={};
 for(const m of maps){const t0=Date.now();const RR=await measureOffline(m,{rounds,secs});J[m]=RR;if(process.env.BS_JSON)fs.writeFileSync(process.env.BS_JSON,JSON.stringify(J,null,1));for(const r of RR)console.log(`${m} team${r.team} pair ${r.pair.toFixed(1)} m | jump max ${r.jumpMax} mean ${r.jumpMean.toFixed(2)} | conv12m/10s ${r.conv.toFixed(2)} | areas ${r.areas.toFixed(2)} (defending ${r.areasDef.toFixed(2)}) groups ${r.groups.toFixed(2)} | clump ${(100*r.clump).toFixed(0)}% | stacks ${r.stacks}/${rounds} (planned ${r.stackOk}) | ${r.plans}`);console.log(`  (${((Date.now()-t0)/1000).toFixed(1)} s)`);}})();
