// Storm Surge server contract (wiki /Storm_Surge): 0.6 s windup, 6 m radius, nearsight 2 s + slow 2 s, no LOS, all players incl. the caster, once. Flight uses the shared Class 3 orb arc (physics are project approximations).
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';
const wall=(o,d,max)=>{if(Math.abs(d[0])<1e-9)return Infinity;const t=(3-o[0])/d[0];return t>0&&t<=max?t:Infinity;};/* wall at x=3: the 5.5 m enemy is behind it (no-LOS contract) */
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:(o,d,max=Infinity)=>{const t=d[1]<0?o[1]/-d[1]:Infinity;const w=wall(o,d,max);return Math.min(t<=max?t:Infinity,w);}};
const s=new SpikeSimulation(W,'five','ascent',()=>.5),h=s.add('h','Harbor'),en=s.add('en'),al=s.add('al'),far=s.add('far'),out=s.add('out');s.start(false);s.buy=0;s.roundDelay=0;s.phase='game';
en.team=1-h.team;far.team=en.team;out.team=en.team;al.team=h.team;h.human=true;
Object.assign(h,{x:0,y:0,z:0,look:0});h.ability.c=1;
assert.equal(s.command(h,{t:'ab',k:'c',d:[0,0,-1],o:[0,1.6,0]}),true,'cast');
const e=s.effects.find(x=>x.kind==='blast'&&x.surge);const FL=e.landAt-s.time;assert.ok(e&&e.radius===6&&FL>0.1&&Math.abs(e.at-e.landAt-.6)<1e-9,'impact = shared Class 3 trajectory landing + grounded 0.6 s windup');
const P=e.p;Object.assign(en,{x:P[0]+5.5,z:P[2],y:0});Object.assign(al,{x:P[0],z:P[2]+3,y:0});Object.assign(far,{x:P[0]+9,z:P[2],y:0});Object.assign(out,{x:P[0]+6.001,z:P[2],y:0});const inn=s.add('inn');inn.team=en.team;Object.assign(inn,{x:P[0]+5.999,z:P[2],y:0,alive:true,loading:false});
for(const u of [en,al,far,out,h])u.nearsightUntil=u.slowUntil=0;Object.assign(h,{x:P[0]-4,z:P[2]});
const tick=(sec)=>{for(let t=0;t<sec-1e-9;t+=.05){s.time+=.05;tickAbilities(s,.05);}};
tick(Math.floor((FL+.5)/.05)*.05);assert.equal(en.nearsightUntil,0,'nothing during flight + windup');tick(.15);
const t0=s.time;for(const [u,n] of [[en,'enemy 5.5 m'],[al,'ally'],[h,'caster']]){assert.ok(u.nearsightUntil>t0+1.8&&u.nearsightUntil<=t0+2.1,n+' nearsighted 2 s');assert.ok(u.slowUntil>t0+1.8&&u.slowUntil<=t0+2.1,n+' slowed 2 s');}
assert.equal(out.nearsightUntil,0,'6.001 m: outside');assert.ok(inn.nearsightUntil>t0+1.8,'5.999 m: inside');
const rs=s.roundState(en).status;assert.ok(rs.nearsight>1.8&&rs.slow>1.8,'private status snapshot carries both effects');const ns=en.nearsightUntil;tick(.5);assert.equal(en.nearsightUntil,ns,'once only: not re-applied');
assert.equal(s.snapshot().fx.filter(x=>x.kind==='blast').length,0,'row gone after the linger');
{/* death / reset semantics */
 const mk=()=>{const q=new SpikeSimulation(W,'five','ascent',()=>.5),H=q.add('h','Harbor'),E=q.add('en');q.start(false);q.buy=0;q.roundDelay=0;q.phase='game';E.team=1-H.team;H.human=true;Object.assign(H,{x:0,y:0,z:0,look:0});H.ability.c=1;q.command(H,{t:'ab',k:'c',d:[0,0,-1],o:[0,1.6,0]});const e=q.effects.find(x=>x.surge);Object.assign(E,{x:e.p[0]+3,z:e.p[2],y:0});E.nearsightUntil=0;return {q,H,E,e};};
 const run=(q,sec)=>{for(let t=0;t<sec-1e-9;t+=.05){q.time+=.05;tickAbilities(q,.05);}};
 {const {q,H,E}=mk();H.alive=false;run(q,2);assert.ok(E.nearsightUntil>0,'caster death mid-flight: the thrown orb still lands');}
 {const {q,E}=mk();E.alive=false;run(q,2);assert.equal(E.nearsightUntil,0,'a unit dead at impact is not affected');}
 {const {q,E}=mk();q.effects=[];run(q,2);assert.equal(E.nearsightUntil,0,'round reset (effects cleared) cancels it: nothing lands');}
}
console.log('surge contract ok (server, stub world; shared Class 3 arc physics approximate)');
