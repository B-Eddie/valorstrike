// Jett Tailwind dash (wiki: 11 m, Dash duration 0.45 s) as a burst, not a teleport, on every side: the page's real movement
// (feel_runtime.js moveP, offline play and the online prediction) runs window.ValorantFeel.dashStep each frame while J.dash is set,
// ignores the movement keys, stops at a wall and ends the record; the server (Simulation / SpikeSimulation step) runs the same
// shared motor (server/src/motor.cjs == vendor/valorant-feel.js) from the page's keys / yaw, so both land on the same spot.
//   node work/test_tailwind_dash.cjs
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(fs.readFileSync(path.join(root,'server','src','motor.cjs'),'utf8'),fs.readFileSync(path.join(root,'vendor','valorant-feel.js'),'utf8'),'server motor = page motor');
const a=html.indexOf('moveP=function(dt,run,hold){\n const P=player;'),b=html.indexOf('\ngSpread=function',a);assert(a>0&&b>a,'feel moveP found');
const VFm=require(path.join(root,'vendor','valorant-feel.js'));const stats=JSON.parse(fs.readFileSync(path.join(root,'server','src','weapons.json'),'utf8')).weapons;
const xTagK=new Function('return '+html.slice(html.indexOf('function xTagK'),html.indexOf('\n',html.indexOf('function xTagK'))).replace(/\}\s*$/,'}'))();
const line=s=>{const i=html.indexOf(s);assert(i>=0,s);return html.slice(i,html.indexOf('\n',i));};
function page({keys={},yaw=0,wall=Infinity,frames=40,dt=1/60,press={f:1,s:0}}){const player={x:0,y:0,z:0,vx:0,vz:0,vy:0,ch:0,hp:100},J={dis:0,dr:0,dash:null};
 const c={player,J,keys,yaw,ads:0,Math,window:{ValorantFeel:VFm},VF:{model:VFm},vfWeapon:()=>'Vandal',vfProfile:w=>stats[w],sgSlow:()=>1,groundAt:()=>0,blocked:(x,z)=>x<-wall||z<-wall,xTagK,SFX:{land(){},selfStep(){}},running:true,mode:'five',kLg:0,moveP:null};
 vm.createContext(c);vm.runInContext(html.slice(a,b)+'\n'+line('var XPAR2 = ')+'\n'+line('function jDash('),c);
 J.dash=vm.runInContext('jDash',c)({f:press.f,s:press.s,r:yaw});const out=[];for(let i=0;i<frames;i++){c.moveP(dt,6.75,false);out.push({t:(i+1)*dt,x:player.x,z:player.z,on:!!J.dash});}return {out,player,J};}
// straight ahead, 60 fps: 24.4 m/s, 11 m at 0.45 s, then over; W held during it changes nothing
{const r=page({keys:{KeyW:true},yaw:0,frames:40});const at=t=>r.out.find(o=>o.t>=t-1e-9);
 assert.ok(Math.abs(at(.25).z+11*(.25/.45))<.05,'0.25 s: ~6.1 m ('+at(.25).z.toFixed(3)+')');assert.ok(Math.abs(at(.25).x)<1e-9);
 const end=r.out.find(o=>!o.on);assert.ok(end&&Math.abs(end.t-.45)<1/60+1e-9,'dash ends at 0.45 s ('+(end&&end.t)+')');
 assert.ok(Math.abs(at(.45).z+11)<.02,'11 m at 0.45 s, W ignored ('+at(.45).z.toFixed(3)+')');assert.ok(r.player.z<at(.45).z,'walks on with W after the dash');}
// strafe right at yaw 90 deg (facing -x): D = +z... the shared dash() picks the same direction the server does
{const r=page({keys:{},yaw:Math.PI/2,press:{f:0,s:1},frames:30});const D=VFm.dash(0,1,Math.PI/2,11,.45);assert.ok(Math.abs(r.player.x-11*D.dx)<.02&&Math.abs(r.player.z-11*D.dz)<.02,'strafe dash direction = motor dash() '+r.player.x.toFixed(2)+','+r.player.z.toFixed(2));}
// wall 4 m ahead: stops short (within one 0.25 m sub-step), the record ends
{const r=page({yaw:0,wall:4,frames:30});assert.ok(r.player.z>-4&&r.player.z<=-3.5,'stopped by the wall '+r.player.z.toFixed(3));assert.equal(r.J.dash,null);}
// a slow frame (0.2 s) still moves exactly v * dt, never past 11 m
{const r=page({yaw:0,frames:4,dt:.2});assert.ok(Math.abs(r.out[0].z+11*.2/.45)<1e-6&&Math.abs(r.out[2].z+11)<1e-6,'0.2 s frames: '+r.out.map(o=>o.z.toFixed(2)));}
// the server, the same keys / yaw: same end point
(async()=>{const {SpikeSimulation}=await import(path.join(root,'server','src','spike.js'));const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};/* = server/test-abilities.js */
 const s=new SpikeSimulation(W),j=s.add('j','Jett');s.add('o');s.start(false);s.buy=0;Object.assign(j,{x:0,y:0,z:0,look:0});j.ability.e=1;
 assert.equal(s.command(j,{t:'ab',k:'e'}),true);s.time+=1;assert.equal(s.command(j,{t:'ab',k:'e',f:0,s:1,r:Math.PI/2}),true);for(let i=0;i<12;i++)s.step(.05);
 const r=page({yaw:Math.PI/2,press:{f:0,s:1},frames:40});assert.ok(Math.hypot(j.x-r.player.x,j.z-r.player.z)<.02,'server '+j.x.toFixed(3)+','+j.z.toFixed(3)+' = page '+r.player.x.toFixed(3)+','+r.player.z.toFixed(3));
 console.log('Tailwind dash: page moveP 24.4 m/s for 0.45 s = 11 m, keys ignored, walls stop it, slow frames exact; server SpikeSimulation lands on the same spot from the page keys / yaw');})().catch(e=>{console.error(e);process.exit(1);});
