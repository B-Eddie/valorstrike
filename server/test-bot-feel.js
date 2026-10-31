// Bots feel like real players beyond aim (lane-botfeel, user 2026-10-30 "bots have to feel like actual players"; offline twin:
// work/test_bot_feel_offline.cjs; measured with work/probe_bot_feel.cjs).
//  1. reloading is not done in the open: a bot whose gun is reloading while it sees the enemy backs off - toward where it
//     peeked from (its unseen trail) when that is close, else straight away from the enemy (to a free side when a wall is
//     behind) - instead of strafing / standing in the enemy's sight (09a42d4 offline: 10-23 % of reload time in sight, backing 7-23 % of it)
//  2. and it does not re-peek mid-reload: unsighted, reloading, with a remembered enemy within RELOAD.hold m, it holds the
//     angle until the magazine is back, then pushes again (the carrier and far contacts are not held)
// Shared decision: vendor/bot-brain.cjs reloadPlay / reloadBack (the page's BOT VARIETY block uses the same module).
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation} from './src/simulation.js';import {persona,botView} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs'),out=[];
const nodes=[],adj=[];for(let i=0;i<21;i++)for(let j=0;j<21;j++){nodes.push([i*2-20,0,-j*2+20]);const k=i*21+j,a=[];if(i>0)a.push(k-21);if(i<20)a.push(k+21);if(j>0)a.push(k-1);if(j<20)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const WALL={on:false};const G=()=>({map:{attacker:[-20,0,20],defender:[20,0,-20],sites:{A:[-8,0,0],B:[8,0,0]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:(o,d,max)=>WALL.on?Math.min(1,max):Infinity});
function duo(k,{bx=0,bz=0,look=0,tx=0,tz=-12,hold=false}={}){WALL.on=false;const s=new Simulation(G(),'tdm','ascent',B.rng(900+k)),t=s.add('Target','Jett',true),b=s.add('Bot Sage','Sage',false);
 s.phase='game';s.remaining=1e9;s.maxKills=1e9;if(hold)s.objectiveRoutes=true;
 Object.assign(t,{team:1,x:tx,y:0,z:tz,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0,input:{}});Object.assign(b,{team:0,x:bx,y:0,z:bz,look,weapon:'Vandal',ammo:25,reserve:75,loading:false,protectedUntil:0});
 persona(s,b);b.pitch=B.idlePitch(persona(s,b).brain);b.nextHoldAt=1e9;/* no holder pause between pushes: only the reload holds it */return {s,t,b};}
const mv=b=>{const i=b.input||{},f=i.forward||0,sd=i.side||0,c=Math.cos(b.look||0),sn=Math.sin(b.look||0);return [-sn*f+c*sd,-c*f-sn*sd];};
function tick(s,b,dt=.05,move=false){s.time+=dt;if(b.reloadAt&&s.time>=b.reloadAt)s.finishReload(b);const L0=b.look;s.bot(b);botView(s,b,L0,dt);const m=mv(b);if(move){b.x+=m[0]*dt*5;b.z+=m[1]*dt*5;}s.events.length=0;return m;}
// 0. the shared decision
{assert.equal(typeof B.reloadPlay,'function','BotBrain.reloadPlay');assert.equal(typeof B.reloadBack,'function','BotBrain.reloadBack');
 assert.equal(B.reloadPlay({reloading:true,seen:true}),'back','reloading in sight: back off');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:10}),'hold','reloading, a contact 10 m away: hold, no re-peek');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:B.RELOAD.hold+5}),null,'a far contact: keep going');
 assert.equal(B.reloadPlay({reloading:true,seen:false,contactD:10,carrier:true}),null,'the Spike carrier keeps its path');
 assert.equal(B.reloadPlay({reloading:false,seen:true}),null,'not reloading: fight');
 const a=B.reloadBack(0,0,0,4,0,-12);assert.ok(a[1]>.99,'back toward the spot it peeked from (4 m behind)');
 const c=B.reloadBack(0,0,null,null,0,-12);assert.ok(c[1]>.99,'no spot: straight away from the enemy');
 const f=B.reloadBack(0,0,0,B.RELOAD.back+6,0,-12);assert.ok(f[1]>.99&&Math.abs(f[0])<.01,'a spot too far: away from the enemy');
 const sd=B.reloadBack(0,0,3,1,0,-12),l=Math.hypot(sd[0],sd[1]);assert.ok(Math.abs(l-1)<1e-6&&sd[0]>.9,'a spot to the side (the corner it swung from): toward it');
 const w=B.reloadBack(0,0,null,null,0,-12,(x,z)=>z<.5);assert.ok(Math.abs(Math.hypot(w[0],w[1])-1)<1e-6&&w[1]<.1&&Math.abs(w[0])>.99,'a wall right behind: to a free side ('+w.map(v=>v.toFixed(2))+')');
 const T=[];for(let t=0;t<2;t+=.05)B.trailNote(T,-t*2,0,t);assert.ok(T.length<=B.RELOAD.keep&&T.length>=6,'trail: one point per '+B.RELOAD.step+' s, the last '+B.RELOAD.keep+' ('+T.length+')');
 const q=B.reloadSpot(T,T[T.length-1][0],0);assert.ok(q&&Math.abs(q[0]-T[T.length-1][0])>=B.RELOAD.min,'the peek spot is the newest trail point at least RELOAD.min m back');
 assert.equal(B.reloadSpot([[0,0,0]],.5,0),null,'a trail only under its feet: no spot (back off straight)');
 out.push('reloadPlay / reloadBack');}
