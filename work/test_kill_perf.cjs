// Kill-cost perf, the rest (browser profile): the kill icon restarts its animations with DOM writes only (no
// getAnimations style flush per kill; re-added two frames on), every WebGLRenderer is created with synchronous
// shader-error checks off (three's checkShaderErrors read every program/shader info log: 79 % of the first frames;
// ?shaderdebug turns them back on), bot LOS caches on numeric cell keys (no string per query), and native-map bot
// re-plans are staggered per bot and capped at 3 per frame.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nm=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'missing '+a);return s.slice(i,j);};
// 3. Kill icon: DOM writes only.
{const a=html.indexOf('function xRestart(');const src=html.slice(a,html.indexOf('\n}',a)+2);const frames=[];const c={requestAnimationFrame:f=>frames.push(f)};vm.createContext(c);vm.runInContext(src,c);
 const cls=new Set(['on']);let flush=0;const el={classList:{contains:k=>cls.has(k),add:k=>cls.add(k),remove:k=>cls.delete(k)},getAnimations(){flush++;return [];}};
 c.xRestart(el,'on',1);assert.equal(flush,0,'no getAnimations (style flush) on the kill path');assert(!cls.has('on'));frames.shift()();assert(!cls.has('on'),'still off after one frame (a style pass without the class runs first)');frames.shift()();assert(cls.has('on'),'restarted two frames on');
 const k=cut(html,'function xKiAdd(','function xDeathFlash(');assert(k.includes('xRestart(s, "on", 1)')&&k.includes('xRestart(XKI.el, "pop", 1)')&&!/offsetWidth|getBoundingClientRect|getComputedStyle/.test(k),'xKiAdd reads no layout');}
// 4. Shader checks off on every renderer, opt back in with ?shaderdebug.
{const n=(html.match(/new THREE\.WebGLRenderer\(/g)||[]).length,w=(html.match(/xShChk\(new THREE\.WebGLRenderer\(/g)||[]).length;assert(n>=5&&n===w,'every renderer goes through xShChk ('+w+'/'+n+')');
 const f=html.slice(html.indexOf('function xShChk('),html.indexOf('\n',html.indexOf('function xShChk(')));for(const [q,want] of [['',false],['?shaderdebug',true],['?a=1&shaderdebug=1',true]]){const c={location:{search:q}};vm.createContext(c);vm.runInContext(f,c);const r={debug:{checkShaderErrors:true}};c.xShChk(r);assert.equal(r.debug.checkShaderErrors,want,q);}}
// 5. LOS cache: numeric keys, same answers, 100 ms reuse, bounded.
{let now=0,raw=0;const c={Math,Map,performance:{now:()=>now},losRaw:(a,b)=>{raw++;return a.x<b.x;}};vm.createContext(c);vm.runInContext('const XLOS=new Map();'+cut(html,'const XLQ =','\nfunction losRaw(')+';globalThis.XLOS=XLOS;',c);
 const P=(x,y,z)=>({x,y,z});assert.equal(c.los(P(0,1.5,0),P(5,1.5,0)),true);assert.equal(c.los(P(0.05,1.5,0),P(5,1.5,0.1)),true);assert.equal(raw,1,'same 0.25 m cells reuse the result');
 assert.equal(c.los(P(9,1.5,0),P(5,1.5,0)),false);now+=150;c.los(P(0,1.5,0),P(5,1.5,0));assert.equal(raw,3,'expires after 100 ms');
 for(let i=0;i<2000;i++)c.los(P(i,0,0),P(0,0,i));let tot=0;for(const m of c.XLOS.values())tot+=m.size;assert(tot<=801,'bounded: '+tot);}
// 6. Native nav: re-plans staggered per bot and at most 3 per frame; no-path / blocked / starved bots re-plan anyway.
{const a=nm.indexOf('{const p=xPath;xPath=function(u,dt,gx,gz,out){const C=nmActive();'),b=nm.indexOf('\n{const goal=xGoal',a);assert(a>=0&&b>a,'native xPath block');
 let plans=0;const c={Math,Map,performance:{now:()=>0},XNF:0,nmActive:()=>({}),xPath:()=>null,nmNext:(C,u,gx,gz)=>{plans++;return [u.g.position.x+5,u.g.position.z,0];}};vm.createContext(c);vm.runInContext(nm.slice(a,b)+';globalThis.P=xPath;',c);
 const U=Array.from({length:10},(_,i)=>({g:{position:{x:i*3,y:0,z:0}}}));
 c.XNF++;for(const u of U)c.P(u,1/60,50,0,[]);assert.equal(plans,10,'bots with no path all plan');
 const ph=new Set(U.map(u=>u.npT.toFixed(4)));assert(ph.size>=8,'re-plan timers staggered per bot: '+ph.size+' distinct');
 for(const u of U)u.npT=0;plans=0;c.XNF++;for(const u of U)c.P(u,1/60,50,0,[]);assert.equal(plans,3,'at most 3 timed re-plans per frame');
 let f=0,most=0;while(U.some(u=>u.npT<=0)&&f<40){plans=0;c.XNF++;for(const u of U)c.P(u,1/60,50,0,[]);most=Math.max(most,plans);f++;}assert(f<=4&&most<=3,'all deferred bots re-plan within a few frames ('+f+')');
 U[0].npT=0;U[0].blk=1;for(const u of U.slice(1,5))u.npT=0;plans=0;c.XNF++;c.P(U[0],1/60,50,0,[]);assert.equal(plans,1,'blocked bot re-plans first');
 const S=U[9];S.npT=0;S.npS=.3;c.XNF++;for(const u of U.slice(1,5))c.P(u,1/60,50,0,[]);plans=0;c.P(S,1/60,50,0,[]);assert.equal(plans,1,'starved bot (>0.25 s) re-plans despite the budget');
 for(const u of U)u.npT=0;delete c.XNF;plans=0;for(const u of U)c.P(u,1/60,50,0,[]);assert.equal(plans,10,'no frame counter (harness): no budget');}
console.log('Kill perf: kill icon without style flush, shader checks off (?shaderdebug), numeric LOS cache, native re-plans staggered and <=3 per frame');
