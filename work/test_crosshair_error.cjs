// Crosshair against VALORANT's settings (Settings > Crosshair; default code 0: outlines .5 / thickness 1, centre dot off with
// opacity 1 / thickness 2, inner lines .8 / 6 / 2 / 3 with movement error off and firing error on, outer lines .35 / 2 / 2 / 10
// with both on, multipliers 1, fade with firing error on, sniper scope dot red .75 / 1). Each line set opens by the error it
// is set to show: the movement error (moving / airborne cone over the standing first shot) and the firing error (spray bloom)
// are measured separately (xhErr) from the same cone the shot uses.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),s=fs.readFileSync(path.join(root,'index.html'),'utf8'),M=require(path.join(root,'vendor/valorant-feel.js')),weapons=require(path.join(root,'server/src/weapons.json')).weapons;
const cut=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
let rects=[];const ctx2d={setTransform(){},clearRect(){},fillRect(x,y,w,h){rects.push({x,y,w,h,a:this.globalAlpha,c:this.fillStyle});},globalAlpha:1,fillStyle:''};
const cv={width:400,height:400,getContext:()=>ctx2d},dot={style:{}};
const c={S:{xh:'#ffffff'},document:{getElementById:id=>id==='xhC'?cv:id==='xScD'?dot:null},Math,console};vm.createContext(c);
vm.runInContext(cut('S.xc = {','function xcUI()').replace(/^const /gm,'var ')+'\n'+cut('function xhErr(','\n')+'\nvar xhE={m:0,f:0};',c);
const X=c.S.xc,J=o=>JSON.parse(JSON.stringify(o));const D0=J(c.S.xc);
// 0. Colour: VALORANT's stock crosshair is white (profile code 0: senslab.pro/crosshair/valorant; tracker.gg builder default #FFFFFF).
assert(/const S = \{[^}]*xh: "#ffffff"/.test(s),'default crosshair colour white');
// 1. Defaults = VALORANT's.
assert.deepEqual(J({ol:X.ol,olo:X.olo,olt:X.olt,dot:X.dot,dto:X.dto,dt:X.dt,fade:X.fade}),{ol:true,olo:.5,olt:1,dot:false,dto:1,dt:2,fade:true});
assert.deepEqual(J(X.inr),{on:true,op:.8,len:6,th:2,off:3,me:false,mm:1,fe:true,fm:1});assert.deepEqual(J(X.out),{on:true,op:.35,len:2,th:2,off:10,me:true,mm:1,fe:true,fm:1});assert.deepEqual(J(X.sd),{on:true,op:.75,th:1});
for(const k of ['Outline thickness','Center dot opacity','Fade crosshair with firing error','Inner movement error','Inner firing error multiplier','Outer movement error multiplier','Outer firing error','Sniper scope center dot','Sniper dot opacity'])assert(s.includes('["'+k+'"'),'settings row '+k);
// 2. Line placement: the right arm of each set starts at cx + offset + its error (cx = 100 in the 2x canvas).
const arms=()=>{const r=rects.filter(r=>r.c!=='#000'&&r.h===X.inr.th&&r.x>100);return J(r.map(q=>q.x-100).sort((a,b)=>a-b));};
const draw=g=>{rects=[];c.xhDraw(cv,g);return arms();};
assert.deepEqual(draw({m:0,f:0}),[3,10],'at rest: inner 3, outer 10');
assert.deepEqual(draw({m:12,f:0}),[3,22],'moving: inner stays (movement error off), outer opens 12');
assert.deepEqual(draw({m:0,f:8}),[11,18],'firing: both open 8');
X.inr.me=true;X.out.mm=2;assert.deepEqual(draw({m:5,f:0}),[8,20],'inner movement on, outer x2 multiplier');X.inr.me=false;X.out.mm=1;
// 3. Fade with firing error; outline thickness; centre dot opacity.
rects=[];c.xhDraw(cv,{m:0,f:0});const a0=rects.find(r=>r.c!=='#000').a;rects=[];c.xhDraw(cv,{m:0,f:15});const a1=rects.find(r=>r.c!=='#000').a;assert(a1<a0&&a1>0,'lines fade while firing ('+a0+' -> '+a1+')');
X.fade=false;rects=[];c.xhDraw(cv,{m:0,f:15});assert.equal(rects.find(r=>r.c!=='#000').a,a0,'no fade when off');X.fade=true;
X.olt=2;rects=[];c.xhDraw(cv,0);const ol=rects.find(r=>r.c==='#000'),ln=rects.find(r=>r.c!=='#000');assert.equal(ol.w-ln.w,4,'outline thickness 2 on each side');X.olt=1;
X.dot=true;X.dto=.4;rects=[];c.xhDraw(cv,0);assert(rects.some(r=>r.c!=='#000'&&r.w===2&&r.h===2&&r.a===.4),'centre dot opacity');X.dot=false;
c.xsdDraw();assert.equal(dot.style.display,'block');assert.equal(dot.style.opacity,'0.75');assert.equal(dot.style.width,'2px');X.sd.on=false;c.xsdDraw();assert.equal(dot.style.display,'none');
// 4. Error split from the shot's cone: airborne Vandal = movement error (capped 40 px), a spray = firing error only.
Object.assign(c,{VF:{model:M},vfProfile:w=>weapons[w],ads:0});let bloom=0;c.gSpread=(w)=>M.spread(Object.assign({},c.player),w,weapons[w])+bloom;
c.player={air:true};let e=c.xhErr('Vandal',{});assert.deepEqual([Math.round(e.m),Math.round(e.f)],[40,0],'airborne: movement error');
c.player={sf:0};bloom=.01;e=c.xhErr('Vandal',{});assert.equal(e.m,0);assert(Math.abs(e.f-4.5)<1e-9,'spray: firing error = bloom x 450');
c.player={sf:1};bloom=0;e=c.xhErr('Operator',{});assert.equal(Math.round(e.m),40,'running Operator: movement error');
assert(s.includes('$("cross").style.setProperty("--g", Math.max(gm, gf) + "px"); xhDraw();')&&s.includes('xhE.m = gm; xhE.f = gf;'),'render loop feeds both errors');
// 5. Migration: a saved crosshair equal to an old shipped default (never changed) takes the VALORANT defaults; a changed one
// keeps every value, the old global movement / firing error toggles applying to both line sets.
const OLD={ol:true,olo:.5,dot:false,dt:2,inr:{on:true,op:.8,len:6,th:2,off:3},out:{on:true,op:.35,len:2,th:2,off:10}};
for(const me of [false,true]){c.S.xc=J(D0);assert.equal(c.xcRestore(J({...OLD,me,fe:true})),false,'untouched old default (me '+me+') not restored');assert.deepEqual(J(c.S.xc),D0,'untouched old default -> VALORANT defaults');}
c.S.xc=J(D0);const reord=J({fe:true,me:false,out:OLD.out,inr:OLD.inr,dt:2,dot:false,olo:.5,ol:true});assert.equal(c.xcRestore(reord),false,'key order does not matter');
c.S.xc=J(D0);assert.equal(c.xcRestore(J({...OLD,inr:{...OLD.inr,len:4},me:false,fe:true})),true);assert.equal(c.S.xc.inr.len,4,'changed length kept');assert.equal(c.S.xc.out.me,false,'changed crosshair: old global movement error (off) applies to outer too');assert.equal(c.S.xc.inr.fe,true);
c.S.xc=J(D0);c.xcRestore(J({...OLD,olo:.8,me:true,fe:false}));assert.deepEqual([c.S.xc.olo,c.S.xc.inr.me,c.S.xc.out.me,c.S.xc.inr.fe,c.S.xc.out.fe],[.8,true,true,false,false],'custom toggles kept on both line sets');
c.S.xc=J(D0);const cur=J(D0);cur.out.off=12;cur.inr.me=true;c.xcRestore(cur);assert.equal(c.S.xc.out.off,12);assert.equal(c.S.xc.inr.me,true,'new-format save restored as is');
console.log('Crosshair: VALORANT stock defaults (white; migrate untouched old defaults only) (outline thickness, dot opacity, per-line movement / firing error + multipliers, fade, sniper dot); lines open by their own error; error split from the shot cone');
