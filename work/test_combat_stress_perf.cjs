// Worst-case combat stays allocation- and DOM-write-light (combat lane 2026-11-04, user: "it lags in certain times, like when i do
// multiple abilities while using ult while shooting at enemy while getting shot at").
// Runs work/bench_combat.cjs (offline 5v5 Ascent, MEDIUM, seed 7: the player casts C, Q, E and the ult while firing full-auto at an
// enemy who shoots back, two more enemies and two allies close with full utility and ult charge) for a few agents, two windows
// each, and checks the counts that are deterministic on any box (frame ms are not, so they are not asserted here):
//  - THREE objects constructed per 420-frame window (the page's own new Vector3 / Matrix4 / Bone / ... : GC pressure; was up to
//    ~9,100 per window: ragdoll pose / basis clones, xrSupports matrices, the Curveball hint arcs)
//  - textContent writes per window (was up to ~2,000: the ability HUD and the buy timer rewrote the same text every frame)
//  - no new shader program and no texture upload in the window
//   node work/test_combat_stress_perf.cjs        (CS_AGENTS=Phoenix,Sage to pick agents)
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
// caps: the counts of this tree (2026-11-04) + ~10 % slack, each below what the window cost before the combat lane
// [objs rep0, objs rep1, text rep0, text rep1]   (before: objs / text per window)
// integration (bugs + move/constants + audio + sounds + combat, 2026-11-04): text caps raised where the scenario itself changed -
// Phoenix w1 146, Sage w0 96, Killjoy w0 615 writes; every extra write is a write-on-change HUD value (xHp / xArm / hudT ammo
// spans: the integrated tree's bot decisions differ, so the player takes more hits in the window), not a per-frame rewrite; still far under 'before'
const CAP={
 Phoenix:[1836, 5805, 81, 161], // before 8501 / 8886 objs, 642 / 544 text; now 1669 / 5277 objs (5277: a gun model build, frame 277), 73 / 98 text
 Sage:[6063, 253, 106, 49],    // before 9135 / 1070 objs, 415 / 870 text; now 5512 / 230 objs, 63 / 44 text
 Killjoy:[1504, 1114, 677, 124], // before 1787 / 1432 objs, 2038 / 1453 text; now 1367 / 1012 objs, 557 / 112 text
};
const AG=(process.env.CS_AGENTS||Object.keys(CAP).join(',')).split(',');
const fail=[];
for(const a of AG){
 const out=path.join(os.tmpdir(),'cs_'+process.pid+'_'+a+'.json');
 const r=spawnSync(process.execPath,['--expose-gc',path.join(__dirname,'bench_combat.cjs'),'--agent',a,'--reps','2','--json',out],{env:{...process.env,PROF:'0',SEED:'7'},encoding:'utf8',maxBuffer:64<<20});
 assert.equal(r.status,0,a+': bench_combat failed\n'+(r.stderr||'').slice(-2000));
 const d=JSON.parse(fs.readFileSync(out,'utf8'));fs.unlinkSync(out);const cap=CAP[a];
 assert.equal(d.runs.length,2,a+': two windows');
 assert.ok(d.errors.every(e=>/unexpected external script models\/valorant\/agents\/manifest\.js/.test(e.msg)),a+': page errors '+JSON.stringify(d.errors));
 d.runs.forEach((w,i)=>{
  const line=`${a} window ${i}: objs ${w.objs} (cap ${cap&&cap[i]}), textContent writes ${w.dom.text} (cap ${cap&&cap[2+i]}), programs ${w.prog}, textures ${w.tex}, cpu p95 ${w.cpuP95} ms`;console.log(line);
  if(w.prog!==0)fail.push(a+' window '+i+': '+w.prog+' new shader program(s) mid-combat: '+JSON.stringify(w.progs));
  if(w.tex!==0)fail.push(a+' window '+i+': '+w.tex+' texture upload(s) mid-combat');
  if(cap&&w.objs>cap[i])fail.push(a+' window '+i+': '+w.objs+' THREE objects constructed > cap '+cap[i]);
  if(cap&&w.dom.text>cap[2+i])fail.push(a+' window '+i+': '+w.dom.text+' textContent writes > cap '+cap[2+i]);
 });
}
assert.deepEqual(fail,[],fail.join('\n'));
console.log('combat stress: '+AG.join(', ')+' - allocations and DOM writes per window under their caps, no program / texture mid-combat');
