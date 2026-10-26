// Map selection regression (user report 2026-10-25: "it keeps going to Ascent even if I don't choose that").
// The real page (index.html in audit.js's fake DOM, see work/page_harness.cjs) is driven through the lobby's own controls:
// every one of the six maps is chosen on the queue panel's map tiles and launched in every offline map mode through every
// lobby path, and the match must be built on that map (FV.map, the map group MAPS.five points at and the only visible map
// group). Paths:
//   card  - the queue tab's own mode card (Deathmatch / Team Deathmatch / Spike Rush / Escalation / 5v5 vs bots). This was
//           the bug: only the START button applied the map tiles, a card click played the last map (Ascent by default).
//   start - the queue panel's START button with that tab selected (Unrated, Swiftplay, Spike Rush, DM, TDM, Escalation;
//           Escalation ignored the tile even here).
//   pre   - the 5v5 pre-match picker (#xMp), which now also sets the lobby choice.
// Plus: Play again keeps the map; Random draws a map and stays Random; the choice is remembered across a reload
// (localStorage vs.map); a queue pick never leaks into a later start; the online map select mirrors the lobby choice.
// The native-map wrapper (work/native_maps_runtime.js nmWrap, stripped from the audit page) is checked in a vm: the map it
// downloads (nmEnsure key) is the one the start builds, Retake stays Ascent, Random is restored after the draw.
//   node work/test_map_select.cjs            all six maps x every mode x every path
//   QUICK=1 node work/test_map_select.cjs    one path per mode/map pair (each map still in every mode)
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {boot,lsStore}=require('./page_harness.cjs');
const selFix=H=>{const s=H.doc.getElementById('xOnMap');Object.defineProperty(s,'value',{configurable:true,get(){return this._value!=null?this._value:'ascent';},set(v){this._value=String(v);}});};// audit.js's fake DOM reads a <select>'s value from its attribute; give it a real one (the page sets it through .value)
const MAPS=['ascent','bind','haven','split','lotus','breeze'],QUICK=!!process.env.QUICK,VERBOSE=!!process.env.VERBOSE;
const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
// ---- 1. native wrapper (vm) ----
{const src=fs.readFileSync(__dirname+'/native_maps_runtime.js','utf8'),a=src.indexOf('function nmLaunch('),b=src.indexOf('startFive=nmWrap(startFive)',a);assert(a>0&&b>a,'nmLaunch / nmWrap moved');
 const loads=[],c={FV:{pick:'ascent',map:'ascent'},Math,Promise,nmOverlay(){},nmEnsure:k=>{loads.push(k);return Promise.resolve({key:k});}};vm.createContext(c);
 vm.runInContext(src.slice(a,b)+';globalThis.W5=nmWrap(function(){FV.map=FV.pick==="random"?"RANDOM-UNRESOLVED":FV.pick;return FV.map;});globalThis.WR=nmWrap(function(){return "retake";},true);',c);
 (async()=>{for(const m of MAPS){c.FV.pick=m;loads.length=0;const built=await c.W5();if(loads[0]!==m||built!==m||c.FV.map!==m||c.FV.pick!==m)fail(`native wrapper ${m}: downloaded ${loads[0]}, built ${built}, pick ${c.FV.pick}`);}
  const seen=new Set();for(let i=0;i<40;i++){c.FV.pick='random';loads.length=0;const built=await c.W5();if(!MAPS.includes(loads[0])||built!==loads[0])fail(`native wrapper random: downloaded ${loads[0]} built ${built}`);if(c.FV.pick!=='random')fail('native wrapper random: pick not restored ('+c.FV.pick+')');seen.add(built);}
  if(seen.size<4)fail('native wrapper random drew only '+[...seen]);
  c.FV.pick='lotus';loads.length=0;await c.WR();if(loads[0]!=='ascent'||c.FV.pick!=='lotus')fail('native wrapper retake: '+loads[0]+' pick '+c.FV.pick);
  c.FV.pick='random';c.nmEnsure=()=>Promise.reject(new Error('404'));await c.W5().then(()=>fail('failed load resolved'),()=>{});if(c.FV.pick!=='random')fail('failed random load left pick '+c.FV.pick);
 })().then(page).catch(e=>{console.error(e);process.exit(1);});}
