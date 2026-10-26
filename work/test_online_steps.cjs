// Online remote footsteps (qa-23): the page only stepped its own offline bots, so online no enemy or ally was ever heard
// running. Server rows carry [23] = running footsteps (simulation.js loud); work/server_runtime.js netStepFlags reads it
// and netSteps (an XHK frame tick) plays SFX.step at the drawn unit every 0.4 s, first step after 0.3 s; silent while
// walking / crouching (flag 0), dead, fogged, out of the scene, offline, or for our own row. End to end from real rows.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),rt=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8'),page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src=rt.slice(rt.indexOf('function netStepFlags('),rt.indexOf('// Online soul resources'));assert.ok(src.includes('netSteps')&&page.includes(src.trim().slice(0,300)),'slice found; index.html regenerated');
const scene={},steps=[];const unit=(nid,x)=>({nid,alive:true,g:{parent:scene,position:{x,y:0,z:0}}});
const c={NET:{socket:{}},MP:{st:'game',me:1},running:true,bots:[unit(7,5),unit(8,9)],allies:[unit(2,-3)],scene,SFX:{step:p=>steps.push(p.x)},performance:{now:()=>c.t},t:1000,window:{XHK:[]},mpCliSnap:()=>0,Array,Math};
vm.createContext(c);vm.runInContext(src+';globalThis.snap=m=>mpCliSnap(m);globalThis.tick=netSteps;',c);
const row=(id,loud,hidden)=>{const r=[id,1,'P','Jett',0,0,0,0,100,0,1,'Vandal',0,0,1,25,50,0,0,0,0,-1,hidden?1:0,loud?1:0];return r;};
const run=(ms)=>{for(let t=0;t<ms;t+=16){c.t+=16;c.tick();}};
assert.equal(c.window.XHK.length,1,'registered as a frame tick');
// 1. a running enemy: first step after ~0.3 s, then every 0.4 s
c.snap({u:[row(1,1),row(7,1),row(8,0),row(2,1)]});c.tick();run(250);assert.deepEqual(steps,[],'first running step silent');run(100);assert.deepEqual(steps.sort(),[-3,5],'enemy 7 and ally 2 step');steps.length=0;run(800);assert.deepEqual(steps.filter(x=>x===5).length,2,'every 0.4 s');assert.ok(!steps.includes(9),'walking enemy 8 silent');
// 2. stops running / hidden by the fog / dead / not drawn: silent
steps.length=0;c.snap({u:[row(7,0),row(2,1,1)]});run(1000);assert.deepEqual(steps,[],'stopped running; a hidden row is never loud');
c.snap({u:[row(7,1)]});c.bots[0].fog=1;run(1000);assert.deepEqual(steps,[],'fogged');c.bots[0].fog=0;c.bots[0].alive=false;run(1000);assert.deepEqual(steps,[],'dead');c.bots[0].alive=true;c.bots[0].g.parent=null;run(1000);assert.deepEqual(steps,[],'not in the scene');c.bots[0].g.parent=scene;
// 3. offline / not in a match: nothing
c.NET.socket=null;run(1000);assert.deepEqual(steps,[]);c.NET.socket={};c.MP.st='post';run(1000);assert.deepEqual(steps,[]);c.MP.st='game';run(1000);assert.ok(steps.includes(5),'back in game: steps again');
// 3b. hk-35: a slow page (frames 1 s / 4.5 s apart: browser fog5 ran ~0.2 fps) still hears the runner - one step per frame,
// cadence on real time (the old 0.1 s per-frame cap needed 3 frames for the first step and 4 per step after)
{steps.length=0;const slow=ms=>{c.t+=ms;c.tick();};c.snap({u:[row(7,0)]});c.tick();c.snap({u:[row(7,1)]});slow(1000);slow(1000);slow(1000);assert.equal(steps.filter(x=>x===5).length,3,'1 s frames: a step each frame '+JSON.stringify(steps));
 steps.length=0;slow(4500);slow(4500);assert.equal(steps.filter(x=>x===5).length,2,'4.5 s frames: one step per frame (no burst)');
 steps.length=0;for(let i=0;i<10;i++)slow(100);{const n=steps.filter(x=>x===5).length;assert.ok(n>=2&&n<=3,'back at 10 fps: every 0.4 s over 1 s ('+n+')');}}
// 4. end to end: real server rows (running vs shift-walking unit)
(async()=>{const {Simulation}=await import(path.join(root,'server/src/simulation.js'));
 const W={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new Simulation(W,'tdm','ascent',()=>.5),a=s.add('A','Jett'),b=s.add('B','Jett');s.start(false);s.units=[a,b];Object.assign(b,{vx:5.4,vz:0,input:{},inputAt:s.time});
 const rb=s.rows().find(r=>r[0]===b.id);assert.equal(rb[23],1);b.input={walk:1};assert.equal(s.rows().find(r=>r[0]===b.id)[23],0,'server: shift-walk silent');
 c.MP.me=99;c.bots=[unit(b.id,4)];steps.length=0;c.snap({u:[rb]});run(1000);assert.ok(steps.includes(4),'real running row steps');
 console.log('online steps: remote running footsteps from row [23] (first step 0.3 s, then 0.4 s), silent walking / crouching / hidden / dead / undrawn / offline; real server rows');})().catch(e=>{console.error(e);process.exit(1);});
