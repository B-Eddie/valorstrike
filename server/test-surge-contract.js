// Storm Surge server contract (wiki /Storm_Surge): 0.6 s windup, 6 m radius, nearsight 2 s + slow 2 s, no LOS, all players incl. the caster, once. Projectile flight is not modelled (labelled).
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const wall=(o,d,max)=>{if(Math.abs(d[0])<1e-9)return Infinity;const t=(3-o[0])/d[0];return t>0&&t<=max?t:Infinity;};/* wall at x=3: the 5.5 m enemy is behind it (no-LOS contract) */
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;const w=wall(o,d,max);return Math.min(t<=max?t:Infinity,w);}};
const s=new SpikeSimulation(W,'five','ascent',()=>.5),h=s.add('h','Harbor'),en=s.add('en'),al=s.add('al'),far=s.add('far'),out=s.add('out');s.start(false);s.buy=0;s.roundDelay=0;s.phase='game';
en.team=1-h.team;far.team=en.team;out.team=en.team;al.team=h.team;h.human=true;
Object.assign(h,{x:0,y:0,z:0,look:0});h.ability.c=1;
assert.equal(s.command(h,{t:'ab',k:'c',d:[0,0,-1],o:[0,1.6,0]}),true,'cast');
const e=s.effects.find(x=>x.kind==='blast'&&x.surge);assert.ok(e&&e.radius===6&&Math.abs(e.at-s.time-.6)<1e-9,'radius 6, impact at the end of the 0.6 s windup');
const P=e.p;Object.assign(en,{x:P[0]+5.5,z:P[2],y:0});Object.assign(al,{x:P[0],z:P[2]+3,y:0});Object.assign(far,{x:P[0]+9,z:P[2],y:0});Object.assign(out,{x:P[0]+6.5,z:P[2],y:0});
for(const u of [en,al,far,out,h])u.nearsightUntil=u.slowUntil=0;Object.assign(h,{x:P[0]-4,z:P[2]});
const tick=(sec)=>{for(let t=0;t<sec-1e-9;t+=.05){s.time+=.05;tickAbilities(s,.05);}};
tick(.5);assert.equal(en.nearsightUntil,0,'nothing during the windup');tick(.2);
const t0=s.time;for(const [u,n] of [[en,'enemy 5.5 m'],[al,'ally'],[h,'caster']]){assert.ok(u.nearsightUntil>t0+1.8&&u.nearsightUntil<=t0+2.1,n+' nearsighted 2 s');assert.ok(u.slowUntil>t0+1.8&&u.slowUntil<=t0+2.1,n+' slowed 2 s');}
assert.equal(out.nearsightUntil,0,'6.5 m: outside');
const ns=en.nearsightUntil;tick(.5);assert.equal(en.nearsightUntil,ns,'once only: not re-applied');
assert.equal(s.snapshot().fx.filter(x=>x.kind==='blast').length,0,'row gone after the linger');
console.log('surge contract ok (server, stub world; flight not modelled)');
