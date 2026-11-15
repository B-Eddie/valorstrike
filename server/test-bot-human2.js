// Bots play like people, not scripts (bots-human-2, user 2026-11-15: "fix bot behavior. make them play more like humans instead
// of like bots"). Shared rules in vendor/bot-brain.cjs (SIGHT / VIEW / HUNT / RELOAD_AT / BACK / HOP), wired into the server's
// Simulation.bot / botOccluded / botUnseen / botTopUp / botHop, bots.js botView / steerPoint, tdm.js navView (offline twin:
// work/bot_variety_runtime.js xbKeep / xbHuntC and the page's bot loops). Measured before on all-bot matches (server DM / TDM,
// Ascent / Bind / Haven, 282 bot-minutes): 123 stuck teleports, 20 % of out-of-fight time standing still, 7.5 % of running
// spent looking > 90 deg off its way, a 10 deg heading weave every 0.1 s, no hop ever, every lost tick of sight a new fight.
//  1. pure rules: object permanence window and "where its motion said"; which contact the eyes go to off-fight (no far sound
//     while on the move, nothing far behind, eyes stay put a moment); committed hunting; reloads out of a fight; hops; no
//     backing out of a fight before the first shot; the calm pace is the same hand, slower
//  2. object permanence in a fight: an enemy that crosses behind a post (0.2 s out of sight) is the same fight - no new reaction,
//     no shot while hidden; one that pops back to the edge it left (a jiggle) is a new fight
//  3. real matches (all bots): Ascent DM and Haven TDM (its spawn rooms) - looking along its way, a straight run, no freezing
//     in the open, few stuck teleports, hops (never in a fight), fights started with a reloaded gun
//   node test-bot-human2.js     (PROBE=1 prints and never fails)
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
import {Simulation,weapons} from './src/simulation.js';import {persona,botView} from './src/bots.js';import {loadWorld} from './src/world.js';import {createSim} from './src/modes.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[],PROBE=!!process.env.PROBE,fails=[];
const check=(ok,msg)=>{if(!ok)fails.push(msg);};
const NAMES=['Bot Sage','Bot Omen','Bot Raze','Bot Sova','Bot Breach','Bot Phoenix','Bot Cypher','Bot Skye','Bot Killjoy','Bot Jett'];
// 1. pure rules
{const Ps=NAMES.map((n,i)=>B.personality(B.hash(n),['entry','anchor','lurker','support'][i%4]));
 const keeps=Ps.map(P=>B.sightKeep(P));assert.ok(keeps.every(k=>k>=B.SIGHT.keep[0]&&k<=B.SIGHT.keep[1]&&k<.5),'object permanence window 0.24-0.4 s, under the 0.5 s glimpse rule');assert.ok(new Set(keeps.map(k=>k.toFixed(4))).size===Ps.length,'every bot its own window');
 const L={t:0,x:0,z:0,vx:5,vz:0};assert.ok(B.sightSame(L,.3,1.5,0,12),'an enemy running on behind a post shows up where its motion said: the same fight');
 assert.ok(!B.sightSame(L,.3,0,0,12),'one back at the edge it left (a jiggle) is not');assert.ok(!B.sightSame(L,.3,1.5,3,12),'nor one somewhere else');
 // eyes off-fight: m.c contacts {x, z, t, kind}
 const mem=(...c)=>{const m=B.memNew();c.forEach((q,i)=>{m.c['e'+i]=Object.assign({y:0,seenT:q.kind==='seen'?q.t:undefined},q);});return m;};
 const run={moving:true,hx:0,hz:-1};
 assert.equal(B.glance(mem({x:0,z:-30,t:9,kind:'heard'}),10,0,0,run),null,'a sound 30 m off while on the move: noted, not looked at');
 assert.ok(B.glance(mem({x:0,z:-30,t:9,kind:'heard'}),10,0,0,{moving:false}),'standing and listening: looked at');
 assert.equal(B.glance(mem({x:0,z:12,t:9.5,kind:'heard'}),10,0,0,run),null,'a sound 12 m behind its way: it keeps its eyes on its way');
 assert.ok(B.glance(mem({x:0,z:6,t:9.5,kind:'heard'}),10,0,0,run),'one 6 m behind: it looks');assert.ok(B.glance(mem({x:0,z:30,t:9.5,kind:'seen'}),10,0,0,run),'an enemy it just saw, even behind: it looks');
 {const m=mem({x:0,z:-15,t:9,kind:'heard'},{x:3,z:-14,t:10,kind:'heard'});const g=B.glance(m,10,0,0,{moving:false,cur:'e0',since:9.6});assert.equal(g&&g.id,'e0','its eyes stay on the contact they went to (VIEW.hold), not the next sound');
  m.c.e1.z=-4;m.c.e1.x=0;assert.equal(B.glance(m,10,0,0,{moving:false,cur:'e0',since:9.6}).id,'e1','unless the new one is much nearer');}
 {const m=mem({x:0,z:-20,t:5,kind:'heard'},{x:0,z:18,t:9,kind:'heard'});assert.equal(B.hunt(m,10,0,0,'e0').id,'e0','hunting: committed to the enemy it goes after, not the latest sound');
  m.c.e1.z=8;assert.equal(B.hunt(m,10,0,0,'e0').id,'e1','but goes for one much nearer');
  const r=mem({x:1,z:1,t:9,kind:'heard'},{x:0,z:-20,t:5,kind:'heard'});assert.equal(B.hunt(r,10,0,0,'e0').id,'e1','a spot it reached with nobody there is passed over');B.memNote(r,'e0',1,0,1,10,'heard');assert.equal(B.hunt(r,10.1,5,5,null).id,'e0','until news of that enemy comes in');}
 const R=(o)=>B.reloadCall(Object.assign({full:25,j:1},o));
 assert.equal(R({mag:15,quiet:.3,killed:true}),'kill','reloads after its kill');assert.equal(R({mag:8,quiet:.7}),'low','low behind cover');assert.equal(R({mag:24,quiet:3.2}),'lull','tops up in a lull');
 assert.equal(R({mag:8,quiet:.2}),null,'not the moment it loses sight');assert.equal(R({mag:25,quiet:9}),null,'not full');assert.equal(R({mag:0,quiet:0}),'empty','empty: at once');
 const paces=Ps.map(P=>B.reloadPace(P));assert.ok(Math.min(...paces)>=.8&&Math.max(...paces)<=1.2&&new Set(paces.map(v=>v.toFixed(3))).size>5,'each bot its own reload pace');
 const many=Array.from({length:60},(_,i)=>B.hopRate(B.personality(B.hash('hop'+i))));const never=many.filter(r=>r===0).length;
 assert.ok(never>=10&&never<=35,'some bots never hop ('+never+'/60)');assert.ok(many.every(r=>r===0||(r>=.4&&r<=4)),'the rest 0.4-4 hops a minute');
 assert.ok(!B.backOff(1.5,false)&&!B.backOff(.5,true)&&B.backOff(1,true),'no stepping back out of a fight before it has shot (and settled)');
 for(const P of Ps){const C=B.calm(P);assert.ok(C.turn<P.turn*.6&&C.turn>P.turn*.35&&B.turnAcc(C)<B.turnAcc(P),'the calm pace is the same hand, slower');assert.equal(B.calm(P),C,'cached');}
 out.push('rules: sight kept '+Math.min(...keeps).toFixed(2)+'-'+Math.max(...keeps).toFixed(2)+' s, glance / hunt / reload / hop ('+never+'/60 never) / backOff / paces');}
