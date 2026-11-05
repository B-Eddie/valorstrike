// fogCast for Omen Shrouded Step (stepout / stepin): each point reaches the enemy team only if that point is in sight;
// seeing / hearing the caster elsewhere never reveals the other point; own team and the caster get the whole event.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {fogCast} from './src/fog.js';
const wall=(o,d,max)=>{ // map wall = plane x=20: blocks any segment crossing it
 if(Math.abs(d[0])<1e-9)return Infinity;const t=(20-o[0])/d[0];return t>0&&t<=max?t:Infinity;};
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:wall};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('A','Jett'),b=s.add('B','Omen');s.start(false);s.buy=0;s.roundDelay=0;s.phase='game';s.units=[a,b];b.team=1-a.team;
 Object.assign(a,{x:0,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});Object.assign(b,{x:40,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});return {s,a,b};};
const st=(s,u,sub,p)=>({t:'ac',i:u.id,ag:'Omen',k:'c',sub,o:p.slice(),d:[0,0,-1],p,ts:1});
{const {s,a,b}=mk();const eo=st(s,b,'stepout',[38,0,2]),ei=st(s,b,'stepin',[5,0,0]);s.castEvents.push(eo,ei);
 const vo=fogCast(s,eo,a),vi=fogCast(s,ei,a);
 assert.equal(vo.p,undefined,'origin behind the wall: no position');assert.equal(vo.fog,1);assert.equal(vo.o,undefined);
 assert.deepEqual(vi.p,[5,0,0],'destination in sight: p kept');assert.equal(vi.o,undefined,'no eye for the enemy');
 assert.equal(fogCast(s,eo,b),eo,'caster gets its own');}
{// the caster stands in plain sight at arrival; the (hidden) origin must still not be revealed
 const {s,a,b}=mk();b.x=5;s.castEvents.push(st(s,b,'stepout',[38,0,2]));const e=s.castEvents[0];const v=fogCast(s,e,a);
 assert.equal(v.p,undefined,'seen caster does not leak the hidden origin');assert.equal(v.fog,1);
 // contrast: a normal cast from the same visible caster is delivered whole (existing rule)
 const n={...e,sub:undefined};assert.equal(fogCast(s,n,a),n);}
{const {s,a,b}=mk();const c=s.add('C','Sova');c.team=b.team;Object.assign(c,{x:-12,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});s.units.push(c);const e=st(s,b,'stepout',[38,0,2]);assert.equal(fogCast(s,e,c),e,'teammate gets whole');}
console.log('fog step events ok');
