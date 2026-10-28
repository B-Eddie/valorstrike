// Shotgun crosshair as VALORANT draws it by default (work/validation/hud-parity-2026-10-28.md; bo3.gg / thespike.gg, patch
// 3.03): Shorty, Bucky and Judge show a dedicated crosshair, a thin ring with a centre dot and no lines, sized to the pellet
// spread (sample: standing Bucky ~22 px radius at 720p = tan(2.6-3 deg) x focal), growing with movement / air like the pellets.
// Crosshair > Primary "Override All Primary Crosshairs With My Primary Crosshair" (default OFF) gives the primary lines back.
// Other weapons are untouched (VALORANT code-0 lines, work/test_crosshair_error.cjs).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'index.html'),'utf8'),M=require(path.join(root,'vendor/valorant-feel.js')),weapons=require(path.join(root,'server/src/weapons.json')).weapons;
const cut=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
let ops=[];const ctx2d={setTransform(){},clearRect(){},fillRect(x,y,w,h){ops.push({t:'rect',x,y,w,h,a:this.globalAlpha,c:this.fillStyle});},beginPath(){},arc(x,y,r){ops.push({t:'arc',x,y,r});},stroke(){ops.push({t:'stroke',w:this.lineWidth,a:this.globalAlpha,c:this.strokeStyle});},globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1};
const cv={width:400,height:400,getContext:()=>ctx2d},dot={style:{}};
const c={S:{xh:'#ffffff'},document:{getElementById:id=>id==='xhC'?cv:id==='xScD'?dot:null},Math,console,innerHeight:720,camera:{fov:70.53}};vm.createContext(c);
vm.runInContext(cut('S.xc = {','function xcUI()').replace(/^const /gm,'var ')+'\nvar xhE={m:0,f:0,sg:0};',c);
// 1. setting: VALORANT default off, listed in the crosshair settings
assert.equal(c.S.xc.sgOv,false,'override off by default');assert(s.includes('["Override all primary crosshairs with my primary crosshair", "sgOv"]'),'settings row');
// 2. ring + dot, no lines, when a ring radius is passed
const draw=g=>{ops=[];c.xhDraw(cv,g);return ops;};
let o=draw({m:0,f:0,sg:23});const arcs=o.filter(q=>q.t==='arc');assert(arcs.length>=1&&arcs.every(q=>q.x===100&&q.y===100&&Math.abs(q.r-23)<1e-9),'ring of radius 23 round the centre');
assert(o.some(q=>q.t==='stroke'&&q.c==='#ffffff'),'ring in the crosshair colour');assert(o.some(q=>q.t==='stroke'&&q.c==='#000'),'ring outlined (outlines on)');
const rects=o.filter(q=>q.t==='rect'&&q.c==='#ffffff');assert.equal(rects.length,1,'only the centre dot, no lines');assert.equal(rects[0].w,rects[0].h);
// 3. override on: primary lines back
c.S.xc.sgOv=true;o=draw({m:0,f:0,sg:23});assert(!o.some(q=>q.t==='arc'),'override: no ring');assert(o.filter(q=>q.t==='rect'&&q.c==='#ffffff').length>=8,'override: primary lines');c.S.xc.sgOv=false;
// no ring radius (rifles): lines as before
o=draw({m:0,f:0});assert(!o.some(q=>q.t==='arc'));
// 4. ring radius from the real pellet cone projected with the camera FOV (xhSg)
assert(/function xhSg\(w, W\)/.test(s),'xhSg present');
vm.runInContext(cut('const XSGUN =','\n')+'\n'+cut('function xhSg(w, W)','\n'),c);
Object.assign(c,{VF:{model:M},vfProfile:w=>weapons[w],ads:0});c.gSpread=w=>M.spread(Object.assign({},c.player),w,weapons[w]);
const f=360/Math.tan(70.53*Math.PI/360);
c.player={sf:0};let r=c.xhSg('Bucky',{});assert(Math.abs(r-Math.tan(3*Math.PI/180)*f)<0.5,'standing Bucky = tan(3 deg) x focal ('+r.toFixed(1)+' px)');assert(r>18&&r<30,'close to the 22 px VALORANT sample at 720p');
c.player={sf:1};const rr=c.xhSg('Bucky',{});assert(rr>r+10,'running opens the ring ('+rr.toFixed(1)+')');
c.player={sf:0};assert(c.xhSg('Judge',{})>0&&c.xhSg('Shorty',{})>0,'Judge / Shorty rings');assert.equal(c.xhSg('Vandal',{}),0,'rifles: no ring');
c.player={air:true};assert(c.xhSg('Shorty',{})<=98,'capped inside the 200 px crosshair canvas');
c.S.xc.sgOv=true;c.player={sf:0};assert.equal(c.xhSg('Bucky',{}),0,'override: no ring');c.S.xc.sgOv=false;
// 5. render loop feeds the ring radius and redraws on change
assert(s.includes('const sgt = CW && running ? xhSg(cw, CW) : 0;')&&s.includes('xhE.sg = gs;'),'render loop computes and passes the ring radius');
console.log('Shotgun crosshair: VALORANT default ring + dot sized to the pellet cone (standing Bucky '+r.toFixed(1)+' px at 720p), grows when moving, override setting restores primary lines; rifles unchanged');
