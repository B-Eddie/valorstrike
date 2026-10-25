// A scripted "human" client for the authoritative room protocol. It speaks the same messages as the browser client
// (hi / start / ready / in / bye), reads only what the server sends (snapshots), and plays like a person hunting one
// named opponent: it walks the nav graph toward them, and when it has a clear line it stops, aims and taps.
// Used by the two-player acceptance run against `wrangler dev` (tools/two-player-local.mjs) and by
// test-two-player.js, which runs the real worker classes in-process.
import {path} from '../src/path.js';

export class ScriptedHuman{
 constructor({name,agent='Jett',token=null,world,target,log=()=>{}}){Object.assign(this,{name,agent,token,world,target,log});this.reset();}
 reset(){this.id=null;this.seq=0;this.started=false;this.ready=false;this.rows=null;this.k={};this.d={};this.kills=[];this.ended=null;this.route=null;this.routeAt=-1;this.routeGoal=-1;this.stuckAt=0;this.lastPos=null;this.dodge=0;this.time=0;this.hits=[];this.respawns=0;this.deathsSeen=0;this.room=null;this.closed=false;}
 attach(socket){this.socket=socket;this.reset();}
 send(m){if(!this.closed)this.socket.send(JSON.stringify(m));}
 hello(){this.send({t:'hi',n:this.name,ag:this.agent,...(this.token?{token:this.token}:{})});}
 leave(){this.send({t:'bye'});this.closed=true;try{this.socket.close();}catch(e){}}
 me(){return this.rows?.find(r=>r[0]===this.id)||null;}
 foe(){return this.rows?.find(r=>r[2]===this.target&&r[12]===1)||null;}
 receive(m){
  if(m.t==='welcome'){this.id=m.you;this.name=m.name;}
  else if(m.t==='room')this.room=m;
  else if(m.t==='start'){this.started=true;this.rows=m.u;this.send({t:'ready'});this.ready=true;}
  else if(m.t==='end'){this.ended=m;this.k=m.k;this.d=m.d;}
  else if(m.t==='s'&&this.ready){const prevFoe=this.foe(),prevMe=this.me();this.rows=m.u;this.k=m.k;this.d=m.d;this.time=m.serverTime||this.time+50;
   for(const e of m.ev||[])if(e[0]==='k')this.kills.push({killer:e[1],victim:e[2],head:e[3],weapon:e[4],at:this.time});
   const foe=this.foe(),me=this.me();
   if(prevFoe&&foe&&foe[8]<prevFoe[8]&&prevFoe[10])this.hits.push({hp:foe[8],from:prevFoe[8],at:this.time});
   if(prevMe&&me&&!prevMe[10]&&me[10])this.respawns++;if(prevMe&&me&&prevMe[10]&&!me[10])this.deathsSeen++;
   this.send(this.input());}
 }
 input(){const me=this.me(),seq=++this.seq,idle={t:'in',seq,r:0,p:0,f:0,s:0};if(!me||!me[10])return idle;const W=this.world,eye=[me[4],me[5]+1.6-(me[17]||0)*.45,me[6]],foe=this.foe();
  const look=me[7]-Math.PI;
  if(foe&&foe[10]){const aim=[foe[4],foe[5]+1.15-(foe[17]||0)*.3,foe[6]],d=aim.map((v,i)=>v-eye[i]),dist=Math.hypot(...d);
   if(dist<45&&W.ray(eye,d.map(v=>v/dist),dist)===Infinity){const r=Math.atan2(-d[0],-d[2]),p=Math.atan2(d[1],Math.hypot(d[0],d[2]));return {t:'in',seq,r,p,f:0,s:0,fire:seq%4<2?1:0};}}
  // Walk the nav graph toward the opponent (or anywhere when they are dead/unknown).
  const goal=foe?W.near(foe[4],foe[6],foe[5]):this.routeGoal;const at=W.near(me[4],me[6],me[5]);
  if(goal>=0&&(!this.route||this.time-this.routeAt>1000||goal!==this.routeGoal)){this.route=path(W,at,goal);this.routeAt=this.time;this.routeGoal=goal;}
  let next=null;if(this.route){const i=this.route.indexOf(at);const rest=i>=0?this.route.slice(i+1):this.route;for(const n of rest){const p=W.nav.nodes[n];if(Math.hypot(p[0]-me[4],p[2]-me[6])>1.2){next=p;break;}}}
  if(!next)return {...idle,r:look};
  if(this.lastPos&&this.time-this.stuckAt>1000){const moved=Math.hypot(me[4]-this.lastPos[0],me[6]-this.lastPos[1]);if(moved<.4)this.dodge=6+(seq%10);this.lastPos=[me[4],me[6]];this.stuckAt=this.time;}else if(!this.lastPos){this.lastPos=[me[4],me[6]];this.stuckAt=this.time;}
  const r=Math.atan2(-(next[0]-me[4]),-(next[2]-me[6]));let s=0,j=0;if(this.dodge>0){this.dodge--;s=seq%20<10?1:-1;j=1;}
  return {t:'in',seq,r,p:0,f:1,s,j};}
}

