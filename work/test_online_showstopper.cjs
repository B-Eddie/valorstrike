// Online Raze Showstopper on a slow page (browser smoke_raze2, ~1 frame/s SwiftShader: the server equipped the launcher,
// the button was held 6 s after it was up, no rocket ever left). Three causes, all pinned here:
//  1. the rocket click goes through rsFire straight from the mouse / touch handlers, never shoot(), so online it sent NO
//     fire input at all -> the rsFire wrapper in server_runtime.js turns a local launch into a fire pulse;
//  2. a fire pulse lived 80 ms by the clock, and the 50 ms input interval runs after a ~1 s frame, so the pulse expired
//     before any input message carried it -> the click stays pending (NET.firePend) until one message carried it, once;
//  3. the page counted the 1.4 s equip / 10 s window down by its clamped frame dt (<= 0.1 s): ~14 s of equip at 1 frame/s,
//     so clicks after the server's launcher was up were swallowed by rsFire -> the server sends status ssr / ssu (equip /
//     window left) and netShowstopperSync makes RS.ss / RS.ssd / RS.sst follow them.
// Plus a real server check (spike.js roundState status ssr / ssu; fire on one input message launches the rocket).
//   node work/test_online_showstopper.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8'),rt=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const line=(src,key)=>{const i=src.indexOf(key);assert(i>=0,key+' missing');return src.slice(i,src.indexOf('\n',i));};
for(const s of [h,rt])for(const k of ['function netShowstopperSync(st){','{const netRsFire0=rsFire;','const netShoot0=shoot;','function netInputMsg(','if(J.pick===\'Raze\'&&m.status)netShowstopperSync(m.status);'])assert(s.includes(k),k+' missing');
// the click paths really bypass shoot(): mouse (xMD) and touch FIRE call rsFire first
assert(h.includes('  if (rsFire()) return;\n  if (jOn() && J.bs > 0 && rw === "knife") return jThrow();\n  if (mode === "duel") duelShoot(); else { fireHeld = true; shoot(); }'),'mouse click path');
const src=[line(h,'function netShowstopperSync(st){'),line(h,'{const netRsFire0=rsFire;'),line(h,'const netShoot0=shoot;'),line(h,'function netInputMsg(')].join('\n');
const T={NET:{socket:{},seq:0,firePulse:0,fireHeavy:0},MP:{st:'game'},J:{pick:'Raze'},RS:{ss:0,ssd:0,sst:0},rw:'pis',ammo:12,kSwing:0,kHv:0,netReyna:null,netChannel:null,ads:0,fireHeld:false,yaw:0,pitch:0,
 WEAP:{Classic:{semi:true},Vandal:{}},performance:{t:1000,now(){return this.t;}},rockets:0,
 rsFire(){/* index.html rsFire: swallowed while the launcher comes up, launches when it is up */if(!T.RS.ss)return false;if(T.RS.ssd>0)return true;T.RS.ss=0;T.rockets++;return true;},shoot(){}};
vm.createContext(T);vm.runInContext(src+'\n;globalThis.click=()=>{if(rsFire())return;fireHeld=true;shoot();};globalThis.msg=(w)=>netInputMsg({},w||"Classic");globalThis.sync=(st)=>netShowstopperSync(st);',T);
const adv=ms=>{T.performance.t+=ms;};
// 3. the launcher follows the server clock
T.RS.ss=1;T.RS.ssd=1.4;T.RS.sst=10;/* local X */T.sync({ssr:1.1,ssu:9.7});assert.deepEqual([T.RS.ss,T.RS.ssd,T.RS.sst],[1,1.1,9.7],'server equip / window adopted');
T.click();assert.equal(T.rockets,0,'a click during the equip launches nothing');assert.equal(T.msg().fire,0,'and sends no fire');
adv(1500);T.sync({ssr:0,ssu:8.2});assert.equal(T.RS.ssd,0,'equip over when the server says so (the clamped local dt would still count ~1 s of it)');
// 1 + 2. the launching click is one pending fire that survives a 1 s frame, carried once
T.click();assert.equal(T.rockets,1,'launched locally');assert.equal(T.RS.ss,0);adv(1000);/* the next input tick runs after the frame */
let m=T.msg();assert.equal(m.fire,1,'the rocket click reaches the server on the next input message, 1 s later');assert.equal(m.kh,0);
adv(50);assert.equal(T.msg().fire,0,'carried once');
// a stale status (server has not seen the fire yet) does not re-equip for 2 s; the server's put-away clears it
adv(300);T.sync({ssr:0,ssu:7.9});assert.equal(T.RS.ss,0,'stale launcher status ignored right after the local launch');T.sync({ssr:0,ssu:0});assert.equal(T.RS.ss,0);
// a launch the server never saw: the launcher comes back after 2 s so the player can click again
adv(2100);/* a later round's launcher */T.sync({ssr:0,ssu:6});assert.equal(T.RS.ss,1);T.click();assert.equal(T.rockets,2);T.msg();adv(2100);T.sync({ssr:0,ssu:3.5});assert.equal(T.RS.ss,1,'server still holds the launcher 2 s later: re-equipped');
T.sync({ssr:0,ssu:0});assert.equal(T.RS.ss,0,'server put it away');
// a local X the server never confirmed is dropped after 3 s; offline / other agents untouched
T.RS.ss=1;T.RS.ssd=1.4;T.sync({});assert.equal(T.RS.ss,1,'waiting for the server');adv(3100);T.sync({});assert.equal(T.RS.ss,0,'unconfirmed launcher dropped after 3 s');
T.NET.socket=null;T.RS.ss=1;T.RS.ssd=0;T.click();assert.equal(T.NET.firePend,0,'offline: no pulse');T.NET.socket={};
// pending pulse also covers gun shots and knife swings (shoot wrapper), and visibility loss clears it
assert(rt.includes("NET.firePend=1;NET.firePendH=NET.fireHeavy?1:0;"),'shoot wrapper sets the pending pulse');
assert(rt.includes("fireHeld=false;NET.firePulse=0;NET.firePend=NET.firePendH=0;"),'hidden tab clears the pending pulse');
(async()=>{const {SpikeSimulation}=await import(path.join(root,'server/src/spike.js'));
 const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new SpikeSimulation(W),rz=s.add('rz','Raze');s.add('foe');s.start(false);s.buy=0;rz.ability.ult=8;assert.equal(s.command(rz,{t:'ab',k:'x'}),true,'Showstopper equips');
 let st=s.roundState(rz).status;assert(Math.abs(st.ssr-1.4)<1e-9&&Math.abs(st.ssu-10)<1e-9,'status ssr 1.4 / ssu 10 at equip: '+JSON.stringify(st));
 s.time+=1.5;st=s.roundState(rz).status;assert.equal(st.ssr,0);assert(st.ssu>8);
 const n0=s.effects.filter(e=>e.kind==='rocket').length;assert.equal(s.fire(rz),true,'fire after the equip launches');assert.equal(s.effects.filter(e=>e.kind==='rocket').length,n0+1);
 st=s.roundState(rz).status;assert.deepEqual([st.ssr,st.ssu],[0,0],'launcher gone from the status after the rocket');
 console.log('Online Showstopper: launching click = one pending fire carried by the next input message (1 s frame), launcher equip / window follow server status ssr / ssu, stale status ignored 2 s, unconfirmed X dropped 3 s; server sends ssr / ssu and fires the rocket');
})().catch(e=>{console.error(e);process.exit(1);});
