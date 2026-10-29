// Default rendering must be sharp: native device pixels on desktop, never a sub-1:1 scale or
// adaptive downscale unless the user opts in, and touch laptops keep the desktop preset.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const pick=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);return s.slice(i,s.indexOf(b,i)+b.length);};
const presets=vm.runInNewContext('('+pick('const xGQP = {','\n};').slice('const xGQP = '.length,-1)+')');
assert.equal(presets.medium.res,'retina');assert.equal(presets.medium.scale,'1');assert(presets.medium.prc>=2);assert.equal(presets.medium.aa,true);
assert(+presets.low.scale>=1,'even the low preset renders at least 1:1');
const media={coarse:false,fine:true};const c={matchMedia:q=>({matches:/any-pointer: fine/.test(q)?media.fine:/pointer: coarse/.test(q)?media.coarse:false}),window:{ontouchstart:null},devicePixelRatio:2,XS:null,xAdPR:Infinity};vm.createContext(c);
const low=pick('const xLowDev =','})();');vm.runInContext(low.replace('const xLowDev','var xLowDev'),c);assert.equal(c.xLowDev,false,'desktop/touch laptop uses the sharp preset');
media.coarse=true;media.fine=false;vm.runInContext(low.replace('const xLowDev','var xLowDev'),c);assert.equal(c.xLowDev,true,'phones use the mobile preset');
// Frame governor (695f989, Video: Dynamic resolution, default on): XGV.on lets the governor's pixel ratio xAdPR step the
// render scale down on dropped vsyncs, never below xPRFloor (max(0.5, XGV.floor x native)); with no dropped vsyncs
// (xAdPR = Infinity, the start state) it renders at the full native ratio, so the default is still sharp.
c.localStorage={getItem:()=>null};c.Uint8Array=Uint8Array;vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);
assert.equal(c.XGV.on,true,'dynamic resolution (frame governor) on by default');c.localStorage={getItem:k=>k==='vs.gov'?'0':null};
vm.runInContext(pick('const XGV = ','};').replace('const ','var '),c);assert.equal(c.XGV.on,false,'Dynamic resolution Off is remembered (vs.gov=0)');
assert(c.XGV.floor>=0.5&&c.XGV.floor<1,'governor floor '+c.XGV.floor);
const pr=pick('const xPRMax =','};')+'\n'+pick('const xPRFloor =',';')+'\n'+pick('const xPR = ','};');vm.runInContext(pr.replace(/const /g,'var '),c);
media.coarse=false;media.fine=true;c.XS={res:'retina',scale:'1',prc:2};c.xAdPR=0.5;c.XGV.on=false;assert.equal(c.xPR(),2,'governor off: fixed scale ignores adaptive downscale');
c.XS.scale='auto';assert.equal(c.xPR(),Math.max(0.5,2*c.XGV.floor),'auto never drops below the floor');c.devicePixelRatio=1;assert.equal(c.xPR(),Math.max(0.5,c.XGV.floor));
c.devicePixelRatio=2;c.XS.scale='1';c.XGV.on=true;c.xAdPR=Infinity;assert.equal(c.xPR(),2,'governor on, no dropped vsyncs: full native ratio');
c.xAdPR=1.6;assert.equal(c.xPR(),1.6,'governor step');c.xAdPR=0.1;assert.equal(c.xPR(),Math.max(0.5,2*c.XGV.floor),'governor never below its floor');
assert.match(pick('function xAdapt() {','\n}'),/if \(!\(XGV\.on \|\| XS\.scale === "auto"\)\) \{ if \(xAdPR !== Infinity\) \{ xAdPR = Infinity; resize\(\); \} return; \}/,'governor off + fixed scale: back to the full ratio, no adapting');
assert.match(s,/id="xGov"><button data-v="1" class="on">On<\/button><button data-v="0">Off<\/button>/,'Dynamic resolution menu default On');
assert.match(s,/data-v="retina" class="on"/);assert.match(s,/data-v="1" class="on">100%/);
assert.match(s,/renderer\.setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/);
console.log('Render quality: native-DPR MSAA default, governor (default on) full native ratio until vsyncs drop and never below its floor, off = no adaptive blur, touch laptops keep desktop preset, UI defaults match');
