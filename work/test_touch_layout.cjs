// Touch layout in portrait and landscape (row 7). Default button layouts are percentages with fixed pixel sizes, so on
// small screens they overlapped (C/Q/E/X at 640x360: 45 px apart for 46 px buttons) or hung off the screen (portrait
// 360x740 used the landscape layout: JUMP/DUCK past the right edge, abilities stacked on each other). Portrait now has
// its own layout, and fit() separates/clamps defaults on any screen while leaving layouts that already fit untouched.
// Also: portrait no longer blocks play behind "Rotate your phone" (the notice offers Play in portrait).
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('  const DEF = { fire:'),b=html.indexOf('  reset();',a);assert(a>0&&b>a,'layout section');
const c={innerWidth:800,innerHeight:450,Math,Object};vm.createContext(c);vm.runInContext(html.slice(a,b).replace('const DEF','var DEF').replace('const DEFP','var DEFP').replace('let custom','var custom').replace('const reset','var reset').replace('const fit','var fit')+';globalThis.get=()=>L;',c);
const check=(w,h)=>{c.innerWidth=w;c.innerHeight=h;c.reset();const L=c.get(),ks=Object.keys(L);assert.equal(ks.length,Object.keys(c.DEF).length);
 for(const k of ks){const p=L[k],x=p.x*w/100,y=p.y*h/100,r=p.s/2;assert(x-r>=0&&x+r<=w&&y-r>=0&&y+r<=h,w+'x'+h+' '+k+' inside the screen ('+x.toFixed(0)+','+y.toFixed(0)+')');}
 for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const p=L[ks[i]],q=L[ks[j]],d=Math.hypot((p.x-q.x)*w/100,(p.y-q.y)*h/100);assert(d>=(p.s+q.s)/2+4,w+'x'+h+' '+ks[i]+' and '+ks[j]+' overlap ('+d.toFixed(1)+' px)');}
 return L;};
const sizes=[[360,740],[390,844],[412,915],[740,360],[640,360],[568,320],[844,390],[915,412],[1024,768],[1280,720]];for(const [w,h] of sizes)check(w,h);
// portrait uses the portrait layout: fire in the lower right, abilities in one row, plant/use/buy on the left edge
{const L=check(360,740);assert(L.fire.x>60&&L.fire.y>65,'portrait fire bottom right');assert(new Set(['c','q','e','x'].map(k=>Math.round(L[k].y))).size===1,'abilities in one row');for(const k of ['plant','use','buy'])assert(L[k].x<20,k+' on the left edge');}
// a roomy landscape screen keeps the designed layout exactly
{const L=check(1280,720);for(const k in c.DEF)assert.deepEqual([L[k].x,L[k].y],[c.DEF[k][0],c.DEF[k][1]],'1280x720 '+k+' unchanged');}
// rotation re-fits the defaults; a layout the player arranged is kept (render() checks custom/lastWH)
assert(/function render\(\) \{ if \(!custom && lastWH !== innerWidth \+ "x" \+ innerHeight\) reset\(\);/.test(html),'render re-fits defaults on rotation');
for(const m of ['if (p.t === "ed") { custom = true;','if (sel) { custom = true; L[sel].s','if (sel) { custom = true; L[sel].off'])assert(html.includes(m),'edit marks layout arranged: '+m);
// portrait play: the rotate notice can be dismissed and stays dismissed
assert(/<div id="rot">[^]*?<button id="rotGo"[^>]*>Play in portrait<\/button>/.test(html),'rotate notice offers portrait play');
assert(/html\.portrait-ok #rot\{display:none!important\}/.test(html),'dismissed notice stays hidden');
assert(/rotGo[^]{0,300}localStorage\.setItem\("vs\.portrait", "1"\)/.test(html),'choice remembered');
console.log('Touch layout: '+sizes.length+' screens (portrait 360x740-412x915, landscape 568x320-1280x720) with every button inside and none overlapping; portrait layout; rotation re-fit; portrait play allowed');
// Pointer lock on a touch screen (browser-found, portrait 360x740 offline 5v5): every match start / resume called
// relock(), and with the lock held Chromium reported each touch at clientX 0, so the stick and aim drag did nothing
// while buttons still worked. Like the click-to-lock path, relock() never locks on a coarse (touch) pointer.
{const i=html.indexOf('const relock = () =>'),line=html.slice(i,html.indexOf('\n',i));const calls=[];const c2={matchMedia:q=>({matches:c2.coarse}),renderer:{domElement:{requestPointerLock:()=>calls.push(1)}},coarse:true};vm.createContext(c2);vm.runInContext(line.replace('const relock','globalThis.relock')+'',c2);
 c2.relock();assert.equal(calls.length,0,'no pointer lock on touch');c2.coarse=false;c2.relock();assert.equal(calls.length,1,'mouse still locks');}
console.log('Touch: relock() never takes pointer lock on a touch screen');
