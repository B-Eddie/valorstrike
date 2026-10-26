// Knife heavy swing parity (client <-> server). The client's right-click / long-press heavy swing (1 s, 75 / 150 head or
// back-stab, KNIFE table) had no server equivalent: online it went out as a plain fire pulse and the server dealt a 50 light hit
// at 2/s. Now a heavy swing sends kh:1 and simulation.js applies KNIFE_HEAVY; a click during a swing sends no pulse; a held
// knife button is one swing on the client and so no longer held fire online; the 1.2 m lunge is offline-only (server moves you).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{
 const {KNIFE_HEAVY}=await import(path.join(root,'server/src/simulation.js'));
 const K=/const KNIFE = \{ light: (\d+), lightBack: (\d+), heavy: (\d+), heavyCrit: (\d+) \}/.exec(h);assert(K,'client KNIFE table');
 const {KNIFE_LIGHT}=await import(path.join(root,'server/src/simulation.js'));assert.equal(+K[1],KNIFE_LIGHT.front);assert.equal(+K[2],KNIFE_LIGHT.back);assert.equal(+K[3],KNIFE_HEAVY.body);assert.equal(+K[4],KNIFE_HEAVY.crit);
 // wiki.playvalorant.com/en-us/Melee: Front 50 / 75, Back 100 / 150 (Primary / Alt); the knife has no headshot bonus
 assert.deepEqual([KNIFE_LIGHT.front,KNIFE_LIGHT.back,KNIFE_HEAVY.body,KNIFE_HEAVY.crit],[50,100,75,150]);
 assert(h.includes('let dmg = kn ? (bk ? head : body) :')&&h.includes('let bk = false; if (kn) try { bk = kBack('),'client knife: back-stab for both swings, no head bonus');
 assert(h.includes('kSwing = hv ? 1 : 0.5;'),'client heavy cooldown must be 1 s like the server');assert.equal(KNIFE_HEAVY.cooldown,1);
 const kb=/function kBack\(r, ax, az, tx, tz\) \{[^\n]*\}/.exec(h)[0];
 // Same back-stab cone: client model yaw r faces +z rotated (sin r, cos r); server look faces (-sin, -cos), i.e. r = look + PI.
 const {knifeBack}=await import(path.join(root,'server/src/simulation.js'));const C={};vm.createContext(C);vm.runInContext(kb+';globalThis.kBack=kBack;',C);
 for(let i=0;i<72;i++){const look=i*Math.PI/36,ax=Math.cos(i)*1.3,az=Math.sin(i*1.7)*1.3;assert.equal(C.kBack(look+Math.PI,ax,az,0,0),knifeBack({x:0,z:0,look},{x:ax,z:az}),'back-stab cone differs at '+i);}
 // Online input: pulse per started swing, kh only for heavy, held knife button is not held fire.
 const i0=h.indexOf('const netShoot0=shoot;'),src=h.slice(i0,h.indexOf('\n',i0));
 const ni=h.indexOf('function netInputMsg('),nsrc=h.slice(ni,h.indexOf('\n',ni));
 const T={NET:{socket:{},firePulse:0,fireHeavy:0},MP:{st:'game'},J:{pick:''},/* netInputMsg reads J.pick (Jett Cloudburst cb) */rw:'knife',ammo:0,kSwing:0,kHv:0,netReyna:null,netChannel:null,ads:0,fireHeld:false,yaw:0,pitch:0,WEAP:{Vandal:{}},performance:{t:1000,now(){return this.t;}},
  shoot(hv){if(T.kSwing>0)return;T.kSwing=hv?1:.5;T.kHv=hv?1:0;}};
 vm.createContext(T);vm.runInContext(src+'\n'+nsrc+'\n;globalThis.go=(hv)=>shoot(hv);globalThis.msg=(w)=>netInputMsg({},w);',T);
 T.go(true);assert(T.NET.firePulse>1000&&T.NET.fireHeavy===T.NET.firePulse,'heavy swing must pulse with kh');let m=T.msg('Knife');assert.equal(m.fire,1);assert.equal(m.kh,1);
 T.performance.t+=100;m=T.msg('Knife');assert.equal(m.fire,0);assert.equal(m.kh,0);
 const p0=T.NET.firePulse;T.go(false);assert.equal(T.NET.firePulse,p0,'a click during a swing must not send a pulse');
 T.kSwing=0;T.go(false);assert(T.NET.firePulse>p0&&T.NET.fireHeavy===0,'light swing pulses without kh');m=T.msg('Knife');assert.equal(m.kh,0);assert.equal(m.fire,1);
 T.performance.t+=100;T.fireHeld=true;assert.equal(T.msg('Knife').fire,0,'a held knife button is not held fire');assert.equal(T.msg('Vandal').fire,1,'held fire still works for guns');
 // Lunge offline only.
 assert(h.includes('if (hv) { body = KNIFE.heavy; head = KNIFE.heavyCrit; if (!(typeof NET !== "undefined" && NET.socket && MP.st === "game")) { kLg = 0.15;'),'lunge must be offline only');
 console.log('Knife heavy parity: client KNIFE heavy 75/150 and 1 s == server KNIFE_HEAVY; same back-stab cone (72 cases); online heavy swing sends kh, light none, no pulse mid-swing, held knife not held fire; lunge offline only');
})().catch(e=>{console.error(e);process.exit(1);});
