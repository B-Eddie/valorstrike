// Remote unit smoothness: snapshots stamped on the sender's clock (mpStamp) instead of their arrival time.
// A unit running at 5.4 m/s, snapshots every 50 ms (server tick jitter +-4 ms) arriving with +-25 ms network jitter,
// rendered at 144 Hz through the page's own mpCliSnap -> mpInterp: per-frame rendered speed must stay near 5.4 m/s.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{T}=require('./valorant_rigs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,'source '+a);return html.slice(i,j);};
assert.ok(/t: "s", c: \+now\.toFixed\(1\)/.test(html)&&/t: "in", c: \+now\.toFixed\(1\)/.test(html),'P2P host snapshots and client inputs carry the sender clock');
assert.ok(/t: mpStamp\(nb, \+m\.c, now\)/.test(html),'host stamps client inputs by their sender clock');
function run(withClock,seed=7){
 const u={g:new T.Group(),nb:[],alive:true,hp:100,name:'Bot',agent:'Jett',nt:1,nid:2},n={running:true,MP:{st:'game',me:1,DELAY:100},NET:{socket:{}},bots:[u],allies:[],XAG:{Jett:1},FV:{},performance:{now:()=>n.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
 vm.createContext(n);vm.runInContext(cut('function mpCliSnap(','function mpCliSelf(')+'\n'+cut('function mpInterp(','const MPT =')+'\n'+cut('const netPose0=mpCliSnap;','let netFxReplay='),n);
 let r=seed;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);const sends=[];
 for(let i=0,t=1000;t<4000;i++){t+=50+(rnd()-.5)*8;sends.push({sent:t,arr:t+40+(rnd()-.5)*50});}sends.sort((a,b)=>a.arr-b.arr);
 const sp=[];let si=0,last=null;
 for(let f=0;f<144*2.8;f++){const now=1200+f*1000/144;while(si<sends.length&&sends[si].arr<=now){const s=sends[si++];n.now=s.arr;const x=5.4*(s.sent-1000)/1000;n.mpCliSnap(withClock?{u:[[2,1,'Bot','Jett',x,0,0,0,100,50,1,'Vandal',0,0,0,25,75,0,0]],serverTime:s.sent+5e5}:{u:[[2,1,'Bot','Jett',x,0,0,0,100,50,1,'Vandal',0,0,0,25,75,0,0]]});}
  n.now=now;n.mpInterp(u,now);const x=u.g.position.x;if(last!=null&&f>144*.5)sp.push((x-last)*144);last=x;}
 const m=sp.reduce((a,b)=>a+b)/sp.length,sd=Math.sqrt(sp.reduce((a,b)=>a+(b-m)**2,0)/sp.length),lo=Math.min(...sp),hi=Math.max(...sp);
 return {m,sd,lo,hi,n,u};}
const A=run(false),B=run(true);
assert.ok(A.sd/A.m>.15,`arrival stamps (old): jittery ${A.lo.toFixed(2)}..${A.hi.toFixed(2)} m/s (sd ${(A.sd/A.m*100).toFixed(0)} %)`);
assert.ok(B.sd/B.m<.06&&B.lo>4.8&&B.hi<6,`sender clock: smooth ${B.lo.toFixed(2)}..${B.hi.toFixed(2)} m/s (sd ${(B.sd/B.m*100).toFixed(1)} %)`);
assert.ok(Math.abs(B.m-5.4)<.1,'mean rendered speed = 5.4 m/s');
// mpStamp: offset follows the smallest delay, stamps monotonic, a clock jump resyncs, no clock = arrival time
{const S=B.n.mpStamp,b=[];b.push({t:S(b,100,140)});b.push({t:S(b,150,215)});assert.ok(b[1].t>190&&b[1].t<191,'a slower packet barely moves the offset');
 const o=b.off;b.push({t:S(b,200,230)});assert.ok(b.off<o&&b.off>30,'a faster packet eases the offset down');const t3=S(b,10200,400);assert.equal(t3,400,'a sender clock jump resyncs at once');
 const c=[{t:500}];assert.equal(S(c,undefined,400),501,'no sender clock: arrival time, never backwards');}
// a late packet: the unit carries on for at most 60 ms along the last segment, then holds (no freeze-then-jump)
{const n=B.n,u=B.u,last=u.nb[u.nb.length-1],prev=u.nb[u.nb.length-2],v=(last.x-prev.x)/(last.t-prev.t);u.nb.splice(0,u.nb.length-2);
 n.mpInterp(u,last.t+100+30);assert.ok(Math.abs(u.g.position.x-(last.x+v*30))<1e-6,'extrapolates 30 ms');n.mpInterp(u,last.t+100+500);assert.ok(Math.abs(u.g.position.x-(last.x+v*Math.min(60,last.t-prev.t)))<1e-6,'holds after 60 ms');}
console.log(`remote interp: arrival stamps ${A.lo.toFixed(2)}..${A.hi.toFixed(2)} m/s (sd ${(A.sd/A.m*100).toFixed(0)} %) -> sender clock ${B.lo.toFixed(2)}..${B.hi.toFixed(2)} m/s (sd ${(B.sd/B.m*100).toFixed(1)} %), mpStamp offset / resync / monotonic, late-packet carry 60 ms`);