// The scenario both runners share. `env` provides connect(query) -> socket {send, close, on(message)}, wait(ms), now(),
// profile() -> {token,id}, stats(token). Returns a report object; throws on a failed acceptance check.
export async function twoPlayerScenario(env,{world,map='ascent',mode='dm',code,log=console.log,fightMs=240000,matchLimitMs=700000,shortenMatchTo=null}){
 const pa=await env.profile(),pb=await env.profile();
 const A=new ScriptedHuman({name:'AcceptA',token:pa.token,world,target:'AcceptB'}),B=new ScriptedHuman({name:'AcceptB',token:pb.token,world,target:'AcceptA'});
 const hook=(h,q)=>{const s=env.connect(q);h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>h.hello());return s;};
 const until=async(cond,ms,what)=>{const end=env.now()+ms;while(!cond()){if(env.now()>end)throw Error('Timed out waiting for '+what);await env.wait(50);}};
 hook(A,{create:1,code,mode,map});await until(()=>A.room,10000,'A room');hook(B,{code});
 await until(()=>A.room?.pl?.length===2,10000,'both players in room');A.send({t:'start'});
 await until(()=>A.ready&&B.ready&&A.me()&&B.me(),20000,'match start');
 const report={map,mode,startAt:env.now()};
 // Phase 1: human-to-human hits, kills both ways, death and respawn.
 const hh=(h,x,y)=>h.kills.filter(k=>k.killer===x&&k.victim===y).length;
 await until(()=>hh(A,'AcceptA','AcceptB')>=1&&hh(A,'AcceptB','AcceptA')>=1&&A.respawns>=1&&B.respawns>=1,fightMs,'human-to-human kills both ways and respawns');
 report.phase1={seconds:(env.now()-report.startAt)/1000,aHitsOnB:A.hits.length,bHitsOnA:B.hits.length,aKillsB:hh(A,'AcceptA','AcceptB'),bKillsA:hh(A,'AcceptB','AcceptA'),aRespawns:A.respawns,bRespawns:B.respawns};
 if(!A.hits.length||!B.hits.length)throw Error('No damage between humans observed');
 // Phase 2: B leaves mid-match; a bot takes the seat. B rejoins with the same profile.
 const firstStint={k:A.k.AcceptB||0,d:A.d.AcceptB||0};B.leave();
 await until(()=>A.rows&&!A.rows.some(r=>r[2]==='AcceptB')&&A.room?.pl?.length===1,5000,'B removed after leaving');
 report.leave={units:A.rows.length,humans:A.rows.filter(r=>r[12]).length,botSeat:A.rows.some(r=>!r[12]&&/^Bot /.test(r[2])),firstStint};
 if(report.leave.units!==10||report.leave.humans!==1)throw Error('Seat not refilled by a bot after leave');
 await env.wait(1500);hook(B,{code});await until(()=>B.ready&&B.me(),20000,'B rejoined');
 report.rejoin={name:B.name,team:B.me()[1],humansNow:A.rows?.filter(r=>r[12]).length};if(B.name!=='AcceptB')throw Error('Rejoined under a different name: '+B.name);
 await until(()=>B.me()?.[10]===1,10000,'B alive after rejoin');
 if(shortenMatchTo)env.shorten?.(shortenMatchTo);
 // Phase 3: natural finish (kill limit or clock), then persisted records.
 await until(()=>A.ended&&B.ended,matchLimitMs,'natural match end');
 const k=A.ended.k,d=A.ended.d;report.end={over:A.ended.over,seconds:(env.now()-report.startAt)/1000,kills:{A:k.AcceptA,B:k.AcceptB},deaths:{A:d.AcceptA,B:d.AcceptB},top:Object.entries(k).sort((a,b)=>b[1]-a[1])[0]};
 await env.wait(1500);
 const sa=(await env.stats(pa.token)).profile,sb=(await env.stats(pb.token)).profile;report.records={A:sa,B:sb};
 const best=Math.max(...Object.values(k),firstStint.k+(k.AcceptB||0));
 const expect={A:{kills:k.AcceptA,deaths:d.AcceptA,matches:1,wins:k.AcceptA===best?1:0},B:{kills:firstStint.k+k.AcceptB,deaths:firstStint.d+d.AcceptB,matches:1,wins:firstStint.k+k.AcceptB===best?1:0}};report.expected=expect;
 for(const [n,s] of [['A',sa],['B',sb]])for(const f of ['kills','deaths','matches','wins'])if(s[f]!==expect[n][f])throw Error(`Persisted ${n}.${f}=${s[f]} expected ${expect[n][f]}`);
 return report;
}
