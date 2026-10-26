// Offline bot teams split the map (bots-spread-1, user: "The opponent bots all just bunch up rather than doing their own
// thing, so I just get jumped by the entire team"). Runs the shipped BOT VARIETY block on the real nav graphs of every
// native map, both sides (work/bot_spread_offline.cjs: units follow xGoal / trade spots, fight what they can see through
// the server collision world, shots feed the sound reactions, deaths feed the trade reactions) and asserts the spread:
// at most 3 bots within 6 m of a team's first contact in the next 3 s, >= 4 bots within 6 m of each other in <= 12% of
// samples, true stacks only on execute / rush / stack plans, >= 2 distinct areas held. Then the contact rules directly:
// a death pulls at most 2 traders (the 2nd GAP m to the side), the others hold; one sound pusher per team; at most 2
// defenders rotate on one piece of information. Before (main 6ea8c3e) numbers are printed next to the result.
//   BS_MEASURE=1 prints without asserting; BS_MAPS / BS_ROUNDS / BS_SECS override the run.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const {measureOffline}=require('./bot_spread_offline.cjs');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),A='// ---- BOT VARIETY ----',Z='// ---- END BOT VARIETY ----',block=html.slice(html.indexOf(A),html.indexOf(Z)+Z.length);
for(const w of ["if(typeof xTradeChk==='function'){const tc0=xTradeChk;xTradeChk=function(team,foes,live){","BotBrain.RESPOND.trade-busy","if(c==='push'&&L.some(t=>t!==u&&t.alive&&t.trT>0))c='hold';","xbvRot(team,u,P,I,C)","BotBrain.follow(u.g.position.x"])assert(block.includes(w),'wired: '+w);
if(!fs.existsSync(path.join(root,'server/public/worlds/ascent/bvh0.bin'))){console.log('test_bot_spread_offline: SKIP (no server/public/worlds collision: npm run build:worlds)');process.exit(0);}
const BEFORE=JSON.parse(fs.readFileSync(path.join(__dirname,'validation/bot-spread-before.json'),'utf8'));
(async()=>{const out=[];
 // 1. contact rules on a small fixture (the block on the Ascent nav graph)
 {const map='ascent',dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8')),N=nav.nodes;
  const C={key:map,nav,meta,playable:new Uint8Array(N.length).fill(1),siteGoals:null};let now=1000;
  const near=(x,z)=>{let b=-1,d=Infinity;for(let k=0;k<N.length;k++){const n=N[k],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=k;}}return b;};
  const ctx={Math,Object,Number,Infinity,Set,Map,WeakMap,Array,Float64Array,Int32Array,Uint8Array,performance:{now:()=>now},window:{xBotSeed:7},mode:'five',running:true,player:{hp:0},allies:[],bots:[],XNF:0,timeLeft:90,
   FV:{you:3,them:2,map,atk:true,dm:false,buy:0,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},nmActive:()=>C,xGoal:(u,t,a,o)=>ctx.x2(o,0,0),nmClimbOk:()=>false,xSmV:(u,dt,vx,vz)=>[vx,vz],
   nmPath:(C,s,e)=>[s,e],nmNext:()=>[0],xTradeChk(team,foes,live){for(const u of team){if(u.wasA&&!u.alive)for(const m of team)if(m.alive&&m!==u)m.tr=[0,0],m.trT=4;u.wasA=u.alive;}},xHear(){}};
  ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(block+'\n;globalThis.BotRoutes=BotRoutes;globalThis.BotBrain=BotBrain;globalThis.XBVq=()=>XBV;',ctx);Object.assign(ctx.window,{BotRoutes:ctx.BotRoutes,BotBrain:ctx.BotBrain});
  const unit=(name,x,z)=>{const n=N[near(x,z)];return {name,alive:true,wasA:true,hp:100,see:0,per:{ag:.5,fl:.5,sd:.5},g:{position:{x:n[0],y:n[1],z:n[2]}}};};
  const c=meta.sites.A,team=[0,1,2,3,4].map(k=>unit('Bot '+k,c[0]+k*2.5,c[2])),foe=[unit('Foe',c[0]+4,c[2]+10)];ctx.bots=team;ctx.allies=foe;
  team[0].alive=false;ctx.xTradeChk(team,foe,true);const tr=team.filter(u=>u.trT>0),held=team.filter(u=>u.alive&&!(u.trT>0));
  assert.equal(tr.length,2,'a death sends the 2 nearest mates to trade (was every mate within 15 m)');assert.ok(held.every(u=>u.xHold&&u.xHold.until>now),'the other mates hold where they stand, facing the fight');
  const fp=foe[0].g.position,gap=Math.hypot(tr[0].tr[0]-tr[1].tr[0],tr[0].tr[1]-tr[1].tr[1]);assert.ok(Math.abs(gap-ctx.BotBrain.GAP)<1e-6,'the two traders take spots GAP m apart ('+gap.toFixed(2)+')');
  team[1].alive=false;ctx.xTradeChk(team,foe,true);assert.equal(team.filter(u=>u.alive&&u.trT>0).length,2,'a second death keeps at most 2 living traders');
  // sound: one pusher at a time
  for(const u of team){u.trT=0;u.xHold=null;}let pushes=0,holds=0;
  for(let k=0;k<40;k++){now+=2000;for(const u of team){u.hear=[fp.x,fp.z];u.hearT=1.3;u.xHeardAt=0;}ctx.XBH.k='shot';ctx.xHear({x:fp.x,z:fp.z});ctx.XBH.k=null;const n=team.filter(u=>u.alive&&u.trT>0).length;assert.ok(n<=1,'one sound pusher per team ('+n+')');if(n)pushes++;holds+=team.filter(u=>u.xSnd==='hold').length;for(const u of team)u.trT=0;}
  assert.ok(pushes>0,'close gunshots still get pushed sometimes ('+pushes+')');
  // rotation: at most 2 defenders answer one piece of information
  Object.assign(ctx.FV,{you:4,them:4,atk:true});const def=[0,1,2,3,4].map(k=>unit('Def '+k,meta.defender[0]+k,meta.defender[2]));ctx.bots=def;ctx.FV.sp={st:'carry',site:'A',c:null};now=5e5;
  let maxRot=0;for(let r=0;r<12;r++){Object.assign(ctx.FV,{you:10+r});ctx.XNF++;for(const u of def)ctx.xbvPlan(u,def,false,C);const S=ctx.XBVq().strat.get(ctx.xbvKey()+'|d');
   const hit=['A','B'][r%2],hc=meta.sites[hit],src=def.find(u=>ctx.XBVq().plans.get(u).site===hit)||def[0];src.see=1;src.xTt={x:hc[0],z:hc[2]};ctx.XNF++;ctx.xbvInfo(def,C);src.see=0;now+=1e4;
   let moved=0;for(const u of def){const P=ctx.XBVq().plans.get(u);if(P.site===hit&&P.role.slot==='anchor')continue;const g=ctx.xGoal(u,def,false,[0,0]);if(P.rotSite===hit)moved++;}
   maxRot=Math.max(maxRot,moved);assert.ok(moved<=2,`${S.plan.type}/${ctx.XBVq().plans.get(def[0]).role&&S.roles.get(def[0])&&''}: at most 2 defenders rotate on one call (${moved})`);now+=1e5;}
  assert.ok(maxRot>=1,'someone still rotates on information');out.push(`contact rules: 2 traders GAP ${ctx.BotBrain.GAP} m apart, sound pushes ${pushes}/40 calls (1 at a time), rotations per call max ${maxRot}`);}
 // 2. team spread on every native map, both sides
 const maps=(process.env.BS_MAPS||'ascent,bind,haven,split,lotus,breeze').split(','),rounds=+(process.env.BS_ROUNDS||8),secs=+(process.env.BS_SECS||60);
 for(const map of maps){const R=await measureOffline(map,{rounds,secs,html});
  for(const r of R){const tag=`${map} team${r.team}`,b=(BEFORE[map]||[])[r.team];
   out.push(`${tag}: pair ${r.pair.toFixed(1)} m, contact 6 m/3 s max ${r.jumpMax} mean ${r.jumpMean.toFixed(2)}, 12 m/10 s ${r.conv.toFixed(2)}, areas ${r.areas.toFixed(2)} (defending ${r.areasDef.toFixed(2)}), clump ${(100*r.clump).toFixed(0)}%, stacks ${r.stacks} (planned ${r.stackOk})`+(b?` [before: pair ${b.pair.toFixed(1)}, contact max ${b.jumpMax} mean ${b.jumpMean.toFixed(2)}, 12 m/10 s ${b.conv.toFixed(2)}, areas ${b.areas.toFixed(2)}, clump ${(100*b.clump).toFixed(0)}%, stacks ${b.stacks} (planned ${b.stackOk})]`:''));
   if(process.env.BS_MEASURE)continue;
   assert.ok(r.jumpMax<=3,`${tag}: at most 3 bots within 6 m of the first contact in 3 s (${r.jumpMax})`);
   assert.ok(r.clump<=.12,`${tag}: >= 4 bots within 6 m in ${(100*r.clump).toFixed(0)}% of samples`);
   assert.ok(r.pair>=18,`${tag}: mean pairwise teammate distance ${r.pair.toFixed(1)} m`);
   assert.ok(r.areas>=1.6,`${tag}: distinct areas held ${r.areas.toFixed(2)}`);
   assert.equal(r.stacks,r.stackOk,`${tag}: true stacks only on execute / rush / stack plans`);}}
 console.log('Bot spread (offline): '+out.join('; '));
})().catch(e=>{console.error(e);process.exit(1);});
