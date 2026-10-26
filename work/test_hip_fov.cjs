// Pace audit (bots-human-1): the hip lens and the first-person bob cadence.
// 1. VALORANT shows 103 deg horizontal at 16:9 and never more (wider screens are letterboxed / cropped to 16:9). The page
//    kept a fixed 70.53 deg vertical FOV, so a browser window wider than 16:9 (1920 x ~970) saw ~109 deg and 21:9 ~118 deg,
//    which makes the same 5.4 m/s run look faster. xHipVFov keeps 103 deg horizontal past 16:9.
// 2. Mouse sensitivity at the hip does not depend on the window shape (degrees per count), scoped = 1 / zoom.
// 3. The viewmodel bob does one vertical dip per footfall (footsteps every 1.85 m), not two.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'index.html'),'utf8'),M=require(path.join(root,'vendor/valorant-feel.js'));
const VF_C=M.C,deg=Math.PI/180,hfov=(v,a)=>2*Math.atan(Math.tan(v*deg/2)*a)/deg;
const i=s.indexOf('function xHipVFov(a)');assert(i>0,'xHipVFov in the page');
const src=s.slice(i,s.indexOf('\n',i));let camera={aspect:16/9};
const xHipVFov=new Function('VF_C','camera',src+'\nreturn xHipVFov;')(VF_C,{get aspect(){return camera.aspect;}});
const near=(a,b,e,m)=>assert(Math.abs(a-b)<=e,m+' ('+a.toFixed(3)+' vs '+b.toFixed(3)+')');
near(xHipVFov(16/9),VF_C.verticalFov,1e-9,'16:9 hip = 70.53 deg vertical');
near(hfov(xHipVFov(16/9),16/9),103,1e-6,'16:9 = 103 deg horizontal');
for(const [w,h] of [[1920,969],[1920,1000],[2560,1080],[3440,1440],[1366,657]])near(hfov(xHipVFov(w/h),w/h),103,1e-6,w+'x'+h+' (browser / ultrawide) keeps 103 deg horizontal');
near(xHipVFov(16/10),VF_C.verticalFov,1e-9,'16:10 keeps the vertical');near(hfov(xHipVFov(16/10),16/10),97.05,.01,'16:10 = 97 deg horizontal as VALORANT');
near(xHipVFov(4/3),VF_C.verticalFov,1e-9,'4:3 keeps the vertical');
const old=hfov(VF_C.verticalFov,1920/969);assert(old>108.5,'before: a 1920x969 window saw '+old.toFixed(1)+' deg');
camera.aspect=1920/969;near(xHipVFov(),xHipVFov(1920/969),1e-12,'reads camera.aspect');
// zoom lens built on it
const f=s.slice(s.indexOf('// ---- VALORANT FEEL ----'),s.indexOf('// ---- END VALORANT FEEL ----'));
assert(/xSCf=function\(z\)\{return 2\*Math\.atan\(Math\.tan\(xHipVFov\(\)\*Math\.PI\/360\)\/z\)/.test(f),'xSCf zooms from the hip lens');
// mouse: k = base * tan(fov/2) / tan(hip/2) -> 1 at the hip for any aspect
const mm=s.slice(s.indexOf('addEventListener("mousemove"'),s.indexOf('addEventListener("mousemove"')+600);
assert(/Math\.tan\(\(typeof xHipVFov === "function" \? xHipVFov\(\)/.test(mm),'mouse sensitivity divides by the current hip lens');
// bob cadence
assert(/V\.phase\+=speed\*dt\*Math\.PI\/1\.85/.test(f),'bob phase pi per 1.85 m');assert(/P\.footDistance>1\.85/.test(f),'footsteps every 1.85 m');
assert(/Math\.abs\(Math\.cos\(V\.phase\)\)/.test(f),'vertical bob is |cos(phase)| (period pi = one dip per step)');
const hz=5.4*Math.PI/1.85/Math.PI;near(hz,5.4/1.85,1e-9,'rifle run: '+hz.toFixed(2)+' dips/s = footstep rate');
console.log('test_hip_fov: PASS (1920x969 was '+old.toFixed(1)+' deg horizontal, now 103; bob '+hz.toFixed(2)+' Hz at 5.4 m/s, was '+(5.4*3.4/Math.PI).toFixed(2)+' Hz)');
