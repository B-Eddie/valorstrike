// Offline bot sprays match the server bots' (bot-spray, found by the bot-gun lane: offline bot spray bloom was ~5x the
// server motor's, so at 15 m offline sprays of 7+ bullets hit ~14 % vs ~57 % on the server and an offline fight's hit %
// fell after ~1 s even though the aim converged). Same weapon, same perfect hand on both sides - the crosshair held on
// the chest of a standing target at 10 / 15 / 20 m, the shooter standing still, 12-bullet sprays at each side's own
// cadence - so only the gun is compared: spread + bloom + spray recoil (and, in part 2, the bot's recoil pull).
//  - server: the real Simulation.fire (server/src/simulation.js: Motor.spread + sprayBloom + sprayStep, the 's' event's
//    first-bullet direction); part 2 adds the server bot's view pull exactly as Simulation.bot writes it
//    (BotBrain.sprayPull of the bot's brain x the spray's recoilY / x.6 recoilX, while the last shot is < 0.3 s old).
//  - offline: the real page (work/page_harness.cjs native: the VALORANT FEEL block / shared motor kept, as shipped) xbShot along the bot's view (u.g.rotation.y / u.xbVP),
//    the bullet read from u.xbLS; part 2 with the same pull share (u.xbPull = the server brain's recoilPull).
// Per bullet index (1-based groups 1 / 2-3 / 4-6 / 7-12): mean climb (vertical offset from the crosshair), spread (rms
// of the offset around its mean), and hit % on BotBrain.hitPart (the server hit volumes, shared) at each range.
// Part 3 (15 m, no pull): crouched still / walking / running reach the same motor inputs (rms and climb as above).
// Asserts per range and group: hit % within 10 points, rms within x0.8-1.25, mean climb within 1.5 mrad, 15 % or 3 standard errors; with
// the pull, offline hit % within 10 points and never above the server's + 10 (offline bots no stronger).
//   node work/test_bot_spray_parity.cjs        (SP_N=sprays per range, default 200)
const path=require('path'),root=path.join(__dirname,'..'),fs=require('fs');const {boot}=require('./page_harness.cjs');
const BB=require(path.join(root,'vendor/bot-brain.cjs'));
const N=+(process.env.SP_N||200),LEN=12,DISTS=[10,15,20],AIMY=BB.AIM_H.chest,G=[[1,1],[2,3],[4,6],[7,12]];
if(!fs.existsSync(path.join(root,'server/public/worlds/ascent/bvh0.bin'))){console.log('test_bot_spray_parity: SKIP (no server/public/worlds collision: npm run build:worlds)');process.exit(0);}
const fails=[],out=[];const ok=(c,m)=>{if(!c)fails.push(m);};
// the server bot's spray pull (Simulation.bot): pinned so the emulation below stays the server's expression
const SIM=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8');
ok(SIM.includes("rc=S&&this.time-(S.shot??-9)<.3?BotBrain.sprayPull(P.brain,undefined,S.sequence||0):0,ry=rc?rc*(S.recoilY||0):0,rx=rc?rc*.6*(S.recoilX||0):0")&&SIM.includes('+xe[0]+rx,bdt')&&SIM.includes('+xe[1]-ry;'),'server bot spray pull expression moved (update this emulation)');
function offsets(v,look,pitch){/* bullet v vs crosshair (look / pitch), radians: [horizontal, vertical] */const h=Math.hypot(v[0],v[2]);return [Math.atan2(Math.sin(Math.atan2(v[0],v[2])-look),Math.cos(Math.atan2(v[0],v[2])-look)),Math.atan2(v[1],h)-pitch];}
function hitAt(v,d){/* the bullet ray from the eye (1.6 m) vs a standing target d ahead, projected as xbShot does: lateral miss d|sin yaw|, height 1.6 + d cos(yaw) tan(elevation) */const yaw=v[0],el=Math.atan2(AIMY-1.6,d)+v[1];return BB.hitPart(d*Math.abs(Math.sin(yaw)),1.6+d*Math.cos(yaw)*Math.tan(el),0);}
function stats(S){/* S[d][spray][bullet]=[ox,oy] -> per group */const r={};for(const d of Object.keys(S).map(Number)){r[d]=G.map(([lo,hi])=>{const q=[];for(const s of S[d])for(let i=lo-1;i<hi;i++)q.push(s[i]);const mx=q.reduce((a,p)=>a+p[0],0)/q.length,my=q.reduce((a,p)=>a+p[1],0)/q.length,rms=Math.sqrt(q.reduce((a,p)=>a+(p[0]-mx)**2+(p[1]-my)**2,0)/q.length);
  return {n:q.length,climb:my,drift:mx,rms,hit:q.filter(p=>hitAt(p,d)).length/q.length};});}return r;}
