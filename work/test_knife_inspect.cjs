// Knife inspect (Y / F): the knife now inspects like the guns. State machine checks on the real source lines:
// key gate and length (native Tactical Inspect SequenceLength for the knife, 2.2 s for guns), cancel by swing/fire
// (kick), ADS, reload and weapon switch, the native FP rig plays 'inspect' then drops to idle when cancelled (an
// attack event still wins), the procedural fallback flips the blade, and the native clip duration follows VM.insT.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),vr=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
const line=(src,start)=>{const i=src.indexOf(start);assert(i>=0,'missing '+start.slice(0,60));return src.slice(i,src.indexOf('\n',i));};
const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'models/valorant/manifest.js'),'utf8'),{window:win});
const want=+win.VALORANT_ASSETS.weaponAnimations.melee.WEAPONS_ANIMS_JSON.Animations.find(a=>a.Translatable==='Inspect').SequenceLength;
assert(want>3&&want<3.5,'native knife inspect length '+want);
const keys=[];const knife={visible:true,rotation:{x:.15,y:.25,z:0},position:{x:.23,y:-.2,z:-.38}};
const C={VALORANT_ASSETS:win.VALORANT_ASSETS,VM:{ins:0,sw:0},rw:'knife',mode:'tdm',du:{w:'Vandal'},ads:0,reloading:0,running:true,paused:false,player:{hp:100},kSwing:0,knife,Math,
 addEventListener:(t,f)=>{if(t==='keydown')keys.push(f);}};
vm.createContext(C);
vm.runInContext([line(html,'function xInsT()'),line(html,'addEventListener("keydown", (e) => { if ((e.code === "KeyF" || e.code === "KeyY")'),
 line(html,'function xKnIns()'),html.slice(html.indexOf('function xKnIns()')).split('\n').slice(1,3).join('\n')].join('\n'),C);
const press=(code='KeyY')=>keys.forEach(f=>f({code,repeat:false}));
// 1. Y on the knife starts the native-length inspect; F does too; guns keep 2.2 s
press();assert.equal(C.VM.ins,want,'knife inspect length');assert.equal(C.VM.insT,want);
C.VM.ins=0;press('KeyF');assert.equal(C.VM.ins,want,'F inspects the knife');
C.VM.ins=0;C.rw='pri';press();assert.equal(C.VM.ins,2.2,'gun inspect stays 2.2 s');
C.VM.ins=0;C.rw='pri';C.mode='duel';C.du.w='knife';press();assert.equal(C.VM.ins,want,'duel knife inspects');C.mode='tdm';C.rw='knife';
// 2. gates: mid-swing, ADS, reload, dead, paused, equip, repeat
for(const [k,v] of [['kSwing',.3],['ads',1],['reloading',1],['paused',true]]){C.VM.ins=0;const o=C[k];C[k]=v;press();assert.equal(C.VM.ins,0,'no inspect while '+k);C[k]=o;}
C.VM.ins=0;C.VM.sw=.1;press();assert.equal(C.VM.ins,0,'no inspect while equipping');C.VM.sw=0;
C.VM.ins=0;C.player.hp=0;press();assert.equal(C.VM.ins,0,'no inspect when dead');C.player.hp=100;
C.VM.ins=0;C.mode='surf';press();assert.equal(C.VM.ins,0,'no inspect in surf');C.mode='tdm';
// 3. cancel rules in vmTick: swing/fire kick, ADS and reload zero the timer; switching zeroes it
const cancel=line(html,'if (rp >= 0 || kick > 0.3 || ads) VM.ins = 0;');assert(cancel.trim().startsWith('if (rp >= 0 || kick > 0.3 || ads) VM.ins = 0;'));
for(const [rp,kick,ads] of [[-1,1,0],[-1,0,1],[.2,0,0]]){const S={VM:{ins:2},rp,kick,ads};vm.runInNewContext(cancel,S);assert.equal(S.VM.ins,0,'cancel '+[rp,kick,ads]);}
{const S={VM:{ins:2},rp:-1,kick:.1,ads:0};vm.runInNewContext(cancel,S);assert.equal(S.VM.ins,2,'idle sway keeps the inspect');}
assert(/kSwing = hv \? 1 : 0\.5; kHv = hv \? 1 : 0; kick = 1;/.test(html),'knife swing must kick (the cancel)');
{const sw=line(html,'{ const w0 = swapW; swapW = function (s)');const S={rw:'knife',VM:{ins:3,sw:0},swapW(s){S.rw=s;},xEq:()=>1,wName:()=>'Vandal'};vm.runInNewContext(sw,S);S.swapW('pri');assert.equal(S.VM.ins,0,'switch cancels inspect');}
// 4. procedural fallback: raises, flips once about the blade, returns
C.VM.insT=want;C.VM.ins=want*.5;knife.rotation={x:.15,y:.25,z:0};const up=C.xKnIns();assert(up>.9,'blade raised mid-inspect');assert(knife.rotation.z>Math.PI*.5,'blade flipped');
C.VM.ins=want*.02;knife.rotation={x:.15,y:.25,z:0};C.xKnIns();C.VM.ins=0;assert.equal(C.xKnIns(),0,'idle after the window');
assert(html.includes('if (VM.ins > 0) xKnIns(); else if (knife.rotation.z || knife.rotation.y !== 0.25) { knife.rotation.y = 0.25; knife.rotation.z = 0; }'),'knife pose reset after inspect');
// 5. native FP rig: inspect plays, an attack event wins, cancel drops to idle
const fp=line(vr,'if(rp>=0){XV.event=null;');
const run=(F,X)=>{const played=[];vm.runInNewContext(fp,{rp:-1,VM:X.VM,XV:X.XV,F,xvFPPlay:(f,k)=>{played.push(k);f.kind=k;f.age=0;}});return played;};
{const F={kind:'idle',age:0,duration:2};assert.deepEqual(run(F,{VM:{ins:want},XV:{event:null}}),['inspect']);
 assert.deepEqual(run(F,{VM:{ins:want-.5},XV:{event:null}}),[],'inspect keeps playing');
 assert.deepEqual(run(F,{VM:{ins:0},XV:{event:'attack 1'}}),['attack 1'],'swing interrupts the inspect clip');
 F.kind='inspect';F.age=.4;F.duration=want;assert.deepEqual(run(F,{VM:{ins:0},XV:{event:null}}),['idle'],'cancelled inspect drops to idle at once');}
// 6. the native inspect clip is stretched to the inspect window, not a fixed 2.2 s
{const S={VM:{insT:want},xEq:()=>1,vfProfile:()=>({reloadTimeSeconds:1,fireRate:2})};vm.runInNewContext(line(feel,'function vfDuration(')+';globalThis.d=vfDuration({w:"Knife"},"inspect",{SequenceLength:3})',S);assert.equal(S.d,want);
 const G={VM:{insT:2.2},xEq:()=>1,vfProfile:()=>({})};vm.runInNewContext(line(feel,'function vfDuration(')+';globalThis.d=vfDuration({w:"Vandal"},"inspect",{})',G);assert.equal(G.d,2.2);}
// 7. the knife's native inspect clip is in the shipped animation file
{const b=fs.readFileSync(path.join(root,'models/valorant/animations/FP_Melee.glb'));const n=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+n));assert(j.animations.some(a=>a.name==='FP_Core_Melee_S0_Tactical_Inspect'),'FP_Melee.glb has the inspect clip');}
console.log('knife inspect: ok (native '+want+' s)');
