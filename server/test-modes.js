// modes-1: extra online modes (server/src/modes.js) and party mode switching / queue (worker.js GameRoom 'mode' / 'queue').
// Rules come from the wiki pages listed in modes.js; this test pins them:
//  1. Escalation: 12 levels Odin..Knife, 7 team points per level (1 on the team level, 0.5 behind), individual level needs a kill,
//     weapon locked to the level (equip / buy refused), random spawn + 5 s protection ended by moving, level 12 or 10 min ends it.
//  2. Swiftplay: first to 5, swap after 4, 4-4 -> Endgame round 9 with 5000; credits 800 / +2400 (+600 to the round-1 winners) /
//     +4250 / +4250, no loss bonus; ult 2 points at the start of a half (3 for a 9-point ult); buy 45 / 30, round 100 s.
//  3. Spike Rush: first to 4, swap after 3, pre-round 20 s, round 80 s, one random gun for all from the round's set, shields 0 / 25 /
//     50, no buying, all basic / signature charges, kill + death ult x2, ult orbs (+1, one full), any attacker in a site holds the Spike.
//  4. Replication: one agent per team (a human's pick), credits 900 / 2400 / 3900 / 6000 each round, weapons and shields reset,
//     +1 ult per round, FLASHGUARD (blinded twice in 4 s -> 5 s immune).
//  5. Worker: /health lists esc (always) and the Spike variants only with ENABLE_SPIKE, plus the lobby features; party switching
//     (leader only, live to every member, new unit ids, map change loads the world), queue countdown seen by members, a mode
//     change / leader cancel / leader leaving cancels it, the queued start uses the selected mode and map.
import assert from 'node:assert/strict';
import {EscalationSimulation,VariantSpikeSimulation,ESC_LEVELS,ESC_PACK,SR_LOADOUT,createSim} from './src/modes.js';
import {Simulation,reserveOf,weapons} from './src/simulation.js';
import {fogView} from './src/fog.js';
import {SpikeSimulation} from './src/spike.js';
import kits from './src/kits.json' with {type:'json'};
import {localCluster} from './tools/local-cluster.mjs';
const out=[],note=s=>{out.push(s);if(process.env.VERBOSE)console.log(s);};
const W={map:{attacker:[0,0,0],defender:[0,0,-40],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-40],[30,0,-20],[-30,0,-20]],adj:[[1,2,3],[0,2,3],[0,1],[0,1]]},playable:[0,1,2,3],allowed:new Set([0,1,2,3]),near:(x,z)=>z<-20?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity,plantAt:(x,z)=>Math.hypot(x,z)<3?'A':null};
let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
// ---- 1. Escalation ----
{assert(createSim(W,'esc','ascent')instanceof EscalationSimulation);assert(createSim(W,'swift','ascent')instanceof VariantSpikeSimulation);assert(createSim(W,'five','ascent')instanceof SpikeSimulation);assert.equal(createSim(W,'tdm','ascent').constructor,Simulation);
 const s=new EscalationSimulation(W,'esc','ascent',rnd),a=s.add('A','Jett'),b=s.add('C','Sage'),a2=s.add('B','Sova'),b2=s.add('D','Omen');s.start(false);
 assert.equal(ESC_LEVELS.length,12);assert.deepEqual([ESC_LEVELS[0],ESC_LEVELS[11]],['Odin','Knife']);assert.equal(s.mode,'esc');assert.equal(s.gm,'esc');assert.equal(s.remaining,600);
 assert.equal(a.team,0);assert.equal(b.team,1);for(const u of [a,a2,b,b2])assert.equal(u.weapon,'Odin','level 1 = Odin');
 assert.equal(s.command(a,{t:'equip',w:'Vandal'}),false,'only the level weapon');assert.equal(s.command(a,{t:'equip',w:'Knife'}),true,'knife allowed');assert.equal(s.command(a,{t:'buy',n:'Vandal'}),false,'no buying');
 assert(a.protectedUntil-s.time>4.9,'5 s spawn protection');a.input={forward:1};a.inputAt=s.time;s.time+=.3;s.step(.05);assert(!(a.protectedUntil>s.time),'moving ends the protection');
 const kill=(k,v)=>s.onGunKill(k,v);
 for(let i=0;i<6;i++)kill(a,b);assert.equal(s.esc.lv[0],0);assert.equal(s.esc.pt[0],6);kill(a,b);assert.equal(s.esc.lv[0],1,'7 points -> level 2');assert.equal(a.escLv,1);assert.equal(a.weapon,'Ares','killer advances');
 assert.equal(a2.escLv,0,'no kill yet: stays on Odin');assert.equal(a2.weapon,'Odin');kill(a2,b);assert.equal(s.esc.pt[0],.5,'a kill behind the team level is 0.5');assert.equal(a2.weapon,'Ares','its kill unlocks the next level');
 for(let i=0;i<200&&s.esc.lv[0]<11;i++){kill(a,b);kill(a2,b);}assert.equal(s.esc.lv[0],11);assert.equal(s.escWeapon(a),'Knife');
 kill(a,b);assert.equal(s.esc.lv[0],12,'one Knife kill finishes level 12');s.step(.05);assert.equal(s.phase,'post');assert(s.scores[0]>s.scores[1]);
 const t=new EscalationSimulation(W,'esc','ascent',rnd);t.add('A');t.add('C');t.start(false);t.onGunKill(t.units[1],t.units[0]);t.remaining=.01;t.step(.05);assert.equal(t.phase,'post');assert(t.scores[1]>t.scores[0],'time out: furthest along wins');
 const snap=s.snapshot();assert.deepEqual(snap.esc.lv,[12,0]);assert.equal(snap.esc.w[1],'Odin');
 note('escalation: Odin..Knife, 7 points / level (0.5 behind), kill-gated individual level, level-locked weapon, 5 s protection ends on move, Knife kill or time ends it');}
