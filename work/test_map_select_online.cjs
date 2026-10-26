// Online map selection: the real page (audit.js fake DOM) talks to the real game server (server/src/worker.js in-process
// via server/tools/local-cluster.mjs, as test_client_online.cjs does). For every online mode (Deathmatch, Team Deathmatch,
// Unrated Spike) and each of the six maps, the map is chosen in the lobby (alternately the Online map select and the queue
// map tiles), the room is created with the page's own Create private / Quick Match buttons, and both the server room
// (sim.map, the world it loaded) and the page's built match (FV.map) must be that map. Also: joining a friend's room by
// code plays the room's map even when the lobby choice (and a queue pick left over from an unstarted START) says another;
// a rejoin after a dropped socket rebuilds the room's map; in a room the select shows the room's map and is locked; after
// leaving it shows the lobby choice again, which the next Create uses.
//   node work/test_map_select_online.cjs        6 maps x 3 modes
//   QUICK=1 node work/test_map_select_online.cjs   each map once, modes rotating
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const selFix=H=>{const s=H.doc.getElementById('xOnMap');Object.defineProperty(s,'value',{configurable:true,get(){return this._value!=null?this._value:'ascent';},set(v){this._value=String(v);}});};// audit.js's fake DOM reads a <select>'s value from its attribute; give it a real one (the page sets it through .value)
const MAPS=['ascent','bind','haven','split','lotus','breeze'],MODES=['dm','tdm','five'],QUICK=!!process.env.QUICK,VERBOSE=!!process.env.VERBOSE;
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(11);const H=boot({real3:true,seed:23});selFix(H);
(async()=>{
 const t0=Date.now(),xe=H.xe,$=id=>H.doc.getElementById(id);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});
 const sockets=[],codes=new Set();let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 const urls=[];class WS{constructor(url){urls.push(url);const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;
 // Quick Match lists rooms over HTTP: answer from the cluster's own directory view of its rooms
 H.win.fetch=function(u){u=String(u);if(/\/rooms$/.test(u)){const rooms=[...codes].map(c=>cluster.room(c)).filter(r=>r&&r.sim&&r.public&&['room','game'].includes(r.sim.phase)).map(r=>{const x=r.room();return {code:x.code,map:x.map,mode:x.mode,players:x.pl.length,state:x.st};});return Promise.resolve({ok:true,json:async()=>({rooms})});}return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 xe('window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return;await step(50);}throw Error('timed out: '+what+' (MP.st '+xe('MP.st')+' msg '+xe('MP.msg')+' errors '+JSON.stringify(H.errors.slice(errs0,errs0+3))+')');};
 // scripted friends: a bare socket that says hi and otherwise idles (no piloting needed to check maps)
 const humans=[];const raw=q=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={socket:s,send:m=>s.send(JSON.stringify(m)),leave(){try{s.send(JSON.stringify({t:'bye'}));s.close();}catch(e){}}};s.on('message',()=>{});s.on('open',()=>{done();h.send({t:'hi',n:q.name,ag:q.agent});});s.on('error',done);humans.push(h);return h;};
 const join=(code,name,agent)=>raw({code,name,agent});
 const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
 const tile=m=>H.doc.querySelector('#xQueue .x-qmap[data-map="'+m+'"]').click();
 const pickSelect=m=>{const s=$('xOnMap');if(s.disabled)fail('online map select disabled outside a room');s.value=m;H.dispatch(s,H.mkEvent('change',{}));};
 const mode=m=>H.doc.querySelector('#xOn [data-om="'+m+'"]').click();
 const leave=async()=>{for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('try{mpLeave&&mpLeave("Left the room")}catch(e){}try{mpReset()}catch(e){}true');await step(300);xe('try{toLobby()}catch(e){}true');await step(200);};
 const page=()=>JSON.parse(xe('JSON.stringify({map:FV.map,five:Object.keys(FMAP).find(k=>FMAP[k]===MAPS.five)||null,vis:Object.keys(FMAP).filter(k=>FMAP[k].g&&FMAP[k].g.visible),st:MP.st,ready:NET.ready})'));
 // start the room's match from the page (Start is the host's button) with one scripted friend, and check both sides
 const play=async(what,want,code,hostPage=true)=>{const room=cluster.room(code);if(!room||!room.sim){fail(what+': no server room '+code);return;}
  if(room.sim.map!==want)fail(`${what}: server room ${code} is ${room.sim.map}, wanted ${want}`);
  if($('xOnMap').value!==want||!$('xOnMap').disabled)fail(`${what}: in the room the select shows ${$('xOnMap').value} (disabled ${$('xOnMap').disabled}), room is ${want}`);
  if(hostPage){join(code,'Friend'+(humans.length+1),'Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')>=2,8000,what+' friend joined');$('xOnStart').click();}
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),30000,what+' match start');const p=page();
  if(p.map!==want||p.five!==want||p.vis.length!==1||p.vis[0]!==want)fail(`${what}: page built ${JSON.stringify(p)}, wanted ${want}`);/* (the audit page strips the native-map block; its wrapper is checked in test_map_select.cjs) */};
 xe("MP.name='MapQA';true");
 const runs=[];MAPS.forEach((m,i)=>{for(const [j,md] of MODES.entries())if(!QUICK||j===i%3)runs.push([md,m,(i+j)%2?'select':'tile',(i+j)%3===2?'quick':'create']);});
 let n=0;for(const [md,m,how,btn] of runs){n++;const what=`${md} ${m} via ${how} + ${btn}`;H.setPhase(what);
  // the lobby choice says another map first, so a stale default can't pass by accident
  tile(MAPS[(MAPS.indexOf(m)+1)%6]);mode(md);if(how==='select')pickSelect(m);else tile(m);
  $(btn==='quick'?'xOnQuick':'xOnCreate').click();await until(()=>xe('MP.st')==='room',10000,what+' room');
  const code=xe('MP.code');codes.add(code);const u=new URL(urls.at(-1).replace(/^ws/,'http'));if(u.searchParams.get('map')!==m||u.searchParams.get('mode')!==md)fail(`${what}: connect url asked for ${u.searchParams.get('map')} ${u.searchParams.get('mode')}`);
  await play(what,m,code);await leave();
  if($('xOnMap').value!==m||$('xOnMap').disabled)fail(`${what}: after leaving the select shows ${$('xOnMap').value} (disabled ${$('xOnMap').disabled})`);}
 // Join by code: a friend's Split TDM room; the lobby says Bind and a START that never launched left a queue pick (Bind)
 {H.setPhase('join by code');const code='SPLTQA';codes.add(code);const host=raw({code,create:'1',mode:'tdm',map:'split',public:'0',name:'RoomHost',agent:'Jett'});await step(500);
  tile('bind');xe('window.xQPick="bind";true');$('xOnCode').value=code;$('xOnJoin').click();await until(()=>xe('MP.st')==='room',10000,'joined by code');
  if(xe('MP.map')!=='split')fail('join by code: page room map '+xe('MP.map'));
  host.send({t:'start'});await play('join by code','split',code,false);
  // rejoin: the page's socket drops mid-match; rejoining the code rebuilds Split
  const room=cluster.room(code),ws=[...room.sessions].find(([w,x])=>x.u&&x.u.name===xe('MP.name'))[0];ws.close(1006,'');room.drop(ws);await step(1500);
  if(xe('MP.st')==='game')fail('rejoin: page still in the match after its socket dropped');xe('try{toLobby()}catch(e){}true');await step(200);tile('haven');
  $('xOnCode').value=code;$('xOnJoin').click();await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),30000,'rejoin start');const p=page();if(p.map!=='split'||p.five!=='split')fail('rejoin: page built '+JSON.stringify(p));
  await leave();if($('xOnMap').value!=='haven')fail('after the friend\'s room the select shows '+$('xOnMap').value+', lobby choice is haven');
  $('xOnCreate').click();await until(()=>xe('MP.st')==='room',10000,'create after join');const c2=xe('MP.code');if(cluster.room(c2).sim.map!=='haven')fail('create after a friend\'s room used '+cluster.room(c2).sim.map);await leave();}
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions: '+JSON.stringify({errors:errors.slice(0,4),xerr:xerr.slice(0,4)}).slice(0,1500));
 if(fails.length){console.error(fails.slice(0,30).join('\n'));process.exit(1);}
 console.log(`Online map selection (page <-> in-process server): ${n} rooms (${QUICK?'each map once':'six maps x DM / TDM / Spike'}), map chosen on the Online select or the queue tiles, Create private and Quick Match: server room and the page's built match are that map; join by code and rejoin play the room's map over a different lobby choice and a stale queue pick; the select shows the room's map in a room and the lobby choice after (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
