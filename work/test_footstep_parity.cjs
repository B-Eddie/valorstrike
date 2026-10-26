// Footstep cadence parity (qa-34): every unit steps by distance on one rule (shared motor vendor/valorant-feel.js runs /
// footfall = server/src/motor.cjs): one footstep per 1.85 m (the player's stride) while running = faster than 0.65x its
// weapon's run speed without walk / crouch; the first running step is silent; at most one per frame. Before: the player
// stepped every 1.85 m at any speed, offline enemy bots / allies / buy-phase bots every 0.4 s (2.16 m at rifle speed, 2.7 m
// with the knife; / difficulty speed) at ANY speed, even pushing into a wall, and the server row [23] counted > 1.5 m/s.
//   node work/test_footstep_parity.cjs
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const M=require(path.join(root,'vendor/valorant-feel.js'));
assert.equal(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'motor pair identical');
assert.equal(M.C.stride,1.85);assert.equal(M.C.stepRun,.65);
// 1. the rule itself
assert.ok(M.runs(5.4,5.4,false)&&M.runs(3.6,5.4,false)&&!M.runs(3.24,5.4,false),'rifle: run loud, walk speed 3.24 quiet');
assert.ok(!M.runs(5.4,5.4,true),'walk / crouch input quiet at any speed');assert.ok(!M.runs(4.05,6.75,false)&&M.runs(4.5,6.75,false),'knife walk 4.05 quiet');
{const st={};let n=0,first=-1;for(let i=1;i<=600;i++)if(M.footfall(st,5.4/60,1/60,true)){n++;if(first<0)first=i/60;}assert.ok(first>.34&&first<.36,'first step after 1.85 m ('+first+' s)');assert.equal(n,29,'10 s at 5.4 m/s: 29 steps');}
{const st={};assert.equal(M.footfall(st,24,4.5,true),true);assert.equal(M.footfall(st,0,0,true),false,'no burst after a long frame');assert.ok(st.fd<1.85);}
{const st={fd:1.5};M.footfall(st,1,.5,false);assert.ok(Math.abs(st.fd-.575)<1e-9,'quiet drains one stride per second');M.footfall(st,1,1,false);assert.equal(st.fd,0);}
// 2. offline bots / allies / buy-phase bots: botStep from the page with its real botRun / vRunK
const g=html.indexOf('function botStep('),gE=html.indexOf('\nfunction botWalk(',g);assert.ok(g>0&&gE>g,'botStep + botRun found');
const vr=html.indexOf('const vRunK = ');assert.ok(vr>0,'vRunK');const vrE=html.indexOf('\n',vr);const vq=html.indexOf('const VRUN');assert.ok(vq>0,'VRUN');
const steps=[];const c={window:{ValorantFeel:M},SFX:{step:p=>steps.push(p)},Math,duelBot:null,WEAP:{},XV:undefined};vm.createContext(c);
vm.runInContext(html.slice(g,gE)+'\n'+html.slice(vq,html.indexOf('\n',vq)).replace('const VRUN','globalThis.VRUN')+'\n'+html.slice(vr,vrE).replace('const vRunK','globalThis.vRunK'),c);
const kRifle=c.vRunK('Vandal');assert.ok(Math.abs(6.75*kRifle-5.4)<.01,'botRun(Vandal) = 5.4 m/s ('+6.75*kRifle+')');
const sim=(w,speed,quiet,secs=10,fps=60)=>{const u={w,g:{position:{x:0,y:0,z:0}}};steps.length=0;for(let i=0;i<secs*fps;i++){const d=speed/fps;u.g.position.z+=d;c.botStep(u,1/fps,d,quiet);}return steps.length;};
assert.equal(sim('Vandal',5.4,false),29,'offline rifle bot: 29 steps in 10 s (0.4 s timer: 25)');
{const k=sim('Knife',6.75,false);assert.ok(k>=36&&k<=37,'offline knife bot: 36 steps in 10 s ('+k+'; timer 25)');}
assert.equal(sim('Vandal',5.4*.8,false),23,'easy-difficulty bot 4.32 m/s: by distance (timer gave 0.4/0.8 s = 20)');
assert.equal(sim('Vandal',3.24,false),0,'walk-speed bot silent even without the walk flag');assert.equal(sim('Vandal',5.4,true),0,'walking / crouching flag silent');
assert.equal(sim('Vandal',0,false),0,'pushing into a wall (no ground moved) silent');
{const u={w:'Vandal',g:{position:{x:0,y:0,z:0}}};steps.length=0;c.botStep(u,4.5,24.3,false);c.botStep(u,4.5,24.3,false);assert.equal(steps.length,2,'slow page: one step per frame');}
// 3. every call site uses it (no 0.4 s timer left), and the player shares footfall / runs
assert.ok(!/\.fs = 0\.4|u\.fs=\.4|fsN=\.4/.test(html),'no 0.4 s footstep timers left in the page');
assert.ok(html.includes('botStep(b, dt, Math.hypot(p.x - bx0, p.z - bz0), b.cr || b.wk, b.spd)')&&html.includes('botStep(a, dt, Math.hypot(p.x - ax0, p.z - az0), a.cr || a.wk, a.spd)'),'enemy bots + allies (distance moved, motor speed)');assert.ok(html.includes('botStep(u,dt,Math.hypot(p.x-x0,p.z-z0),walk,u.spd)'),'buy-phase bots');
{const u={w:'Vandal',g:{position:{x:0,y:0,z:0}}};steps.length=0;for(let i=0;i<600;i++)c.botStep(u,1/60,5.4/60,false,2.0);assert.equal(steps.length,0,'motor speed under the threshold (accelerating / stopping) silent');}
const feel=fs.readFileSync(path.join(root,'work/feel_runtime.js'),'utf8');assert.ok(/VF\.model\.footfall\(P,result\.speed\*dt,dt,!P\.air&&VF\.model\.runs\(result\.speed,6\.75\*\(kn\?1:p\.runSpeedMultiplier\|\|\.8\),P\.wk\|\|P\.cr\)\)\)SFX\.selfStep/.test(feel)&&html.includes('VF.model.footfall(P,result.speed*dt'),'player: shared footfall + runs');
// 4. the player through the real moveP: steps every 1.85 m with a rifle, silent shift-walking and crouching
const a=html.indexOf('moveP=function(dt,run,hold){\n const P=player;'),b=html.indexOf('\ngSpread=function',a);assert(a>0&&b>a,'feel moveP found');
const stats=JSON.parse(fs.readFileSync(path.join(root,'server','src','weapons.json'),'utf8')).weapons;
const xTagK=new Function('return '+html.slice(html.indexOf('function xTagK'),html.indexOf('\n',html.indexOf('function xTagK'))).replace(/\}\s*$/,'}'))();
function player(keys,secs=10){const pl={x:0,y:0,z:0,vx:0,vz:0,vy:0,ch:0,hp:100};let n=0;const cx={player:pl,J:{dis:0,dr:0},keys,yaw:0,ads:0,Math,VF:{model:M},vfWeapon:()=>'Vandal',vfProfile:w=>stats[w],sgSlow:()=>1,groundAt:()=>0,blocked:()=>false,xTagK,SFX:{land(){},selfStep(){n++;}},xStepMetal:()=>false,running:true,mode:'match',kLg:0,moveP:null};
 vm.createContext(cx);vm.runInContext(html.slice(a,b),cx);for(let i=0;i<secs*60;i++)cx.moveP(1/60);return {n,d:Math.hypot(pl.x,pl.z)};}
{const r=player({KeyW:true});const k=Math.floor(r.d/1.85);assert.ok(r.n===k||r.n===k-1,'player rifle: one step per 1.85 m ('+r.n+' over '+r.d.toFixed(1)+' m)');}
assert.equal(player({KeyW:true,ShiftLeft:true}).n,0,'player shift-walk silent');assert.equal(player({KeyW:true,ControlLeft:true}).n,0,'player crouch-walk silent');
console.log('footstep parity: player / offline bots / allies / buy-phase bots / server row share Motor.runs + footfall (1.85 m stride, 0.65x run speed, first step silent, one per frame)');
