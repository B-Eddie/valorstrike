// net lane (60 Hz rooms): the page's interpolation delay follows the room's snapshot rate. A room says its rate in every
// snapshot (tickIntervalMs); the page buffers two snapshots of it: 100 ms against a 20 Hz room (an old worker, as before),
// 50 ms against a 40 Hz room (the default), 35 ms against a 60 Hz one, MP.DELAY when the server does not say. The jitter / starve decays run per 50 ms of server
// time, so a 60 Hz room does not forget a jittery link three times as fast. The input's view (what the server rewinds by)
// is floored at 30 (rewind.js REWIND.minView), so a 60 Hz page reports its real 35 ms.
// Page code (mpCliSnap, netInputMsg) cut from index.html as test_remote_interp_steady.cjs does.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,'source '+a);return html.slice(i,j);};
const DELAY=+html.match(/DELAY: (\d+)/)[1];
function page(){const n={running:true,MP:{st:'game',me:1,DELAY},NET:{socket:{},seq:0},bots:[],allies:[],XAG:{},FV:{},performance:{now:()=>n.now},now:0,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x)),
 yaw:0,pitch:0,ads:0,fireHeld:false,J:{pick:'Jett'},WEAP:{},RS:{}/* netInputMsg hg: Skye Guiding Light hold (df60c6c) */,Math};
 vm.createContext(n);vm.runInContext(cut('function mpCliSnap(','function mpCliSelf(')+'\n'+cut('function netInputMsg(','function netSyncSmokes(')+';globalThis.netInputMsg=netInputMsg;',n);return n;}
// steady snapshots every TICK ms (link jitter J ms), tickIntervalMs as the room sends it (undefined: an old page / P2P host)
function feed(TICK,ti,secs=6,J=0,seed=3){const n=page();let r=seed;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);let pa=0;
 for(let t=1000;t<1000+secs*1000;t+=TICK){let arr=t+40+(rnd()*2-1)*J;arr=Math.max(arr,pa);pa=arr;n.now=arr;n.mpCliSnap({u:[],serverTime:t+5e5,tickIntervalMs:ti});}
 return n;}
const out=[];
{const n=feed(50,50);assert.equal(n.MP.snapClock.delay,100,'old 20 Hz server: 100 ms client delay as before');assert.equal(n.MP.snapClock.min,100);out.push('20 Hz room '+n.MP.snapClock.delay+' ms');
 const v=n.netInputMsg({},'Vandal').view;assert.equal(v,100,'20 Hz room: input view 100');}
{const n=feed(1000/60,16.667);assert.equal(n.MP.snapClock.min,35,'60 Hz room: floor 2 snapshots (35 ms)');assert.ok(n.MP.snapClock.delay>=35&&n.MP.snapClock.delay<40,'60 Hz room steady delay '+n.MP.snapClock.delay);out.push('60 Hz room '+n.MP.snapClock.delay.toFixed(1)+' ms');
 const v=n.netInputMsg({},'Vandal').view;assert.ok(v>=35&&v<40,'60 Hz room: input reports the real view '+v);}
{const n=feed(25,25);assert.equal(n.MP.snapClock.min,50,'40 Hz room: 50 ms');assert.ok(n.MP.snapClock.delay>=50&&n.MP.snapClock.delay<55);out.push('40 Hz room '+n.MP.snapClock.delay.toFixed(1)+' ms');assert.equal(n.netInputMsg({},'Vandal').view,n.MP.snapClock.delay);}
{const n=feed(50,undefined);assert.equal(n.MP.snapClock.delay,DELAY,'no tickIntervalMs: MP.DELAY');}
{const n=feed(1000/30,33.333);assert.equal(n.MP.snapClock.min,Math.max(35,Math.min(DELAY,2*33.333)),'30 Hz room: 2 snapshots');}
// jitter memory is per server time: after the same 2 s of a 15 ms jitter link then 1 s clean, 20 Hz and 60 Hz rooms hold a
// similar margin over their floor (the 60 Hz one would have decayed 3x as fast per snapshot)
{const marg=(TICK)=>{const n=page();let r=9;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);let pa=0;for(let t=1000;t<4000;t+=TICK){const J=t<3000?15:0;let arr=t+40+(rnd()*2-1)*J;arr=Math.max(arr,pa);pa=arr;n.now=arr;n.mpCliSnap({u:[],serverTime:t+5e5,tickIntervalMs:TICK});}return n.MP.snapClock.delay-n.MP.snapClock.min;};
 const a=marg(50),b=marg(1000/60);out.push(`jitter margin after 1 s clean: 20 Hz ${a.toFixed(1)} ms, 60 Hz ${b.toFixed(1)} ms`);assert.ok(a>1&&b>1,'both still hold a jitter margin');assert.ok(b>a/4,'60 Hz room does not forget jitter 3x faster');}
console.log('net tick rate (client): '+out.join('; '));