// 2. object permanence in a fight (an open plane; WALL toggles every line of sight, as test-bot-perception)
{const nodes=[],adj=[];for(let i=0;i<21;i++)for(let j=0;j<21;j++){nodes.push([i*2-20,0,-j*2+20]);const k=i*21+j,a=[];if(i>0)a.push(k-21);if(i<20)a.push(k+21);if(j>0)a.push(k-1);if(j<20)a.push(k+1);adj.push(a);}
 const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
 const WALL={on:false},G={map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:(o,d,max)=>WALL.on?Math.min(1,max):Infinity};
 const duo=k=>{WALL.on=false;const s=new Simulation(G,'tdm','ascent',B.rng(700+k)),t=s.add('Target','Jett',true),b=s.add(NAMES[k%NAMES.length],'Sage',false);s.phase='game';s.remaining=1e9;s.maxKills=1e9;s.objectiveRoutes=true;s.holdTurn=false;
  Object.assign(t,{team:1,x:-3,y:0,z:-12,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0,input:{},vx:0,vz:0});Object.assign(b,{team:0,x:0,y:0,z:0,look:0,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});persona(s,b);return {s,t,b};};
 const tick=(s,b,dt=1/30)=>{s.time+=dt;const L0=b.look;s.bot(b);botView(s,b,L0,dt);let shots=0;if(b.input.fire&&s.fire(b))shots=1;s.events.length=0;return shots;};
 let post=0,jig=0,n=0,hidden=0,after=0;
 for(let k=0;k<12;k++){n++;
  {const {s,t,b}=duo(k);let eng=0;for(let i=0;i<54;i++){WALL.on=i>=30&&i<36;/* 0.2 s behind a post */t.vx=4;t.x+=4/30;t.hp=1e9;const sh=tick(s,b);t.hp=1e9;if(WALL.on)hidden+=sh;if(i===29)eng=b.engagedAt;if(i>=36&&i<42)after+=sh;}if(eng&&b.engagedAt===eng)post++;}
  {const {s,t,b}=duo(k+50);let eng=0,vx=4;for(let i=0;i<54;i++){WALL.on=i>=30&&i<38;if(i===30)vx=-4;/* hidden: it turns back to the edge it left */if(i<30||i>=38)t.x+=vx/30;else t.x+=(i<34?4:-4)/30;t.vx=vx;t.hp=1e9;tick(s,b);t.hp=1e9;if(i===29)eng=b.engagedAt;}if(eng&&b.engagedAt!==eng)jig++;}}
 check(post>=n*.75,'2. an enemy crossing behind a post stays the same fight in '+post+'/'+n+' (>= 75 %)');check(hidden===0,'2. never a shot while it is hidden ('+hidden+')');
 check(jig>=n*.75,'2. a jiggle back to the edge it left is a new fight in '+jig+'/'+n+' (>= 75 %)');
 out.push('object permanence: behind a post same fight '+post+'/'+n+', jiggle new fight '+jig+'/'+n+', '+hidden+' shots while hidden, '+after+' in the 0.2 s after');}