const climbTol=(x,y)=>Math.max(.0015,.15*Math.abs(x.climb),3*Math.sqrt((x.rms*x.rms/x.n+y.rms*y.rms/y.n)/2));/* 1.5 mrad, 15 %, or 3 standard errors of the difference of the means (a wide moving cone) */
const pct=x=>(100*x).toFixed(0)+'%',mr=x=>(1000*x).toFixed(1);
(async()=>{
 // ---- server
 const {Simulation}=await import(path.join(root,'server/src/simulation.js'));const {persona}=await import(path.join(root,'server/src/bots.js'));
 const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
 const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
 const W={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new Simulation(W,'tdm','ascent',BB.rng(4242));s.add('Hold','Jett',true);const a=s.add('Bot Sova','Sage',false),t=s.add('Bot Jett','Jett',false);s.phase='game';s.remaining=1e9;s.matchLen=1e9+300;s.maxKills=1e9;
 const h=s.units.find(u=>u.human);Object.assign(h,{x:100,z:100,team:0});a.persona=null;const brain=persona(s,a).brain,pullShare=BB.recoilPull(brain);
 function server(pull,ST,DS,NN){ST=ST||{};const R={};for(const d of (DS||DISTS)){R[d]=[];for(let n=0;n<(NN||N);n++){s.time+=2;a.fireAt=0;const sp=[];
   for(let i=0;i<LEN;i++){Object.assign(a,{team:0,x:0,y:0,z:0,alive:true,loading:false,weapon:'Vandal',ammo:1e9,hp:100,cr:false,mv:false,sf:0,wk:0,air:false,ls:0,vx:0,vz:0,ch:0,protectedUntil:0,dismissUntil:0,reloadAt:0},ST);a.input.ads=false;a.input.fire=true;
    Object.assign(t,{team:1,x:0,y:0,z:-d,alive:true,hp:1e9,protectedUntil:0,invulnerableUntil:0});s.time=Math.max(s.time,a.fireAt);
    const look=0,pitch=Math.atan2(AIMY-1.6,d),S=a.spray,rc=pull&&S&&s.time-(S.shot??-9)<.3?BB.sprayPull(brain,undefined,S.sequence||0):0,ry=rc?rc*(S.recoilY||0):0,rx=rc?rc*.6*(S.recoilX||0):0;
    a.look=look+rx;a.pitch=pitch-ry;s.events.length=0;if(!s.fire(a))throw Error('server fire refused');const e=s.events.find(x=>x[0]==='s'&&x[1]===a.id);
    /* server forward = (-sin look, ., -cos look): mirror x / z into the page's (+sin, +cos) convention */sp.push(offsets([-e[3],e[4],-e[5]],look,pitch));a.triggerHeld=false;}
   R[d].push(sp);}}return R;}
 const srv=server(false),srvP=server(true);
 // ---- offline (real page)
 const H=boot({real3:true,seed:11,native:true}),xe=H.xe;const adv=async ms=>{for(let q=0;q<ms;q+=50){H.advance(Math.min(50,ms-q));await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);
 for(let i=0;i<150&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 ok(xe('running&&typeof xbShot==="function"&&bots.length>0&&allies.length>0'),'no live offline round');
 const off=(P,ST,DS,NN)=>JSON.parse(xe(`(()=>{const ST=${JSON.stringify(ST||{})};const b=bots[0],t=allies[0],out={};window.__T=performance.now();try{performance.now=()=>__T;}catch(e){}if(performance.now()!==__T)return JSON.stringify({err:'clock'});
  const W=WEAP.Vandal,D=DIFF.normal,AIMY=${AIMY};for(const d of ${JSON.stringify(DS||DISTS)}){out[d]=[];for(let n=0;n<${NN||N};n++){__T+=2000;b.lt=9;b.sn=0;const sp=[];
   for(let i=0;i<${LEN};i++){b.alive=true;b.hp=100;b.w='Vandal';b.cr=false;b.mv=false;b.sf=0;b.wk=0;b.rope=0;Object.assign(b,ST);b.g.position.set(0,0,0);t.alive=true;t.hp=100;t.cr=false;t.g.position.set(0,0,d);
    if(i===0){xbEngage(b,true,{off:0,e0y:0,d});${P!=null?'b.xbPull='+P+';':'b.xbPull=0;'}}b.see=3;const pitch=Math.atan2(AIMY-1.6,d);b.g.rotation.y=0;b.xbVP=pitch;b.xbTrP=0;
    const r=xbShot(b,{t,x:0,z:d},{x:0,y:1.6,z:0},'Vandal',W,d,D);if(r===undefined)return JSON.stringify({err:'no human aim model'});const v=b.xbLS.d,hh=Math.hypot(v.x,v.z);
    sp.push([Math.atan2(v.x,v.z),Math.atan2(v.y,hh)-pitch]);__T+=1000/(W.rate||4);b.lt=1/(W.rate||4);}out[d].push(sp);}}return JSON.stringify(out);})()`));
 const o0=off(null),o1=off(pullShare);for(const o of [o0,o1])if(o.err){console.log('test_bot_spray_parity: FAIL',o.err);process.exit(1);}
 const A=stats(srv),B=stats(o0),AP=stats(srvP),BP=stats(o1);
 for(const d of DISTS){out.push(d+' m  bullets   server: climb mrad / rms mrad / hit   offline: climb / rms / hit   |  with pull: server hit / offline hit');
  G.forEach(([lo,hi],g)=>{const x=A[d][g],y=B[d][g],xp=AP[d][g],yp=BP[d][g],tag=d+' m bullets '+lo+'-'+hi+': ';
   out.push('   '+(lo+'-'+hi).padEnd(5)+'  '+mr(x.climb).padStart(6)+' / '+mr(x.rms).padStart(5)+' / '+pct(x.hit).padStart(4)+'      '+mr(y.climb).padStart(6)+' / '+mr(y.rms).padStart(5)+' / '+pct(y.hit).padStart(4)+'   |   '+pct(xp.hit).padStart(4)+' / '+pct(yp.hit).padStart(4));
   ok(Math.abs(x.hit-y.hit)<=.1,tag+'hit % offline '+pct(y.hit)+' vs server '+pct(x.hit)+' (within 10 points)');
   ok(y.rms>=x.rms*.8&&y.rms<=x.rms*1.25,tag+'spread rms offline '+mr(y.rms)+' vs server '+mr(x.rms)+' mrad (x0.8-1.25)');
   ok(Math.abs(y.climb-x.climb)<=climbTol(x,y),tag+'climb offline '+mr(y.climb)+' vs server '+mr(x.climb)+' mrad');
   ok(Math.abs(xp.hit-yp.hit)<=.1&&yp.hit<=xp.hit+.1,tag+'with the recoil pull: hit % offline '+pct(yp.hit)+' vs server '+pct(xp.hit));});}
 // part 3: the bot's movement / crouch state reaches the same motor inputs (crouched still: crouch first / max spread + x.85
 // recoil; walking: walk ramp on sf; running sf 1: run spread + the Vandal's x1.8 running recoil), 15 m, no pull
 for(const [name,st] of [['crouched',{cr:true}],['walking',{mv:true,wk:1,sf:.9}],['running',{mv:true,sf:1}]]){const x=stats(server(false,st,[15],120))[15],y=stats(off(null,st,[15],120))[15];
  out.push('15 m '+name.padEnd(8)+' rms server / offline mrad '+G.map(([lo,hi],g)=>(lo+'-'+hi)+' '+mr(x[g].rms)+'/'+mr(y[g].rms)).join('  ')+'   climb '+G.map((_,g)=>mr(x[g].climb)+'/'+mr(y[g].climb)).join(' '));
  G.forEach(([lo,hi],g)=>{const tag='15 m '+name+' bullets '+lo+'-'+hi+': ';ok(y[g].rms>=x[g].rms*.8&&y[g].rms<=x[g].rms*1.25,tag+'spread rms offline '+mr(y[g].rms)+' vs server '+mr(x[g].rms)+' mrad');ok(Math.abs(y[g].climb-x[g].climb)<=climbTol(x[g],y[g]),tag+'climb offline '+mr(y[g].climb)+' vs server '+mr(x[g].climb)+' mrad');});}
 console.log(out.join('\n'));
 if(fails.length){console.log('test_bot_spray_parity: FAIL\n - '+fails.join('\n - '));process.exit(1);}console.log('test_bot_spray_parity: PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