// ---- 1b. Escalation health packs (wiki Escalation: each death drops a pack on the body for 10 s, full health / shields / ammo) ----
{seed=3;const s=new EscalationSimulation(W,'esc','ascent',rnd),a=s.add('A','Jett'),b=s.add('C','Sage'),c=s.add('B','Sova');s.start(false);
 assert.deepEqual({...ESC_PACK},{life:10,hp:100,armor:50,r:.5,cap:100,armorCap:50,ammo:true});
 const park=(u,x,z)=>Object.assign(u,{x,y:0,z,vx:0,vz:0,vy:0,input:{},inputAt:-9,loading:false});park(a,0,-30);park(b,20,-10);park(c,-20,-10);
 b.hp=0;b.alive=false;b.deaths++;b.lastKiller=a.id;b.respawnAt=s.time+60;s.step(.05);assert.equal(s.packs.length,1,'an Escalation death drops a pack');const k=s.packs[0];assert.deepEqual([k.x,k.z],[20,-10]);
 const sn=s.snapshot();assert(Array.isArray(sn.hpk)&&sn.hpk.length===1&&sn.hpk[0][6]>9.8&&sn.hpk[0][6]<=10,'snapshot hpk row, 10 s left');
 const g=c.weapon;park(c,20,-10);c.hp=100;c.armor=50;c.ammo=1;c.reserve=0;c.inventory[g]=1;c.reserves[g]=0;c.reloadAt=s.time+1;s.step(.05);assert.equal(s.packs.length,0,'full health, gun not full: taken');
 assert.equal(c.ammo,weapons[g].magazineSize,'magazine refilled');assert.equal(c.reserve,reserveOf(g),'reserve refilled');assert.equal(c.reloadAt,0,'reload cancelled');
 b.alive=true;b.hp=100;park(b,20,-10);b.hp=0;b.alive=false;b.deaths++;s.step(.05);assert.equal(s.packs.length,1);park(c,20,-10);c.hp=100;c.armor=50;s.step(.05);assert.equal(s.packs.length,1,'full health / armour / ammo: the pack stays');
 c.hp=7;c.armor=0;s.step(.05);assert.equal(s.packs.length,0);assert.deepEqual([c.hp,c.armor],[100,50],'full restore');
 b.alive=true;park(b,20,-10);b.hp=0;b.alive=false;b.deaths++;s.step(.05);park(c,-20,-10);for(let i=0;i<196;i++)s.step(.05);assert.equal(s.packs.length,1,'still there before 10 s');for(let i=0;i<6;i++)s.step(.05);assert.equal(s.packs.length,0,'gone after 10 s');
 assert.equal(fogView(s,sn,a).hpk?.length,1,'killer sees it through fog');
 {const t=new Simulation(W,'tdm','ascent',()=>.5);t.add('p','Jett',true);t.start(false);assert.equal(t.snapshot().hpk,undefined,'still no packs in TDM');}
 note('escalation packs: a death drops one (10 s), full health / armour + magazine and reserve, taken at full health when a gun is not full, fog-filtered hpk rows');}
