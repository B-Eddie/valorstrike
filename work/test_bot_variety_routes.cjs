// Offline native-map bot variety (work/bot_variety_runtime.js + vendor/bot-routes.cjs, inlined in index.html):
// over several rounds on the real Ascent and Bind navigation graphs the five attackers take several distinct routes
// (not one shared shortest path to one site point), stand on their own spots inside the site, at most one lurks,
// starts are staggered by personality, defenders spread over the sites in a per-round order, and walking teammates
// closer than 1.8 m are steered apart. Deterministic: seeded per bot and round, no Math.random.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(process.env.BV_INDEX||path.join(root,'index.html'),'utf8');
const A='// ---- BOT VARIETY ----',B='// ---- END BOT VARIETY ----',i=html.indexOf(A),j=html.indexOf(B,i);assert(i>=0&&j>i,'bot variety block inlined in index.html');
const block=html.slice(i,j+B.length);assert(/root\.BotRoutes=factory\(\)/.test(block),'shared BotRoutes inlined with the block');
assert(html.indexOf('xReady = true;',j)>j,'bot variety block sits before xReady');
const out=[];
for(const map of (process.env.BV_MAPS||'ascent,bind').split(',')){
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8'));
 const N=nav.nodes,C={key:map,nav,meta,playable:new Uint8Array(N.length),siteGoals:null};
 const near=(x,z,y)=>{let b=-1,d=Infinity;for(let k=0;k<N.length;k++){if(!C.playable[k])continue;const n=N[k],v=(n[0]-x)**2+(n[2]-z)**2+(y==null?0:((n[1]-y)*3)**2);if(v<d){d=v;b=k;}}return b;};
 {let s=0,d=Infinity;for(let k=0;k<N.length;k++){const n=N[k],v=Math.hypot(n[0]-meta.attacker[0],n[2]-meta.attacker[2])+Math.abs(n[1]-meta.attacker[1])*3;if(v<d){d=v;s=k;}}const q=[s];C.playable[s]=1;while(q.length){const a=q.pop();for(const b of nav.adj[a])if(!C.playable[b]){C.playable[b]=1;q.push(b);}}}
 // plain A* (the shortest path every bot used to share)
 const astar=(C,s,e)=>{const g=new Float64Array(N.length).fill(Infinity),pv=new Int32Array(N.length).fill(-1),cl=new Uint8Array(N.length),h=k=>Math.hypot(N[k][0]-N[e][0],N[k][2]-N[e][2]),open=[[s,h(s)]];g[s]=0;
  while(open.length){let bi=0;for(let k=1;k<open.length;k++)if(open[k][1]<open[bi][1])bi=k;const a=open.splice(bi,1)[0][0];if(cl[a])continue;if(a===e){const p=[];for(let k=e;k>=0;k=pv[k])p.push(k);return p.reverse();}cl[a]=1;
   for(const b of nav.adj[a]){if(cl[b]||!C.playable[b])continue;const c=g[a]+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+Math.abs(N[a][1]-N[b][1])*.2;if(c<g[b]){g[b]=c;pv[b]=a;open.push([b,c+h(b)]);}}}return [s];};
 let now=0;const unit=(name,per,x,z)=>{const k=near(x,z),n=N[k];return {name,per,alive:true,see:0,g:{position:{x:n[0],y:n[1],z:n[2]}}};};
 const ctx={Math,Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,performance:{now:()=>now},window:{},mode:'five',running:true,player:{hp:0},allies:[],bots:[],XNF:0,timeLeft:100,
  FV:{you:0,them:0,map,atk:true,dm:false,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>C,
  xGoal:(u,team,atk,o)=>{const s=ctx.FV.sp,p=meta.sites[atk?s.site:(s.seen||'A')];return ctx.x2(o,p[0],p[2]);},
  nmPath:(C,s,e)=>astar(C,s,e),nmNext:(C,u,gx,gz)=>{const p=u.g.position;return ctx.nmPath(C,near(p.x,p.z,p.y),near(gx,gz));},xSmV:(u,dt,vx,vz)=>[vx,vz]};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(block+'\n;globalThis.BotRoutes=BotRoutes;globalThis.XBVq=()=>XBV;',ctx);ctx.window.BotRoutes=ctx.BotRoutes;
 const PER=[{ag:.9,fl:.2,sd:.5},{ag:.55,fl:.7,sd:.3},{ag:.4,fl:.85,sd:.8},{ag:.65,fl:.35,sd:.6},{ag:.3,fl:.5,sd:.2}],NAMES=['Jett','Omen','Raze','Sova','Sage'];
 const ROUNDS=+(process.env.BV_ROUNDS||6),sites=Object.keys(meta.sites),sig=p=>{const c=[];for(const k of p){const n=N[k],s=Math.floor(n[0]/6)+','+Math.floor(n[2]/6);if(c[c.length-1]!==s)c.push(s);}return c.join(' ');};
 const all=new Set(),plain=new Set(),perRound=[],gaps=[],delays=new Set(),defSites=[];let lurkRounds=0;
 for(let r=0;r<ROUNDS;r++){
  Object.assign(ctx.FV,{you:r,them:0,atk:true});const atk=PER.map((p,k)=>unit('Bot '+NAMES[k],p,meta.attacker[0]+(k-2)*1.2,meta.attacker[2]));ctx.bots=atk;
  ctx.FV.sp={st:'carry',site:sites[r%sites.length],c:atk[0]};now=1;
  const goals=atk.map(u=>ctx.xGoal(u,atk,true,[0,0])),P=atk.slice(1).map(u=>ctx.XBVq().plans.get(u));assert(P.every(Boolean),'every non-carrier attacker has a round plan');
  for(const p of P)delays.add(Math.round(p.delay));assert(P.filter(p=>p.lurk).length<=1,'at most one lurker');if(P.some(p=>p.lurk))lurkRounds++;
  P.forEach((p,k)=>{if(p.delay>0){const u=atk[k+1];assert(goals[k+1][0]===u.g.position.x&&goals[k+1][1]===u.g.position.z,'staggered start holds a late bot at spawn');}});
  now=1e5;const sg=new Set();
  for(const u of atk){const g=ctx.xGoal(u,atk,true,[0,0]);ctx.XNF++;const route=ctx.nmNext(C,u,g[0],g[1]),s=sig(route);sg.add(s);all.add(s);
   plain.add(sig(astar(C,near(u.g.position.x,u.g.position.z,u.g.position.y),near(meta.sites[ctx.FV.sp.site][0],meta.sites[ctx.FV.sp.site][2]))));}
  perRound.push(sg.size);
  // own spots: teammates heading for the same site stand apart (the carrier keeps the exact plant goal)
  const spots=P.filter(p=>!p.lurk&&p.spot).map(p=>p.spot);
  for(let a=0;a<spots.length;a++){let m=Infinity;for(let b=0;b<spots.length;b++)if(a!==b)m=Math.min(m,Math.hypot(spots[a][0]-spots[b][0],spots[a][2]-spots[b][2]));if(m<Infinity)gaps.push(m);}
  // defenders: spread over every site, a different seat order each round
  ctx.FV.atk=false;ctx.FV.you=r+100;const def=PER.map((p,k)=>unit('Def '+NAMES[k],p,meta.defender[0]+(k-2)*1.2,meta.defender[2]));ctx.bots=def;ctx.FV.sp={st:'carry',site:sites[0],c:null};
  const ds=def.map(u=>{ctx.xGoal(u,def,false,[0,0]);return ctx.XBVq().plans.get(u).site;});assert.equal(new Set(ds).size,sites.length,'defenders cover every site');defSites.push(ds.join(''));
 }
 // spacing while walking: two teammates 1.5 m apart walking the same way are pushed apart (the 1.35 m body radius did not)
 {const a=unit('Bot Jett',PER[0],meta.attacker[0],meta.attacker[2]),b={...a,name:'Bot Omen',g:{position:{...a.g.position,x:a.g.position.x+1.5}}};ctx.bots=[a,b];
  const v=ctx.xSmV(a,.016,0,-5);assert(v[0]<-0.3,'walking teammate steered away inside 1.8 m');a.see=1;const w=ctx.xSmV(a,.016,0,-5);assert.equal(w[0],0,'no spacing steer while fighting');}
 const avgGap=gaps.reduce((s,v)=>s+v,0)/Math.max(1,gaps.length);
 out.push(`${map} routes ${plain.size} plain -> ${all.size} varied over ${ROUNDS} rounds (per round ${perRound.join('/')}), site spot gap avg ${avgGap.toFixed(2)} m (min ${Math.min(...gaps).toFixed(2)}), lurker rounds ${lurkRounds}, start delays ${delays.size} distinct, defender orders ${new Set(defSites).size}`);
 assert(all.size>=Math.max(plain.size+ROUNDS,ROUNDS*3),`${map}: varied routes outnumber the shared shortest paths (${plain.size} -> ${all.size})`);
 assert(perRound.every(n=>n>=3),`${map}: at least 3 distinct routes every round (${perRound})`);
 assert(avgGap>=3&&Math.min(...gaps)>=1.8,`${map}: teammates hold their own spots (avg ${avgGap.toFixed(2)} m)`);
 assert(delays.size>=4,'staggered starts differ by personality');assert(new Set(defSites).size>=2,'defender seats rotate between rounds');
}
// The page harnesses (audit.js) strip the native-map section: the variety block must not touch nmPath/nmNext unguarded.
{const v=html.slice(html.indexOf('// ---- BOT VARIETY ----'),html.indexOf('// ---- END BOT VARIETY ----'));assert(v.length>100,'bot variety block inlined');
 assert(!/\{const np=nmPath/.test(v)&&v.includes("if(typeof nmPath==='function'&&typeof nmNext==='function')"),'nmPath/nmNext wraps guarded for pages without native maps');
 const ctx={window:{},Math,Map,Set,Object,console,xGoal(){},xSmV(){}};ctx.window=ctx;require('vm').createContext(ctx);require('vm').runInContext(v,ctx);assert(ctx.BotRoutes&&typeof ctx.xbvPath==='function','block loads with no native maps defined');}
console.log('Bot variety (offline native maps): '+out.join('; '));
