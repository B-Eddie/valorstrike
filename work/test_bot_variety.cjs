// Bot behavior variety: per-bot personality rolls, route splitting + lane jitter,
// shuffled defender holds, per-bot post-plant order, combat strafe flips.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=src.indexOf('// per-bot behavior profiles'),a2=src.indexOf('const XR = {');
const g=src.indexOf('function xGoal'),b=src.indexOf('function xStep');
assert(a>=0&&a2>a&&g>a2&&b>g,'variety+xGoal source found');
const c=src.indexOf('function xFight'),d=src.indexOf('// peek style',c);
assert(c>=0&&d>c,'xFight found');
const slice=src.slice(a,a2)+src.slice(g,b)+src.slice(c,d);
const mk=(env)=>new Function('FV','SITES','XR','XA','xaPick','LG','LOTUS_PLANT','BREEZE_PLANT','LOTUS_HOLD','BREEZE_HOLD','SPLIT_HOLD','xPost','xRet','blocked','feed','xgGet',
  'timeLeft','mode','player','bots','allies','x2',
  'const XF_V=[0,0];'+slice+';return {xPer,xJit,xShuf,xGoal,xFight};')(
  env.FV,env.SITES,env.XR,env.XA,env.xaPick,env.LG,env.LOTUS_PLANT,env.BREEZE_PLANT,env.LOTUS_HOLD,env.BREEZE_HOLD,env.SPLIT_HOLD,env.xPost,env.xRet,env.blocked,env.feed,env.xgGet,
  env.timeLeft,env.mode,env.player,env.bots,env.allies,(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;});
const XR={laneB:[[20,33],[24.5,24],[24.5,12],[24.5,0],[27.5,-9]],hookah:[[16,35],[16,22],[13,13]],tpB:[[-20,33],[-21,17],[-27.5,14],[-27.5,8,"tp"]]};
const XA={bind:{A:["laneA","tpA"],B:["laneB","hookah","tpB"]}};
const env=()=>({FV:{map:"bind",sp:{st:"carry",site:"B",c:null},dm:false},SITES:{A:[-20,-25],B:[20,-25]},
 XR:JSON.parse(JSON.stringify(XR)),XA,xaPick:(m,s)=>XA[m][s][0],LG:{},LOTUS_PLANT:{},BREEZE_PLANT:{},
 LOTUS_HOLD:[[1,1],[2,2],[3,3],[4,4],[5,5]],BREEZE_HOLD:[[1,1],[2,2],[3,3],[4,4],[5,5]],SPLIT_HOLD:[[1,1],[2,2],[3,3],[4,4],[5,5]],
 xPost:()=>[[1,2],[3,4],[5,6]],xRet:()=>null,blocked:()=>false,feed:()=>{},xgGet:()=>({N:[]}),
 timeLeft:80,mode:"five",player:null,bots:[],allies:[]});
