// Default rendering must be sharp: native device pixels on desktop, never a sub-1:1 (CSS pixel) scale unless the user
// opts in, and touch laptops keep the desktop preset. Since 12 Nov 2026 (user: "fix the lag and choppy game"; an M1 at
// native 2880x1800 ran 27-50 fps) the frame governor is ON by default: native until vsyncs drop, floor 1:1 CSS pixels.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const pick=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);return s.slice(i,s.indexOf(b,i)+b.length);};
const presets=vm.runInNewContext('('+pick('const xGQP = {','\n};').slice('const xGQP = '.length,-1)+')');
assert.equal(presets.medium.res,'retina');assert.equal(presets.medium.scale,'1');assert(presets.medium.prc>=2);assert.equal(presets.medium.aa,true);
assert(+presets.low.scale>=1,'even the low preset renders at least 1:1');
const media={coarse:false,fine:true};const c={matchMedia:q=>({matches:/any-pointer: fine/.test(q)?media.fine:/pointer: coarse/.test(q)?media.coarse:false}),window:{ontouchstart:null},devicePixelRatio:2,XS:null,xAdPR:Infinity};vm.createContext(c);
const low=pick('const xLowDev =','})();');vm.runInContext(low.replace('const xLowDev','var xLowDev'),c);assert.equal(c.xLowDev,false,'desktop/touch laptop uses the sharp preset');
media.coarse=true;media.fine=false;vm.runInContext(low.replace('const xLowDev','var xLowDev'),c);assert.equal(c.xLowDev,true,'phones use the mobile preset');
// Frame governor (695f989, Video: Dynamic resolution; default ON again since 12 Nov 2026, see above; Off in Video
// settings is remembered as vs.gov=0, an explicit On as vs.gov=1): XGV.on lets the governor's pixel ratio xAdPR step the
// render scale down on dropped vsyncs, never below xPRFloor (max(0.5, XGV.floor x native)); with no dropped vsyncs
// (xAdPR = Infinity, the start state) it renders at the full native ratio, so the default is still sharp.
c.localStorage={getItem:()=>null};c.Uint8Array=Uint8Array;vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);
assert.equal(c.XGV.on,true,'dynamic resolution (frame governor) is ON by default (user, 12 Nov 2026: fix the lag and choppy game; native 2x was 27-50 fps on an M1)');assert.equal(c.XGV.opt,false,'default is not an explicit opt-in: 1:1 floor');c.localStorage={getItem:k=>k==='vs.gov'?'1':null};
vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);assert.equal(c.XGV.on,true,'Dynamic resolution On is remembered (vs.gov=1)');assert.equal(c.XGV.opt,true,'explicit On is an opt-in');
c.localStorage={getItem:k=>k==='vs.gov'?'0':null};vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);assert.equal(c.XGV.on,false,'Dynamic resolution Off is remembered (vs.gov=0)');
c.localStorage={getItem:()=>{throw new Error('blocked');}};vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);assert.equal(c.XGV.on,true,'no storage: governor on (the default)');assert.equal(c.XGV.opt,false);
assert(c.XGV.floor>=0.5&&c.XGV.floor<1,'governor floor '+c.XGV.floor);
const pr=pick('const xPRMax =','};')+'\n'+pick('const xPRFloor =',');')+'\n'+pick('const xPR = ','};');vm.runInContext(pr.replace(/const /g,'var '),c);
media.coarse=false;media.fine=true;c.XS={res:'retina',scale:'1',prc:2};c.xAdPR=0.5;c.XGV.on=false;assert.equal(c.xPR(),2,'governor off: fixed scale ignores adaptive downscale');
c.XS.scale='auto';assert.equal(c.xPR(),Math.max(0.5,2*c.XGV.floor),'auto never drops below the floor');c.devicePixelRatio=1;assert.equal(c.xPR(),Math.max(0.5,c.XGV.floor));
c.devicePixelRatio=2;c.XS.scale='1';c.XGV.on=true;c.XGV.opt=false;c.xAdPR=Infinity;assert.equal(c.xPR(),2,'governor on, no dropped vsyncs: full native ratio');
c.xAdPR=1.6;assert.equal(c.xPR(),1.6,'governor step');c.xAdPR=0.1;assert.equal(c.xPR(),Math.max(1,2*c.XGV.floor),'governor never below its floor');
// default (not an explicit opt-in): never under 1 render pixel per CSS pixel; a 1x screen keeps exactly 1:1
c.devicePixelRatio=1;assert.equal(c.xPR(),1,'default governor on a 1x screen: stays 1:1 (no sub-1:1 blur without an opt-in)');c.devicePixelRatio=1.5;assert.equal(c.xPR(),1,'1.5x screen: floor 1:1 CSS pixels');
c.XGV.opt=true;c.devicePixelRatio=1;assert.equal(c.xPR(),Math.max(0.5,c.XGV.floor),'explicit On: may go under 1:1 down to the floor');c.XGV.opt=false;c.devicePixelRatio=2;
assert.match(pick('function xAdapt() {','\n}'),/if \(!\(XGV\.on \|\| XS\.scale === "auto"\)\) \{ if \(xAdPR !== Infinity\) \{ xAdPR = Infinity; resize\(\); \} return; \}/,'governor off + fixed scale: back to the full ratio, no adapting');
assert.match(s,/id="xGov"><button data-v="1" class="on">On<\/button><button data-v="0">Off<\/button>/,'Dynamic resolution menu default On');
// FPS-cap vs refresh fix stays on whatever the governor setting: a cap at / above the measured refresh never throttles
{const g=pick('function xCapGates(','}');assert(!/XGV/.test(g),'cap gating must not depend on the governor');const cg=new Function(g+';return xCapGates;')();
 assert.equal(cg(60,1000/60),false,'60 cap on 60 Hz throttles');assert.equal(cg(60,1000/75),true,'60 cap on 75 Hz must gate');assert.equal(cg(144,1000/60),false,'cap above refresh throttles');assert.equal(cg(0,1000/144),false,'no cap gates');
 assert.match(pick('function xGate() {','\n}'),/if \(!xCapGates\(cap, XRF\.ms\)\) \{ xAcc = 0; return false; \}/,'frame limiter does not use the cap-vs-refresh check');}
assert.match(s,/data-v="retina" class="on"/);assert.match(s,/data-v="1" class="on">100%/);
assert.match(s,/renderer\.setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/);
console.log('Render quality: native-DPR MSAA default, governor default ON (full native ratio until vsyncs drop, never below 1:1 CSS px without an opt-in), off = no adaptive blur, cap >= refresh never throttles, touch laptops keep desktop preset, UI defaults match');
