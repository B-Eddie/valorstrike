// Headless offline-client soak: the real page (index.html in audit.js's fake DOM, real three.js scene graph with only
// the WebGL renderer stubbed; see work/page_harness.cjs) plays every offline-only mode from the lobby's own buttons with
// seeded random player input (real keydown / keyup / mousedown / mouseup / mousemove events on the window and canvas,
// through the page's own rAF loop), then reaches the mode's end (results) or leaves through the pause menu.
// Checked every 0.5 s: no page exception or xErr, no NaN / Infinity in player, camera, bots, allies, duel bot, surf
// body; player and bots stay inside the map (collision boxes + margin); round / score / timer progression; the mode end
// is reachable; no runaway arrays (every top-level array / Map / Set in the page and one level into its state objects:
// effects, decals, corpses, floor guns, tracers ...), scene children, timers, rAF callbacks, window listeners; bounded heap.
//   node work/test_client_offline_soak.cjs                    fast variant (in test_all)
//   QA_LONG=1 [SEED=n] [SECS=180] node work/test_client_offline_soak.cjs   long soak, a tool
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),v8=require('v8'),vm=require('vm');
const {boot,mulberry}=require('./page_harness.cjs');
const LONG=!!process.env.QA_LONG,SEED=+(process.env.SEED||1),SECS=+(process.env.SECS||(LONG?180:14)),VERBOSE=!!process.env.VERBOSE;
v8.setFlagsFromString('--expose_gc');const gc=vm.runInNewContext('gc');
const H=boot({real3:true,seed:SEED}),adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}},xe=H.xe,rnd=mulberry(SEED*31+7);
const errs0=H.errors.length,x0=H.xErrCalls.length;
// Every top-level array / Map / Set / plain object the page declares (column-0 declarations), for the runaway scan.
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const NAMES=[...new Set([...html.matchAll(/^(?:let|const|var) ([A-Za-z_$][\w$]*) = (?:\[|\{|new (?:Map|Set)\b)/gm)].map(m=>m[1]))];
xe(`window.__qaNames=${JSON.stringify(NAMES)};window.__qaSizes=function(){const o={};for(const n of __qaNames){let v;try{v=eval(n);}catch(e){continue;}
 const sz=x=>Array.isArray(x)?x.length:x instanceof Map||x instanceof Set?x.size:-1;const s=sz(v);if(s>=0){o[n]=s;continue;}
 if(v&&typeof v==="object"&&!v.isObject3D&&!v.isMaterial&&!v.nodeType){let k=0;for(const key in v){if(++k>200)break;let w;try{w=v[key];}catch(e){continue;}const t=sz(w);if(t>=0)o[n+"."+key]=t;}}}
 let sc=0;try{scene.traverse(()=>sc++);}catch(e){}o["scene.children"]=scene.children.length;o["scene.descendants"]=sc;return o;};true`);
const winListeners=()=>{const m=H.listeners.get(H.win)||{},d=H.listeners.get(H.doc)||{};let n=0;for(const k in m)n+=m[k].length;for(const k in d)n+=d[k].length;return n;};
const sizes=()=>Object.assign(xe('__qaSizes()'),{'harness.timers':H.timers.size,'harness.raf':H.rafLen(),'harness.listeners':winListeners()});
// Per-mode probes. prog: a number that must move while the mode is played; end: forces the last round / time-up when
// random play has not finished the mode inside the soak (the forced path still runs the page's own end flow).
const MODES0=[
 {n:'duel',btn:'duelBtn',prog:'du.you+du.them+du.t',end:'du.you=Math.max(du.you,DUEL_WIN-1);duelKill(true," QA")',results:true},
 {n:'aim',btn:'aimBtn',prog:'AM.sh+AM.k+(60-AM.t)',end:'AM.t=Math.min(AM.t,0.5)',results:true},
 {n:'rifle',btn:'rifleBtn',prog:'RF.you+RF.them+(100-timeLeft)',end:'if(picking)rGo(RF.w||"Vandal");if(!running)return false;RF.you=RIFLE_WIN-1;RF.them=Math.min(RF.them,RIFLE_WIN-1);rEnd(true,"QA")',results:true},
 {n:'surf boreas',btn:'surfBtn',prog:'sv.t+sv.cp+sv.p.x+sv.p.y+sv.p.z',surf:true},
 {n:'surf utopia',btn:'utoBtn',prog:'sv.t+sv.cp+sv.p.x+sv.p.y+sv.p.z',surf:true},
 {n:'retake',btn:'goBtn',prog:'score.you+score.bots+(45-timeLeft)',end:'score.you=Math.max(score.you,3);if(running)end(true,"QA")',results:true,again:true},
 {n:'deathmatch',btn:'dmBtn',map:'ascent',prog:'stats.k+stats.d+(600-timeLeft)',end:'timeLeft=Math.min(timeLeft,0.05)',results:true},
 {n:'escalation',btn:'escBtn',map:'bind',prog:'stats.k+stats.d+(600-timeLeft)',end:'timeLeft=Math.min(timeLeft,0.05)',results:true},
];
const MODES=process.env.ONLY?MODES0.filter(m=>m.n.startsWith(process.env.ONLY)):MODES0;
const CHECK=`(()=>{const f=Number.isFinite,bad=[];const P=typeof player!=="undefined"?player:null;
 if(P)for(const k of ["x","y","z","hp","vy"])if(P[k]!==undefined&&!f(P[k]))bad.push("player."+k+"="+P[k]);
 if(!f(yaw)||!f(pitch))bad.push("yaw/pitch "+yaw+","+pitch);const c=camera.position;if(![c.x,c.y,c.z].every(f))bad.push("camera "+[c.x,c.y,c.z]);
 const U=[].concat(bots||[],allies||[],duelBot?[duelBot]:[]),pos=[];for(const u of U){if(!u||!u.g)continue;const p=u.g.position;if(![p.x,p.y,p.z].every(f))bad.push((u.name||"unit")+" pos "+[p.x,p.y,p.z]);else if(u.alive!==false&&u.g.parent)pos.push([u.name,p.x,p.y,p.z]);}
 if(mode==="surf"&&![sv.p.x,sv.p.y,sv.p.z,sv.v.x,sv.v.y,sv.v.z].every(f))bad.push("surf "+[sv.p.x,sv.p.y,sv.p.z]);
 if(typeof timeLeft==="number"&&!f(timeLeft))bad.push("timeLeft="+timeLeft);
 let bx=null;try{const B=__nav.getB();if(B&&B.length){bx=[Infinity,-Infinity,Infinity,-Infinity];for(const b of B){bx[0]=Math.min(bx[0],b.x1);bx[1]=Math.max(bx[1],b.x2);bx[2]=Math.min(bx[2],b.z1);bx[3]=Math.max(bx[3],b.z2);}}}catch(e){}
 const res=(typeof xResUp==="function"&&xResUp())||document.getElementById("result").style.display==="flex"||document.getElementById("result").style.display==="block";
 return {bad,mode,running,paused,ld:!!window.xLdOn,res,P:P&&[P.x,P.y||0,P.z,P.hp],pos,bx,surfY:mode==="surf"?sv.p.y:null};})()`;
// Caches with their own cap (checked in the page source): XLOS clears itself past 800 entries.
const BOUNDED=new Set(['XLOS']);
const KEYS_MOVE=['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ControlLeft'],TAPS=['Space','Digit1','Digit2','Digit3','Digit4','KeyR','KeyC','KeyQ','KeyE','KeyX','KeyF','KeyG','KeyV','Tab','KeyB'];
const held=new Set();let tap=null,mouseDown=false;
const releaseAll=()=>{for(const k of held)H.key(k,false);held.clear();if(tap){H.key(tap,false);tap=null;}if(mouseDown){H.mouse(0,false);mouseDown=false;}};
const randomInput=()=>{
 if(tap){H.key(tap,false);tap=null;}
 for(const k of KEYS_MOVE)if(rnd()<(k.startsWith('Key')?.18:.04)){if(held.has(k)){held.delete(k);H.key(k,false);}else{held.add(k);H.key(k,true);}}
 H.look(Math.round((rnd()-.5)*160),Math.round((rnd()-.5)*30));
 if(rnd()<.18){if(mouseDown){H.mouse(0,false);mouseDown=false;}else{H.mouse(0,true);mouseDown=true;}}
 if(rnd()<.03){H.mouse(2,true);H.mouse(2,false);}
 if(rnd()<.12){tap=TAPS[Math.floor(rnd()*TAPS.length)];H.key(tap,true);}
 // an open buy / DM menu or the scoreboard would swallow the random input: close it again soon
 if(rnd()<.3)xe('try{if(FV.menu)buyMenu(false);if(typeof DM!=="undefined"&&DM.menu)dmMenu(false);}catch(e){}true');
};
// Through pre-match / agent select exactly as a player would (GO, pick a random agent, lock in).
const through=async()=>{for(let t=0;t<16000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre')){H.$('preGo').click();}else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[Math.floor(rnd()*tiles.length)].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const toLobby=async()=>{if(H.shown('result')||xe('xResUp()')){H.$('lobbyBtn').click();await adv(100);}};
const fails=[],report={};const fail=(m,s)=>{fails.push(m+': '+s);};
const tStart=Date.now();
(async()=>{
 // DM / TDM / Escalation spawn candidates on every legacy blockout map lie inside that map (they were Ascent's callouts
 // on every map: dmPts() looked for the nav graph's nodes under the wrong key).
 if(!process.env.ONLY)for(const m of ['ascent','bind','haven','split','lotus','breeze']){H.setPhase('dm spawns '+m);xe(`FV.pick=${JSON.stringify(m)};window.xQPick=null;true`);H.$('dmBtn').click();await adv(50);await through();
  const r=xe(`(()=>{const P=dmPts(),B=__nav.getB();let bx=[1e9,-1e9,1e9,-1e9];for(const b of B){bx[0]=Math.min(bx[0],b.x1);bx[1]=Math.max(bx[1],b.x2);bx[2]=Math.min(bx[2],b.z1);bx[3]=Math.max(bx[3],b.z2);}
   return {map:FV.map,n:P.length,out:P.filter(p=>p[0]<bx[0]||p[0]>bx[1]||p[1]<bx[2]||p[1]>bx[3]).map(p=>p.map(v=>+v.toFixed(1))),dup:P.length-new Set(P.map(p=>p.join())).size};})()`);
  if(r.map!==m||r.n<8||r.out.length)fail('DM spawns '+m,JSON.stringify(r));
  H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();await adv(200);}
 for(const M of MODES){
 H.setPhase('offline '+M.n);const tm=Date.now();await toLobby();releaseAll();
 if(M.map)xe(`FV.pick=${JSON.stringify(M.map)};window.xQPick=null;true`);
 H.$(M.btn).click();await adv(50);if(!(await through())){fail(M.n,'did not start (running '+xe('running')+' ld '+xe('!!window.xLdOn')+')');continue;}
 const s0=sizes(),seen={},maxS={},prog0=xe(M.prog);let progMoved=false,mid=null,series=[],bad=0,outside=0,rounds=0,lastProg=prog0;const out=[];
 for(let t=0;t<SECS*1000;t+=100){
  randomInput();await adv(100);
  if(M.again&&H.shown('result')&&!xe('matchOver')){H.$('againBtn').click();await adv(50);rounds++;}
  if(t%500!==400)continue;
  const c=xe(CHECK);if(process.env.TRACE)console.log(t,JSON.stringify({run:c.running,pz:c.paused,ld:c.ld,res:c.res}),xe(M.prog),xe("JSON.stringify({covs:xCovEl.filter(e=>e.style.display===\"flex\").map(e=>e.id),lob0:xLob0,pl:!!document.pointerLockElement,cov:xCov(),xs:xSetFull(),m:FV.menu})"));if(c.bad.length&&bad++<3)fail(M.n,'non-finite at '+(t/1000)+'s: '+c.bad.join('; '));
  if(c.bx&&!M.surf){const [x0,x1,z0,z1]=c.bx,m=6,inside=(x,z,y)=>x>=x0-m&&x<=x1+m&&z>=z0-m&&z<=z1+m&&y>-20&&y<80;
   if(c.P&&c.P[3]>0&&!inside(c.P[0],c.P[2],c.P[1])&&outside++<3)fail(M.n,'player off map at '+(t/1000)+'s: '+c.P.map(v=>+v.toFixed(2)));
   for(const [n,x,y,z] of c.pos)if(!inside(x,z,y)&&outside++<3)fail(M.n,n+' off map at '+(t/1000)+'s: '+[x,y,z].map(v=>+v.toFixed(2)));}
  if(M.surf&&!(c.surfY>-500))fail(M.n,'surf body fell forever y='+c.surfY);
  const p=xe(M.prog);if(Number.isFinite(p)&&p!==lastProg){progMoved=true;lastProg=p;}
  if(c.res&&!M.again){if(VERBOSE)console.log(M.n,"ended on its own at",t/1000,JSON.stringify(c),xe(M.prog));break;}// the mode finished on its own
  const s=sizes();if(t%2000===1900)series.push(s);for(const k in s)maxS[k]=Math.max(maxS[k]||0,s[k]);if(!mid&&t>=SECS*500)mid=s;}
 releaseAll();if(!progMoved)fail(M.n,'no progression ('+M.prog+' stayed '+prog0+')');
 const sEnd=sizes();
 // runaway: grew steadily over the second half and is large, or absurdly large anywhere
 // (a bounded cache that clears itself, like XLOS at 800, dips in the second half and is not flagged)
 for(const k in sEnd){if(BOUNDED.has(k))continue;const a=mid?mid[k]||0:s0[k]||0,b=sEnd[k],ser=series.map(s=>s[k]||0),dips=ser.slice(Math.floor(ser.length/2)).some((v,i,A)=>i&&v<A[i-1]);if((b>2*a+64&&b>150&&!dips)||maxS[k]>5000)fail(M.n,'runaway '+k+': start '+(s0[k]||0)+' mid '+a+' end '+b+' max '+maxS[k]);}
 // mode end: reach the results (forcing the last round / time-up when random play did not get there) or leave by the pause menu
 let ended=false;
 if(M.results){// (between rounds, e.g. Rifle's 2.2 s banner, the round end is a no-op: retry until it takes)
  let forced=false;for(let t=0;t<25000&&!(ended=xe(CHECK).res);t+=100){if(!forced)forced=xe(`(()=>{try{${M.end}}catch(e){window.__qaEndErr=String(e);}return true;})()`)!==false;await adv(100);}
  if(!ended)fail(M.n,'mode end not reached ('+xe('JSON.stringify({picking,RF:[RF.you,RF.them],ban:document.getElementById("xBan").style.display,mode,pz:paused})')+' running '+xe('running')+' err '+xe('window.__qaEndErr||""')+')');
  else{await adv(500);if(xe('running'))fail(M.n,'still running behind the results');H.$('lobbyBtn').click();await adv(200);}}
 else{H.key('Escape',false);H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);if(!xe('paused'))fail(M.n,'Esc did not pause');H.$('xHome').click();await adv(200);ended=true;}
 if(H.$('lobby').style.display!=='flex'||xe('running'))fail(M.n,'not back in the lobby (lobby '+H.$('lobby').style.display+' running '+xe('running')+')');
 await adv(3000);if(xe('running'))fail(M.n,'mode restarted itself after leaving');
 gc();report[M.n]={ms:Date.now()-tm,prog:[prog0,lastProg].map(v=>+(+v).toFixed(1)),rounds,heapMB:+(process.memoryUsage().heapUsed/1048576).toFixed(1),scene:sEnd['scene.descendants'],timers:sEnd['harness.timers']};
}
const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);
if(VERBOSE||fails.length||errors.length||xerr.length)console.log(JSON.stringify(report));
if(errors.length||xerr.length)fails.push('page exceptions: '+JSON.stringify({errors:errors.slice(0,6),xerr:xerr.slice(0,6)}));
const heaps=Object.values(report).map(r=>r.heapMB);if(heaps.length>2&&heaps.at(-1)>heaps[0]+300)fails.push('heap grew '+heaps[0]+' -> '+heaps.at(-1)+' MB');
if(fails.length){console.error(fails.slice(0,30).join('\n'));process.exit(1);}
console.log(`Offline client soak (three r${H.three}, seed ${SEED}, ${SECS} s/mode, DM spawn points inside all 6 legacy maps, ${((Date.now()-tStart)/1000).toFixed(0)} s): ${MODES.map(m=>m.n).join(', ')} from the lobby buttons with random input; no exceptions, no NaN, units on the map, progression, mode end/leave reached, no runaway arrays/scene/timers/listeners, heap ${heaps[0]} -> ${heaps.at(-1)} MB`);
process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
