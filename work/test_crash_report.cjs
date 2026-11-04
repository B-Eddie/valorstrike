// Crash report (work/crash_report_runtime.js; iOS user 2026-11-03: online matches on Safari and Arc - WebKit - end in a black
// screen, the menu, or the error toast "Something broke: Script error."). Runs the real runtime in a small fake DOM:
//  1. installed: first inline script after the analytics stub, == the runtime file; the CDN scripts (three, GLTFLoader,
//     SkeletonUtils) load with crossorigin="anonymous" so WebKit no longer mutes their exceptions to "Script error.";
//     the match load / map load / online socket / lost match call into it;
//  2. a window error is saved to localStorage with its message, file:line:col and stack; a muted "Script error." still
//     records its source URL; unhandledrejection is recorded, an AbortError is not;
//  3. WEBGL_lose_context: loseContext() on the game's canvas records a named WebGLContextLost with the load stage and,
//     unrestored after restoreMs, shows the "graphics reset" message with Reload (no silent black screen); restoreContext()
//     hides it again; the GL renderer string and limits are recorded from the first WebGL context;
//  4. a shader link failure (getProgramParameter LINK_STATUS false) and three's "Shader Error" console.error are recorded;
//  5. ws close codes: 1000 is not a crash, 1006 during a match is;
//  6. next page load: a match that ended in a fatal event, or whose page died mid-load (iOS reload), shows the dismissible
//     "Last match ended: <reason>" note with Copy (clipboard gets the JSON report); a cleanly finished match shows nothing.
//   node work/test_crash_report.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),RT=fs.readFileSync(path.join(__dirname,'crash_report_runtime.js'),'utf8');
// ---- a small DOM ----
class Ev{constructor(t,o){this.type=t;Object.assign(this,o||{});this.defaultPrevented=false;}preventDefault(){this.defaultPrevented=true;}}
class Node_{constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this.L={};this.textContent='';this.parent=null;}
 appendChild(c){c.parent=this;this.children.push(c);return c;}remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(t,f){(this.L[t]=this.L[t]||[]).push(f);}dispatch(e){for(const f of (this.L[e.type]||[]).slice())f.call(this,e);}
 set innerHTML(h){this._html=h;}get innerHTML(){return this._html||'';}select(){}
 all(){const o=[this];for(const c of this.children)o.push(...c.all());return o;}}