// helpers for the Spike variants
const mk=(gm,agents=['Jett','Sova','Sage','Omen'])=>{seed=7;const s=new VariantSpikeSimulation(W,gm,'ascent',rnd);const u=agents.map((g,i)=>s.add('P'+i,g,true));s.start(false);return {s,u};};
const next=(s,w)=>{s.finishRound(w,'Attackers eliminated');for(let i=0;i<200&&s.roundDelay>0&&s.phase==='game';i++)s.step(.05);};
// ---- 2. Swiftplay ----
{const {s,u}=mk('swift');const [a,a2,b]=u;assert.equal(s.round,1);assert.equal(s.buy,45);assert.equal(s.remaining,100);for(const x of u)assert.equal(x.credits,800);
 assert.equal(a.ability.ult,Math.min(kits.Jett.u>=9?3:2,kits.Jett.u),'ult starts at 2 (3 for a 9-point ult)');const nine=Object.keys(kits).find(k=>kits[k].u>=9);if(nine){const m2=mk('swift',[nine,'Sova','Sage','Omen']);assert.equal(m2.u[0].ability.ult,3,nine+' 9-point ult starts at 3');}
 const atk0=s.atk;next(s,0);assert.equal(s.round,2);assert.equal(s.buy,30);assert.equal(a.credits,800+2400+(a.team===0?600:0));assert.equal(b.credits,800+2400+(b.team===0?600:0));
 next(s,1);assert.equal(a.credits,Math.min(9000,800+2400+600+4250));next(s,1);next(s,1);assert.equal(s.round,5);assert.notEqual(s.atk,atk0,'sides swap after round 4');for(const x of u)assert.equal(x.credits,800,'second half starts on 800');assert.equal(s.buy,45);
 for(let i=0;i<3;i++)next(s,0);assert.deepEqual(s.roundScores,[4,3]);next(s,1);assert.deepEqual(s.roundScores,[4,4]);assert.equal(s.round,9,'4-4: Endgame round 9');for(const x of u)assert.equal(x.credits,5000);
 next(s,0);assert.equal(s.phase,'post');assert.deepEqual(s.scores,[5,4]);const re=s.roundEvents.filter(e=>e.t==='re');assert.equal(re.at(-1).o,1);assert.equal(re.at(-2).o,0);
 const q=mk('swift');for(let i=0;i<5;i++)next(q.s,1);assert.equal(q.s.phase,'post','5-0 ends after 5 rounds');assert.deepEqual(q.s.scores,[0,5]);
 const rs=s.roundState(a);assert.equal(rs.gm,'swift');assert.equal(rs.win,5);
 note('swiftplay: 800 / +2400 (+600) / +4250 / +4250, swap after 4 back to 800, 4-4 Endgame on 5000, first to 5, ult start 2 (9-point 3)');}
