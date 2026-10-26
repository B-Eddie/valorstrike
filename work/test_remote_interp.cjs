// Remote unit smoothness through the page's own mpCliSnap -> mpInterp (144 Hz render), a unit running at 5.4 m/s, snapshots every
// 50 ms (+-4 ms tick jitter). Snapshots are placed on the sender's clock (8f1721e: serverTime, a minimum-offset clock and an
// adaptive jitter buffer; P2P host snapshots carry the host clock c, 18b0b45) instead of their arrival time, so network jitter
// does not reach the motion. Network: WebSocket (TCP, ordered), one-way 40 ms + 0..J ms jitter; a lost segment is retransmitted
// ~200 ms later and holds everything behind it. A stall must not run the render clock ahead: before, the unit froze for the
// stall and then jumped the whole gap in one frame (~60-130 m/s rendered); now it stops at the 50 ms extrapolation bound,
// resumes from there (never over 1.1x speed) and the buffer widens by the shortfall (C.starve, capped at 220 ms total).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{T}=require('./valorant_rigs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,'source '+a);return html.slice(i,j);};
assert.ok(/t: "s", c: \+now\.toFixed\(1\)/.test(html),'P2P host snapshots carry the host clock');
assert.ok(/t: mpStamp\(nb, \+m\.c, now\)/.test(html),'host stamps client inputs by mpStamp (sender clock when present, else arrival)');
function run({clock='server',J=50,loss=0,seed=7}={}){
 const u={g:new T.Group(),nb:[],alive:true,hp:100,name:'Bot',agent:'Jett',nt:1,nid:2},n={running:true,MP:{st:'game',me:1,DELAY:100},NET:{socket:{}},bots:[u],allies:[],XAG:{Jett:1},FV:{},performance:{now:()=>n.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
 vm.createContext(n);vm.runInContext(cut('function mpCliSnap(','function mpCliSelf(')+'\n'+cut('function mpInterp(','const MPT =')+'\n'+cut('const netPose0=mpCliSnap;','let netFxReplay='),n);
 let r=seed;const rnd=()=>((r=(r*16807)%2147483647)/2147483647),sends=[];let pa=0;
 for(let t=1000;t<7000;){t+=50+(rnd()-.5)*8;const lost=rnd()<loss;let arr=t+40+rnd()*J;if(lost)arr+=200;arr=Math.max(arr,pa);pa=arr;sends.push({sent:t,arr});}
 const truth=t=>5.4*(t-1000)/1000,sp=[],lag=[];let si=0,last=null,freeze=0;
 for(let f=0;f<144*5.5;f++){const now=1200+f*1000/144;while(si<sends.length&&sends[si].arr<=now){const s=sends[si++];n.now=s.arr;const e=[2,1,'Bot','Jett',truth(s.sent),0,0,0,100,50,1,'Vandal',0,0,0,25,75,0,0];n.mpCliSnap(clock==='server'?{u:[e],serverTime:s.sent+5e5}:clock==='p2p'?{u:[e],c:s.sent+2e4}:{u:[e]});}
  n.now=now;n.mpInterp(u,now);const x=u.g.position.x;if(last!=null&&f>144*1.5){const v=(x-last)*144;sp.push(v);if(v<.5)freeze++;lag.push(now-1000-x/5.4*1000);}last=x;}
 const m=sp.reduce((a,b)=>a+b)/sp.length,sd=Math.sqrt(sp.reduce((a,b)=>a+(b-m)**2,0)/sp.length);lag.sort((a,b)=>a-b);
 return {m,sd:sd/m,lo:Math.min(...sp),hi:Math.max(...sp),freeze,lag:lag[lag.length>>1],n,u};}
const f2=x=>x.toFixed(2),rows=[];
const A=run({clock:'arrival'});assert.ok(A.sd>.15,`arrival stamps: jittery ${f2(A.lo)}..${f2(A.hi)} m/s (sd ${(A.sd*100).toFixed(0)} %)`);rows.push(`arrival +-25: ${f2(A.lo)}..${f2(A.hi)} sd ${(A.sd*100).toFixed(0)}%`);
for(const clock of ['server','p2p'])for(const J of [50,100,150])for(const seed of [7,11,23]){const B=run({clock,J,seed});
 assert.ok(B.sd<.1&&B.lo>4.5&&B.hi<6.2&&!B.freeze,`${clock} clock, ${J} ms jitter: smooth ${f2(B.lo)}..${f2(B.hi)} m/s (sd ${(B.sd*100).toFixed(1)} %, ${B.freeze} frozen frames)`);
 assert.ok(Math.abs(B.m-5.4)<.12,'mean rendered speed = 5.4 m/s');assert.ok(B.lag<240,`${clock} ${J} ms: render delay ${B.lag.toFixed(0)} ms`);if(seed===7)rows.push(`${clock} ${J}ms: ${f2(B.lo)}..${f2(B.hi)} sd ${(B.sd*100).toFixed(1)}% delay ${B.lag.toFixed(0)}ms`);}
for(const [J,loss] of [[100,.02],[150,.05]])for(const seed of [7,11,23]){const B=run({J,loss,seed});
 assert.ok(B.hi<6.2,`${J} ms jitter + ${loss*100}% loss: no catch-up jump after a stall (max rendered ${f2(B.hi)} m/s)`);
 assert.ok(B.freeze<=50,`${J} ms + ${loss*100}% loss: ${B.freeze} frozen frames of ${144*4}`);assert.ok(B.lag<300,'delay stays bounded '+B.lag.toFixed(0));if(seed===7)rows.push(`${J}ms+${loss*100}%loss: max ${f2(B.hi)} m/s, ${B.freeze} frozen frames, delay ${B.lag.toFixed(0)}ms`);}
// mpStamp (host side, P2P client inputs): offset follows the smallest delay, stamps monotonic, a clock jump resyncs, no clock = arrival
{const S=A.n.mpStamp,b=[];b.push({t:S(b,100,140)});b.push({t:S(b,150,215)});assert.ok(b[1].t>190&&b[1].t<191,'a slower packet barely moves the offset');
 const o=b.off;b.push({t:S(b,200,230)});assert.ok(b.off<o&&b.off>30,'a faster packet eases the offset down');assert.equal(S(b,10200,400),400,'a sender clock jump resyncs at once');
 const c=[{t:500}];assert.equal(S(c,undefined,400),501,'no sender clock: arrival time, never backwards');}
console.log('remote interp: '+rows.join('; '));
