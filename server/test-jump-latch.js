// Jump press latch (scroll-wheel / short-tap jumps online). The server keeps only each seat's latest input message, so a jump press
// whose release message (j:0) arrives before the next tick was lost: a scroll-wheel notch (VALORANT bunny hoppers bind Jump to it) or a
// quick tap over a jittery link never jumped on the server while the page's prediction did (a snap back down). The command handler
// now latches a rising j into pendingJump, and the next step feeds it to the motor as a press, then the release.
//  1. j:1 then j:0 before one step -> the unit jumps (once).
//  2. j:1 held over many ticks -> one jump (the motor's press edge still rules: holding Space never re-jumps).
//  3. a latched press on a unit whose input has gone stale (no message for 0.3 s) is dropped, as its other input is.
//  4. spawn clears a press left over from a dead unit.
import assert from 'node:assert/strict';import {Simulation} from './src/simulation.js';
const flat=()=>({map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity});
const place=u=>Object.assign(u,{x:0,y:0,z:0,vx:0,vy:0,vz:0,ch:0,air:false,input:{},protectedUntil:0,invulnerableUntil:0});
let seq=1;const send=(s,u,j)=>s.command(u,{t:'in',seq:seq++,r:0,p:0,f:0,j});
const make=()=>{const s=new Simulation(flat(),'tdm','ascent',()=>.5),u=s.add('a');s.start(false);place(u);return {s,u};};
const jumpsOver=(s,u,ticks,each)=>{let jumps=0,wasAir=u.air;for(let k=0;k<ticks;k++){if(each)each(k);const vy0=u.vy;s.step(.05);if(!wasAir&&u.air&&u.vy>0&&!(vy0>0))jumps++;wasAir=u.air;}return jumps;};
// 1. press and release between ticks
{const {s,u}=make();s.step(.05);send(s,u,1);send(s,u,0);assert.equal(u.input.jump,false,'the latest message is the release');
 s.step(.05);assert.ok(u.air&&u.vy>0,'a press released before the tick still jumps on the server ('+u.y.toFixed(3)+' m, vy '+u.vy.toFixed(2)+')');
 const more=jumpsOver(s,u,30);assert.equal(more,0,'the latched press is consumed: no second jump');}
// 2. held
{const {s,u}=make();s.step(.05);const n=jumpsOver(s,u,60,()=>send(s,u,1));assert.equal(n,1,'holding jump for 3 s jumps once ('+n+')');}
// 3. stale input
{const {s,u}=make();s.step(.05);send(s,u,1);send(s,u,0);u.inputAt=s.time-1;s.step(.05);assert.ok(!u.air&&u.y===0,'a stale seat does not jump on a leftover press');}
// 4. spawn
{const {s,u}=make();s.step(.05);send(s,u,1);send(s,u,0);s.spawn(u);assert.equal(u.pendingJump,false,'spawn clears a pending press');}
// 5. scroll-wheel bunny hop: one notch (press + release in one message gap) each time the unit is back on the ground
{const {s,u}=make();s.step(.05);let jumps=0;for(let k=0;k<200&&jumps<5;k++){if(!u.air){send(s,u,1);send(s,u,0);}const g=!u.air;s.step(.05);if(g&&u.air)jumps++;}
 assert.equal(jumps,5,'five wheel-notch hops in a row');}
console.log('jump latch: tap released before the tick jumps once, held jump jumps once, stale / respawned seats drop the press, wheel-notch hops chain');
