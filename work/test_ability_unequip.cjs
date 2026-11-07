// Ability unequip + weapon re-equip (qa-34): after an equip-flow cast the ability is put away over its wiki "Unequip time",
// then the last weapon comes back at its FAST equip time (Instant for Curveball / Leer / Rendezvous; wiki weapon pages
// Normal / Fast / Instant), firing blocked until the gun is up - the page (work/ability_equip_runtime.js XAB_UNEQ /
// XAB_REEQI / XAB_REEQ, rec phase then VM.sw) and the server (server/src/windups.js recoverTime -> u.fireAt) agree to the ms.
// Was a flat 0.45 s and the gun fired at once after it.   node work/test_ability_unequip.cjs
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{const W=await import(path.join(root,'server/src/windups.js')),A=await import(path.join(root,'server/src/abilities.js'));
 const a=html.indexOf('const XAB_UNEQ = '),b=html.indexOf('const XAB_EQ = {',a);assert(a>0&&b>a,'client tables found (index.html regenerated)');
 const t0=html.indexOf('function xEqTick(dt) {'),t1=html.indexOf('\nconst xEqKey0',t0);assert(t0>0&&t1>t0,'xEqTick');
 const c={RS:{hk:null},J:{pick:'Phoenix',eq:null},XABT:{rec:.45,rel:.2,draw:.5},VM:{sw:0,swT:0,ins:0},Math,Number,running:true,player:{hp:100},mode:'five',FV:{buy:0},fireHeld:false,jOn:()=>true,xEqCast:()=>true,W:'Vandal',stim:1};
 c.vfWeapon=()=>c.W;c.xRotOn=()=>false;/* xEqTick's Turret+Barrier rotation branch (not under test here) */c.xStimK=()=>c.stim;vm.createContext(c);const line=k=>{const i=html.indexOf(k);assert(i>0,k);return html.slice(i,html.indexOf('\n',i));};// xEqTick reads xEqHold (hold-type abilities: Sova bow, Breach Fault Line, Omen Dark Cover marker)
 vm.runInContext(html.slice(a,b)+'\n'+line('const XAB_HOLD = ')+'\n'+line('function xEqHold(q) {')+'\n'+html.slice(t0,t1)+';globalThis.T={XAB_UNEQ,XAB_REEQI,XAB_REEQ,xUneqT,xReeqT,xEqTick};',c);
 const T=c.T,plain=o=>JSON.parse(JSON.stringify(o));
 assert.deepEqual(plain(T.XAB_UNEQ),plain(W.UNEQUIP),'page unequip table = server UNEQUIP');assert.deepEqual(plain(T.XAB_REEQI),plain(W.REEQ_INSTANT),'instant re-equip abilities');assert.deepEqual(plain(T.XAB_REEQ),plain(W.REEQUIP),'weapon fast / instant equip');
 for(const [ag,ks] of Object.entries(A.ABILITY_EQUIP))for(const k of ks)assert(Number.isFinite(T.XAB_UNEQ[ag][k]),ag+' '+k);
 // weapon re-equip rows = the wiki's 0.6 x Normal (fast) for every gun; Normal = weapons.json equipTimeSeconds; Operator instant 0.5 (patch nerf)
 const stats=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons;
 for(const [w,[f]] of Object.entries(W.REEQUIP))if(w!=='Knife'&&w!=='Frenzy'&&w!=='Outlaw'&&w!=='Marshal')assert(Math.abs(f-.6*stats[w].equipTimeSeconds)<1e-9,w+' fast = 0.6 x normal');
 assert.deepEqual(W.REEQUIP.Operator,[.9,.5]);assert.deepEqual(W.REEQUIP.Knife,[.3,0]);
 // the page flow: release -> rec (unequip) -> VM.sw (gun re-equip); total = server recoverTime for every agent / key / a few guns
 const run=(ag,k,w,stim=1)=>{Object.assign(c,{W:w,stim});c.J.pick=ag;c.VM.sw=0;c.J.eq={k,code:'Key'+k.toUpperCase(),st:'rel',t:.2,alt:false,buf:0,h:0,bn:0};let t=0,rec=null,sw=null;const dt=.001;
  for(let i=0;i<4000;i++){c.VM.sw=Math.max(0,c.VM.sw-dt);t+=dt;const st=c.J.eq&&c.J.eq.st;T.xEqTick(dt);if(st==='rel'&&c.J.eq&&c.J.eq.st==='rec')rec=t;if(c.J.eq===null&&sw===null)sw=t;if(sw!==null&&c.VM.sw<=0)return {rel:rec,unequip:sw-rec,back:t};}throw new Error('never back '+ag+k);};
 const rows=[];
 for(const [ag,ks] of Object.entries(A.ABILITY_EQUIP))for(const k of ks)for(const w of ['Vandal','Classic','Operator','Knife']){const r=run(ag,k,w),srv=W.recoverTime(ag,k,w);
  assert(Math.abs((r.back-r.rel)-srv)<.004,ag+' '+k+' '+w+': page '+(r.back-r.rel).toFixed(3)+' vs server '+srv);assert(Math.abs(r.unequip-W.UNEQUIP[ag][k])<.003,ag+' '+k+' unequip');if(w==='Vandal')rows.push(ag+' '+k+' '+srv.toFixed(2));}
 {const r=run('Reyna','c','Vandal',1.1);assert(Math.abs((r.back-r.rel)-W.recoverTime('Reyna','c','Vandal',1.1))<.004,'Empress shortens the re-equip');}
 // the page blocks the trigger while VM.sw > 0 (feel shoot wrapper / fire gate)
 assert(/shoot=function\(\)\{if\(VM\.sw>0\)return;/.test(html),'gun fire waits for VM.sw');
 // server: the same total holds the trigger (u.fireAt) after the cast message
 const {SpikeSimulation}=await import(path.join(root,'server/src/spike.js'));const Wd={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
 const s=new SpikeSimulation(Wd),p=s.add('p','Phoenix');s.start(false);s.buy=0;s.time=3;p.weapon='Vandal';p.ability.q=1;p.fireAt=0;assert.equal(s.command(p,{t:'ab',k:'q'}),true,'Hot Hands');assert(Math.abs(p.fireAt-(s.time+1.3))<1e-9,'server Hot Hands + Vandal: 0.7 + 0.6 s');
 console.log('ability unequip: page = server for '+rows.length+' equip abilities (Vandal: '+rows.join(', ')+'); weapon fast / instant re-equip; Empress');
})().catch(e=>{console.error(e);process.exit(1);});
