// vs-lane-mapdouble, ONLINE: test_map_double.cjs's invariant (no legacy procedural map drawn over the native map, one
// native-* root) for online rooms: the real page WITH the native-map block (page_harness native:true, stand-in render scene)
// against the real game server in-process (server/tools/local-cluster.mjs), Create private + Start with a scripted friend.
//   node work/qa_map_double_online.cjs   [PLAN=dm:ascent,five:bind,...]
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const selFix=H=>{const s=H.doc.getElementById('xOnMap');Object.defineProperty(s,'value',{configurable:true,get(){return this._value!=null?this._value:'ascent';},set(v){this._value=String(v);}});};// audit.js's fake DOM reads a <select>'s value from its attribute; give it a real one (the page sets it through .value)
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(11);const H=boot({real3:true,seed:23,native:true});selFix(H);const VERBOSE=!!process.env.VERBOSE;
H.xe(`nmLoadScene=function(){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());m.name='nm-render';m.userData.nmRender=1;g.add(m);return Promise.resolve({scene:g,animations:[]});};true`);
const SAMPLE=`(()=>{const C=NM.current,vis=o=>{for(let p=o;p;p=p.parent){if(!p.visible)return false;if(p===scene)return true;}return false;};
 const groups=new Map();for(const k in FMAP)if(FMAP[k]&&FMAP[k].g)groups.set(FMAP[k].g,'FMAP.'+k);for(const k in MAPS)if(MAPS[k]&&MAPS[k].g&&!groups.has(MAPS[k].g))groups.set(MAPS[k].g,'MAPS.'+k);
 const stray=[];for(const [g,n] of groups){if(C&&g===C.M.g)continue;if(g.userData&&g.userData.nativeMap)continue;let k=0;g.traverse(o=>{if(o.isMesh&&vis(o))k++;});if(k)stray.push(n+':'+k);}
 const roots=scene.children.filter(c=>c.userData&&c.userData.nativeMap).map(c=>c.name+(c.visible?'':'(hidden)'));
 let nmDrawn=0;if(C)C.M.g.traverse(o=>{if(o.userData&&o.userData.nmRender&&vis(o))nmDrawn++;});
 return JSON.stringify({mode,map:FV.map,cur:C?C.key:null,stray,roots,nmDrawn,solidsNative:!!(C&&solids===C.M.solids),active:!!nmActive()});})()`;
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
 const nf=H.win.fetch;H.win.fetch=function(u){u=String(u);if(/\/rooms$/.test(u)){const rooms=[...codes].map(c=>cluster.room(c)).filter(r=>r&&r.sim&&r.public&&['room','game'].includes(r.sim.phase)).map(r=>{const x=r.room();return {code:x.code,map:x.map,mode:x.mode,players:x.pl.length,state:x.st};});return Promise.resolve({ok:true,json:async()=>({rooms})});}return nf.apply(this,arguments);};
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
 const PLAN=(process.env.PLAN||'dm:ascent,dm:bind,tdm:haven,five:split,dm:ascent').split(',').map(s=>s.split(':'));let n=0;
 for(const [md,m] of PLAN){n++;const what=`${md} ${m}`;H.setPhase(what);tile(m);mode(md);pickSelect(m);
  $('xOnCreate').click();await until(()=>xe('MP.st')==='room',10000,what+' room');const code=xe('MP.code');codes.add(code);
  join(code,'Friend'+(humans.length+1),'Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')>=2,8000,what+' friend joined');$('xOnStart').click();
  try{await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('running')&&!xe('!!window.xLdOn'),60000,what+' match start');}catch(e){fail(String(e.message));await leave();continue;}
  for(let t=0;t<4;t++){await step(600);const s=JSON.parse(xe(SAMPLE));if(VERBOSE&&t===0)console.log(n,what,JSON.stringify(s));
   if(s.stray.length)fail(`${what} t${t}: legacy map drawn (${s.stray.join(', ')}) native ${s.cur} mode ${s.mode} map ${s.map}`);
   if(s.roots.length!==1)fail(`${what} t${t}: ${s.roots.length} native roots (${s.roots.join(', ')})`);
   if(!s.nmDrawn||s.cur!==m)fail(`${what} t${t}: native ${m} not drawn (cur ${s.cur}, drawn ${s.nmDrawn})`);
   if(!s.active)fail(`${what} t${t}: nmActive() null (collision is not the native map: solidsNative ${s.solidsNative})`);}
  await leave();}
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions: '+JSON.stringify({errors:errors.slice(0,4),xerr:xerr.slice(0,4)}).slice(0,1500));
 if(fails.length){console.error([...new Set(fails)].slice(0,30).join('\n'));process.exit(1);}
 console.log(`Map double-draw online: ${n} rooms (${PLAN.map(p=>p.join(' ')).join(', ')}): native map drawn and collided, no legacy map over it, one native root`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
