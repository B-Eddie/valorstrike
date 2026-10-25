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
// Portrait HUD (browser-found, offline 5v5 at 360x740): the top bar (alive pips + "BUY PHASE 0:45") measured 524 px and ran
// off both edges, the 96 px minimap sat under the bar and the subtitle, the buy-phase team panel ended 10 px above the
// C/Q/E/X row and COMMS reached across the C button. The max-width:480px block compacts the bar (browser after: 268 px,
// x 46-314), gives the subtitle its own clipped line, stacks the minimap under it, the kill feed under the pause button and
// lifts the team panel (rows 22 px: 118 px tall, browser x 0-360 y 280-398). Geometry below uses the sizes measured in
// Chromium and the real portrait button layout from fit() at three phone sizes.
{const k='@media (max-width:480px){\n  #game .x-top{',i=html.indexOf(k);assert(i>0,'portrait HUD block');const blk=html.slice(i,html.indexOf('\n}\n',i));
 const rule=(sel,prop)=>{const m=blk.match(new RegExp(sel.replace(/[.#()+]/g,'\\$&')+'\\{([^}]*)\\}'));assert(m,'rule '+sel);const v=m[1].match(new RegExp('(?:^|;)'+prop+':([^;]+)'));assert(v,sel+' '+prop);return v[1].trim();};
 assert.equal(rule('#game .x-top .x-pp','display'),'none','alive pips hidden in portrait');assert.equal(rule('#game .x-top .x-tm','min-width'),'0');assert(parseFloat(rule('#game .x-top .x-tm','font-size'))<=15);
 assert.equal(rule('#game .x-top','max-width'),'calc(100vw - 8px)');assert.equal(rule('#game #xSub','text-overflow'),'ellipsis');assert.equal(rule('#game #xSub','left'),'8px');assert.equal(rule('#game #xSub','right'),'8px');
 const subTop=parseFloat(rule('#game #xSub','top')),mapTop=parseFloat(rule('#game #xMap','top')),MAP=96,BAR_BOTTOM=40,SUB_H=11,PANEL_H=118,FEED_H=5*24+6,COMMS_W=83;
 assert(subTop>=BAR_BOTTOM+4&&mapTop>=subTop+SUB_H+4,'bar / subtitle / minimap stacked');assert.equal(rule('#xObs .x-obr','height'),'22px');
 assert.equal(rule('#game .hud.x-fw','top'),'calc(12.2vh + 28px)');assert.equal(rule('#xObs','top'),'calc(50% - 90px)');
 for(const [w,h] of [[360,740],[390,844],[412,915]]){const L=check(w,h),px=(k,a)=>L[k][a]*(a==='x'?w:h)/100,pb=px('pause','y')+L.pause.s/2,feed=0.122*h+28,ob=h/2-90,ab=px('c','y')-L.c.s/2;
  assert(px('pause','x')-L.pause.s/2>8+MAP+4,w+'x'+h+' pause clear of the minimap');assert(feed>=pb+4,w+'x'+h+' kill feed below pause');
  assert(ob>=mapTop+MAP+8&&ob>=feed+FEED_H,w+'x'+h+' team panel below minimap and feed ('+ob+')');assert(ob+PANEL_H+16<=ab,w+'x'+h+' team panel clear of the ability row ('+(ob+PANEL_H)+' vs '+ab+')');
  assert(12+COMMS_W+4<=px('c','x')-L.c.s/2,w+'x'+h+' COMMS clear of C');}}
console.log('Touch: portrait HUD (top bar fits, subtitle/minimap/feed/team panel stacked clear of the touch buttons at 360x740, 390x844, 412x915)');
