const fs=require('fs'),vm=require('vm'),assert=require('assert'),s=fs.readFileSync(__dirname+'/server_runtime.js','utf8'),a=s.indexOf('const netAbilityKey0='),b=s.indexOf('function netChamberAnchor',a),sent=[],ctx={jKey:()=>sent.push('legacy'),NET:{socket:{}},MP:{st:'game',m5:true},J:{pick:'Jett'},running:true,player:{hp:100},FV:{buy:0},netSend:m=>sent.push(m),netTwReady:()=>false,performance:{now:()=>0}};vm.createContext(ctx);vm.runInContext(s.slice(a,b),ctx);ctx.jKey('KeyQ');ctx.jKey('KeyE');assert.equal(sent[0].k,'q');assert.equal(sent[1].k,'e');assert(!sent.includes('legacy'));ctx.FV.buy=1;ctx.FV.menu=true;ctx.jKey('KeyQ');assert.equal(sent.length,2,'buy menu open: no cast');ctx.FV.menu=false;ctx.jKey('KeyQ');assert.equal(sent.length,3,'buy phase, menu closed: abilities cast (user 2026-11-06)');sent.pop();ctx.FV.buy=0;ctx.player.hp=0;ctx.jKey('KeyE');assert.equal(sent.length,2);ctx.player.hp=100;ctx.J.pick='Skye';ctx.jKey('KeyC');assert.equal(sent[2].k,'c');ctx.NET.socket=null;ctx.jKey('KeyE');assert.equal(sent[3],'legacy');console.log('Online Jett Q/E are server-only intents with buy/death gating; no local movement/charge before authority; offline path retained');

// Tailwind dash prediction (qa-29 / qa-30): with the server's window open (status twa 0, twu > 0 -> NET.tw) the E press sends the held
// keys / yaw (f s r) and starts the same shared-motor dash locally (J.dash, jDash = window.ValorantFeel.dash, 11 m / 0.45 s); during the
// windup or with no window it is a plain intent and nothing is predicted. Real netTwReady / jDash / jDashKeys / XPAR2 / motor.
{const html=fs.readFileSync(__dirname+'/../index.html','utf8'),VFm=require('../vendor/valorant-feel.js');
 const grab=(src,start,end)=>{const i=src.indexOf(start),j=src.indexOf(end,i+start.length);assert(i>=0&&j>i,'missing '+start);return src.slice(i,j);};
 const tw=grab(s,'function netTwReady(){','\n'),keysF=grab(html,'function jDashKeys()','\n'),dashF=grab(html,'function jDash(','\n'),par=grab(html,'var XPAR2 = ','\n');
 assert(html.includes(tw),'index.html carries netTwReady');
 let now=5000;const out=[],c={jKey:()=>out.push('legacy'),NET:{socket:{}},MP:{st:'game',m5:true},J:{pick:'Jett',dash:null},running:true,player:{hp:100},FV:{buy:0},netSend:m=>out.push(m),performance:{now:()=>now},keys:{KeyW:true,KeyD:false},yaw:Math.PI/2,window:{ValorantFeel:VFm},Math};
 vm.createContext(c);vm.runInContext(tw+'\n'+keysF+'\n'+dashF+'\n'+par+'\n'+s.slice(a,b),c);
 c.jKey('KeyE');assert.equal(out[0].k,'e');assert.equal(out[0].f,undefined,'no window yet: plain intent');assert.equal(c.J.dash,null);
 c.NET.tw={a:.4,u:7.9,at:now};now+=200;c.jKey('KeyE');assert.equal(out[1].f,undefined,'windup still running (0.2 s left): no prediction');assert.equal(c.J.dash,null);
 now+=300;assert.equal(vm.runInContext('netTwReady()',c),true,'windup over, window open');c.jKey('KeyE');const m=out[2];
 assert.deepEqual([m.k,m.f,m.s,m.r],['e',1,0,+(Math.PI/2).toFixed(4)],'keys / yaw sent with the E');const D=c.J.dash;assert.ok(D,'dash predicted at the press');
 assert.ok(Math.abs(D.dx+1)<1e-9&&Math.abs(D.dz)<1e-9&&D.left===11&&Math.abs(D.v-11/.45)<1e-9,'W at yaw 90 deg: 11 m along -x at 24.4 m/s '+JSON.stringify(D));
 assert.equal(c.NET.tw,null,'window consumed locally');assert.ok(c.NET.dashUntil>now,'reconcile holds corrections while the dash settles');
 c.jKey('KeyE');assert.equal(out[3].f,undefined,'second E: no second prediction');
 c.NET.tw={a:0,u:.05,at:now};c.J.dash=null;now+=100;assert.equal(vm.runInContext('netTwReady()',c),false,'window ran out');
 const P={x:0,y:0,z:0,vx:3,vz:1},W={blocked:()=>false},D2=VFm.dash(1,0,Math.PI/2,11,.45);let n=0;while(VFm.dashStep(P,D2,.05,W))n++;
 assert.ok(Math.abs(P.x+11)<1e-9&&P.vx===0&&n===8,'motor: 11 m in 9 x 50 ms ticks '+P.x+' '+n);}
console.log('Online Tailwind dash: predicted at the press only once the server window is open; keys / yaw sent; shared motor 11 m / 0.45 s');
