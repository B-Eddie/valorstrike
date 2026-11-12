// Frame pacing (user, 28 Oct 2026: "75 Hz monitor sits at 60 and dips to 30", "i want it to have a steady max fps").
// Pure pieces of index.html's frame governor, run in node:
//  A. boot: every inline classic script parses and no top-level const / let / class is declared twice across them (the
//     governor's first cut declared a second `const XG` - the bot nav graph's name - and the whole game script failed).
//  B. xCapGates: an FPS limit at / above the measured display refresh never gates (60 cap on 75 Hz used to skip 1 vsync
//     in 5); a limit clearly below it does.
//  C. xGovTick: dropped vsyncs (interval > 1.5 refresh) step the pixel ratio down 10% of the ceiling, never below the floor;
//     a clean run of G.wait ms steps back up (Infinity at the ceiling); stepping up into a miss doubles the wait (cap 60 s);
//     a 20 s clean run halves it (floor 3 s); the 600 ms hold after a step judges nothing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// ---- A
const decl={};let n=0;for(const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)){if(/type="(?!text\/javascript)/.test(m[1]))continue;n++;
 assert.doesNotThrow(()=>new vm.Script(m[2],{filename:'inline'+n}),'inline script '+n+' does not parse');
 for(const d of m[2].matchAll(/^(?:const|let|class) ([A-Za-z_$][\w$]*)/gm))(decl[d[1]]=decl[d[1]]||[]).push(n);}
const dup=Object.entries(decl).filter(([,v])=>v.length>1);assert.deepEqual(dup,[],'top-level names declared twice: '+JSON.stringify(dup));
// ---- B / C: the page's own functions
const fn=nm=>{const i=html.indexOf('\nfunction '+nm+'(');assert(i>=0,nm+' missing');let d=0,j=html.indexOf('{',i);for(;j<html.length;j++){if(html[j]==='{')d++;else if(html[j]==='}'&&!--d)break;}return html.slice(i+1,j+1);};
const {xCapGates,xGovTick,xGovClear,xGovRef}=new Function(['xCapGates','xGovTick','xGovClear','xGovRef'].map(fn).join('\n')+'\nreturn {xCapGates,xGovTick,xGovClear,xGovRef};')();
const decl0=html.match(/const XGV = \{[^\n]*\};/);assert(decl0,'governor state XGV missing');
const G0=()=>{const mk=ls=>new Function('localStorage','return '+decl0[0].slice('const XGV = '.length,-1))(ls),G=mk({getItem:()=>null});assert.equal(G.on,true,'dynamic resolution defaults ON (user, 12 Nov 2026: fix the lag and choppy game)');assert.equal(G.opt,false,'default: not an explicit opt-in (1:1 floor)');assert.equal(mk({getItem:k=>k==='vs.gov'?'0':null}).on,false,'Dynamic resolution Off (vs.gov=0) remembered');const E=mk({getItem:k=>k==='vs.gov'?'1':null});assert(E.on&&E.opt,'Dynamic resolution On (vs.gov=1) remembered as an explicit opt-in');return G;};
const hz=r=>1000/r;
assert.equal(xCapGates(0,hz(75)),false,'no cap');
assert.equal(xCapGates(60,hz(60)),false,'60 cap on 60 Hz');
assert.equal(xCapGates(60,hz(61.5)),false,'60 cap on a 61.5 Hz measurement (jitter)');
assert.equal(xCapGates(60,hz(75)),true,'60 cap on 75 Hz throttles (the user asked for 60)');
assert.equal(xCapGates(144,hz(75)),false,'144 cap on 75 Hz: never gates');
assert.equal(xCapGates(120,hz(144)),true,'120 cap on 144 Hz');
// governor
const R=hz(75),m=2,lo=m*0.6;let G=G0(),t=1000,cur=m;const res=[];
const frame=(dt)=>{t+=dt;const nx=xGovTick(G,t,dt,R,cur,m,lo);if(nx!==undefined){cur=nx===Infinity?m:nx;res.push([Math.round(t),nx]);}return nx;};
xGovClear(G,t);
for(let i=0;i<22;i++)assert.equal(frame(R*2),undefined,"hold: frames inside 600 ms after a reset are not judged"); // 22*26.7=587 ms
G=G0();xGovClear(G,t);t+=700;res.length=0;
for(let i=0;i<3;i++)assert.equal(frame(R*2),undefined,'3 misses < missN');
assert.equal(frame(R*2),1.8,'4th miss in the window: down 10% of the ceiling (2 -> 1.8)');
for(let i=0;i<200;i++)frame(R*2); // keep missing
assert.equal(cur,lo,'never below the floor (0.6 of the ceiling)');
const steps=G.steps;for(let i=0;i<50;i++)frame(R*2);assert.equal(G.steps,steps,'at the floor: no more steps');
// clean run steps back up after wait (3 s)
G=G0();xGovClear(G,t);cur=1.6;t+=700;let up=null;for(let i=0;i<600&&up===null;i++){const nx=frame(R);if(nx!==undefined)up=t;}
assert(up!==null,'clean frames step back up');assert.equal(cur,1.8,'up 10% of the ceiling');
for(let i=0;i<1000&&cur<m;i++)frame(R);assert.equal(cur,m,'climbs back to the ceiling');assert.equal(res[res.length-1][1],Infinity,'ceiling is Infinity (follow the setting)');
// hysteresis: stepping up straight into misses doubles the wait
G=G0();xGovClear(G,t);cur=1.6;t+=700;for(let i=0;i<400&&cur===1.6;i++)frame(R);assert.equal(cur,1.8);
for(let i=0;i<50&&cur===1.8;i++)frame(R*2);assert.equal(cur,1.6,'missing after the step up steps down again');assert.equal(G.wait,6000,'wait doubled');
const tDown=t;for(let i=0;i<2000&&cur===1.6;i++)frame(R);assert(t-tDown>=6000,'next step up waits the doubled wait ('+Math.round(t-tDown)+' ms)');
for(let k=0;k<6;k++){for(let i=0;i<50&&cur>=1.6;i++)frame(R*2);for(let i=0;i<20000&&cur<1.8;i++)frame(R);for(let i=0;i<50&&cur===1.8;i++)frame(R*2);}
assert(G.wait<=60000,'wait capped at 60 s ('+G.wait+')');
// long clean run halves the wait (floor 3 s)
G.wait=12000;cur=m;G.clean=t;for(let i=0;i<Math.ceil(21000/R);i++)frame(R);assert.equal(G.wait,6000,'20 s clean: wait halved');
G.wait=3000;G.clean=t;for(let i=0;i<Math.ceil(21000/R);i++)frame(R);assert.equal(G.wait,3000,'wait floor 3 s');
// a 75 Hz screen at a steady 60 fps (every 5th vsync dropped = 4 frames of 13.3 + 1 of 26.7) is judged missing: the governor steps down
G=G0();xGovClear(G,t);cur=m;t+=700;let d=false;for(let i=0;i<200&&!d;i++)d=frame(i%5===4?R*2:R)!==undefined;assert(d,'uneven 60 on 75 Hz is caught');
// D. xGovRef: the governor judges against the fastest refresh seen. A game stuck at a steady 30 fps on a 60 Hz screen has a
//    33 ms median rAF interval; judged against that nothing "missed" and the pixel ratio never stepped down.
{const H=hz(60);G=G0();assert.equal(xGovRef(G,H,false,0),H,'first measurement taken');assert.equal(xGovRef(G,H*2,false,1000),H,'a slower median (steady 30 fps) does not replace the 60 Hz refresh');
 xGovClear(G,t);cur=m;t+=700;let dn=false;for(let i=0;i<40&&!dn;i++)dn=frame2(H*2)!==undefined;function frame2(dt){t+=dt;const nx=xGovTick(G,t,dt,xGovRef(G,H*2,cur<=lo+0.001,t),cur,m,lo);if(nx!==undefined)cur=nx===Infinity?m:nx;return nx;}
 assert(dn,'steady 30 fps on a 60 Hz screen steps the pixel ratio down');
 assert.equal(xGovRef(G,hz(75),false,t),hz(75),'a faster refresh is taken at once');
 // moved to a slower screen: at the floor, 5 s without reaching the old refresh -> the slower one is accepted
 G=G0();xGovRef(G,hz(120),false,0);assert.equal(xGovRef(G,H,true,1000),hz(120),'not yet');assert.equal(xGovRef(G,H,true,5000),hz(120),'4 s: not yet');assert.equal(xGovRef(G,H,true,6100),H,'5 s at the floor: the slower refresh is accepted');
 G=G0();xGovRef(G,hz(120),false,0);xGovRef(G,H,true,1000);xGovRef(G,H,false,3000);assert.equal(xGovRef(G,H,true,7000),hz(120),'the 5 s restart when it left the floor');}
console.log('frame governor: OK (boot parse '+n+' scripts, cap-vs-refresh, governor steps / floor / ceiling / hysteresis)');