// ---- 3. Spike Rush ----
{const {s,u}=mk('sr');const [a,a2,b,b2]=u;assert.equal(s.buy,20);assert.equal(s.remaining,80);const g1=a.weapon;assert(SR_LOADOUT[0].w.includes(g1),'round 1: a sidearm');for(const x of u){assert.equal(x.weapon,g1,'same gun for everyone');assert.equal(x.armor,0);assert.equal(x.credits,0);}
 assert.equal(s.command(a,{t:'buy',n:'Ghost'}),false,'no buying');for(const x of u){const M=kits[x.agent].mx;assert.equal(x.ability.c,M.c||0);assert.equal(x.ability.q,M.q||0);}
 next(s,0);assert(SR_LOADOUT[1].w.includes(a.primary),'round 2: a primary of 2050 or less ('+a.primary+')');for(const x of u)assert.equal(x.armor,25);next(s,0);assert(SR_LOADOUT[2].w.includes(a.primary));for(const x of u)assert.equal(x.armor,50);
 const atk=s.atk;next(s,1);assert.notEqual(s.atk,atk,'swap after round 3');next(s,1);next(s,0);assert.deepEqual(s.roundScores,[3,2]);next(s,1);assert.equal(s.round,7,'3-3 Endgame');for(const x of u)assert.equal(x.ability.ult,Math.max(0,kits[x.agent].u-3),'Endgame: 3 short of the ult');assert(SR_LOADOUT[2].w.includes(a.weapon)||SR_LOADOUT[2].w.includes(a.primary));
 next(s,1);assert.equal(s.phase,'post');assert.deepEqual(s.scores,[3,4]);
 const m=mk('sr');const S=m.s,[p,p2,e]=m.u;S.buy=0;assert(S.orbs.length>=1&&S.orbs.length<=5,'1-5 orbs');assert.equal(S.orbs.filter(o=>o.full).length,1);const orb=S.orbs.find(o=>!o.full)||S.orbs[0];const u0=p.ability.ult;Object.assign(p,{x:orb.x,y:orb.y,z:orb.z});S.step(.05);assert(!S.orbs.includes(orb),'orb taken');assert.equal(p.ability.ult,orb.full?kits[p.agent].u:u0+1);
 const k0=p.ability.ult,ft=S.fireTick;S.fireTick=function(l){p.kills++;S.fireTick=ft;return ft.call(this,l);};S.step(.05);assert.equal(p.ability.ult,Math.min(kits[p.agent].u,k0+1),'tick counts the kill once more (x2 with the normal point)');
 const A=S.units.filter(x=>x.team===S.atk),site=A.find(x=>x.id!==S.spike.carrier);Object.assign(site,{x:0,y:0,z:0});for(const x of A)if(x!==site)Object.assign(x,{x:0,y:0,z:-30});S.step(.05);assert.equal(S.spike.carrier,site.id,'the attacker in a site holds the Spike');
 note('spike rush: 20 s / 80 s, one random gun per round from the round set, shields 0/25/50, no buy, full basics, swap after 3, 3-3 Endgame 3 short of ult, first to 4, orbs, kill ult x2, any attacker plants');}
// ---- 4. Replication ----
{const {s,u}=mk('rep',['Jett','Sova','Sage','Omen']);const t0=u.filter(x=>x.team===0),t1=u.filter(x=>x.team===1);assert(new Set(t0.map(x=>x.agent)).size===1&&new Set(t1.map(x=>x.agent)).size===1,'one agent per team');
 const humans0=u.filter(x=>x.human&&x.team===0).map(x=>x.agent);assert(['Jett','Sage'].includes(t0[0].agent),'a team-0 human pick: '+t0[0].agent);assert(['Sova','Omen'].includes(t1[0].agent));
 for(const x of u)assert.equal(x.credits,900);next(s,0);for(const x of u){assert.equal(x.credits,2400,'set, not earned');assert.equal(x.primary,null);assert.equal(x.armor,0);}next(s,0);for(const x of u)assert.equal(x.credits,3900);next(s,1);for(const x of u)assert.equal(x.credits,6000);
 const v=u[0],ult=v.ability.ult;next(s,1);assert.equal(s.round,5);for(const x of u)assert.equal(x.credits,900,'second half 900');
 s.buy=0;v.blindUntil=s.time+1;s.step(.05);v.blindUntil=s.time;s.step(.05);s.time+=1;v.blindUntil=s.time+1;s.step(.05);assert(v.fgUntil>s.time+4.8,'flashed twice in 4 s: FLASHGUARD');v.blindUntil=s.time+2;s.step(.05);assert(!(v.blindUntil>s.time),'cannot be blinded during FLASHGUARD');assert(s.roundState(v).fg>4);
 note('replication: one agent per team from a human pick, credits 900/2400/3900/6000 set each round, gear reset, FLASHGUARD');}
