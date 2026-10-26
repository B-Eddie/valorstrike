// Knife swing visuals (row: "knife feels a bit long"). (1) light swings run Valorant's looping three-swing combo
// (wiki.playvalorant.com/en-us/Melee: "The primary slash has a three swing combo that loops"): back-to-back swings at the
// 2/s cadence play Attack 1 -> 2 -> 3 -> 1, a pause past XVK.chain or a heavy swing restarts at Attack 1; (2) on the real
// native rig the combo alternates sides (Attack 1 ends right, 2 slashes left, 3 returns right) and each montage starts
// where the previous ended; (3) the montage ends at XVK.light / XVK.heavy with the arm back at idle (the authored clip pads
// to 1.92 / 2.17 s with a near-idle hold), and the slash itself peaks early (~0.2 s) so the hit at the click reads.
//   node work/test_knife_combo.cjs   (in test_all)
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
(async()=>{
 const vr=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'marker '+a);return s.slice(i,j);};
 assert(html.includes("XV.event=kHv?'alt Attack':xvKnCombo(F)"),'knife swing event goes through the combo');
 const clock={t:10};const C={performance:{now:()=>clock.t*1000},Math,Date};vm.createContext(C);
 vm.runInContext(feel.slice(feel.indexOf('var XVK='),feel.indexOf('\n',feel.indexOf('var XVK=')))+'\n'+cut(vr,'function xvKnCombo(','function xvFPTick(')+';globalThis.combo=xvKnCombo;globalThis.K=XVK;',C);
 const entries=['Idle','Equip','Inspect','Attack 1','Attack 2','Attack 3','Attack 4','Attack 5','Alt Attack'].map(t=>({Translatable:t})),F={entries};
 const seq=[];for(let i=0;i<5;i++){seq.push(C.combo(F));clock.t+=0.5;}assert.deepEqual(seq,['attack 1','attack 2','attack 3','attack 1','attack 2'],'2/s light swings loop the three-swing combo');
 clock.t+=C.K.chain+0.01;assert.equal(C.combo(F),'attack 1','a pause restarts the combo');clock.t+=0.5;assert.equal(C.combo(F),'attack 2');
 F.kt=-1e9;clock.t+=0.5;assert.equal(C.combo(F),'attack 1','a heavy swing (kt reset) restarts the combo');
 const F2={entries:entries.filter(e=>e.Translatable!=='Attack 3')};clock.t+=5;const s2=[];for(let i=0;i<3;i++){s2.push(C.combo(F2));clock.t+=0.5;}assert.deepEqual(s2,['attack 1','attack 2','attack 1'],'a skin with fewer authored attacks loops what it has');
 assert.equal(C.K.chain>0.5&&C.K.chain<1,true,'chain window covers the 0.5 s light cadence');
 // real rig: sides, continuity, end at idle, early peak
 const FP=await import(path.join(root,'server/tools/fp-view.mjs')),THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
 const R=await FP.build('jett','melee'),Fr=R.F,hand=()=>{R.cam.updateMatrixWorld(true);return Fr.sc.getObjectByName('R_Hand').getWorldPosition(new THREE.Vector3());};
 const at=(kind,sec)=>{const e=Fr.entries.find(x=>x.Translatable.toLowerCase()===kind.toLowerCase());Fr.am.stopAllAction();const a=Fr.ac[e.Name];a.reset().play();a.time=Math.min(a.getClip().duration-1e-3,sec/ +e.SequenceLength*a.getClip().duration);Fr.am.update(0);return hand();};
 const idle=(()=>{Fr.am.stopAllAction();const e=Fr.entries.find(x=>x.Translatable==='Idle'),a=Fr.ac[e.Name];a.reset().play();a.time=0;Fr.am.update(0);return hand();})();
 const end=k=>at(k,0.5),start=k=>at(k,0);
 assert(end('Attack 1').x>idle.x+0.05,'Attack 1 ends out right');assert(end('Attack 2').x<idle.x-0.25,'Attack 2 slashes across to the left');assert(end('Attack 3').x>idle.x+0.05,'Attack 3 returns right');
 for(const [a,b] of [['Attack 1','Attack 2'],['Attack 2','Attack 3']])assert(end(a).distanceTo(start(b))<0.08,b+' starts where '+a+' is at the next swing ('+end(a).distanceTo(start(b)).toFixed(3)+' m)');
 for(const k of ['Attack 1','Attack 2','Attack 3'])assert(at(k,C.K.light).distanceTo(idle)<0.03,k+' back at idle by '+C.K.light+' s ('+at(k,C.K.light).distanceTo(idle).toFixed(3)+' m)');
 assert(at('Alt Attack',C.K.heavy).distanceTo(idle)<0.07,'heavy back near idle by '+C.K.heavy+' s ('+at('Alt Attack',C.K.heavy).distanceTo(idle).toFixed(3)+' m)');
 let pk=0,pt=0,prev=at('Attack 1',0);for(let t=0.01;t<=0.6;t+=0.01){const p=at('Attack 1',t),v=p.distanceTo(prev);if(v>pk){pk=v;pt=t;}prev=p;}assert(pt<0.3,'light slash peaks early ('+pt.toFixed(2)+' s)');
 console.log('knife: three-swing combo loops at 2/s (1 -> 2 -> 3 -> 1, resets on a pause / heavy), sides alternate on the native rig and chain seamlessly, light montage ends at idle by '+C.K.light+' s (was 1.92 s), heavy by '+C.K.heavy+' s (was 2.17 s), slash peaks at '+pt.toFixed(2)+' s');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
