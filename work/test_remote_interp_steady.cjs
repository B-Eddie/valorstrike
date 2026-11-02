// net lane: a remote unit running at a constant speed is drawn at that speed. mpInterp eases its render clock toward
// now - offset - delay; the target moves a little with every snapshot (the jitter estimate, the minimum-offset clock), and
// the old easing jumped straight to its +-10 % rate bounds for any error over a tenth of a frame, so with 40 +- 15 ms of
// network jitter a 5.4 m/s run was drawn alternating 4.86 / 5.94 m/s frame to frame (sd 4-6 %: legs and footsteps out of
// step with the body, a visible surge; qa/net/interpbench.cjs). Now the clock rate follows the error proportionally
// (25 ms of error = the 10 % bound), so jitter-sized errors move it by a few percent at most.
// Page code (mpCliSnap / mpInterp) cut from index.html as test_remote_interp.cjs does; 60 Hz render, snapshots every 50 ms
// (20 Hz rooms) and every 16.7 ms (60 Hz rooms), ordered link 40 +- 15 ms one-way, 3 seeds each.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{T}=require('./valorant_rigs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,'source '+a);return html.slice(i,j);};
function run(TICK,seed,DL=40,J=15,FPS=60,SECS=12){
 const u={g:new T.Group(),nb:[],alive:true,hp:100,name:'Bot',agent:'Jett',nt:1,nid:2},n={running:true,MP:{st:'game',me:1,DELAY:+html.match(/DELAY: (\d+)/)[1]},NET:{socket:{}},bots:[u],allies:[],XAG:{Jett:1},FV:{},performance:{now:()=>n.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
 vm.createContext(n);vm.runInContext(cut('function mpCliSnap(','function mpCliSelf(')+'\n'+cut('function mpInterp(','const MPT =')+'\n'+cut('const netPose0=mpCliSnap;','let netFxReplay='),n);
 let r=seed;const rnd=()=>((r=(r*16807)%2147483647)/2147483647),sends=[];let pa=0;
 for(let t=1000;t<SECS*1000+2000;){t+=TICK+(rnd()-.5)*4;let arr=t+DL+(rnd()*2-1)*J;arr=Math.max(arr,pa);pa=arr;sends.push({sent:t,arr});}
 const truth=t=>5.4*(t-1000)/1000,sp=[];let si=0,last=null;
 for(let f=0;f<FPS*SECS;f++){const now=1200+f*1000/FPS;while(si<sends.length&&sends[si].arr<=now){const s=sends[si++];n.now=s.arr;n.mpCliSnap({u:[[2,1,'Bot','Jett',truth(s.sent),0,0,0,100,50,1,'Vandal',0,0,0,25,75,0,0]],serverTime:s.sent+5e5,tickIntervalMs:TICK});}
  n.now=now;n.mpInterp(u,now);const x=u.g.position.x;if(last!=null&&f>FPS*3)sp.push((x-last)*FPS);last=x;}
 const m=sp.reduce((a,b)=>a+b)/sp.length,sd=Math.sqrt(sp.reduce((a,b)=>a+(b-m)**2,0)/sp.length)/m,off=sp.filter(v=>Math.abs(v-5.4)>5.4*.04).length/sp.length;
 return {sd,off,lo:Math.min(...sp),hi:Math.max(...sp),m};}
const rows=[];
for(const TICK of [50,1000/60])for(const seed of [7,11,23]){const R=run(TICK,seed),tag=`${TICK.toFixed(1)} ms snapshots seed ${seed}`;
 assert.ok(Math.abs(R.m-5.4)<.1,`${tag}: mean drawn speed ${R.m.toFixed(2)} = 5.4 m/s`);
 assert.ok(R.sd<.025,`${tag}: drawn speed sd ${(R.sd*100).toFixed(1)} % (< 2.5 %), ${R.lo.toFixed(2)}..${R.hi.toFixed(2)} m/s`);
 assert.ok(R.off<.02,`${tag}: ${(R.off*100).toFixed(1)} % of frames drawn more than 4 % off 5.4 m/s (< 2 %)`);
 if(seed===7)rows.push(`${TICK.toFixed(1)}ms: ${R.lo.toFixed(2)}..${R.hi.toFixed(2)} m/s sd ${(R.sd*100).toFixed(1)}%`);}
console.log('remote interp steady: '+rows.join('; '));
