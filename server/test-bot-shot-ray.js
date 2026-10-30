// Every server shot event carries the real shot ray (bot-gun, user 2026-10-29: "i dont think the bullet is coming out of
// the right place for bots and i think their shots aren't going to their crosshair"): ['s', id, weapon, dx, dy, dz, len] -
// the first bullet's unit direction from the shooter's eye and how far it went (to the body it hit, else the wall /
// range), so clients draw the tracer from the shooter's gun along the shot (was: a random level ray along the drawn
// facing). Checked on real bot fights (Simulation.step: motor spread / recoil, hitboxes):
//  - the direction is the bot's view at the shot (look / pitch = its crosshair, what a spectator sees) plus spread and spray
//    climb only: within the motor's cone (movement / stance spread + bloom cap) + the recoil offset, and within 0.1 rad
//    when the bot stands still; first bullets of a pull centred on it (a run-and-gun shot legitimately leaves up to the
//    Vandal's running cone off the crosshair, so the bound is the motor's, not a flat one);
//  - on a hit, eye + direction x len is the hit point the 'h' event reports on the target.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Simulation,gunOf} from './src/simulation.js';import Motor from './src/motor.cjs';import {persona} from './src/bots.js';
const B=createRequire(import.meta.url)('../vendor/bot-brain.cjs');
const nodes=[],adj=[];for(let i=0;i<15;i++)for(let j=0;j<15;j++){nodes.push([i*2-14,0,-j*2]);const k=i*15+j,a=[];if(i>0)a.push(k-15);if(i<14)a.push(k+15);if(j>0)a.push(k-1);if(j<14)a.push(k+1);adj.push(a);}
const all=nodes.map((_,i)=>i),near=(x,z)=>{let b=0,d=Infinity;for(const i of all){const n=nodes[i],v=(n[0]-x)**2+(n[2]-z)**2;if(v<d){d=v;b=i;}}return b;};
const G={map:{attacker:[-14,0,0],defender:[14,0,-28],sites:{A:[-8,0,-14],B:[8,0,-14]}},nav:{nodes,adj},playable:all,allowed:new Set(all),near,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
let shots=0,hits=0,devMax=0,first=[0,0,0],pointErr=0;
for(let k=0;k<12;k++){const s=new Simulation(G,'tdm','ascent',B.rng(500+k)),t=s.add('Target','Jett',true),b=s.add('Bot Omen','Sage',false);s.phase='game';s.remaining=1e9;s.matchLen=1e9+300;s.maxKills=1e9;
 Object.assign(t,{team:1,x:k%3-1,y:0,z:-12-k,hp:1e9,armor:0,look:0,loading:false,protectedUntil:0,invulnerableUntil:0});Object.assign(b,{team:0,x:0,y:0,z:0,look:.3,weapon:'Vandal',ammo:1e9,loading:false,protectedUntil:0});
 b.persona=null;persona(s,b).r=B.rng(k*3+1);b.pitch=B.idlePitch(persona(s,b).brain);
 // the view and the cone at the shot: fire() runs inside step, and the bot may turn again after it in the same tick
 const fire0=s.fire.bind(s);let at=null;s.fire=u=>{const view={look:u.look,pitch:u.pitch,cone:Motor.spread(u,u.weapon,gunOf(u))+Motor.bloomCap(u,u.weapon,gunOf(u)),still:Math.hypot(u.vx||0,u.vz||0)<.5},r=fire0(u);if(u===b&&r)at={...view,climb:Math.hypot(u.spray?.recoilX||0,u.spray?.recoilY||0),seq:u.spray?.sequence};return r;};
 for(let i=0;i<60;i++){t.hp=1e9;b.ammo=1e9;t.input=k%2?{side:i%20<10?1:-1}:{};t.inputAt=s.time;
  at=null;s.events.length=0;s.step(.05);
  let last=null;for(const e of s.events){if(e[0]==='s'&&e[1]===b.id){shots++;assert.equal(e.length,7,'shot event carries the ray: '+JSON.stringify(e));const d=e.slice(3,6),L=Math.hypot(...d);assert.ok(Math.abs(L-1)<2e-3,'unit direction');
    assert.ok(at,'one bot shot per tick, view captured');
    const v=[-Math.sin(at.look)*Math.cos(at.pitch),Math.sin(at.pitch),-Math.cos(at.look)*Math.cos(at.pitch)],dev=Math.acos(Math.max(-1,Math.min(1,(v[0]*d[0]+v[1]*d[1]+v[2]*d[2])/L)));devMax=Math.max(devMax,dev);
    assert.ok(dev<=at.cone+at.climb+.005,'the bullet leaves along the crosshair + spread / climb only ('+dev.toFixed(3)+' rad, cone '+at.cone.toFixed(3)+' + climb '+at.climb.toFixed(3)+')');
    if(at.still)assert.ok(dev<.1,'standing still: within 0.1 rad ('+dev.toFixed(3)+')');
    if(!at.seq||at.seq<=1){const yv=Math.atan2(-d[0],-d[2]),pv=Math.asin(d[1]/L);first[0]+=Math.atan2(Math.sin(yv-at.look),Math.cos(yv-at.look));first[1]+=pv-at.pitch;first[2]++;}
    assert.ok(e[6]>0&&e[6]<=150,'reach '+e[6]);last={e,eye:[b.x,b.y+1.6-(b.ch||0),b.z]};}
   if(e[0]==='h'&&e[1]===b.id&&last){hits++;const [,,,,,,len]=last.e,p=[last.eye[0]+last.e[3]*len,last.eye[1]+last.e[4]*len,last.eye[2]+last.e[5]*len],q=[t.x+e[6],t.y+e[7],t.z+e[8]];
    const err=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);pointErr=Math.max(pointErr,err);assert.ok(err<.02,'eye + direction x reach = the hit point on the target ('+err.toFixed(3)+' m)');}}}}
assert.ok(shots>100&&hits>20,'fights fired '+shots+' shots, '+hits+' hits');
assert.ok(first[2]>10&&Math.abs(first[0]/first[2])<.01&&Math.abs(first[1]/first[2])<.01,'first bullets centred on the crosshair ('+(first[0]/first[2]).toFixed(4)+' / '+(first[1]/first[2]).toFixed(4)+')');
console.log('Server shot ray: '+shots+' shots / '+hits+' hits - the event carries the bullet direction (crosshair + spread / climb <= '+devMax.toFixed(3)+' rad, first bullets centred) and reach (hit point within '+pointErr.toFixed(3)+' m)');
