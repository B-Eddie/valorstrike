// Real-Chrome movement feel probe: the live page (offline 5v5, Ascent, through the real load gate) driven by TRUSTED keyboard / mouse /
// wheel input from Playwright, logging every moveP call (dt, keys, yaw, the player's state after it). The recorded per-frame input is
// replayed through the shared motor (vendor/valorant-feel.js) on a flat world, so any frame where the game diverges from the motor
// (input delay, an extra slow-down, a dt clamp, a wall) shows; and the VALORANT metrics are read off the real frames:
// knife accel 0.288 s, stop ~99 ms, counter-strafe, jump apex 1.165 m / airtime 0.675 s, landing keeps speed, air strafe keeps speed,
// scroll-wheel bunny hop never above 6.75 m/s, crouch 0.276 s / 2.5 m/s, Classic run 5.74 / walk 3.44 m/s.
//   PW=<playwright dir> node work/browser_movement_feel.cjs [--headful]
// PW defaults to the newest ~/.npm/_npx/*/node_modules/playwright. Writes work/validation/movement-browser/run.json.
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'),M=require('../vendor/valorant-feel.js');
function pwDir(){if(process.env.PW)return process.env.PW;const b=path.join(os.homedir(),'.npm/_npx');const c=fs.existsSync(b)?fs.readdirSync(b).map(d=>path.join(b,d,'node_modules/playwright')).filter(fs.existsSync):[];c.sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);if(!c.length)throw Error('playwright not found: set PW');return c[0];}
const chromium=()=>require(pwDir()).chromium;
const PORT=8000+Math.floor(Math.random()*900),sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Analysis of a recorded run (out.log rows: t, dt, W, S, A, D, Space, Ctrl, Shift, yaw, x, y, z, vx, vz, vy, air, ch, hold, weapon, run speed).
// A search that finds nothing fails its check (G) instead of throwing, so one missed phase does not hide the rest.
function analyze(out,check){const L=out.log;const G=(f,name)=>{try{f();}catch(e){check(false,name,'no data: '+String(e.message||e).slice(0,80));}};
  const ph=n=>{const p=out.phases[n];if(!p)throw Error('phase '+n+' missing');return L.slice(Math.max(0,p.from-1),p.to);},sp=r=>Math.hypot(r[13],r[14]);
  const idx=(R,f)=>{const i=R.findIndex(f);if(i<0)throw Error('event not found');return i;};
  const fr=L.slice(5).map(r=>r[1]).sort((a,b)=>a-b);out.dt={median:fr[fr.length>>1],p95:fr[Math.floor(fr.length*.95)],max:fr[fr.length-1]};
  // replay: the recorded per-call input through the shared motor on a flat, open floor
  const flat={ground:()=>0,blocked:()=>false};const diff={};
  for(const n of Object.keys(out.phases)){const R=ph(n);if(!R.length)continue;const r0=R[0];const P={x:0,y:0,z:0,vx:r0[13],vz:r0[14],vy:r0[15],air:false,ch:r0[17]};let worst=0,at=-1,prev=null,off=0;
   for(let i=1;i<R.length;i++){const r=R[i],prof=r[20],y=r[9],fx=-Math.sin(y),fz=-Math.cos(y);let x=0,z=0;if(r[2]){x+=fx;z+=fz;}if(r[3]){x-=fx;z-=fz;}if(r[4]){x+=fz;z-=fx;}if(r[5]){x-=fz;z+=fx;}
    M.step(P,{x,z,jump:!!r[6],duck:!!r[7],walk:!!r[8],speed:prof,hold:!!r[18]},r[1],flat);const d=Math.abs(Math.hypot(P.vx,P.vz)-sp(r));if(d>.02)off++;if(d>worst){worst=d;at=i;}prev=r;}
   diff[n]={worstSpeedDiff:+worst.toFixed(4),atFrame:at,framesOff:off,frames:R.length};}
  out.replay=diff;
  // metrics on the real frames
  const t=(R,i)=>R[i][0];
  G(()=>{const R=ph('knife_run_stop');const s=idx(R,r=>r[2]);const top=idx(R,(r,i)=>i>s&&sp(r)>=6.75*.995);const rel=idx(R,(r,i)=>i>top&&!r[2]);const st=idx(R,(r,i)=>i>rel&&sp(r)<.01);
   const acc=(t(R,top)-t(R,s-1>=0?s-1:s))/1000,stop=(t(R,st)-t(R,rel-1))/1000;out.knife={accelS:acc,stopS:stop,top:Math.max(...R.map(sp))};
   check(Math.abs(acc-.288)<=out.dt.p95+.006,'knife reaches 6.75 m/s in ~0.288 s (real frames)',acc.toFixed(3)+' s');check(Math.max(...R.map(sp))<=6.75+1e-6,'knife never above 6.75 m/s');check(Math.abs(stop-.099)<=out.dt.p95+.006,'release stop ~99 ms (Stark friction)',(stop*1000).toFixed(1)+' ms');},'phase knife_run_stop');
  G(()=>{const R=ph('knife_back_counter');const sw=idx(R,(r,i)=>i>0&&r[3]&&!r[2]);const z=idx(R,(r,i)=>i>sw&&((r[13]*R[sw-1][13]+r[14]*R[sw-1][14])<=0||sp(r)<.01));const cs=(t(R,z)-t(R,sw-1))/1000;out.counterStrafeS=cs;
   check(cs<out.knife.stopS&&cs>.04,'counter-strafe stops faster than releasing',(cs*1000).toFixed(1)+' ms vs '+(out.knife.stopS*1000).toFixed(1)+' ms');},'phase knife_back_counter');
  G(()=>{const R=ph('jump_stand');const g=R[0][11];const j=idx(R,r=>r[16]);const l=idx(R,(r,i)=>i>j&&!r[16]);const apex=Math.max(...R.map(r=>r[11]))-g,air=(t(R,l)-t(R,j-1))/1000;out.jump={apex,air};
   check(Math.abs(apex-1.165)<.03,'standing jump apex 1.165 m',apex.toFixed(3)+' m');check(Math.abs(air-.675)<=out.dt.p95+.01,'airtime 0.675 s',air.toFixed(3)+' s');},'phase jump_stand (a sub-frame Space tap must jump)');
  G(()=>{const R=ph('run_jump');const j=idx(R,r=>r[16]);const l=idx(R,(r,i)=>i>j&&!r[16]);const before=sp(R[j-1]),after=sp(R[l]),inAir=Math.max(...R.slice(j,l).map(sp));out.runJump={before,after,inAir};
   check(Math.abs(after-6.75)<.01&&inAir<=6.75+1e-6,'run-jump lands at full knife speed (no landing slowdown)',before.toFixed(3)+' -> '+after.toFixed(3));},'phase run_jump');
  G(()=>{const R=ph('air_strafe');const j=idx(R,r=>r[16]);const l=idx(R,(r,i)=>i>j&&!r[16]);const A=R.slice(j,l),sa=A.map(sp),dirs=A.map(r=>Math.atan2(r[14],r[13]));let turn=dirs[dirs.length-1]-dirs[0];turn=Math.atan2(Math.sin(turn),Math.cos(turn))*180/Math.PI;
   out.airStrafe={minSpeed:Math.min(...sa),maxSpeed:Math.max(...sa),turnDeg:turn,yawTurnDeg:(A[A.length-1][9]-A[0][9])*180/Math.PI};
   check(Math.max(...sa)<=6.75+1e-6&&Math.min(...sa)>6.75-.05,'air strafe keeps speed while turning',`speed ${Math.min(...sa).toFixed(3)}..${Math.max(...sa).toFixed(3)}, velocity turned ${turn.toFixed(1)} deg`);
   check(Math.abs(turn)>15,'mouse + strafe key turns the jump in the air',turn.toFixed(1)+' deg');},'phase air_strafe');
  G(()=>{const R=ph('wheel_bhop');let jumps=0,land=[];for(let i=1;i<R.length;i++){if(!R[i-1][16]&&R[i][16]&&R[i][15]>0)jumps++;if(R[i-1][16]&&!R[i][16]&&R[i][2])land.push(sp(R[i]));/* landings with W held (a landing after W is released brakes on contact, as it should) */}out.bhop={jumps,landSpeeds:land.map(v=>+v.toFixed(3)),max:Math.max(...R.map(sp))};
   check(jumps>=3,'scroll-wheel bunny hop chains jumps',jumps+' jumps from '+out.wheelNotches+' notches');check(out.bhop.max<=6.75+1e-6,'bunny hop never exceeds melee speed',out.bhop.max.toFixed(3));
   check(land.length&&land.every(v=>v>6.75-.02),'every bhop landing keeps full speed',land.map(v=>v.toFixed(2)).join(' '));},'phase wheel_bhop');
  G(()=>{const R=ph('crouch_walk');const c0=idx(R,r=>r[7]);const full=idx(R,(r,i)=>i>c0&&r[17]>=.4-1e-6);const ct=(t(R,full)-t(R,c0-1))/1000;const w=R.filter(r=>r[2]&&r[7]);const top=Math.max(...w.map(sp));out.crouch={timeS:ct,walkTop:top};
   check(Math.abs(ct-.276)<=out.dt.p95+.006,'full crouch 0.276 s',ct.toFixed(3)+' s');check(Math.abs(top-2.5)<.01,'crouch-walk 2.5 m/s with the knife',top.toFixed(3));},'phase crouch_walk');
  G(()=>{const A=ph('classic_run'),B=ph('classic_walk');const run=Math.max(...A.filter(r=>r[2]).map(sp)),walk=Math.max(...B.filter(r=>r[2]&&r[8]).map(sp));out.classic={run,walk,weapon:A[1][19]};
   check(Math.abs(run-5.7375)<.01,'Classic run 5.74 m/s',run.toFixed(3)+' '+A[1][19]);check(Math.abs(walk-5.7375*.6)<.01,'Classic walk 3.44 m/s',walk.toFixed(3));},'phase classic');
  for(const [n,d] of Object.entries(diff))check(d.worstSpeedDiff<.02||(d.framesOff<=1&&d.worstSpeedDiff<.1),'frame-by-frame replay through the shared motor matches the game: '+n,'worst |dv| '+d.worstSpeedDiff+' m/s, '+d.framesOff+' of '+d.frames+' frames off (one < 0.1 m/s = a graze beside the lane)');
  check(!(out.errors||[]).length,'no page errors',(out.errors||[]).slice(0,2).join(' | '));
}
const out0=process.argv.includes('--analyze')?JSON.parse(fs.readFileSync(path.join(__dirname,'validation/movement-browser/run.json'),'utf8')):null;
(async()=>{if(out0){let f=0;out0.checks=[];analyze(out0,(ok,name,detail)=>{out0.checks.push({ok:!!ok,name,detail});if(!ok)f++;console.log((ok?'PASS ':'FAIL ')+name+(detail?'  ['+detail+']':''));});console.log(`analyzed: ${out0.checks.length-f}/${out0.checks.length} passed`);fs.writeFileSync(path.join(__dirname,'validation/movement-browser/run.json'),JSON.stringify(out0));process.exit(f?1:0);}
 const srv=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await sleep(800);
 const browser=await chromium().launch({channel:'chrome',headless:!process.argv.includes('--headful'),args:['--autoplay-policy=no-user-gesture-required']});
 const out={when:new Date().toISOString(),checks:[],phases:{}};let fail=0;const check=(ok,name,detail)=>{out.checks.push({ok:!!ok,name,detail});if(!ok)fail++;console.log((ok?'PASS ':'FAIL ')+name+(detail?'  ['+detail+']':''));};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.route(/\/index\.html$|\/$/,async r=>{const res=await r.fetch();let b=await res.text();b=b.replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({response:res,body:b,headers:{...res.headers(),'content-type':'text/html'}});});
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);await page.waitForFunction(()=>{try{return typeof window.__xe==='function'&&window.__xe("typeof xGo==='function'&&typeof startFive==='function'");}catch(e){return false;}},null,{timeout:120000,polling:250});
  const xe=s=>page.evaluate(s=>window.__xe(s),s);
  await xe(`FV.pick='ascent';xGo(()=>window.xMatchLoad(()=>startFive(),FV.pick,undefined,true));true`);
  await page.waitForFunction(()=>{try{return window.__xe("typeof xCrash!=='undefined'&&xCrash.rec&&xCrash.rec.stage==='playable'&&running&&!!player");}catch(e){return false;}},null,{timeout:240000,polling:500});
  // Buy phase held open: bots stay frozen in their spawn, the player walks its spawn area. Knife out (melee key, real input).
  await xe(`FV.buy=1e9;FV.menu=false;try{buyMenu(false)}catch(e){}bots.forEach(b=>{b.cd=1e9});true`);
  await page.mouse.click(640,360);await sleep(300);
  const locked=await xe('!!document.pointerLockElement');out.pointerLock=locked;
  if(!locked)await xe(`(()=>{const c=renderer.domElement;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>c});return true})()`);
  await page.keyboard.press('3');await sleep(900);
  // A direction with >= 7 m of flat, free floor both ways (W runs, S returns), from the spawn.
  // A lane from the spawn: >= 7.5 m of flat floor ahead, clear of walls, the buy barrier and every (frozen) unit by 1.2 m, and 2.5 m to
  // the right of it (the air strafe curves that way). Every phase starts from the lane's start, facing along it (a teleport).
  const dir=await xe(`(()=>{const P=player,W=nmActive(),U=[...allies,...bots].filter(u=>u&&u.g).map(u=>u.g.position);const free=(x,z)=>Math.abs(groundAt(x,z,.3,P.y+.5)-P.y)<=.03&&!nmBlocked(W,x,z,.45,P.y+.05,1.7)&&!(typeof sgBlk==='function'&&sgBlk(x,z,.45,P.y))&&!U.some(q=>Math.hypot(q.x-x,q.z-z)<1.2);let best=null;
   for(let gx=-8;gx<=8;gx++)for(let gz=-8;gz<=8;gz++){const X=P.x+gx,Z=P.z+gz;if(!free(X,Z))continue;for(let k=0;k<32;k++){const a=k*Math.PI/16,fx=-Math.sin(a),fz=-Math.cos(a),rx=-fz,rz=fx;let ok=0;for(let d=0;d<=8;d+=.25){if(!free(X+fx*d,Z+fz*d))break;ok=d;}if(ok<7.5&&best&&best.ok>=7.5)continue;let side=2.5;for(let d=0;d<=ok&&side>0;d+=1)for(let w=.5;w<=2.5;w+=.5)if(!free(X+fx*d+rx*w,Z+fz*d+rz*w)){side=Math.min(side,w-.5);break;}const sc=Math.min(ok,8)+Math.min(side,2.5)-Math.hypot(gx,gz)*.01;if(!best||sc>best.s)best={a,ok,side,s:sc,x:X,y:P.y,z:Z};}if(best&&best.ok>=7.5&&best.side>=2.5)break;}yaw=best.a;pitch=0;return best;})()`);
  out.lane=dir;check(dir&&dir.ok>=7.5&&dir.side>=2.5,'found a flat lane clear of walls, barrier and units',JSON.stringify(dir));
  const home=async()=>{await xe(`(()=>{Object.assign(player,{x:${dir.x},y:${dir.y},z:${dir.z},vx:0,vz:0,vy:0,air:false});yaw=${dir.a};pitch=0;window.__tread=null;return 1})()`);await sleep(250);};
  // per-moveP logger; __tread: a treadmill for the long bunny hop (past 6 m along the lane the position steps back 5 m, velocity untouched)
  await xe(`(()=>{window.__L=[];const m0=moveP;moveP=function(dt,run,hold){const tap=!J.dr&&performance.now()-(VF.jumpTap||-1e9)<100;const r=m0.apply(this,arguments);const P=player,T=window.__tread;if(T){const d=(P.x-T.x)*T.fx+(P.z-T.z)*T.fz;if(d>6){P.x-=T.fx*5;P.z-=T.fz*5;P.fallY=P.y;}}window.__L.push([performance.now(),dt,keys.KeyW?1:0,keys.KeyS?1:0,keys.KeyA?1:0,keys.KeyD?1:0,keys.Space||tap?1:0,keys.ControlLeft?1:0,keys.ShiftLeft?1:0,yaw,P.x,P.y,P.z,P.vx||0,P.vz||0,P.vy||0,P.air?1:0,P.ch||0,!!hold?1:0,vfWeapon(),vfWeapon()==='Knife'?6.75:6.75*(vfProfile(vfWeapon()).runSpeedMultiplier||.8)]);return r;};return true})()`);
  const mark=async n=>{await home();const i=await xe('__L.length');out.phases[n]={from:i};return i;},end=async n=>{out.phases[n].to=await xe('__L.length');};
  const K=page.keyboard;
  await mark('knife_run_stop');await K.down('w');await sleep(800);await K.up('w');await sleep(400);await end('knife_run_stop');
  await mark('knife_back_counter');await K.down('w');await sleep(800);await K.up('w');await K.down('s');await sleep(170);await K.up('s');await sleep(400);await end('knife_back_counter');
  // K.press = keydown + keyup inside one frame: a sub-frame tap (rapid-trigger keys, low frame rates) must still jump
  await mark('jump_stand');await K.press('Space');await sleep(1000);await end('jump_stand');
  await mark('run_jump');await K.down('w');await sleep(350);await K.press('Space');await sleep(850);await K.up('w');await sleep(300);await end('run_jump');
  // air strafe: run, jump, release W, hold D and turn the mouse right with the velocity (trusted mouse moves; ~0.028 deg per count)
  await mark('air_strafe');await K.down('w');await sleep(350);await K.press('Space');await sleep(30);await K.up('w');await K.down('d');
  {let mx=640;for(let i=0;i<20&&await xe('player.air');i++){mx+=70;await page.mouse.move(mx,360);await sleep(16);}}/* ~40-60 deg, stops at touchdown */for(let i=0;i<120&&await xe('player.air');i++)await sleep(4);await K.up('d');await sleep(500);/* D released at touchdown: the landing stops in place */await end('air_strafe');
  // wheel bunny hop: Jump (alt) on Wheel Down (as a player binds it), W held, one notch whenever the player is back on the floor
  await xe(`XS.keys.jumpW='WheelDown';xKbBuild();true`);
  await mark('wheel_bhop');await xe(`window.__tread={x:${dir.x},z:${dir.z},fx:${-Math.sin(dir.a)},fz:${-Math.cos(dir.a)}};true`);await K.down('w');await sleep(400);let hops=0;const t0=Date.now();while(Date.now()-t0<2600){const g=await xe('!player.air');if(g){await page.mouse.wheel(0,120);hops++;}await sleep(8);}await K.up('w');await sleep(500);await end('wheel_bhop');out.wheelNotches=hops;
  await mark('crouch_walk');await K.down('Control');await sleep(450);await K.down('w');await sleep(1200);await K.up('w');await sleep(300);await K.up('Control');await sleep(500);await end('crouch_walk');
  await page.keyboard.press('2');await sleep(1200);
  await mark('classic_run');await K.down('w');await sleep(900);await K.up('w');await sleep(300);await end('classic_run');
  await mark('classic_walk');await K.down('Shift');await K.down('w');await sleep(1000);await K.up('w');await K.up('Shift');await sleep(300);await end('classic_walk');
  const L=await xe('__L');out.frames=L.length;out.errors=errors.slice(0,5);out.log=L;fs.mkdirSync(path.join(__dirname,'validation/movement-browser'),{recursive:true});fs.writeFileSync(path.join(__dirname,'validation/movement-browser/run.json'),JSON.stringify(out));
  analyze(out,check);
 }catch(e){console.error(e);fail++;out.crash=String(e&&e.stack||e);}finally{await browser.close();srv.kill();}
 const dirOut=path.join(__dirname,'validation/movement-browser');fs.mkdirSync(dirOut,{recursive:true});fs.writeFileSync(path.join(dirOut,'run.json'),JSON.stringify(out));
 console.log(`browser movement feel: ${out.checks.length-fail}/${out.checks.length} passed, ${out.frames||0} frames, dt median ${out.dt&&(out.dt.median*1000).toFixed(2)} ms`);process.exit(fail?1:0);
})();