function page(ls,{clip=true}={}){
 const store=ls||new Map(),win={L:{}},doc=new Node_('#document');doc.body=new Node_('body');doc.readyState='complete';
 doc.createElement=t=>{const n=t==='canvas'?new Canvas():new Node_(t);return n;};doc.getElementById=id=>doc.body.all().find(n=>n.id===id)||null;doc.addEventListener=()=>{};doc.execCommand=()=>true;
 const lobby=new Node_('div');lobby.id='lobby';lobby.style.display='none';doc.body.appendChild(lobby);
 const errs=[];const con={error:(...a)=>errs.push(a),warn(){},log(){}};
 class GL{constructor(c){this.canvas=c;this.lost=false;this.VERSION=7938;this.VENDOR=7936;this.RENDERER=7937;this.MAX_TEXTURE_SIZE=3379;this.MAX_TEXTURE_IMAGE_UNITS=34930;this.MAX_VERTEX_TEXTURE_IMAGE_UNITS=35660;this.MAX_ARRAY_TEXTURE_LAYERS=35071;this.MAX_FRAGMENT_UNIFORM_VECTORS=36349;this.MAX_VERTEX_UNIFORM_VECTORS=36347;this.MAX_RENDERBUFFER_SIZE=34024;}
  getParameter(k){return {7938:'WebGL 2.0',7936:'WebKit',7937:'WebKit WebGL',3379:16384,34930:16,35660:16,35071:2048,36349:1024,36347:1024,34024:16384,37446:'Apple GPU',37445:'Apple Inc.'}[k];}
  isContextLost(){return this.lost;}getProgramInfoLog(){return 'ERROR: too many samplers';}
  getExtension(n){const gl=this;if(n==='WEBGL_debug_renderer_info')return {UNMASKED_VENDOR_WEBGL:37445,UNMASKED_RENDERER_WEBGL:37446};
   if(n==='WEBGL_lose_context')return {loseContext(){gl.lost=true;gl.canvas.dispatch(new Ev('webglcontextlost'));},restoreContext(){gl.lost=false;gl.canvas.dispatch(new Ev('webglcontextrestored'));}};return null;}}
 GL.prototype.getProgramParameter=function(p,n){return n===0x8B82?p.ok:true;};
 class GL2 extends GL{}
 class Canvas extends Node_{constructor(){super('canvas');}getContext(t){if(/webgl/.test(t))return this.gl||(this.gl=new GL2(this));return null;}}
 const timers=[];
 Object.assign(win,{window:win,document:doc,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',clipboard:clip?{writeText:s=>{win.clip=s;return Promise.resolve();}}:undefined},
  location:{reload(){win.reloaded=true;}},devicePixelRatio:3,console:con,JSON,Date,Math,String,Array,Error,TypeError,Promise,
  setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout:i=>{if(timers[i-1])timers[i-1].f=null;},setInterval:()=>0,
  HTMLCanvasElement:Canvas,WebGLRenderingContext:GL,WebGL2RenderingContext:GL2,
  addEventListener:(t,f)=>{(win.L[t]=win.L[t]||[]).push(f);}});
 win.fire=(t,o)=>{for(const f of (win.L[t]||[]).slice())f(new Ev(t,o));};
 win.runTimers=()=>{for(const t of timers.splice(0))if(t.f)t.f();};
 vm.createContext(win);vm.runInContext(RT,win,{filename:'crash_report_runtime.js'});
 return {win,doc,store,errs,lobby,X:win.xCrash};
}
const rec=s=>JSON.parse(s.get('vs.crash'));
(async()=>{
 // 1. installed
 { const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),a=html.indexOf('<script>// ---- CRASH REPORT ----'),b=html.indexOf('// ---- END CRASH REPORT ----</script>');
   assert(a>0&&b>a,'index.html carries the CRASH REPORT script (python3 work/install_valorant.py)');
   assert.equal(html.slice(a+'<script>'.length,b+'// ---- END CRASH REPORT ----'.length),RT.trimEnd(),'installed == work/crash_report_runtime.js');
   assert(a<html.indexOf('<script>/* perf2: allocation-free Math.hypot')&&a>html.indexOf('window.va = window.va ||'),'first script after the analytics stub');
   for(const u of ['https://unpkg.com/three@0.149.0/build/three.min.js','https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js','https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/utils/SkeletonUtils.js']){
    assert(html.includes('<script src="'+u+'" crossorigin="anonymous"></script>'),u+' loads with CORS (crossorigin="anonymous"), not muted to "Script error."');}
   assert(!/<script src="https:\/\/[^"]+"><\/script>/.test(html),'no cross-origin script without crossorigin');
   assert(/xCrash\.begin\(/.test(html)&&/xCrash\.stage\("playable"\)/.test(html)&&/xCrash\.stage\("weapons"\)/.test(html)&&/xCrash\.stage\("rigs"\)/.test(html)&&/xCrash\.stage\("warm"\)/.test(html)&&/xCrash\.stage\('map-download'\)/.test(html)&&/xCrash\.stage\('map-upload'\)/.test(html),'match / map load stages reported');
   assert(/ws\.addEventListener\('close',e=>\{try\{if\(window\.xCrash\)xCrash\.ws\(e\.code,e\.reason\)/.test(html),'online socket closes reported');
   assert(/mpLost=function\(why\)\{try\{if\(window\.xCrash/.test(html),'a lost match is reported'); }
 // 2. errors
 { const P=page(),X=P.X;assert(X,'window.xCrash');
   const e=new TypeError("null is not an object (evaluating 'a.b')");e.stack="t@https://valorstrike.vercel.app/index.html:12:3\nu@...";
   P.win.fire('error',{error:e,message:e.message,filename:'https://valorstrike.vercel.app/index.html',lineno:12,colno:3});
   let R=rec(P.store),ev=R.ev.find(x=>x.type==='error');assert(ev&&/TypeError: null is not an object/.test(ev.d)&&/index\.html:12:3/.test(ev.d)&&/t@https/.test(ev.d),'error with message, file:line:col, stack: '+(ev&&ev.d));
   P.win.fire('error',{message:'Script error.',filename:'https://unpkg.com/three@0.149.0/build/three.min.js',lineno:0,colno:0});
   R=rec(P.store);ev=R.ev.filter(x=>x.type==='error').pop();assert(/three\.min\.js/.test(ev.d)&&/muted cross-origin/.test(ev.d),'muted Script error keeps its source URL: '+ev.d);
   P.win.fire('unhandledrejection',{reason:new Error('boom')});P.win.fire('unhandledrejection',{reason:Object.assign(new Error('x'),{name:'AbortError'})});
   R=rec(P.store);assert.equal(R.ev.filter(x=>x.type==='unhandledrejection').length,1,'rejection recorded, AbortError skipped');
   P.win.fire('error',{target:{tagName:'IMG'},message:''});assert.equal(rec(P.store).ev.filter(x=>x.type==='error').length,2,'resource load errors ignored'); }
 // 3. context loss
 { const P=page(),X=P.X;const cv=P.doc.createElement('canvas');const gl=cv.getContext('webgl2');P.doc.body.appendChild(cv);
   let R=rec(P.store);assert.equal(R.gl.renderer,'Apple GPU');assert.equal(R.gl.maxTex,16384);assert.equal(R.gl.units,16);assert.equal(R.gl.layers,2048);assert.equal(R.gl.v2,true);
   X.begin('TDM ascent');X.stage('map-upload');const lose=gl.getExtension('WEBGL_lose_context');lose.loseContext();
   R=rec(P.store);const ev=R.ev.find(x=>x.type==='webglcontextlost');assert(ev&&/WebGLContextLost: WebGL context lost during map-upload/.test(ev.d),'named WebGLContextLost: '+(ev&&ev.d));
   assert.equal(R.fatal.type,'webglcontextlost');assert(P.errs.some(a=>a[0]&&a[0].name==='WebGLContextLost'),'console.error(WebGLContextLost)');
   assert.equal(P.doc.getElementById('xCtxLost'),null,'no message before restoreMs');P.win.runTimers();
   const box=P.doc.getElementById('xCtxLost');assert(box&&box.style.display==='flex','unrestored loss: message shown');assert(/WebGL context lost/.test(box.children[0].textContent+box.innerHTML),'says what happened');
   const btn=box.all().find(n=>n.tagName==='button');assert.equal(btn.textContent,'Reload');btn.onclick();assert.equal(P.win.reloaded,true,'Reload reloads');
   lose.restoreContext();assert.equal(box.style.display,'none','restored: message hidden');assert(rec(P.store).ev.some(x=>x.type==='webglcontextrestored'));
   lose.loseContext();lose.restoreContext();P.win.runTimers();assert.equal(box.style.display,'none','restored in time: no message'); }
 // 4. shader failures
 { const P=page();const cv=P.doc.createElement('canvas');const gl=cv.getContext('webgl2');P.X.begin('x');
   assert.equal(gl.getProgramParameter({ok:false},0x8B82),false);P.win.console.error('THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false');
   const R=rec(P.store);assert(R.ev.some(x=>x.type==='shader-link'&&/too many samplers/.test(x.d)),'link failure with its info log');assert(R.ev.some(x=>x.type==='shader'&&/Shader Error/.test(x.d)),'three shader error');
   assert.equal(gl.getProgramParameter({ok:true},0x8B82),true); }
 // 5. ws
 { const P=page();P.X.begin('x');P.X.ws(1000,'bye');assert(!rec(P.store).fatal,'1000 is a normal close');P.X.ws(1006,'');const R=rec(P.store);assert.equal(R.fatal.type,'ws-close');assert(/1006/.test(R.fatal.d)); }
 // 6. next load
 { // the page died during the map upload (iOS killed / reloaded the tab): nothing fatal logged
   const S=new Map();const A=page(S);A.X.begin('TDM ascent');A.X.stage('map-upload');
   const B=page(S),n=B.doc.getElementById('xCrNote');assert(n,'note shown on the next load');const txt=n.children[0].textContent;
   assert(/^Last match ended: the page closed or reloaded during map-upload/.test(txt),txt);
   const [copy,close]=n.children.filter(c=>c.tagName==='button');assert.equal(copy.textContent,'Copy');await copy.onclick();assert(/"stage": "map-upload"/.test(B.win.clip),'Copy puts the JSON report on the clipboard');
   close.onclick();assert.equal(B.doc.getElementById('xCrNote'),null,'dismissed');
   const C=page(S);assert.equal(C.doc.getElementById('xCrNote'),null,'shown once: the next load carries the previous page only'); }
 { const S=new Map();const A=page(S);A.X.begin('TDM ascent');const cv=A.doc.createElement('canvas');cv.getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
   const B=page(S);assert(/Last match ended: graphics context lost \(WebGLContextLost\)/.test(B.doc.getElementById('xCrNote').children[0].textContent)); }
 { const S=new Map();const A=page(S);A.X.begin('TDM ascent');A.X.stage('playable');A.lobby.style.display='flex';A.X.poll();assert.equal(rec(S).clean,true,'back on the menu after playing: clean');
   const B=page(S);assert.equal(B.doc.getElementById('xCrNote'),null,'a clean match leaves no note');
   const C0=page(S);C0.X.begin('m');C0.X.stage('map-prepare');C0.lobby.style.display='flex';C0.X.poll();assert.equal(rec(S).inMatch,true,'a load that never became playable is not cleared by the menu'); }
 { const S=new Map();const A=page(S,{clip:false});A.X.begin('m');A.win.fire('error',{message:'Script error.',filename:'',lineno:0,colno:0});const B=page(S,{clip:false});const n=B.doc.getElementById('xCrNote');
   assert(/Last match ended: error: Script error\./.test(n.children[0].textContent));await n.children[1].onclick();assert.equal(n.children[1].textContent,'Copied','copy falls back to execCommand'); }
 console.log('Crash report: installed first, CDN scripts CORS-enabled; errors (message, file:line:col, stack, muted source), rejections, WebGLContextLost (named, message + Reload when unrestored), shader link / compile, ws close codes, load stage and GL limits saved to localStorage; next load shows a dismissible "Last match ended" note with Copy');
})().catch(e=>{console.error(e);process.exit(1);});
