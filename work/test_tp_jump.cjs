// Third-person jump / fall / land through the shipped xUbAnim + native post passes (tp_anim_sim.cjs), real agent skins.
// VALORANT: the legs tuck once the feet leave the floor and the body rides the 6.902 m/s / 20.45 m/s^2 arc (1.165 m, 0.675 s);
// a landing is a short knee give, never a squat. Before: Jump_Start (wind-up crouch, pop, second crouch, tuck: 1.33 s) was
// squeezed into 0.35 s (legs folding and unfolding mid-air) and a standing landing squatted the pelvis 0.30 m; the tuck was
// dropped 20 cm over the floor and the body popped up 14 cm on the landing frame.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{sim}=require('./tp_anim_sim.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const anim=html.slice(html.indexOf('function xUbAnim('),html.indexOf('function xUbW('));
assert.ok(!/xUbOnce\(X, "jump"/.test(anim)&&!/xUbOnce\(X, "land"/.test(anim),'no squeezed Jump_Start / Jump_Land one-shots');
const arc=t=>Math.max(0,6.902*t-.5*20.45*t*t);
async function jump(S,hz,{speed=0,drop=0}={}){const dt=1/hz,R={air:[],ground:[],touch:null};let z=0;
 for(let i=0;i<hz;i++){z+=speed*dt;S.frame(dt,0,0,z);}const stand=S.at('Pelvis').y;
 const T=.675+Math.sqrt(2*drop/20.45)*0+.0;let t=0,landed=-1;
 for(let i=0;i<Math.round(1.4*hz);i++){t+=dt;z+=speed*dt;let y=6.902*t-.5*20.45*t*t+drop*Math.min(1,t/.3);if(t>.3&&drop)y=Math.max(0,y);y=Math.max(0,y);if(landed<0&&t>.1&&y<=0)landed=t;
  S.frame(dt,0,y,z);const p=S.at('Pelvis').y-y;if(landed<0){if(t>.12&&y>.3)R.air.push(p);R.lastAir=p;}else{if(R.touch==null)R.touch=p;R.ground.push([t-landed,p]);}}
 return {stand,...R,fall:S.X.w.fall};}
(async()=>{const rows=[];
 for(const ag of ['jett','breach','sage']){const S=await sim(ag);
  for(const hz of [60,144]){const J=await jump(S,hz);const s=J.stand-0;
   const airMin=Math.min(...J.air),airMax=Math.max(...J.air),dip=s-Math.min(...J.ground.map(g=>g[1])),late=J.ground.filter(g=>g[0]>.45).map(g=>g[1]);
   assert.ok(airMax-airMin<.05,`${ag} ${hz}Hz: airborne pelvis steady over 0.3 m (no mid-air crouch / unfold): ${airMin.toFixed(3)}..${airMax.toFixed(3)}`);
   assert.ok(airMin>s-.08&&airMax<s+.08,`${ag}: airborne body rides the capsule (pelvis ${airMin.toFixed(3)}..${airMax.toFixed(3)} vs standing ${s.toFixed(3)})`);
   assert.ok(J.touch<=J.lastAir+.03,`${ag}: no pop on the landing frame (${J.touch.toFixed(3)} vs last airborne ${J.lastAir.toFixed(3)})`);
   assert.ok(dip>=.03&&dip<=.12,`${ag} ${hz}Hz: standing landing knee give ${dip.toFixed(3)} m (VALORANT: brief, small)`);
   assert.ok(late.every(p=>Math.abs(p-s)<.012),`${ag}: back to standing 0.45 s after landing`);
   rows.push(`${ag}@${hz}: air pelvis ${(airMin-s).toFixed(3)}..${(airMax-s).toFixed(3)} m vs stand, land dip ${dip.toFixed(3)} m`);}
  const S2=await sim(ag),M=await jump(S2,60,{speed:5.4}),dipM=M.stand-Math.min(...M.ground.filter(g=>g[0]<.35).map(g=>g[1]));
  rows.push(`${ag} run-jump land dip ${dipM.toFixed(3)} m`);}
 // landing weight scales with the landing speed, capped; jumping again cancels the knee give at once
 const S=await sim('jett'),A=S.api2;const n=A.xUbLandStart(-6.9,0),hi=A.xUbLandStart(-14,0),run=A.xUbLandStart(-6.9,5.4),lo=A.xUbLandStart(-2,0);
 assert.ok(hi.w>n.w&&n.w>lo.w&&run.w<n.w&&hi.w<=.9,'land weight: drop > jump > small hop, running < standing, capped');
 assert.equal(A.xUbLandEnv(0),0);assert.equal(A.xUbLandEnv(1),0);assert.ok(A.xUbLandEnv(.15)>.99,'fast attack');
 for(let i=0;i<60;i++)S.frame(1/60,0,0,0);let t=0;for(;t<.675;t+=1/60)S.frame(1/60,0,arc(t),0);S.frame(1/60,0,0,0);S.frame(1/60,0,0,0);assert.ok(S.X.lnd>0,'landing started');
 S.frame(1/60,0,.25,0);assert.equal(S.X.lnd,0,'jump spam: the next takeoff cancels the knee give');
 console.log('tp jump: '+rows.join('; '));
})().catch(e=>{console.error(e);process.exit(1);});
