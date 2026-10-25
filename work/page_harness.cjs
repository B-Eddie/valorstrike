// Boots the real page (index.html) in audit.js's fake DOM + fake timers, as test_client_online.cjs does, for offline
// soaks. real3: the real three.js scene graph (only the WebGL renderer stubbed) so object positions, scene children and
// geometries / materials / textures are real. Uses work/qa's three r149 (REAL3_DIR) when present, else the repo's own
// three (server/node_modules/three, r160) behind a tiny GLTFLoader / SkeletonUtils shim (no asset downloads offline).
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function threeDir(){
 const own=process.env.REAL3_DIR||'/workspace/work/qa';if(!process.env.QA_THREE160&&['three.min.js','GLTFLoader.js','SkeletonUtils.js'].every(f=>fs.existsSync(path.join(own,f))))return {dir:own,rev:'149'};
 const dir=path.join(os.tmpdir(),'vs-three160');fs.mkdirSync(dir,{recursive:true});
 const cjs=fs.readFileSync(path.join(__dirname,'..','server','node_modules','three','build','three.cjs'),'utf8');
 fs.writeFileSync(path.join(dir,'three.min.js'),'(function(){var exports={};'+cjs+'\n;globalThis.THREE=exports;})();');
 fs.writeFileSync(path.join(dir,'GLTFLoader.js'),'THREE.GLTFLoader=function(){this.setMeshoptDecoder=this.setDRACOLoader=this.setKTX2Loader=function(){return this;};this.load=function(u,ok,p,err){setTimeout(function(){err&&err(new Error("no loader offline"));},0);};this.parse=function(d,p,ok,err){err&&err(new Error("no loader offline"));};this.loadAsync=function(){return Promise.reject(new Error("no loader offline"));};};');
 fs.writeFileSync(path.join(dir,'SkeletonUtils.js'),'THREE.SkeletonUtils={clone:function(o){return o.clone(true);}};');
 return {dir,rev:'160'};
}
function boot({real3=false,seed=1,ls=null}={}){
 const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),src=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
 const T=real3?threeDir():null,env={...process.env,REAL3:real3?'1':'',REAL3_DIR:T?T.dir:''};if(!real3)delete env.REAL3;
 const proc=Object.create(process,{env:{value:env},argv:{value:[process.argv[0],'audit']}});
 // ls: a localStorage store present while the page's scripts load (a reload: settings saved by an earlier session are
 // read at startup). Without it localStorage throws during the boot, as in the audit, and is set up empty afterwards.
 const LSD='Object.defineProperty(win, "localStorage"';if(ls&&!src.includes(LSD))throw Error('page_harness: audit.js localStorage hook moved');
 const log=console.log;console.log=()=>{};
 let H;try{H=new Function('require','__dirname','process','module','__qaLS',(ls?src.replace(LSD,'win.__ls=__qaLS;'+LSD):src)+'\nreturn {win,doc,context,errors,xErrCalls,advance,frame,timers,listeners,rafLen:()=>rafQ.length,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,proc,module,ls);}finally{console.log=log;}
 H.three=T&&T.rev;H.xe=code=>vm.runInContext('__xe',H.context)(code);
 vm.runInContext(`Math.random=(${mulberry})(${seed*7919+3});`,H.context);
 H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 // three r149's FileLoader builds a Request before fetching. It must exist, and it must resolve the page's relative URLs
 // ('models/valorant/...') against a base as a browser does: Node's Request threw "Failed to parse URL" after the loader
 // had registered the URL as in flight, so every later load of that URL (xvLoad 'environment/cover' on each map build)
 // queued behind a request that never settled, and each queued callback kept its old map group alive (a harness-only
 // leak; in a browser the fetch settles and xvLoad's cache entry resolves or is dropped on failure).
 const BASE='http://localhost/';class PageRequest extends Request{constructor(u,o){super(typeof u==='string'||u instanceof URL?new URL(String(u),BASE).href:u,o);}}
 Object.assign(H.win,{Request:PageRequest,Headers,Response});
 if(!ls){H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);}
 // No renderer / network: native maps fall back to the legacy blockout and agent models are skipped (as the audit's
 // fixtures and test_client_online.cjs do).
 H.xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 // getComputedStyle from inline styles (the audit's returns "" for everything, so the page's results-screen flag read
 // "shown" for good and its rAF loop treated the game as covered: no ticks behind a phantom results screen).
 H.win.getComputedStyle=el=>{const st=(el&&el.style)||{},d=st.display||(el&&el.hidden?'none':(el&&el.id==='result'?'none':'block'));return new Proxy({},{get:(t,k)=>k==='display'?d:k==='visibility'?(st.visibility||'visible'):k==='getPropertyValue'?(n=>st[n]||''):(st[k]||'')});};
 H.xe('try{xFlags()}catch(e){}true');
 H.key=(code,down)=>H.dispatch(H.win,H.mkEvent(down?'keydown':'keyup',{code,key:code.replace(/^Key|^Digit/,'').toLowerCase()}));
 H.mouse=(button,down)=>{const cv=H.xe('renderer.domElement');H.dispatch(down?cv:H.win,H.mkEvent(down?'mousedown':'mouseup',{button}));};
 H.look=(mx,my)=>H.dispatch(H.win,H.mkEvent('mousemove',{movementX:mx,movementY:my}));
 H.shown=id=>{const e=H.doc.getElementById(id),d=e&&e.style.display;return !!d&&d!=='none';};
 H.$=id=>H.doc.getElementById(id);
 return H;
}
// a localStorage store for boot({ls}): a Map with the Storage methods the page calls
function lsStore(init){const m=new Map(init||[]);m.getItem=k=>m.has(k)?m.get(k):null;m.setItem=(k,v)=>m.set(k,String(v));m.removeItem=k=>m.delete(k);return m;}
module.exports={boot,mulberry,lsStore};