// 1. server: reloading in sight backs off (away from the enemy without a cover spot, toward the peek spot with one)
{let back=0,n=0,dotS=0;for(let k=0;k<8;k++){const {s,t,b}=duo(k);for(let i=0;i<6;i++)tick(s,b);/* the fight is on */b.ammo=0;b.reloadAt=s.time+2.4;
  for(let i=0;i<30;i++){const m=tick(s,b,.05,true);if(!b.reloadAt)break;n++;const dx=t.x-b.x,dz=t.z-b.z,d=Math.hypot(dx,dz)||1,l=Math.hypot(m[0],m[1]);if(l>.1){const c=(m[0]*dx+m[1]*dz)/(d*l);dotS+=c;if(c<-.3)back++;}}}
 assert.ok(n>100,'reload ticks in sight ('+n+')');assert.ok(back/n>=.8,`a reloading bot in sight backs away from the enemy (${(back/n*100).toFixed(0)} % of ticks >= 80 %)`);
 let toward=0,m2=0;for(let k=0;k<6;k++){const {s,t,b}=duo(k,{bx:3,bz:2});WALL.on=true;tick(s,b);WALL.on=false;b.x=0;b.z=0;/* it walked out of (3, 2) unseen */for(let i=0;i<6;i++)tick(s,b);b.ammo=0;b.reloadAt=s.time+2.4;
  for(let i=0;i<10;i++){const m=tick(s,b,.05,false);m2++;const dx=3-b.x,dz=2-b.z,d=Math.hypot(dx,dz),l=Math.hypot(m[0],m[1]);if(l>.1&&(m[0]*dx+m[1]*dz)/(d*l)>.9)toward++;}}
 assert.ok(toward/m2>=.8,`with the spot it peeked from 3.6 m away it backs toward it (${(toward/m2*100).toFixed(0)} % >= 80 %)`);
 out.push(`reload in sight: backing ${(back/n*100).toFixed(0)} % of ticks, toward the peek spot ${(toward/m2*100).toFixed(0)} %`);}
// 2. server: unsighted mid-reload with a remembered enemy close -> holds (no re-peek), pushes again once reloaded
{let held=0,n=0,moved=0,base=0;for(let k=0;k<6;k++){
  {const {s,t,b}=duo(k,{bx:-10,bz:10});WALL.on=true;B.memNote(b.mem||(b.mem=B.memNew()),t.id,0,0,-4,s.time,'seen');let go=0;for(let i=0;i<10;i++){const m=tick(s,b);if(Math.hypot(m[0],m[1])>.1)go++;}base+=go;}
  const {s,t,b}=duo(k,{bx:-10,bz:10});WALL.on=true;B.memNote(b.mem||(b.mem=B.memNew()),t.id,0,0,-4,s.time,'seen');b.ammo=0;b.reloadAt=s.time+1.5;
  for(let i=0;i<60;i++){const m=tick(s,b),l=Math.hypot(m[0],m[1]);if(b.reloadAt){n++;if(l<.05)held++;}else if(l>.1)moved++;}}
 assert.ok(base>=40,'the same bot not reloading pushes the contact ('+base+' moving ticks of 60)');
 assert.ok(n>150&&held/n>=.95,`unsighted mid-reload with a contact 16 m away it holds (${(held/n*100).toFixed(0)} % of ${n} ticks >= 95 %)`);
 assert.ok(moved>=60,'and pushes again once the magazine is back ('+moved+' moving ticks)');
 out.push(`reload unsighted: holds ${(held/n*100).toFixed(0)} %, then moves`);}
console.log('Bot feel (server): '+out.join('; '));
