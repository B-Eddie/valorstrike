// Online remote footsteps (qa-23, qa-34): server rows carry [23] = running footsteps (simulation.js loud = shared Motor.runs:
// faster than 0.65x the weapon's run speed, no walk / duck); work/server_runtime.js netStepFlags reads it and netSteps (an XHK
// frame tick) plays SFX.step at the drawn unit by DISTANCE like the player (Motor.footfall: one step per 1.85 m its drawn
// model moves while running, the first step silent), not on a 0.4 s timer; silent while walking / crouching (flag 0), dead,
// fogged, out of the scene, offline, or for our own row; a teleport banks nothing; hk-35's slow page (frames 1-4.5 s apart)
// still steps once per frame, never a burst. End to end from real server rows.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),rt=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8'),page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const Motor=require(path.join(root,'vendor/valorant-feel.js'));
const src=rt.slice(rt.indexOf('function netStepFlags('),rt.indexOf('// Online soul resources'));assert.ok(src.includes('netSteps')&&page.includes(src.trim().slice(0,300)),'slice found; index.html regenerated');
const scene={},steps=[];const unit=(nid,x)=>({nid,alive:true,g:{parent:scene,position:{x,y:0,z:0}}});
const c={NET:{socket:{}},MP:{st:'game',me:1},running:true,bots:[unit(7,5),unit(8,9)],allies:[unit(2,-3)],scene,SFX:{step:p=>steps.push(p.nid)},performance:{now:()=>c.t},t:1000,window:{XHK:[],ValorantFeel:Motor},mpCliSnap:()=>0,Array,Math};
for(const u of [...c.bots,...c.allies])u.g.position.nid=u.nid;
vm.createContext(c);vm.runInContext(src+';globalThis.snap=m=>mpCliSnap(m);globalThis.tick=netSteps;',c);
const row=(id,loud,hidden)=>[id,1,'P','Jett',0,0,0,0,100,0,1,'Vandal',0,0,1,25,50,0,0,0,0,-1,hidden?1:0,loud?1:0];
const all=()=>[...c.bots,...c.allies];let speed=5.4;
const run=(ms,step=16)=>{for(let t=0;t<ms;t+=step){c.t+=step;for(const u of all())u.g.position.z+=speed*step/1000;c.tick();}};
const n=id=>steps.filter(x=>x===id).length;
assert.equal(c.window.XHK.length,1,'registered as a frame tick');
// 1. running at rifle speed 5.4 m/s: first step after 1.85 m (0.34 s), then every 1.85 m = 2.92 steps/s (the player's stride)
c.snap({u:[row(1,1),row(7,1),row(8,0),row(2,1)]});c.tick();run(320);assert.deepEqual(steps,[],'first running step silent');run(60);assert.deepEqual(steps.sort(),[2,7],'enemy 7 and ally 2 step');
steps.length=0;run(10000);{const k=n(7);assert.ok(k>=28&&k<=30,'10 s at 5.4 m/s = 54 m / 1.85 m = 29 steps ('+k+'); the 0.4 s timer gave 25');}assert.equal(n(8),0,'walking enemy 8 silent');
steps.length=0;speed=6.75;run(10000);{const k=n(7);assert.ok(k>=35&&k<=37,'knife 6.75 m/s: 36 steps in 10 s ('+k+')');}speed=5.4;
// a unit standing still with the flag (server flag lags a stop by a snapshot) never steps
steps.length=0;speed=0;run(2000);assert.equal(n(7),0,'loud flag but not moving: silent');speed=5.4;
// 2. stops running / hidden by the fog / dead / not drawn: silent
steps.length=0;c.snap({u:[row(7,0),row(2,1,1)]});run(1000);assert.deepEqual(steps,[],'stopped running; a hidden row is never loud');
c.snap({u:[row(7,1)]});c.bots[0].fog=1;run(1000);assert.deepEqual(steps,[],'fogged');c.bots[0].fog=0;c.bots[0].alive=false;run(1000);assert.deepEqual(steps,[],'dead');c.bots[0].alive=true;c.bots[0].g.parent=null;run(1000);assert.deepEqual(steps,[],'not in the scene');c.bots[0].g.parent=scene;
// a teleport (respawn / fog reappearance far away) banks nothing
steps.length=0;run(16);c.bots[0].fd=0;c.bots[0].g.position.z+=40;c.t+=16;c.tick();assert.equal(n(7),0,'40 m jump in one frame: no step');
// 3. offline / not in a match: nothing
c.NET.socket=null;run(1000);assert.deepEqual(steps,[]);c.NET.socket={};c.MP.st='post';run(1000);assert.deepEqual(steps,[]);c.MP.st='game';run(1000);assert.ok(n(7)>0,'back in game: steps again');
// 3b. hk-35: a slow page (frames 1 s / 4.5 s apart: browser fog5 ran ~0.2 fps) still hears the runner - one step per frame, no burst
{steps.length=0;c.snap({u:[row(7,0)]});c.tick();c.snap({u:[row(7,1)]});run(1000,1000);run(1000,1000);run(1000,1000);assert.equal(n(7),3,'1 s frames (5.4 m each): a step each frame '+JSON.stringify(steps));
 steps.length=0;run(4500,4500);run(4500,4500);assert.equal(n(7),2,'4.5 s frames (24 m each): one step per frame (no burst, not a teleport)');
 steps.length=0;run(1000,100);{const k=n(7);assert.ok(k>=2&&k<=3,'back at 10 fps: 5.4 m over 1 s = 2-3 steps ('+k+')');}}
// 4. end to end: real server rows (running vs shift-walking / crouching / slow unit)
(async()=>{const {Simulation}=await import(path.join(root,'server/src/simulation.js'));
 const W={map:{attacker:[0,0,0],defender:[0,0,-10]},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new Simulation(W,'tdm','ascent',()=>.5),a=s.add('A','Jett'),b=s.add('B','Jett');s.start(false);s.units=[a,b];Object.assign(b,{vx:5.4,vz:0,input:{},inputAt:s.time,weapon:'Vandal'});
 const F=()=>s.rows().find(r=>r[0]===b.id)[23];const rb=s.rows().find(r=>r[0]===b.id);assert.equal(rb[23],1);
 b.input={walk:1};assert.equal(F(),0,'server: shift-walk silent');b.input={duck:1};assert.equal(F(),0,'server: crouch silent');b.input={};
 b.vx=3.0;assert.equal(F(),0,'server: 3.0 m/s with a rifle (under 0.65 x 5.4 = 3.51) silent - was loud above 1.5 m/s');b.vx=3.6;assert.equal(F(),1,'3.6 m/s loud');
 b.vx=4.0;b.weapon='Knife';assert.equal(F(),0,'knife 4.0 m/s (= knife walk speed range) silent');b.vx=5;assert.equal(F(),1,'knife 5 m/s loud');b.vx=5.4;b.weapon='Vandal';
 c.MP.me=99;c.bots=[unit(b.id,4)];c.allies=[];steps.length=0;c.snap({u:[rb]});c.bots[0].g.position.nid=b.id;run(1000);assert.ok(n(b.id)>=2,'real running row steps');
 console.log('online steps: remote footsteps by distance (1.85 m stride, first step silent) from row [23] = Motor.runs (0.65 x weapon run speed, no walk / duck); silent walking / crouching / standing / hidden / dead / undrawn / offline / teleport; slow page one step per frame; real server rows');})().catch(e=>{console.error(e);process.exit(1);});
