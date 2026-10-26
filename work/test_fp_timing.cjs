// First-person weapon timing parity (row 5). For every weapon and the knife the client's equip, reload and fire cadence
// equal the server's (weapons.json + simulation.js Knife), including ADS rates and the concussed x0.8 / Empress x1.1 (v11.08, also reload and equip /1.1)
// multipliers the feel wrapper used to drop; the knife light swing equals the server's 2/s. Native FP clips play at the
// authored montage length (the exported clips run ~2.5x slow), bolt/pump fire montages finish within the fire interval,
// measured on the real Jett rigs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sim=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
const line=(src,start)=>{const i=src.indexOf(start);assert(i>=0,'missing '+start.slice(0,50));return src.slice(i,src.indexOf('\n',i));};
(async()=>{
 const {weapons}=await import(path.join(root,'server/src/simulation.js'));
 // The server's cadence formula this test mirrors.
 assert(sim.includes('rk=(concussed?.8:1)*stimK(u)')&&sim.includes('u.fireAt=this.time+(gap!=null?gap/rk:1/((aiming&&p.adsStats?p.adsStats.fireRate:p.fireRate)*rk))')&&/STIM=1\.1;/.test(sim),'server cadence formula changed');/* qa-36: + the motor CADENCE gap (ADS bursts, Odin spin-up) - pinned by work/test_weapon_cadence_page.cjs + server test-weapon-cadence.js; here xCadRate passes the base rate through */
 const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'models/valorant/weapon-calibration.js'),'utf8'),{window:win});
 const now={t:1000};const C={window:win,WEAP:{},VRUN:{},FSA:{},XZ:{},Math,performance:{now:()=>now.t},ads:0,xCU:0,J:{emp:0},jOn:()=>true,NET:{socket:null},netReyna:null,VM:{sw:0},ammo:30,rw:'pri',fcd:0,AM:{},aimFire(){},w:'Vandal'};
 for(const n of Object.keys(weapons).concat('Knife'))C.WEAP[n]={mag:1,rate:1};
 C.shoot=function(){C.ammo--;C.fcd=99;};C.wName=()=>C.w;
 vm.createContext(C);
 vm.runInContext(['var VF={profiles:window.VALORANT_WEAPON_STATS.weapons};',line(feel,'function vfProfile('),line(feel,'for(const [w,p]of Object.entries(VF.profiles))'),'var xEq,xRate;var xCadRate=function(w,b){return b;};',line(feel,'xEq=function('),line(feel,'xRate=function('),line(feel,'function vfDuration('),line(feel,'function xStimK('),'var xRT=function(){return 2.5;};',line(feel,'{const rt0=xRT;xRT=function()'),line(feel,'function vfRateK('),line(feel,"{const shoot0=shoot;shoot=function(){if(VM.sw>0)return;"),'globalThis.api={vfDuration,vfRateK,xEq:w=>xEq(w),xRT:()=>xRT(),xRate,fire:()=>shoot()};'].join('\n'),C);
 const A=C.api;let checked=0;
 for(const [n,p] of Object.entries(weapons)){if(p.abilityOnly)continue;C.J.emp=0;C.xCU=0;
  assert.equal(A.xEq(n),p.equipTimeSeconds,n+' equip');
  if(n!=='Knife'){assert.equal(A.vfDuration({w:n},'reload'),p.reloadTimeSeconds,n+' reload (viewmodel)');assert.equal(C.WEAP[n].rld,p.reloadTimeSeconds,n+' reload (timer)');assert.equal(C.WEAP[n].mag,p.magazineSize,n+' magazine');
   for(const aiming of [0,1])for(const conc of [false,true])for(const emp of [false,true]){C.w=n;C.ads=aiming;C.xCU=conc?now.t+500:0;C.J.emp=emp?1:0;C.ammo=30;A.fire();
    const want=1/((aiming&&p.adsStats?p.adsStats.fireRate:p.fireRate)*(conc?.8:1)*(emp?1.1:1));assert(Math.abs(C.fcd-want)<1e-9,n+' cadence ads='+aiming+' concussed='+conc+' empress='+emp+': '+C.fcd+' vs '+want);checked++;}}}
 C.ads=0;C.xCU=0;C.J.emp=0;C.NET.socket={};C.netReyna={empress:true};C.w='Vandal';C.ammo=30;A.fire();assert(Math.abs(C.fcd-1/(weapons.Vandal.fireRate*1.1))<1e-9,'online Empress (server state) must speed the cadence');
 assert(Math.abs(A.xEq('Vandal')-weapons.Vandal.equipTimeSeconds/1.1)<1e-9&&Math.abs(A.vfDuration({w:'Vandal'},'reload')-weapons.Vandal.reloadTimeSeconds/1.1)<1e-9&&Math.abs(A.xRT()-2.5/1.1)<1e-9,'online Empress: equip / reload (timer and viewmodel) /1.1');C.NET.socket=null;
 C.J.emp=1;assert(Math.abs(A.xEq('Vandal')-weapons.Vandal.equipTimeSeconds/1.1)<1e-9,'offline Empress equip /1.1');C.J.emp=0;assert.equal(A.xEq('Vandal'),weapons.Vandal.equipTimeSeconds,'no stim');
 // Knife: light swing cooldown = the server's 1/fireRate; equip shared above and = the wiki's 0.6 s (Melee: Equip Speeds 0.6 sec Normal).
 assert.equal(A.xEq('Knife'),0.6,'knife equip (wiki 0.6 s)');assert.equal(weapons.Knife.equipTimeSeconds,0.6,'server knife equip');
 assert(html.includes('if (kSwing > 0) return; kSwing = hv ? 1 : 0.5;')&&html.includes('if (kn) { AM.cd = kSwing = hv ? 1 : 0.5;'),'knife light swing is not 0.5 s');assert.equal(1/weapons.Knife.fireRate,0.5);
 assert(!/J\.emp > 0 \? 1\.3/.test(html)&&html.includes('XU.b[u.name] = 1.1; return 1; } // Empress: +10% fire rate (v11.08)')&&!/J\.emp > 0 \? 1\.15/.test(html),'Empress offline bots / base cadence not +10 %');
 // Native clip durations from the authored montages; playback on the real rigs.
 const FP=await import(path.join(root,'server/tools/fp-view.mjs'));const base=FP.runtime();
 const P={THREE:require(require.resolve('three',{paths:[path.join(root,'server')]})),Math,vfDuration:A.vfDuration};vm.createContext(P);vm.runInContext(line(feel,'var XVK=')+'\nvar xvFPPlay;'+line(feel,'xvFPPlay=function(F,kind,phase){')+'\n'+feel.slice(feel.indexOf(' if(F.kind!==kind){const prior=F.action'),feel.indexOf('// A separate lens keeps'))+';globalThis.play=xvFPPlay;globalThis.XVK=XVK;',P);
 const step=(F,t)=>{for(let k=0;k<Math.round(t/0.01);k++){F.am.update(0.01);F.gm.update(0.01);F.age+=0.01;}};
 for(const [w,kind] of [['operator','fire'],['marshal','fire'],['bucky','fire'],['vandal','fire'],['classic','idle'],['melee','attack 1'],['melee','alt Attack']]){
  const R=await FP.build('jett',w,base),F=R.F,label=kind==='idle'?'Idle':kind.charAt(0).toUpperCase()+kind.slice(1),entry=F.entries.find(e=>e.Translatable===label)||F.entries.find(e=>e.Translatable.startsWith(label));
  F.kind=null;P.play(F,kind);const clip=F.action.getClip().duration,seq=+entry.SequenceLength,name=w==='melee'?'Knife':w[0].toUpperCase()+w.slice(1),cyc=weapons[name]?1/weapons[name].fireRate:Infinity;
  if(w==='melee'){ // knife: authored speed (seq), the montage ends when the arm is back at idle (XVK), well inside the authored pad
   const vis=kind==='alt Attack'?P.XVK.heavy:P.XVK.light;assert(Math.abs(F.duration-Math.min(seq,vis))<1e-6,w+'/'+kind+' visual end '+F.duration+' vs '+vis);assert(clip>seq*1.4,'slow export');
   step(F,seq*0.25);assert(Math.abs(F.action.time/clip-0.25)<0.03,w+'/'+kind+' plays at the authored speed');continue;}
  const want=kind==='fire'&&cyc>=.5?Math.min(seq,cyc):seq;assert(Math.abs(F.duration-want)<1e-6,w+'/'+kind+' duration '+F.duration+' vs '+want);assert(clip>seq*1.4,w+'/'+kind+' exported clip is not the slow export ('+clip+' vs '+seq+')');
  if(kind==='idle'){step(F,seq*0.5);assert(Math.abs(F.action.time/clip-0.5)<0.03,'idle runs at the authored speed');continue;}
  step(F,F.duration*0.5);assert(Math.abs(F.action.time/clip-0.5)<0.03,w+'/'+kind+' half-way at half the authored time ('+(F.action.time/clip).toFixed(3)+')');
  step(F,F.duration*0.5+0.02);assert(F.action.time>=clip-0.02,w+'/'+kind+' not finished at its duration');
  if(kind==='fire'&&cyc>=.5)assert(F.duration<=cyc+1e-9,w+' bolt/pump still cycling at the next allowed shot');}
 console.log('FP timing: '+checked+' weapon cadence cases (hip/ADS x concussed x Empress) == server; equip/reload/magazine == weapons.json for every weapon, knife equip 0.6 s (wiki) and light swing 0.5 s == server, knife montage ends at idle (light 1 s, heavy 1.75 s); native clips at the authored montage length (Operator/Marshal/Bucky fire finish within the fire interval, knife attacks 1.92 s, idle 2.5x faster than the raw export)');
})().catch(e=>{console.error(e);process.exit(1);});
