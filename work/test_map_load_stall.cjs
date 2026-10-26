// Native map load timeout = 120 s with no progress (a fetch finishing, a glTF asset loading, a prepare phase), 10 min cap.
// Browser-found (smoke_raze1, SwiftShader under load): the old fixed 120 s timer failed an Ascent load that was still
// progressing ('Map loading timed out. Please retry.'). Virtual clock; the glTF loader reports progress by hand.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const s=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),a=s.indexOf('function nmCancel('),b=s.indexOf('// Disconnected decorative',a);assert(a>0&&b>a);
function make(){
  let now=0,seq=0;const T=new Map();
  const setT=(f,ms)=>{const id=++seq;T.set(id,{f,at:now+(ms|0)});return id;},clrT=id=>{T.delete(id);};
  const advance=async ms=>{const end=now+ms;for(;;){let n=null;for(const [id,t] of T)if(t.at<=end&&(!n||t.at<n[1].at))n=[id,t];if(!n)break;T.delete(n[0]);now=n[1].at;n[1].f();await new Promise(r=>setImmediate(r));}now=end;await new Promise(r=>setImmediate(r));};
  const st={progress:null,loads:0};
  const c={NM:{current:null,pending:null,ticket:0,progress:null},Promise,Error,AbortController,window:{},location:{hostname:'127.0.0.1'},console:{error(){}},
    Date:{now:()=>now},setTimeout:setT,clearTimeout:clrT,nmOverlay(){},nmFree(){},
    THREE:{Group:class{},LoadingManager:class{constructor(l,p){st.progress=p;}},GLTFLoader:class{loadAsync(){st.loads++;return new Promise(()=>{});}}},
    nmCollision:()=>Promise.resolve({}),
    fetch:async url=>({ok:true,json:async()=>url.endsWith('navigation.json')?{validation:{attackerToDefender:true,attackerToSites:{A:true}}}:{}})};
  vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.ensure=nmEnsure;'+s.slice(s.indexOf('function nmLoadScene('),s.indexOf('\n',s.indexOf('function nmLoadScene('))),c);
  return {c,st,advance};
}
(async()=>{
  { // still progressing past 120 s: kept; then 120 s of silence: timed out
    const {c,st,advance}=make();let err=null;const p=c.ensure('ascent').catch(e=>{err=e;});
    await advance(10);assert.equal(st.loads,1,'glTF load started');
    await advance(100000);assert.equal(err,null,'100 s in: still loading');
    st.progress('a.bin',1,40);await advance(100000);assert.equal(err,null,'200 s in, progress at 100 s: still loading (old fixed timer failed here)');
    st.progress('b.bin',2,40);await advance(119000);assert.equal(err,null,'119 s after the last progress: still loading');
    await advance(2000);await p;assert(err&&/timed out/.test(err.message),'121 s without progress: timed out ('+(err&&err.message)+')');
  }
  { // progress every 100 s forever: capped at 10 min
    const {c,st,advance}=make();let err=null,t=0;const p=c.ensure('bind').catch(e=>{err=e;});await advance(10);
    for(let i=0;i<5;i++){await advance(100000);st.progress('x',i+1,99);}assert.equal(err,null,'500 s with steady progress: still loading');
    await advance(100000);await p;assert(err&&/timed out/.test(err.message),'10 min cap');
  }
  { // progress of a stale (cancelled) load does not re-arm the new load's timer
    const {c,st,advance}=make();let e1=null,e2=null;c.ensure('bind').catch(e=>{e1=e;});await advance(10);const stale=st.progress;
    const p2=c.ensure('haven').catch(e=>{e2=e;});await advance(10);assert(e1&&/selection changed/.test(e1.message));
    await advance(100000);stale('old',5,9);await advance(21000);await p2;assert(e2&&/timed out/.test(e2.message),'stale progress ignored');
  }
  console.log('Map load: 120 s stall timeout re-armed by fetches / glTF progress / prepare phases, 10 min cap, stale loads cannot extend it');
})().catch(e=>{console.error(e);process.exit(1);});