const unit=(x,z,per)=>({alive:true,g:{position:{x,z},rotation:{y:0}},per:per||null,hp:100,strafe:1,cd:1});
// 1. personalities roll inside ranges and differ across bots
{
 const api=mk(env());const ps=new Set();
 for(let k=0;k<40;k++){const p=api.xPer();assert(p.ag>=0.15&&p.ag<=1&&p.fl>=0&&p.fl<1&&p.cd>=0.7&&p.cd<1.3&&p.sd>=0&&p.sd<1,'ranges');ps.add(p.sd);}
 assert(ps.size>30,'personalities vary');
}
// 2. route split: high-flank bot leaves the team route, low-flank keeps it
{
 const E=env();const A=mk(E);E.FV.sp.xr="laneB";E.FV.sp.c=null;
 const flanker=unit(20,30,{ag:0.5,fl:0.9,cd:1,sd:0.5});const team=[unit(20,31,{ag:0.5,fl:0.1,cd:1,sd:0.5}),flanker,unit(20,32,{ag:0.5,fl:0.2,cd:1,sd:0.5})];
 team.forEach((u,i)=>A.xGoal(u,team,true,null));
 const last=(u)=>u.xr[u.xr.length-1].slice(0,2); // last waypoint identifies the route (jitter <= 2.2 m)
 const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<2.3;
 assert(!near(last(flanker),[27.5,-9]),'flanker leaves the team route, got '+last(flanker));
 assert(near(last(team[0]),[27.5,-9])&&near(last(team[2]),[27.5,-9]),'low-flank bots keep the team route');
}
// 3. xJit: lane offset applied, scripted links untouched, offsets within 2.2 m
{
 const E=env();const A=mk(E);
 const u=unit(0,0,{ag:0.5,fl:0.5,cd:1,sd:0.9});
 u.xr=[[0,0],[0,10],[0,20,"tp"],[5,30]];
 const tpBefore=u.xr[2].slice();
 A.xJit(u);
 assert.deepEqual(u.xr[2],tpBefore,'scripted waypoint untouched');
 const d=Math.hypot(u.xr[0][0]-0,u.xr[0][1]-0);
 assert(d>0.1&&d<=2.21,'lateral offset within lane, got '+d);
 assert.equal(u.xr[1][1]-u.xr[0][1],10-0,'parallel lane: z-delta preserved');
}
// 4. blocked() fallback: jitter skipped when the offset spot is blocked
{
 const E=env();E.blocked=()=>true;const A=mk(E);
 const u=unit(0,0,{ag:0.5,fl:0.5,cd:1,sd:0.9});u.xr=[[3,4],[3,14]];
 A.xJit(u);
 assert.deepEqual(u.xr[0],[3,4],'blocked offset keeps original waypoint');
}
// 5. defender shuffle: s.ho is a permutation; offsets vary per bot
{
 const E=env();E.FV.map="breeze";const A=mk(E);
 const s=E.FV.sp;const team=[0,1,2,3,4].map(i=>unit(0,0,{ag:0.5,fl:0.5,cd:1,sd:i/5}));
 team.forEach((u,i)=>{const r=A.xGoal(u,team,false,null);assert(r,'defender goal returned');});
 assert(s.ho&&s.ho.length===5&&[...s.ho].sort().join()==='0,1,2,3,4','ho is a permutation: '+s.ho);
 const goals=team.map((u,i)=>JSON.stringify(A.xGoal(u,team,false,null)));
 assert(new Set(goals).size>=3,'holds differ across bots: '+goals.join(' | '));
}
// 6. xFight: strafe flips on the bot's own cadence; two bots flip at different times
{
 const E=env();const A=mk(E);
 const b1=unit(0,0,{ag:0.5,fl:0.5,cd:0.7,sd:0.1}),b2=unit(0,0,{ag:0.5,fl:0.5,cd:1.25,sd:0.9});
 b1.strafe=1;b2.strafe=1;let f1=0,f2=0,last1=1,last2=1;
 for(let t=0;t<8;t+=0.1){A.xFight(b1,0.1,0,10,10);A.xFight(b2,0.1,0,10,10);
  if(b1.strafe!==last1){f1++;last1=b1.strafe;}if(b2.strafe!==last2){f2++;last2=b2.strafe;}}
 assert(f1>=2,'bot 1 strafe flips, got '+f1);
 assert(f2>=1&&f1!==f2,'cadence differs across bots: '+f1+' vs '+f2);
}
// 7. post-plant order shuffled
{
 const E=env();E.FV.sp.st="plant";const A=mk(E);
 const team=[0,1,2].map(i=>unit(0,0,{ag:0.5,fl:0.5,cd:1,sd:0.5}));
 team.forEach((u)=>A.xGoal(u,team,true,null));
 const posts=team.map((u,i)=>JSON.stringify(A.xGoal(u,team,true,null)));
 assert(new Set(posts).size>1,'post-plant spots differ across bots');
}
console.log('test_bot_variety: OK');