// 3. real matches, all bots, the room's real step (40 Hz)
const assets={async fetch(r){try{return new Response(await fs.readFile(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
async function play(map,mode,seed,secs){const W=await loadWorld(assets,map);let s0=seed*7919+13;const sim=createSim(W,mode,map,()=>{s0=(s0*16807)%2147483647;return s0/2147483647;});sim.botSeed=seed;sim.start(true);
 const M={calm:0,still:0,mov:0,back:0,turns:[],tele:0,jumps:0,jumpFight:0,fights:0,low:0,min:0},prev=new Map(),ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
 for(let k=0;k<secs*40;k++){sim.step(1/40);
  for(const u of sim.units){if(u.human)continue;let p=prev.get(u);if(!p){p={x:u.x,z:u.z,q:0,un:u.unstuck||0,e:0,j:false,h:[]};prev.set(u,p);}
   if((u.unstuck||0)>p.un){M.tele+=(u.unstuck||0)-p.un;p.un=u.unstuck||0;}
   const jump=!!(u.input&&u.input.jump);if(jump&&!p.j){M.jumps++;if(u.sawTarget)M.jumpFight++;}p.j=jump;
   const e=u.engagedAt||0;if(e&&e!==p.e&&u.alive){const g=weapons[u.weapon];if(g&&g.magazineSize>0){M.fights++;if(u.ammo/g.magazineSize<=.5)M.low++;}}p.e=e;
   if(!u.alive){p.h.length=0;p.q=0;continue;}M.min+=1/40/60;p.q=u.sawTarget||u.occl?0:p.q+1/40;
   if(k%4===0){p.h.push([u.x,u.z]);if(p.h.length>3)p.h.shift();
    if(p.q>=1&&p.h.length===3){const [a,b,c]=p.h,sp=Math.hypot(c[0]-b[0],c[1]-b[1])/.1;if(sp<20){M.calm++;if(sp<.3)M.still++;
     if(sp>2){M.mov++;const mh=Math.atan2(-(c[0]-b[0]),-(c[1]-b[1]));if(Math.abs(ang(u.look-mh))>Math.PI/2)M.back++;const l1=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l1>.3)M.turns.push(Math.abs(ang(mh-Math.atan2(-(b[0]-a[0]),-(b[1]-a[1])))));}}}}}}
 const T=M.turns.sort((a,b)=>a-b);return {back:M.back/Math.max(1,M.mov),still:M.still/Math.max(1,M.calm),turn50:(T[T.length>>1]||0)*57.3,tele:M.tele,telePerMin:M.tele/Math.max(1e-9,M.min),jumpsPerMin:M.jumps/Math.max(1e-9,M.min),jumpFight:M.jumpFight,fights:M.fights,lowMag:M.low/Math.max(1,M.fights),min:M.min};}
{const dm=await play('ascent','dm',1,90),tdm=await play('haven','tdm',2,120);
 for(const [k,r] of [['Ascent DM',dm],['Haven TDM',tdm]]){
  check(r.back<.05,'3. '+k+': running looking > 90 deg off its way '+(r.back*100).toFixed(1)+' % (< 5 %; was 7.5 %)');
  check(r.turn50<3,'3. '+k+': heading change median '+r.turn50.toFixed(1)+' deg per 0.1 s (< 3; was ~10: the node weave)');
  check(r.still<.2,'3. '+k+': standing still out of a fight '+(r.still*100).toFixed(1)+' % (< 20 %)');
  check(r.lowMag<.08,'3. '+k+': fights started at half a magazine or less '+(r.lowMag*100).toFixed(1)+' % of '+r.fights+' (< 8 %; was 6-14 %)');
  check(r.jumpFight===0,'3. '+k+': no hop in a fight ('+r.jumpFight+')');}
 check(dm.jumpsPerMin>.15,'3. bots hop now and then ('+dm.jumpsPerMin.toFixed(2)+' / bot-minute)');
 check(dm.telePerMin<.4,'3. Ascent DM stuck teleports '+dm.tele+' ('+dm.telePerMin.toFixed(2)+' / bot-minute)');check(tdm.tele<=12,'3. Haven TDM stuck teleports '+tdm.tele+' (<= 12; was 30+ at its defenders\' spawn room)');
 out.push(['Ascent DM',dm,'Haven TDM',tdm].reduce((s,v,i,a)=>i%2?s:s+`${v}: back ${(a[i+1].back*100).toFixed(1)} %, turn ${a[i+1].turn50.toFixed(1)} deg, still ${(a[i+1].still*100).toFixed(1)} %, low-mag fights ${(a[i+1].lowMag*100).toFixed(1)} %, hops ${a[i+1].jumpsPerMin.toFixed(2)}/min, teleports ${a[i+1].tele}; `,'').trim());}
if(fails.length&&!PROBE){console.error('FAIL test-bot-human2\n - '+fails.join('\n - '));process.exit(1);}
console.log((fails.length?'PROBE (would fail): '+fails.join('; ')+'\n':'')+'Bots play like people (bots-human-2): '+out.join('; '));