// ---- 2. the page ----
async function page(){
 const t0=Date.now(),H=boot({real3:true,seed:3}),xe=H.xe;selFix(H);const errs0=H.errors.length,x0=H.xErrCalls.length;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 const q=sel=>H.doc.querySelector(sel);
 const tab=t=>q('#xQueue .x-qtabs [data-q="'+t+'"]').click(),tile=m=>q('#xQueue .x-qmap[data-map="'+m+'"]').click();
 // which map the running match is on: FV.map, the map group MAPS.five points at, and the only visible map group
 const onMap=()=>xe('(()=>{const vis=Object.keys(FMAP).filter(k=>FMAP[k].g&&FMAP[k].g.visible);return JSON.stringify({map:FV.map,five:Object.keys(FMAP).find(k=>FMAP[k]===MAPS.five)||null,vis,mode,pick:FV.pick,qp:window.xQPick==null?null:window.xQPick});})()');
 const toLobby=async()=>{if(H.shown('result'))H.$('lobbyBtn').click();else{H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);try{H.$('xHome').click();}catch(e){}}await adv(1500);};
 const check=(what,want,o)=>{if(o.map!==want||o.five!==want||o.vis.length!==1||o.vis[0]!==want||o.mode!=='five')fail(`${what}: wanted ${want}, got ${JSON.stringify(o)}`);if(o.qp!=null)fail(`${what}: queue pick left behind (${o.qp})`);};
 const launch=async(what,want,go)=>{await go();await adv(50);if(!(await through())){fail(what+': did not start');await toLobby();return null;}const o=JSON.parse(onMap());check(what,want,o);return o;};
 const CARD={dm:'dmBtn',tdm:'tdmBtn',sr:'srBtn',esc:'escBtn',unrated:'pm5v5'},START=['unrated','swift','sr','dm','tdm','esc'];
 const runs=[];for(const [mi,m] of MAPS.entries()){
  for(const [i,t] of Object.keys(CARD).entries())if(!QUICK||(i+mi)%2===0)runs.push(['card '+t,m,async()=>{tab(t);tile(m);H.$(CARD[t]).click();}]);
  for(const [i,t] of START.entries())if(!QUICK||(i+mi)%2===1||t==='swift')runs.push(['start '+t,m,async()=>{tab(t);tile(m);H.$('xqPlay').click();}]);
  // pre-match picker: the lobby tile says something else; the picker wins and becomes the lobby choice
  if(!QUICK||mi%2===0)runs.push(['pre-match picker',m,async()=>{tile(MAPS[(mi+3)%6]);H.$('pm5v5').click();await adv(50);q('#xMp button[data-m="'+m+'"]').click();if(xe('window.xQMap')!==m)fail('pre-match picker '+m+': lobby choice not updated ('+xe('window.xQMap')+')');}]);}
 let n=0;for(const [what,m,go] of runs){n++;H.setPhase(what+' '+m);await launch(what+' '+m,m,go);await toLobby();}
 // Play again keeps the map (DM card on Haven, then the results screen's Play again)
 H.setPhase('play again');tab('dm');tile('haven');await launch('play again first','haven',async()=>H.$('dmBtn').click());xe('timeLeft=Math.min(timeLeft,0.05);true');
 for(let t=0;t<20000&&!H.shown('result');t+=100)await adv(100);if(!H.shown('result'))fail('play again: no results screen');else{tile('split');await launch('play again','haven',async()=>H.$('againBtn').click());}await toLobby();
 // Random: stays Random (5v5 via the pre-match picker); legacy start draws a map and FV.pick keeps the draw (the native
 // wrapper, checked above, restores Random); a concrete map always
 H.setPhase('random');H.$('pm5v5').click();await adv(50);q('#xMp button[data-m="random"]').click();if(xe('window.xQMap')!=='random')fail('random: lobby choice '+xe('window.xQMap'));
 if(xe('[...document.querySelectorAll("#xQueue .x-qmap")].some(b=>b.classList.contains("selected"))'))fail('random: a map tile still looks selected');
 H.$('preGo').click();await adv(50);if(!(await through()))fail('random: did not start');else{const o=JSON.parse(onMap());if(!MAPS.includes(o.map)||o.five!==o.map)fail('random: '+JSON.stringify(o));}await toLobby();
 // The online map select mirrors the lobby choice outside a room and sets it
 H.setPhase('online select');tile('lotus');if(xe('FV.pick')!=='lotus')fail('a tile click alone did not set the pick (FV.pick '+xe('FV.pick')+')');tab('unrated');H.$('xqPlay').click();await adv(50);if(!/Lotus/.test(H.$('preMt').textContent)||H.$('preMh').textContent!=='LOTUS')fail('pre-match screen after the Lotus tile: '+H.$('preMh').textContent+' / '+H.$('preMt').textContent);H.$('preCancel').click();await adv(100);if(H.$('xOnMap').value!=='lotus')fail('online select shows '+H.$('xOnMap').value+' after the Lotus tile');
 H.$('xOnMap').value='bind';H.dispatch(H.$('xOnMap'),H.mkEvent('change',{}));if(xe('window.xQMap')!=='bind'||q('#xQueue .x-qmap[data-map="bind"]').getAttribute('aria-pressed')!=='true')fail('online select did not set the lobby choice: '+xe('window.xQMap'));
 if(!H.$('xOnMap').closest||H.$('xOnMap').closest('#xOnRoom'))fail('online map select is still inside the hidden room panel');
 // Remembered on this device
 if(H.win.__ls.getItem('vs.map')!=='bind')fail('lobby choice not saved: '+H.win.__ls.getItem('vs.map'));
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions: '+JSON.stringify({errors:errors.slice(0,4),xerr:xerr.slice(0,4)}).slice(0,1500));
 H.setPhase('reload');const H2=boot({real3:true,seed:4,ls:lsStore([['vs.map','breeze']])}),x2=H2.xe;selFix(H2);
 if(x2('FV.pick')!=='breeze')fail('reload: FV.pick '+x2('FV.pick'));if(x2('window.xQMap')!=='breeze'||H2.doc.querySelector('#xQueue .x-qmap[data-map="breeze"]').getAttribute('aria-pressed')!=='true'||H2.$('xOnMap').value!=='breeze')fail('reload: saved choice not restored ('+x2('window.xQMap')+', select '+H2.$('xOnMap').value+')');
 H2.$('dmBtn').click();for(let t=0;t<20000&&!(x2('running')&&!x2('!!window.xLdOn'));t+=100){H2.advance(100);await new Promise(r=>setImmediate(r));}if(x2('FV.map')!=='breeze')fail('reload: DM card played '+x2('FV.map'));
 if(fails.length){console.error(fails.slice(0,30).join('\n'));process.exit(1);}
 console.log(`Map selection: ${n} launches (${QUICK?'one path per mode/map':'every path'}): all six maps in Deathmatch, TDM, Spike Rush, Escalation, 5v5 Unrated and Swiftplay from the queue mode cards and START, and the 5v5 pre-match picker build the chosen map; Play again keeps it; Random draws a map; no queue pick leaks; the online map select mirrors and sets the lobby choice, saved across a reload; native wrapper loads the built map, Retake stays Ascent, Random restored (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);}
