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
const pr=pick('const xPRMax =','};')+'\n'+pick('const xPRFloor =',';')+'\n'+pick('const xPR = ','};');vm.runInContext(pr.replace(/const /g,'var '),c);
media.coarse=false;media.fine=true;c.XS={res:'retina',scale:'1',prc:2};c.xAdPR=0.5;assert.equal(c.xPR(),2,'fixed scale ignores adaptive downscale');
c.XS.scale='auto';assert.equal(c.xPR(),1.5,'auto never drops below 75% of native / 1:1');c.devicePixelRatio=1;assert.equal(c.xPR(),1);
assert.match(pick('function xAdapt() {','\n}'),/if \(XS\.scale !== "auto"\) return;/);
assert.match(s,/data-v="retina" class="on"/);assert.match(s,/data-v="1" class="on">100%/);
assert.match(s,/renderer\.setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/);
console.log('Render quality: native-DPR MSAA default, no sub-native/adaptive blur unless chosen, touch laptops keep desktop preset, UI defaults match');