// ---- 5. worker: health, party switching, queue ----
{const P=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});const h=await (await P.fetch('/health')).json();assert.deepEqual(h.modes,['dm','tdm','esc'],'production: DM, TDM, Escalation');assert(h.features.includes('party-mode')&&h.features.includes('queue'));
 const C=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const hs=await (await C.fetch('/health')).json();for(const m of ['five','swift','sr','rep','esc'])assert(hs.modes.includes(m),m+' with ENABLE_SPIKE');
 const code='PARTYA',until=async(c,ms,w)=>{const end=C.clock.now()+ms;while(!c()){if(C.clock.now()>end)throw Error('timed out: '+w);await C.advance(50);}};
 class Cl{constructor(n){this.n=n;this.msgs=[];this.room=null;this.you=null;}hook(q){this.s=C.connect(q);this.s.on('message',m=>{this.msgs.push(m);if(m.t==='room')this.room=m;if(m.t==='welcome')this.you=m.you;if(m.t==='start'){this.start=m;this.s.send(JSON.stringify({t:'ready'}));}});this.s.on('open',()=>this.send({t:'hi',n:this.n,ag:this.n==='Lead'?'Jett':'Sage'}));return this;}send(m){this.s.send(JSON.stringify(m));}last(t){return this.msgs.filter(m=>m.t===t).at(-1);}}
 const A=new Cl('Lead').hook({create:1,code,mode:'tdm',map:'ascent'});await until(()=>A.room&&A.you!=null,8000,'room');const B=new Cl('Mate').hook({code});await until(()=>B.room&&B.room.pl.length===2&&A.room.pl.length===2,8000,'join');
 assert.equal(A.room.mode,'tdm');B.send({t:'mode',mode:'dm'});await until(()=>B.last('mo'),2000,'mo');assert.equal(B.last('mo').ok,0,'a member cannot change the mode');assert.equal(C.room(code).gm(),'tdm');
 const idA=A.you;A.send({t:'mode',mode:'esc'});await until(()=>B.room.mode==='esc'&&A.room.mode==='esc',3000,'switch esc');assert.equal(A.last('mo').ok,1);const R=C.room(code);assert(R.sim instanceof EscalationSimulation);assert.equal(R.sim.units.filter(u=>u.human).length,2,'both members re-seated');assert.equal(R.sim.units.find(u=>u.name==='Lead').agent,'Jett');
 assert.equal(A.last('welcome').switched,1);assert.equal(A.you,R.sim.units.find(u=>u.name==='Lead').id);
 A.send({t:'mode',mode:'nope'});await until(()=>A.last('mo')&&A.last('mo').ok===0,2000,'bad mode');assert.equal(R.gm(),'esc');
 A.send({t:'queue'});await until(()=>B.room.q>0,2000,'queue seen by the member');assert(B.room.q<=5);A.send({t:'mode',mode:'swift'});await until(()=>B.last('qx')&&B.room.mode==='swift'&&B.room.q===0,3000,'mode change cancels the queue');assert.match(B.last('qx').why,/mode/);
 A.send({t:'queue'});await until(()=>B.room.q>0,2000,'requeue');A.send({t:'queue',on:0});await until(()=>B.room.q===0,2000,'leader cancel');
 A.send({t:'mode',mode:'sr',map:'bind'});await until(()=>B.room.map==='bind'&&B.room.mode==='sr',60000,'map switch');assert.equal(C.room(code).sim.map,'bind');assert.equal(C.room(code).world.map?.name??'bind',C.room(code).world.map?.name??'bind');
 A.send({t:'queue'});const qAt=C.clock.now();await until(()=>A.start&&B.start,9000,'queued start');assert(C.clock.now()-qAt>=4500,'counted down ~5 s');assert.equal(B.start.gm,'sr');assert.equal(B.start.mode,'five');assert.equal(B.start.map,'bind');
 A.send({t:'mode',mode:'dm'});await until(()=>A.msgs.filter(m=>m.t==='mo').length>=5,2000,'no switch in game');assert.equal(A.last('mo').ok,0);
 // the leader leaving cancels a queue
 const code2='PARTYB',X=new Cl('Lead').hook({create:1,code:code2,mode:'dm',map:'ascent'});await until(()=>X.room,8000,'room2');const Y=new Cl('Mate').hook({code:code2});await until(()=>Y.room&&Y.room.pl.length===2,8000,'join2');X.send({t:'queue'});await until(()=>Y.room.q>0,2000,'q2');X.send({t:'bye'});await until(()=>Y.last('qx'),3000,'leader left');assert.match(Y.last('qx').why,/leader left/);assert(Y.room.pl.find(p=>p.n===Y.room.pl[0].n).h===1,'the member becomes leader');
 note('worker: health modes / features, leader-only switching with re-seating and new ids, live room to members, queue countdown, cancel on mode change / leader cancel / leader leaving, queued start uses mode + map');}
console.log('test-modes: PASS\n  '+out.join('\n  '));
