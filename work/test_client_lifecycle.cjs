// Client match lifecycle leak check: one page session (real page in audit.js's fake DOM with the real three.js scene
// graph, see work/page_harness.cjs) plays 24 back-to-back matches from the lobby's own buttons: every offline mode
// (duel, rifle 2v2, retake, surf x2, aim, deathmatch, TDM, escalation, 5v5, Spike Rush) across all six maps, a random
// agent at every agent select, leaving through the results screen or mid-match through the pause menu, with random
// player input in between. Each return to the lobby measures: scene objects, live geometries / textures (created and
// not disposed; also the ones that were ever drawn), timers, rAF callbacks, window / document listeners, every page
// array / Map / Set (as the offline soak does) and the JS heap. The second cycle of the same 12 matches must not end
// above the first (small tolerance): anything that grows per match is a leak. No page exception anywhere.
//   node work/test_client_lifecycle.cjs                 fast variant (in test_all), 2 cycles
//   QA_LONG=1 [CYCLES=4] [SEED=n] node work/test_client_lifecycle.cjs   longer play per match, more cycles
const fs=require('fs'),path=require('path'),v8=require('v8'),vm=require('vm');
const {boot,mulberry}=require('./page_harness.cjs');
const LONG=!!process.env.QA_LONG,SEED=+(process.env.SEED||1),CYCLES=+(process.env.CYCLES||(LONG?4:2)),PLAY=LONG?20000:3000,VERBOSE=!!process.env.VERBOSE;
v8.setFlagsFromString('--expose_gc');const gc=vm.runInNewContext('gc');
const H=boot({real3:true,seed:SEED}),xe=H.xe,rnd=mulberry(SEED*131+5);
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const errs0=H.errors.length,x0=H.xErrCalls.length;if(process.env.QA_STACKS)xe('window.__qaStacks=true');
// GPU-resource bookkeeping. geometries / textures: created, not disposed and still reachable (weakly held, counted after
// a GC). orphan geometries / textures: drawn at least once (seen in the rendered scene, sampled every 4th frame through
// renderer.render) but neither disposed nor in the scene any more: WebGLRenderer keeps their GPU buffers until dispose(),
// so these are the GPU leaks renderer.info.memory would show climbing.
xe(`(()=>{const G=new Set(),T=new Set(),DG=new Set(),DT=new Set(),BG=THREE.BufferGeometry.prototype,TX=THREE.Texture.prototype,ST=!!window.__qaStacks;
 const tag=o=>{if(ST&&!o.__st)o.__st=new Error().stack.split("\\n").slice(3,10).map(s=>s.trim().replace(/^at /,"")).join(" < ");};
 const sa=BG.setAttribute;BG.setAttribute=function(){if(!this.__qd&&!this.__qw){this.__qw=1;G.add(new WeakRef(this));tag(this);}return sa.apply(this,arguments);};
 const gd=BG.dispose;BG.dispose=function(){this.__qd=1;DG.delete(this);return gd.apply(this,arguments);};
 const d=Object.getOwnPropertyDescriptor(TX,"needsUpdate");Object.defineProperty(TX,"needsUpdate",{configurable:true,get:d.get,set(v){if(v&&!this.__qd&&!this.__qw){this.__qw=1;T.add(new WeakRef(this));tag(this);}return d.set.call(this,v);}});
 const td=TX.dispose;TX.dispose=function(){this.__qd=1;DT.delete(this);return td.apply(this,arguments);};
 const texOf=(m,f)=>{for(const k in m){const t=m[k];if(t&&t.isTexture)f(t);}};
 let fr=0;const r0=renderer.render;renderer.render=function(s,c){if(++fr%4===0&&s&&s.traverse)s.traverse(o=>{if(o.visible===false)return;if(o.geometry&&!o.geometry.__qd)DG.add(o.geometry);if(o.material)for(const m of [].concat(o.material))texOf(m,t=>{if(!t.__qd)DT.add(t);});});return r0.apply(this,arguments);};
 window.__qaGpu=()=>{const ig=new Set(),it=new Set();scene.traverse(o=>{if(o.geometry)ig.add(o.geometry);if(o.material)for(const m of [].concat(o.material))texOf(m,t=>it.add(t));});
  let gl=0,tl=0;window.__qaLiveG=[];for(const w of G){const g=w.deref();if(!g)G.delete(w);else if(!g.__qd){gl++;__qaLiveG.push(g);}}for(const w of T){const t=w.deref();if(!t)T.delete(w);else if(!t.__qd)tl++;}
  const og=[...DG].filter(g=>!ig.has(g)&&!g.userData.shared),ot=[...DT].filter(t=>!it.has(t)&&!(t.userData&&t.userData.shared));/* xG()'s cached shared geometries are kept on purpose */window.__qaOrphans={og,ot};
  return {"geometries":gl,"textures":tl,"orphan geometries":og.length,"orphan textures":ot.length};};return true;})()`);
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const NAMES=[...new Set([...html.matchAll(/^(?:let|const|var) ([A-Za-z_$][\w$]*) = (?:\[|\{|new (?:Map|Set)\b)/gm)].map(m=>m[1]))];
xe(`window.__qaNames=${JSON.stringify(NAMES)};window.__qaSizes=function(){const o={};for(const n of __qaNames){let v;try{v=eval(n);}catch(e){continue;}
 const sz=x=>Array.isArray(x)?x.length:x instanceof Map||x instanceof Set?x.size:-1;const s=sz(v);if(s>=0){o[n]=s;continue;}
 if(v&&typeof v==="object"&&!v.isObject3D&&!v.isMaterial&&!v.nodeType){let k=0;for(const key in v){if(++k>200)break;let w;try{w=v[key];}catch(e){continue;}const t=sz(w);if(t>=0)o[n+"."+key]=t;}}}
 let sc=0,mesh=0;try{scene.traverse(o=>{sc++;if(o.isMesh)mesh++;});}catch(e){}o["scene.children"]=scene.children.length;o["scene.objects"]=sc;o["scene.meshes"]=mesh;return Object.assign(o,__qaGpu());};true`);
const listenerCount=()=>{let n=0;for(const t of [H.win,H.doc]){const m=H.listeners.get(t)||{};for(const k in m)n+=m[k].length;}return n;};
// Drop the previous measurement's strong lists first: __qaLiveG / __qaOrphans held every geometry alive at the last
// measurement, so gc() could never collect it and each one was counted live again (a self-perpetuating false leak).
const measure=()=>{xe('window.__qaLiveG=null;window.__qaOrphans=null;true');gc();return Object.assign(xe('__qaSizes()'),{'harness.timers':H.timers.size,'harness.raf':H.rafLen(),'window+document listeners':listenerCount(),'heap MB':Math.round(process.memoryUsage().heapUsed/1048576)});};
// how a match ends: forced last round / time-up (the page's own end flow follows) -> results -> Lobby button
const END={duel:'du.you=Math.max(du.you,DUEL_WIN-1);duelKill(true," QA")',aim:'AM.t=Math.min(AM.t,0.5)',
 rifle:'if(picking)rGo(RF.w||"Vandal");if(!running)return false;RF.you=RIFLE_WIN-1;RF.them=Math.min(RF.them,RIFLE_WIN-1);rEnd(true,"QA")',
 retake:'if(!running)return false;score.you=Math.max(score.you,3);end(true,"QA")',dm:'timeLeft=Math.min(timeLeft,0.05)',
 five:'if(!running)return false;FV.you=(FV.sr?(FV.srWin||4):FV.sw?5:FIVE_WIN)-1;FV.them=Math.min(FV.them,FV.you-1);FV.sp.st="carry";fCheck(true,"QA")'};
const CYCLE=[
 ['duel','duelBtn',null,'duel'],['rifle','rifleBtn',null,'rifle'],['retake','goBtn',null,'retake'],['surf boreas','surfBtn',null,null],
 ['aim','aimBtn',null,'aim'],['deathmatch','dmBtn','ascent','dm'],['tdm','tdmBtn','bind','dm'],['escalation','escBtn','haven','dm'],
 ['5v5','pm5v5','split','five'],['spike rush','srBtn','lotus','five'],['surf utopia','utoBtn',null,null],['deathmatch','dmBtn','breeze','dm']];
const held=new Set();let mouseDown=false;
const releaseAll=()=>{for(const k of held)H.key(k,false);held.clear();if(mouseDown){H.mouse(0,false);mouseDown=false;}};
const randomInput=()=>{for(const k of ['KeyW','KeyA','KeyS','KeyD'])if(rnd()<.2){if(held.has(k)){held.delete(k);H.key(k,false);}else{held.add(k);H.key(k,true);}}
 H.look(Math.round((rnd()-.5)*160),Math.round((rnd()-.5)*30));if(rnd()<.2){mouseDown=!mouseDown;H.mouse(0,mouseDown);}
 if(rnd()<.08){const k=['Space','Digit1','Digit2','Digit3','KeyR','KeyC','KeyQ','KeyE','KeyX'][Math.floor(rnd()*9)];H.key(k,true);H.key(k,false);}};
const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[Math.floor(rnd()*tiles.length)].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const res=()=>xe('(typeof xResUp==="function"&&xResUp())')||H.shown('result');
const fails=[],marks=[];const fail=s=>fails.push(s);
(async()=>{
 const t0=Date.now();let n=0;
 for(let c=0;c<CYCLES;c++){for(const [name,btn,map,end] of CYCLE){n++;H.setPhase(`match ${n} ${name}${map?' '+map:''}`);releaseAll();
  // the 5v5 / Spike Rush queue reads the lobby's map pick; the free-for-all modes read FV.pick
  if(map)xe(`FV.pick=${JSON.stringify(map)};window.xQPick=${JSON.stringify(map)};try{mpSet(${JSON.stringify(map)})}catch(e){}true`);
  H.$(btn).click();await adv(50);if(!(await through())){fail(`match ${n} ${name}: did not start (ld ${xe('!!window.xLdOn')} running ${xe('running')})`);await adv(500);if(res())H.$('lobbyBtn').click();continue;}
  if(map&&xe('mode')==='five'&&xe('FV.map')!==map)fail(`match ${n} ${name}: map ${xe('FV.map')} not ${map}`);
  for(let t=0;t<PLAY;t+=100){randomInput();await adv(100);if(res())break;}
  releaseAll();const viaResults=end&&(c+n)%2===0;
  if(viaResults){let forced=false,ok=false;for(let t=0;t<25000&&!(ok=res());t+=100){if(!forced)forced=xe(`(()=>{try{${END[end]}}catch(e){window.__qaEndErr=String(e);}return true;})()`)!==false;await adv(100);}
   if(!ok)fail(`match ${n} ${name}: results not reached (${xe('window.__qaEndErr||""')})`);await adv(300);H.$('lobbyBtn').click();}
  else{if(res()){H.$('lobbyBtn').click();}else{H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();}}
  await adv(3000);if(H.$('lobby').style.display!=='flex'||xe('running'))fail(`match ${n} ${name}: not back in the lobby`);
  // Lotus's breakable wall once stayed in the gun raycast's extra hitbox list after leaving Lotus (phantom wall on later maps,
  // and the list kept the freed map alive): outside a Lotus match nothing parented may remain live in it.
  if(xe('xLdh().filter(m=>m.parent).length'))fail(`match ${n} ${name}: gun raycast still lists ${xe('xLdh().filter(m=>m.parent).length')} map hitbox(es) in the lobby`);
  if(process.env.QA_STACKS&&n===CYCLE.length)xe('__qaGpu();for(const g of __qaLiveG)g.__c1=1;true');
  marks.push({n,name,map,cycle:c,via:viaResults?'results':'pause',m:measure()});}}
 if(process.env.QA_STACKS){// debug: where the orphans and the still-live geometries made in the last cycle come from
  const grp=expr=>{const by={};for(const st of xe(expr))by[st]=(by[st]||0)+1;return Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>v+' '+k.slice(0,500)).join('\n');};
  xe('__qaGpu()');console.log('ORPHAN GEOMETRIES\n'+grp('__qaOrphans.og.map(g=>g.__st||"?")'));console.log('ORPHAN TEXTURES\n'+grp('__qaOrphans.ot.map(g=>g.__st||"?")'));
  console.log('LIVE GEOMETRIES made after cycle 1\n'+grp('__qaLiveG.filter(g=>!g.__c1).map(g=>g.__st||"?")'));}
 // leak verdict: last cycle's end vs first cycle's end (same 12 matches in between)
 const a=marks[CYCLE.length-1].m,b=marks.at(-1).m,grow=[];
 for(const k in b){if(k==='XLOS')continue;/* clears itself past 800 entries */const x=a[k]||0,y=b[k],tol=k==='heap MB'?40:Math.max(4,Math.ceil(x*.03));if(y>x+tol)grow.push(`${k}: ${x} -> ${y}`);}
 if(grow.length)fail('grew between cycles (per-match leak): '+grow.join('; '));
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions: '+JSON.stringify({errors:errors.slice(0,6),xerr:xerr.slice(0,6)}));
 const keys=['scene.objects','geometries','orphan geometries','textures','orphan textures','harness.timers','window+document listeners','heap MB'];
 if(VERBOSE||fails.length)for(const m of marks)console.log(String(m.n).padStart(2),(m.name+(m.map?' '+m.map:'')).padEnd(22),m.via.padEnd(7),keys.map(k=>k.replace('scene.','').replace('orphan ','o.').replace('geometries','geo').replace('textures','tex').split(' ')[0]+'='+m.m[k]).join(' '));
 if(fails.length){console.error(fails.slice(0,20).join('\n'));process.exit(1);}
 console.log(`Client lifecycle (three r${H.three}, seed ${SEED}): ${n} back-to-back matches in one page session (every offline mode, all six maps, random agents, results or pause-menu exits); scene ${a['scene.objects']} -> ${b['scene.objects']}, geometries ${a.geometries} -> ${b.geometries} (orphaned on the GPU ${a['orphan geometries']} -> ${b['orphan geometries']}), textures ${a.textures} -> ${b.textures} (orphaned ${a['orphan textures']} -> ${b['orphan textures']}), timers ${a['harness.timers']} -> ${b['harness.timers']}, listeners ${a['window+document listeners']} -> ${b['window+document listeners']}, heap ${a['heap MB']} -> ${b['heap MB']} MB; nothing grows per match, no exceptions (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
