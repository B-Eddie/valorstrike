// ---- TRUSTED ONLINE SERVER ----
// Online flash screen (server blindUntil -> st.blind s left): fully white while blinded, then a 1 s fade (wiki Status Effect#Flash:
// the flash lasts its duration, then fades out over 1 second); was opacity = blind / 1.5, so a 1.5 s Curveball was only fully white
// for its first frame and faded the whole time.
function netBlindCss(el,b){const on=b>0;el.style.cssText='pointer-events:none;position:fixed;inset:0;z-index:110;background:#fff;opacity:'+(on?1:0)+';transition:'+(on?'none':'opacity 1s ease-out');return on;}
let netDetainAt=0; // Killjoy Lockdown detain notice (server status.detain)
let netVulnAt=0,netTetherAt=0; // Alarmbot Vulnerable / Trapwire tether (server status.vulnerable / status.tether)
function netStatusChips(st){const now=performance.now();NET.tw={a:+st.twa||0,u:+st.twu||0,at:now};/* Tailwind windup / window as of now (the dash prediction reads it) */if(st.vulnerable>0&&!(netVulnAt>now))say('Vulnerable · taking double damage · '+Math.ceil(st.vulnerable)+' s',1200);netVulnAt=st.vulnerable>0?now+st.vulnerable*1000:0;if(st.tether>0&&!(netTetherAt>now))say('Slowed by Trapwire · move 4 m away or shoot the anchor',1200);netTetherAt=st.tether>0?now+st.tether*1000:0;const on=[];if(st.vulnerable>0)on.push('VULNERABLE '+st.vulnerable.toFixed(1)+'s');if(st.tether>0)on.push('TRAPWIRE');/* Jett Tailwind (twa / twu: server 1 s windup, 7.5 s window) shows as the bar above the E icon (xAbTm reads NET.tw), as VALORANT draws it, not in this banner */if(st.dart>0)on.push(st.drm>0?'REMOVING DART '+Math.min(100,Math.round(st.drm/1.85*100))+'%':'TRACKING DART · HOLD 4 TO REMOVE');/* Spycam dart in me: server 1.85 s removal channel (h4 held, standing, not firing) */let el=document.getElementById('netSt');if(!el&&!on.length)return on;if(!el){el=document.body.appendChild(document.createElement('div'));el.id='netSt';el.className='x-nst';/* styled in <style id="xHudParity">: debuff status above the ability bar */}el.textContent=on.join(' · ');el.style.display=on.length?'block':'none';return on;}
// Browser prediction is display only. The server consumes controls and owns
// positions, collision, guns, damage, kills and results. Legacy P2P is not used.
var netSkyeState=null,netReyna=null,netChannel=null;
var NET={url:['localhost','127.0.0.1','[::1]'].includes(location.hostname)?location.protocol+'//'+location.hostname+':8787':'https://valorstrike-game.itsmybirthdayim7.workers.dev',socket:null,host:false,seq:0,ready:false,latest:null};
MP_V=2;
// WebSocket is reliable and ordered: never queue obsolete movement behind a slow uplink. Keep click pulses until an
// input can actually be sent. Commands stay reliable; only replaceable input/heartbeat traffic is skipped under pressure.
function netSend(m){const ws=NET.socket;if(!ws||ws.readyState!==1)return false;if((m.t==='in'||m.t==='hb'||m.t==='pi')&&ws.bufferedAmount>16384){if(m.t==='in'){NET.firePend=NET.firePend||m.fire;NET.firePendH=NET.firePendH||m.kh;}return false;}try{if(Number.isSafeInteger(NET.ack)&&['in','hb','pi','ready'].includes(m.t))m={...m,q:NET.ack};ws.send(JSON.stringify(m));return true;}catch(e){return false;}}
const netReset0=mpReset;mpReset=function(){const ws=NET.socket;NET.socket=null;clearTimeout(NET.retryTimer);NET.retryTimer=0;NET.epoch=(NET.epoch||0)+1;NET.reconnecting=false;NET.resume=null;NET.ack=null;NET.wireBase=null;NET.openAt=NET.lastSeen=NET.watchAt=NET.retryUntil=NET.loadAt=NET.lpAt=NET.hbAt=0;NET.recoverGame=NET.recoverLoading=false;NET.ready=false;NET.tab=0;NET.latest=null;NET.tw=null;NET.dashUntil=0;NET.inLog=[];NET.path=[];NET.correction=null;MP.snapClock=null;netSkyeState=null;netReyna=null;netChannel=null;netReynaClear();netClearEffects();const hud=mpEl('xMpHud');if(hud)hud.style.display='none';netWeapon='';netReload=false;NET.hid=0;if(ws)try{ws.close();}catch(e){}return netReset0();};
let netSessionToken=null,netTokenRequest=null,netTokenPersistent=true;
async function netProfileToken(){if(netSessionToken)return netSessionToken;try{netSessionToken=localStorage.getItem('vs.serverToken');}catch(e){}if(netSessionToken)return netSessionToken;if(!netTokenRequest)netTokenRequest=(async()=>{try{const r=await fetch(NET.url+'/profile',typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(6000)}:undefined);if(!r.ok)return null;const p=await r.json();if(typeof p.token!=='string'||!p.token)return null;netSessionToken=p.token;try{localStorage.setItem('vs.serverToken',p.token);}catch(e){netTokenPersistent=false;}return p.token;}catch(e){return null;}finally{netTokenRequest=null;}})();return netTokenRequest;}
// Server frames are shape-checked before anything stores or replays them (the frame loop re-reads NET.latest and round
// state every frame, so one malformed snapshot would otherwise throw on every frame): unknown shapes are dropped, the
// arrays the page iterates are made arrays of the right kind, and unit rows / events with missing fields are removed.
function netClean(m){if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.t!=='string')return null;
 const t=m.t;
 if(t==='room'){m.pl=nclKeep(m.pl,nclPl);if(!nclStr(m.code))m.code='';if(!nclStr(m.mode))m.mode='tdm';if(!nclStr(m.map))m.map='ascent';}
 else if(t==='welcome'){if(!nclStr(m.name)&&!nclNum(m.name))return null;}
 else if(t==='start'){if(!NCL_MODES.includes(m.mode)||!NCL_MAPS.includes(m.map)||!nclNum(m.you))return null;m.u=nclKeep(m.u,nclRow);m.k=nclKd(m.k);m.d=nclKd(m.d);if(m.rs!==undefined&&!nclRs(m.rs))delete m.rs;if(m.ld!==undefined&&!Array.isArray(m.ld))delete m.ld;if(m.tl!==undefined&&!nclNum(m.tl))delete m.tl;}
 else if(t==='s'){nclSnap(m);if(m.rs!==undefined&&!nclRs(m.rs))delete m.rs;if(!nclNum(m.tl))m.tl=0;if(!nclNum(m.serverTime))m.serverTime=Date.now();}
 else if(t==='rs'){if(!nclRs(m))return null;}
 else if(t==='re'){if(!(Array.isArray(m.sc)&&m.sc.length===2&&m.sc.every(nclNum)))return null;nclSnap(m);if(!nclStr(m.tx))m.tx='';}
 else if(t==='end'){nclSnap(m);if(m.over!=null&&!nclStr(m.over))m.over=null;}
 else if(t==='rd'){if(m.ld!==undefined&&!Array.isArray(m.ld))m.ld=[null,'Classic'];}
 else if(t==='ac'){if(!nclNum(m.i)||!nclStr(m.ag)||!nclStr(m.k))return null;for(let i=0;i<3;i++){const k=NCL_AC[i];if(m[k]!==undefined&&!nclVec(m[k]))return null;}for(let i=0;i<2;i++){const k=NCL_ACN[i];if(m[k]!==undefined&&!nclNum(m[k]))delete m[k];}/* Sova bolt charge / bounces */}
 else if(t==='ao'){if(m.rs!==undefined&&!nclRs(m.rs))delete m.rs;}
 return m;}
// perf3: netClean's helpers and predicates live out here (they were ~10 closures built per message, plus one per filter call,
// a constant table per round state and Object.entries arrays); a list / map whose entries all pass is kept as it came
// (a filtered copy only when something is dropped). Same checks, same results (work/test_net_clean_alloc.cjs).
const nclNum=Number.isFinite,nclHas=Object.prototype.hasOwnProperty,NCL_MODES=['tdm','dm','five','esc','skm'],NCL_MAPS=['ascent','bind','haven','split','lotus','breeze'],NCL_RS=[['tm',0,1e7],['b',0,120],['tl',0,1e4],['me',0,99999]],NCL_AB=[['c',0,9],['q',0,9],['e',0,9],['ult',0,20],['blades',0,10],['regrowthPool',0,100],['rechargeAt',0,1e7],['signatureKills',0,99]],NCL_AC=['o','d','p'],NCL_ACN=['pw','b'];
function nclObj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}
function nclStr(v){return typeof v==='string';}
function nclVec(v){return Array.isArray(v)&&v.length>=3&&nclNum(v[0])&&nclNum(v[1])&&nclNum(v[2]);}
function nclKeep(v,f){if(!Array.isArray(v))return [];for(let i=0;i<v.length;i++)if(!(i in v)||!f(v[i]))return v.filter(f);return v;}/* arr(v).filter(f) */
function nclRow(r){return Array.isArray(r)&&r.length>=15&&nclNum(r[0])&&(r[1]===0||r[1]===1||nclNum(r[1]))&&nclStr(r[2])&&nclStr(r[3])&&nclNum(r[4])&&nclNum(r[5])&&nclNum(r[6])&&nclNum(r[7])&&nclNum(r[8])&&nclNum(r[9])&&nclStr(r[11])&&nclNum(r[14]);}
function nclEv(e){return Array.isArray(e)&&nclStr(e[0]);}
function nclFx(e){return !!nclObj(e)&&nclVec(e.p);}
function nclFw(r){return Array.isArray(r)&&nclNum(r[0])&&nclStr(r[1])&&nclNum(r[2])&&nclNum(r[3])&&nclNum(r[4]);}
function nclRv(x){return Array.isArray(x)&&x.length>=4&&x.every(nclNum);}
function nclSoul(o){return !!nclObj(o)&&(nclStr(o.id)||nclNum(o.id))&&nclVec(o.p);}
function nclPl(p){return !!nclObj(p)&&nclStr(p.n);}
function nclKd(v){const o=nclObj(v);if(!o)return {};for(const k in o)if(nclHas.call(o,k)&&(k==='__proto__'||!nclNum(o[k]))){const out={};for(const [k2,n]of Object.entries(o))if(nclNum(n))out[k2]=n;return out;}return o;}/* {k: n} for the finite numbers only */
function nclCl(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function nclWk(v){return typeof v==='string'&&nclHas.call(WEAP,v);}/* own weapon keys only: '__proto__' / 'constructor' passed WEAP[n] and threw in the skin path (onSkin) */
// Snapshot-shaped frames ('s', and 'end' / 're', which the page replays through the snapshot path): everything iterated.
function nclSnap(m){m.u=nclKeep(m.u,nclRow);m.k=nclKd(m.k);m.d=nclKd(m.d);m.ev=nclKeep(m.ev,nclEv);if(m.fx!==undefined)m.fx=nclKeep(m.fx,nclFx);if(m.fw!==undefined)m.fw=nclKeep(m.fw,nclFw);if(m.tl!==undefined&&!nclNum(m.tl))delete m.tl;}
// Round state (alone, or inside 'start' / 'ao'): the spike row, and the per-agent state the page walks (Reyna souls, ability block, statuses).
function nclRs(r){if(!nclObj(r)||r.tab!==1&&(!Array.isArray(r.sp)||r.sp.length<9))return null;/* tab 1: an online TDM round state (server tdm.js: abilities only, no Spike row) */if(r.ld!==undefined){if(!Array.isArray(r.ld))r.ld=[null,'Classic'];else r.ld=[nclWk(r.ld[0])?r.ld[0]:null,nclWk(r.ld[1])?r.ld[1]:'Classic'];}if(r.tw!==undefined&&!(r.tw===null||nclWk(r.tw)))r.tw=null;if(r.status!==undefined&&!nclObj(r.status))delete r.status;if(r.channel!==undefined&&!nclObj(r.channel))r.channel=null;
  if(r.ab!==undefined){if(!nclObj(r.ab))delete r.ab;else{if(r.ab.cool!==undefined&&!nclObj(r.ab.cool))delete r.ab.cool;if(r.ab.anchor!=null&&!nclVec(r.ab.anchor))r.ab.anchor=null;}}
  if(r.reyna!==undefined&&r.reyna!==null){if(!nclObj(r.reyna))r.reyna=null;else r.reyna.souls=nclKeep(r.reyna.souls,nclSoul);}
  r.rv=nclKeep(r.rv,nclRv);if(r.cr!==undefined)r.cr=nclKd(r.cr);if(r.sc!==undefined&&!(Array.isArray(r.sc)&&r.sc.length===2&&r.sc.every(nclNum)))return null;
  // Values (JSON carries 1e999 = Infinity and any magnitude, and typeof checks let them through): every number the page
  // reads is finite and clamped to its range, a junk one dropped (scalars) or zeroed (statuses, spike row).
  for(let i=0;i<NCL_RS.length;i++){const T=NCL_RS[i],k=T[0];if(r[k]!==undefined){if(nclNum(r[k]))r[k]=nclCl(r[k],T[1],T[2]);else delete r[k];}}
  if(r.atk!==undefined)r.atk=r.atk===1||r.atk===true?1:0;if(r.bl!==undefined)r.bl=nclKeep(r.bl,nclStr);if(r.sc!==undefined)r.sc=[nclCl(Math.floor(r.sc[0]),0,99),nclCl(Math.floor(r.sc[1]),0,99)];if(r.cr)for(const k in r.cr)r.cr[k]=nclCl(r.cr[k],0,99999);
  if(r.status){const S=r.status,o={};for(const k in S)if(nclHas.call(S,k)){const v=S[k];o[k]=nclNum(v)?nclCl(v,0,60):0;}r.status=o;}
  if(r.channel)r.channel={kind:nclStr(r.channel.kind)?r.channel.kind:'',remaining:nclNum(r.channel.remaining)?nclCl(r.channel.remaining,0,30):0};
  if(r.ab){const a=r.ab;for(let i=0;i<NCL_AB.length;i++){const T=NCL_AB[i],k=T[0];if(a[k]!==undefined&&!(typeof a[k]==='boolean')){if(nclNum(a[k]))a[k]=nclCl(a[k],T[1],T[2]);else delete a[k];}}if(a.cool)for(const k of Object.keys(a.cool)){if(nclNum(a.cool[k]))a.cool[k]=nclCl(a.cool[k],0,1e7);else delete a.cool[k];}}
  if(r.tp!==undefined){if(nclNum(r.tp))r.tp=nclCl(r.tp,0,200);else delete r.tp;}if(r.uc!==undefined){if(nclNum(r.uc))r.uc=nclCl(r.uc,1,200);else delete r.uc;}
  if(r.sp){const p=r.sp;r.sp=[nclStr(p[0])?p[0]:'',nclNum(p[1])?Math.floor(p[1]):-1,nclNum(p[2])?nclCl(p[2],-1e4,1e4):0,nclNum(p[3])?nclCl(p[3],-1e4,1e4):0,nclNum(p[4])?nclCl(p[4],0,1e4):0,nclNum(p[5])?nclCl(p[5],0,1e4):0,nclNum(p[6])?nclCl(p[6],0,1e4):0,nclStr(p[7])?p[7]:'',p[8]===1||p[8]===true?1:0];}
  return r;}
// Session-local lossless state decoder. Private rows are updated only after validating every patch;
// presentation rows and mutable round-state objects are copied before validation/gameplay handlers.
function netReceive(data){let m;try{m=JSON.parse(data);}catch{return null;}m=netDecode(m);return m?netClean(m):null;}
function netDecode(m){
 if(!m||typeof m!=='object')return m;
 if(m.t==='start'){NET.wireBase=null;return m;}
 if(m.t!=='s'&&m.t!=='sd')return m;
 if(m.t==='s'&&!Number.isSafeInteger(m.q))return m; // Older workers keep the original validator path.
 let raw=m;
 if(m.t==='sd'){
  const old=NET.wireBase;
  if(!old||m.b!==old.q||!Number.isSafeInteger(m.q)||m.q<=m.b||!nclObj(m.c)||!Array.isArray(m.u)||!Array.isArray(m.ev))return netDeltaMiss();
  if(m.r!==undefined&&(!Array.isArray(m.r)||!m.r.every(nclStr))||m.rr!==undefined&&(!Array.isArray(m.rr)||!m.rr.every(nclStr))||m.rs!==undefined&&!nclObj(m.rs))return netDeltaMiss();
  // Spread creates own data properties, including '__proto__'; never use Object.assign on wire keys.
  raw={...old,...m.c,t:'s',q:m.q,u:old.u,ev:m.ev};
  if(m.r)for(const k of m.r){if(['t','q','u','ev'].includes(k))return netDeltaMiss();delete raw[k];}
  // Validate the entire patch set first so a malformed packet cannot partially modify the baseline.
  for(const p of m.u){if(!Array.isArray(p)||p.length<3||p.length%2!==1||!Number.isInteger(p[0])||p[0]<0||p[0]>=raw.u.length)return netDeltaMiss();const row=raw.u[p[0]];for(let i=1;i<p.length;i+=2){const k=p[i],v=p[i+1];if(!Number.isInteger(k)||k<=0||k>=row.length||(k===1||k>=4&&k<=9||k===14)&&!nclNum(v)||(k===2||k===3||k===11)&&!nclStr(v))return netDeltaMiss();}}
  for(const p of m.u){const row=raw.u[p[0]];for(let i=1;i<p.length;i+=2)row[p[i]]=p[i+1];}
  if(m.rs!==undefined){raw.rs={...old.rs,...m.rs};if(m.rr)for(const k of m.rr)delete raw.rs[k];}
 }
 if(!Array.isArray(raw.u)||!raw.u.every(nclRow))return netDeltaMiss();
 if(Number.isSafeInteger(raw.q))NET.wireBase=raw;
 const out={...raw,u:raw.u.map(r=>r.slice())};
 if(nclObj(raw.rs)){const r=out.rs={...raw.rs};if(nclObj(r.ab)){r.ab={...r.ab};if(nclObj(r.ab.cool))r.ab.cool={...r.ab.cool};}if(nclObj(r.reyna))r.reyna={...r.reyna};if(nclObj(r.cr))r.cr={...r.cr};}
 return out;
}
function netDeltaMiss(){NET.wireBase=null;const now=performance.now();if(!(now-(NET.resyncAt||-1e9)<1000)){NET.resyncAt=now;netSend({t:'resync'});}return null;}
function netConnect(create,code,publicRoom){
 if(create&&['ascent','bind','haven','split','lotus','breeze','random'].includes(window.xQMap))MP.map=window.xQMap;
 mpReset();NET.seatTries=0;NET.seat=null;MP.st='conn';mpMsg(create?'Creating server room…':'Joining server room…');mpUI();NET.host=create;
 MP.code=code;MP.pub=!!publicRoom;MP.loadT=performance.now();netOpenSocket(create,code,publicRoom);
}
function netOpenSocket(create,code,publicRoom){
 const q=new URLSearchParams({code,create:create?'1':'0',mode:MP.mode,map:MP.map==='random'?['ascent','bind','haven','split','lotus','breeze'][Math.floor(Math.random()*6)]:MP.map,public:publicRoom?'1':'0'});
 if(NET.reconnecting&&NET.resume)q.set('resume',NET.resume);
 let ws;try{ws=new WebSocket(NET.url.replace(/^http/,'ws')+'/connect?'+q);}catch(e){return netFinishConnection({code:1006,reason:''});}
 const old=NET.socket;NET.socket=ws;NET.openAt=NET.lastSeen=performance.now();NET.ack=null;NET.wireBase=null;NET.resyncAt=0;NET.welcomed=false;
 if(old&&old!==ws)try{old.close();}catch(e){}
 ws.onopen=async()=>{const token=await netProfileToken();if(NET.socket===ws){netSend({t:'hi',n:MP.name,ag:J.pick||'Jett',token,resume:NET.resume||undefined,batch:1,ack:1,delta:1,sk:typeof xskWire==='function'?xskWire():undefined});netHbStart();}};
 ws.onmessage=e=>{
  if(NET.socket!==ws)return;const m=netReceive(e.data);if(!m)return;
  NET.lastSeen=MP.last=performance.now();
  try{netOnMsg(m);}catch(err){NET.dropped=(NET.dropped||0)+1;const w=String(err&&err.message||err).slice(0,160)+' @'+m.t;NET.drops=NET.drops||[];if(NET.drops.length<20&&!NET.drops.includes(w))NET.drops.push(w);}
 };
 const netOnMsg=m=>{
  /* Seated: 'welcome', or for a worker that never sends one (the deployed worker as of 2026-10-26 sends hello / room / start / s
     only) the room, the match start or a snapshot. The 20 s handshake watchdog used to fire on those workers mid-round (queue 1e). */
  if(m.t==='room'||m.t==='start'||m.t==='s')NET.welcomed=true;
  if(m.t==='ping'){netSend({t:'pong',c:m.c});return;}if(m.t==='hello'||m.t==='hb')return;
  if((m.t==='sk'||m.t==='sks'||m.t==='skr')&&typeof xskNet==='function')return xskNet(m);
  if(m.t==='welcome'){NET.welcomed=true;if(typeof m.resume==='string')NET.resume=m.resume;MP.name=String(m.name);MP.me=m.you;const input=mpEl('xOnName');if(input)input.value=MP.name;return;}
  if(m.t==='room'){
   MP.on=true;MP.role='client';MP.room=m;MP.mode=m.mode;MP.map=m.map;if(MP.st!=='game'&&MP.st!=='post')MP.st='room';NET.host=!!m.pl.find(p=>(p.id!=null?p.id===MP.me:p.n===MP.name)&&p.h);
   if(NET.reconnecting&&!NET.recoverGame&&!NET.recoverLoading){NET.reconnecting=false;NET.retryUntil=0;}
   mpMsg(NET.reconnecting?'Reconnecting to game server…':'Connected to game server');return mpUI();
  }
  if(m.t==='start'){
   const resume=NET.reconnecting&&m.you===NET.resumeMe&&(NET.recoverGame||NET.recoverLoading);
   NET.reconnecting=false;NET.retryUntil=0;NET.inLog=[];NET.path=[];NET.correction=null;MP.snapClock=null;NET.latest=null;NET.lpAt=0;NET.seat=null;
   MP.hc={open:true,send(m){if(m.t!=='hit'&&(m.t!=='in'||Number.isSafeInteger(m.seq)))netSend(m);}};
   if(resume){
    MP.team=m.team;netWeapon='';netReload=false;
    if(NET.recoverGame&&running){
     NET.ready=true;NET.readyAt=performance.now();NET.loadAt=0;MP.loadT=0;
     const self=m.u.find(e=>e[0]===MP.me);if(self){player.x=self[4];player.y=self[5];player.z=self[6];player.vx=player.vy=player.vz=0;}
     netSend({t:'ready'});mpCliSnap(m);if(m.rs)mpCliRS(m.rs);netVisibility();
    }else{NET.ready=false;NET.latest={...m,t:'s'};}
    mpMsg('Connected to game server');mpUI();return;
   }
   NET.ready=false;NET.loadAt=performance.now();return mpCliMsg(m);
  }
  if(m.t==='s'){
   if(Number.isSafeInteger(m.q)&&m.q>=0)NET.ack=m.q;
   NET.latest=m;NET.receivedAt=performance.now();NET.serverAge=Date.now()-m.serverTime;NET.tickMs=m.tickMs;
   if(NET.ready){mpCliMsg(m);if(m.rs)mpCliRS(m.rs);netSyncEffects(m.fx||[]);netSyncSmokes(m.fx||[]);netSeatCheck(m);}return;
  }
  if(m.t==='ac'&&m.ag==='Sage'&&m.k==='c')return;
  if(m.t==='ao'){if(m.rs)mpCliRS(m.rs);if(!m.ok&&m.k==='e'&&J.pick==='Jett'&&J.dash){J.dash=null;NET.dashUntil=0;}if(!m.ok){sgNo();say('Ability unavailable or target invalid',1000);}else if(J.pick==='Omen'&&(m.k==='x'||m.k==='c'))say(m.k==='x'?'From the Shadows · 4 s':'Shrouded Step · 1.2 s',1000);return;}
  if(m.t==='po'){NET.poAt=performance.now();const c=Number(m.c);if(Number.isFinite(c))MP.ping=Math.max(0,Math.round(performance.now()-c));return;}
  mpCliMsg(m);
 };
 ws.onclose=event=>{if(NET.socket!==ws)return;NET.lastClose={code:event.code,reason:event.reason,at:Date.now()};/* 1008 'Rate or size limit' (a stalled network delivering its queued inputs at once) resumes like a transport loss; 1008 'Room full' stays final */if((![1000,1008,4001,4003].includes(event.code)||event.code===1008&&event.reason==='Rate or size limit')&&event.reason!=='Load timed out'&&netRetryConnection())return;netFinishConnection(event);};
 ws.onerror=()=>{if(NET.socket===ws)mpMsg(NET.reconnecting?'Reconnecting to game server…':'Could not reach the game server. Try again shortly.');};
}
function netFinishConnection(event){
 const was=MP.st==='game',room=MP.code,loadingMatch=!!NET.loadAt&&!NET.ready,tries=NET.reconnecting?NET.retryCount||0:0;NET.loadAt=0;mpReset();
 /* close code / reason (and the reconnect attempts) for diagnosis, e.g. ' (close 1006, 7 reconnect attempts)' */
 const why=' (close '+(Number.isFinite(event.code)?event.code:'?')+(event.reason?' "'+String(event.reason).slice(0,60)+'"':'')+(tries?', '+tries+' reconnect attempt'+(tries===1?'':'s'):'')+')';
 mpMsg(event.reason==='Load timed out'?'Loading the match took too long, so the server closed your seat. Rejoin room '+room+' to try again; closing other tabs or apps can speed up loading.':event.reason==='Connection idle'&&loadingMatch?'Lost contact with the game server while the match was loading. Rejoin room '+room+' to try again.':event.reason==='Connection idle'?'Connection timed out while the client was inactive. Rejoin room '+room+' if another player is still connected.':event.code===1012?'The game server restarted. Join or create a room again.':event.code===4003?'Your seat in room '+room+' was released after too long offline'+why+'. Rejoin room '+room+' to keep playing.':'Connection to the game server was interrupted'+why+'. Try rejoining room '+room+'.');
 if(was)mpExitGame();mpUI();
}
function netRetryConnection(){
 const now=performance.now();if(!NET.resume||!MP.on||MP.st==='post')return false;
 if(!NET.reconnecting){NET.reconnecting=true;NET.retryUntil=now+90000;/* the server keeps the seat 90 s (GameRoom.RESUME) */NET.retryCount=0;NET.resumeMe=MP.me;NET.recoverGame=NET.ready&&MP.st==='game';NET.recoverLoading=!NET.ready&&!!NET.loadAt;netReleaseInput();NET.ready=false;NET.latest=null;}
 if(now>=NET.retryUntil)return false;
 if(NET.retryTimer)return true;
 const epoch=NET.epoch,code=MP.code,pub=MP.pub;mpMsg('Reconnecting to game server…');
 NET.retryTimer=setTimeout(()=>{NET.retryTimer=0;if(NET.epoch===epoch&&NET.reconnecting)netOpenSocket(false,code,pub);},Math.min(4000,250*2**Math.min(4,NET.retryCount++)));
 return true;
}
// Seat check (online 'ghost' report): the page must never play a local match the server has no live unit for. A worker that
// does not know our id (no row for MP.me in its snapshots: an old / mismatched server, a lost seat) or that is not applying
// our inputs (row [19] = last applied input seq stuck while we keep sending: the seat never left loading, e.g. a lost
// 'ready') left the player moving and shooting on the page only: invisible to everyone, no damage either way.
// Recovery: re-send 'ready' (a no-op for a live seat), then resume the seat on a new socket, then give up with a message.
const NET_SEAT={miss:60/* snapshots in a row without our row (3 s at 20 Hz) */,stallMs:3000,stallSeq:40/* inputs sent past the last applied one */,tries:3};
function netSeatCheck(m){
 if(!NET.ready||MP.st!=='game'||!NET.socket||NET.reconnecting||!Array.isArray(m.u))return;
 const now=performance.now(),G=NET.seat||(NET.seat={miss:0,ack:-1,ackAt:now,fix:0});
 const self=MP.me!=null?m.u.find(e=>e[0]===MP.me):null;
 if(!self){if(++G.miss>=NET_SEAT.miss){G.miss=0;netUnsynced(G,'no row for our player in the server snapshots');}return;}
 G.miss=0;const ack=self.length>19&&Number.isSafeInteger(self[19])?self[19]:null;if(ack===null)return;
 if(ack!==G.ack){if(ack>G.ack&&G.ack>=0){G.fix=0;NET.seatTries=0;}G.ack=ack;G.ackAt=now;return;}
 if((NET.seq||0)-ack<NET_SEAT.stallSeq||now-G.ackAt<NET_SEAT.stallMs)return;
 G.ackAt=now;netUnsynced(G,'the server is not applying our inputs');}
function netUnsynced(G,why){
 NET.seatWhy=why;
 if(!G.fix){G.fix=1;netSend({t:'ready'});return;}/* a seat stuck loading (its 'ready' lost) goes live */
 NET.seatTries=(NET.seatTries||0)+1;
 const old=NET.socket,fail={code:4000,reason:'Out of sync with the game server'};
 if(NET.seatTries>=NET_SEAT.tries||!netRetryConnection())return netFinishConnection(fail);
 old.onclose=null;try{old.close();}catch(e){}NET.lastClose=Object.assign(fail,{at:Date.now()});}
function netReleaseInput(){
 if(typeof keys!=='undefined')for(const k in keys)keys[k]=false;
 fireHeld=false;NET.firePulse=NET.fireHeavy=NET.firePend=NET.firePendH=0;
}
// A suspended event loop cannot process queued WebSocket messages. Give them a turn on wake before measuring silence.
// Active heartbeat replies prove a lobby/hidden connection is alive even when no simulation snapshots are being sent.
function netTransportTick(){
 const now=performance.now(),gap=now-(NET.watchAt||now);NET.watchAt=now;
 if(!NET.socket)return;
 if(gap>2000){NET.lastSeen=now;NET.openAt=now;return;}
 if(NET.reconnecting&&now>=NET.retryUntil)return netFinishConnection(NET.lastClose||{code:1006,reason:''});
 if(NET.retryTimer)return;
 if(MP.on&&now-(NET.hbAt||0)>=2000){NET.hbAt=now;netSend({t:'pi',c:Math.round(now)});}
 /* seat check: the link answers (recent 'po') but no snapshot has come for 5 s since the match went live: the server is not
    sending us the match (a seat that never left loading sends none), so we would be playing alone (netSeatCheck) */
 if(NET.ready&&MP.st==='game'&&!document.hidden&&now-Math.max(NET.receivedAt||0,NET.readyAt||0)>5000&&now-(NET.poAt||0)<3000){NET.receivedAt=now;netUnsynced(NET.seat||(NET.seat={miss:0,ack:-1,ackAt:now,fix:0}),'no snapshots from the server');}/* 'pi' (not 'hb'): every worker version answers it with 'po' (the deployed one ignores 'hb'), and it measures ping */
 const silent=now-(NET.lastSeen||NET.openAt),connecting=!NET.welcomed;
 if((connecting&&now-NET.openAt>20000)||silent>(document.hidden?150000:30000)){
  const old=NET.socket;if(!netRetryConnection())return netFinishConnection({code:1006,reason:''});
  // Detach first: the close callback must not schedule a second retry or reset the still-playable match.
  old.onclose=null;try{old.close();}catch(e){}
 }
}

mpCreate=function(pub,mode){MP.mode=mode||MP.mode;netConnect(true,mpCode(),pub);};
mpJoin=function(code){code=String(code||'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){mpMsg('Enter the six-character room code.');return;}netConnect(false,code,false);};
mpQuick=async function(mode){MP.mode=mode||MP.mode;mpMsg('Finding a live server room…');try{const r=await fetch(NET.url+'/rooms'),data=await r.json(),room=data.rooms.find(r=>r.mode===MP.mode&&r.players<10&&(window.xQMap==='random'||r.map===(window.xQMap||MP.map)));if(room)netConnect(false,room.code,true);else mpCreate(true,MP.mode);}catch(e){mpMsg('Room list unavailable. Try a private room.');}};
mpStart=function(){if(NET.host&&MP.st==='room')netSend({t:'start'});};
const netUI0=mpUI;mpUI=function(){netUI0();const start=mpEl('xOnStart');if(start){start.hidden=!NET.host;start.disabled=MP.st!=='room';}const map=mpEl('xOnMap');if(map){map.disabled=!!MP.on;/* outside a room it is the lobby map choice that Create / Quick Match use (window.xQMap); in a room, the room's map */if(!MP.on&&typeof window.xQMap==='string'&&map.value!==window.xQMap)map.value=window.xQMap;}const wait=mpEl('xOnWait');if(wait&&NET.host)wait.textContent='Server room ready';document.querySelectorAll('#xOn [data-om]').forEach(b=>{b.disabled=MP.on;});};
// Bots are a room setting; the server independently checks the leader and lobby phase.
const netBotsUI0=mpUI;mpUI=function(){netBotsUI0();const box=mpEl('xOnRoom');if(!box)return;let row=mpEl('xOnBotsRow'),input=mpEl('xOnBots');if(!row){row=document.createElement('label');row.id='xOnBotsRow';input=document.createElement('input');input.id='xOnBots';input.type='checkbox';input.addEventListener('change',()=>netSend({t:'bots',on:!!input.checked}));row.appendChild(input);row.appendChild(document.createTextNode(' Bots'));box.appendChild(row);}row.hidden=!NET.host||!netFeat('bots')||MP.mode==='skm';input.disabled=MP.st!=='room';input.checked=!(MP.room&&MP.room.botsEnabled===false);};
// Movement reconciliation: the server echoes the last input it applied (row[19]) and how long it has applied it (row[20]).
// The page keeps its predicted path and the send time of every input, and compares the server position with where its own
// prediction was at that moment, not with where it is now. The current position runs ahead of every snapshot by the round
// trip, so the old comparison pulled a running player back 25 % toward the past each snapshot and snapped a jumping player
// 0.3-0.7 m down whenever the gap passed 0.35 m (jumps looked jarring online). Small residuals (< 5 cm, < 15 cm vertical)
// are left alone, larger ones are smoothed on movement frames at a bounded rate, and > 1 m (teleport, wall clip, ability) snaps.
NET.inLog=[];NET.path=[];NET.correction=null;
function netPathAt(t){const P=NET.path;if(!P.length||t<P[0].t)return null;for(let i=P.length-1;i>=0;i--)if(P[i].t<=t){const a=P[i],b=P[i+1];if(!b)return a;const k=(t-a.t)/Math.max(1e-6,b.t-a.t);return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,z:a.z+(b.z-a.z)*k};}return null;}
function netPredicted(seq,age){if(!(seq>0)||!Number.isFinite(age))return null;let e=null;for(let i=NET.inLog.length-1;i>=0&&!e;i--)if(NET.inLog[i].seq===seq)e=NET.inLog[i];if(!e)return null;return netPathAt(Math.min(performance.now(),e.t+age*1000));}
function netShiftPath(dx,dy,dz){for(const p of NET.path){p.x+=dx;p.y+=dy;p.z+=dz;}}
// Small authority residuals are consumed by the movement frames, not in 20 Hz socket-handler jumps.
function netCorrect(dt){const C=NET.correction;if(!C||!player)return;dt=Math.max(0,Math.min(.05,Number(dt)||0));const h=Math.hypot(C.x,C.z),k=Math.min(1-Math.exp(-10*dt),h>0?.75*dt/h:1),ky=Math.min(1-Math.exp(-10*dt),Math.abs(C.y)>0?.75*dt/Math.abs(C.y):1),dx=C.x*k,dy=C.y*ky,dz=C.z*k;player.x+=dx;player.y+=dy;player.z+=dz;netShiftPath(dx,dy,dz);C.x-=dx;C.y-=dy;C.z-=dz;if(Math.hypot(C.x,C.y,C.z)<.001)NET.correction=null;}
function netTwReady(){const T=NET.tw;if(!T||J.dash)return false;const el=(performance.now()-T.at)/1000;return T.a-el<=0&&T.u-el>0;}/* server status: Tailwind windup over, window still open */
{const move0=moveP;moveP=function(){if(NET.socket)netCorrect(arguments[0]);const r=move0.apply(this,arguments);if(NET.socket&&player){const now=typeof XRT!=='undefined'&&XRT.at!=null?XRT.at:performance.now();NET.path.push({t:now,x:player.x,y:player.y||0,z:player.z});while(NET.path.length&&NET.path[0].t<now-5000)NET.path.shift();}return r;};}
function netReconcile(e,ref){const ex=e[4]-ref.x,ey=e[5]-ref.y,ez=e[6]-ref.z,eh=Math.hypot(ex,ez);if(NET.dashUntil>performance.now()&&eh<2.5&&Math.abs(ey)<1){NET.correction=null;return 'dash';}/* predicted dash has a different tick phase: wait until it settles */if(eh>1||Math.abs(ey)>1){NET.correction=null;player.x+=ex;player.y+=ey;player.z+=ez;netShiftPath(ex,ey,ez);return 'snap';}NET.correction={x:eh<.05?0:ex,y:Math.abs(ey)<.15?0:ey,z:eh<.05?0:ez};if(!NET.correction.x&&!NET.correction.y&&!NET.correction.z){NET.correction=null;return 'kept';}return 'eased';}
const netSelf0=mpCliSelf;mpCliSelf=function(e){if(Number.isFinite(e[13])&&e[13]>0)MP.ping=e[13];const seq=MP.sq;netSelf0(e);if(!NET.socket)return;const ref=seq===e[14]?netPredicted(e[19],e[20]):null;if(seq!==e[14]){player.x=e[4];player.y=e[5];player.z=e[6];NET.path.length=0;NET.correction=null;}else if(ref)NET.lastFix=netReconcile(e,ref);else{NET.correction=null;NET.lastFix='waiting';/* startup/resume/stall: wait for an acknowledged predicted sample; comparing a past snapshot with today's position reintroduces rubber-banding */}if(netEquipWant&&(e[11]===netEquipWant||performance.now()>netEquipUntil))netEquipWant=null;const held=rw==='knife'?'Knife':wName();/* a swap the server has not applied yet: its snapshots still name the old gun (and its ammo) for a round trip; reverting to it lost the swap (netWeapon was reset, so the equip was never sent) */
 /* TDM: a primary the current stage does not allow (the page's own start loadout) is not ours: 1 would equip a gun the server refuses *//* not in Escalation (it plays this TDM path with the server's level guns, none of them TDM stage guns) and never the gun the server says we hold (e[11]): dropping it made netAdoptWeapon put it back on every snapshot (20 Hz re-equip: the draw never finished, no shot, the viewmodel rebuilt each time) */if(typeof FV!=='undefined'&&FV.tdm&&!MP.m5&&MP.gm!=='esc'&&FV.pri&&FV.pri!==e[11]&&typeof tdmOk==='function'&&!tdmOk(FV.pri,tdmTier())&&!netEquipWant){const was=rw==='pri';FV.pri=null;if(was){netRec=true;try{swapW('pis');}finally{netRec=false;}}slots.pri={};}
 if(!netEquipWant&&e[11]&&WEAP[e[11]]&&wName()!==e[11]&&rw!=='knife'){netAdoptWeapon(e[11]);netWeapon=e[11];}const same=(rw==='knife'?'Knife':wName())===e[11];/* ammo only for the gun the server holds: mid-swap it was the other gun's, written into this slot */if(same&&e[16]!=null&&MP.m5){rsv=e[16];if(slots[rw])slots[rw].rsv=rsv;}if(same&&e[15]!=null&&!(reloading>0)){/* reloading > 0, not truthiness: a finished reload can leave it a hair below 0 */if(rw!=='knife')ammo=e[15];if(slots[rw])slots[rw].ammo=ammo;}updHud();};
const netWalls=new Map(),netCbs=new Map();/* Jett Cloudburst rows (fx kind 'cb'): id -> {m: projectile mesh, s: smoked} */
function netClearEffects(){for(const c of netCbs.values())if(c.m)jRel(c.m);netCbs.clear();for(const S of J.smokes||[])if(S.netId!=null)jRel(S.m);if(J.smokes)J.smokes=J.smokes.filter(S=>S.netId==null);document.getElementById('netBlind')?.remove();for(const m of netWalls.values()){scene.remove(m);m.children.forEach(q=>{q.geometry.dispose();q.material.dispose();});}netWalls.clear();for(const id of [...netDevs.keys()])netDevDrop(id);netOwnDevs.clear();}/* a barrier is a Group of segment meshes (no geometry of its own) */
// Others' Cloudbursts from the snapshot: the projectile while it flies (s 0), then the smoke where the server landed it (s 1,
// once per id, tl seconds left). Our own Cloudburst flies locally (jCbTick) and is skipped here.
function netSyncCb(rows){const seen=new Set();for(const e of rows){if(e.kind!=='cb'||!Number.isFinite(e.id)||e.o===MP.me||!Array.isArray(e.p)||e.p.length!==3||!e.p.every(Number.isFinite))continue;seen.add(e.id);let c=netCbs.get(e.id);if(!c){c={m:null,s:false};netCbs.set(e.id,c);}
 if(e.s!==1){if(!c.m){c.m=xCbProj();scene.add(c.m);c.q=e.p.slice();}const v=c.q?[e.p[0]-c.q[0],e.p[1]-c.q[1],e.p[2]-c.q[2]]:null;c.q=e.p.slice();c.m.position.set(e.p[0],e.p[1],e.p[2]);if(v&&Math.hypot(v[0],v[1],v[2])>1e-4)xCbSpin(c.m,v,1/30);continue;}/* the same wind orb as our own / bots' (xCbProj), not a grey ball */
 if(c.m){jRel(c.m);c.m=null;}if(!c.s){c.s=true;const u=allies.find(x=>x&&x.nid===e.o),al=!!u;void al;xCbCloud(e.p[0],e.p[1],e.p[2],Math.max(.1,Math.min(Cloudburst.CB.life,Number.isFinite(e.tl)?e.tl:Cloudburst.CB.life)));/* Jett's own cloud (xCbCloud), as offline: not the grey controller smoke */try{feed('Jett ▸ Cloudburst');}catch(err){}}}
 for(const [id,c]of netCbs)if(!seen.has(id)){if(c.m)jRel(c.m);netCbs.delete(id);}}
// Persistent devices from the snapshot (server devices.js deviceRows: {kind:'dev', d, o, tm, p, q, yaw, hp, fp}): others' Turret,
// Alarmbot, Trapwire, Trademark, Blast Pack, Spycam and Owl Drone drawn with the offline placeholders and swapped for their real
// models (xvDevice, as xvDevicesTick does offline). Our own are drawn by the local cast. A row that stops coming is removed.
const netDevs=new Map(),NET_DEV={hunter:null,turret:['turret',.9],alarmbot:['alarmbot',.45],trademark:['trademark',.3],blastpack:['blast-pack',.22],spycam:['spycam',.25],owl:['owl-drone',.35],trapwire:['trapwire',.2]};
function netDevPart(kind,al){const col=al?0x3fb4ff:0xff4655;let m,own=false;
 if(kind==='hunter')return srHunterMesh(col);
 if(kind==='turret')m=new THREE.Mesh(kjTur,okMat(col));else if(kind==='alarmbot')m=new THREE.Mesh(kjBox,okMat(col));
 else if(kind==='trademark'){m=new THREE.Mesh(orbGeo,okMat(0xd8b04a));m.scale.set(1.6,.5,1.6);}
 else if(kind==='blastpack'||kind==='owl'){m=new THREE.Mesh(orbGeo,okMat(kind==='owl'?0x45d0ff:0xffb21f));m.scale.setScalar(kind==='owl'?.5:.25);}
 else{m=new THREE.Mesh(new THREE.BoxGeometry(kind==='spycam'?.25:.2,kind==='spycam'?.25:.2,kind==='spycam'?.25:.2),okMat(kind==='spycam'?0x3fd0c0:0xe8e8e4));own=true;}
 m.userData.netDev=kind;m.userData.ownGeo=own;m.raycast=()=>{};scene.add(m);const D=NET_DEV[kind];try{if(D&&typeof xvDevice==='function')xvDevice(m,D[0],kind==='blastpack'||kind==='owl'?D[1]/Math.max(.01,m.scale.y):D[1]);/* as xvDevicesTick: the pack's height is divided by its placeholder scale, the Trademark's is not */}catch(err){}return m;}
function netDevFree(m){if(!m)return;if(m.userData.hunter){scene.remove(m);m.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});return;}scene.remove(m);try{if(typeof xvDeviceReset==='function')xvDeviceReset(m);}catch(err){}if(m.material&&!m.userData.shared)m.material.dispose();/* fireMat is a shared cache */if(m.userData.ownGeo&&m.geometry)m.geometry.dispose();}
function netDevDrop(id){const d=netDevs.get(id);if(!d)return;d.parts.forEach(netDevFree);netDevs.delete(id);}
// Our own devices are drawn by the local cast, which never learns that the server destroyed one (shot down, Spycam / Owl
// Drone bodies, a detonated or expired Blast Pack): it stayed drawn (and the Spycam viewable) until round end. A device
// row of ours the server stops sending now takes the local one nearest its last server position away (2.5 m; 4 m for a
// Blast Pack, which flies; the Owl Drone only while it still had > 0.4 s to fly, so its own timeout stays local).
const netOwnDevs=new Map();
function netOwnGone(d){const p=d.p,nr=(o,r)=>!!o&&Number.isFinite(o.x)&&Math.hypot(o.x-p[0],o.z-p[2])<=r;
 if(d.k==='turret'){if(J.tur&&nr(J.tur.p,2.5)){okRm(J.tur);J.tur=null;}}
 else if(d.k==='alarmbot'){if(J.ab&&nr(J.ab.p,2.5)){okRm(J.ab);J.ab=null;}}
 else if(d.k==='trademark'){const i=BC.tm.findIndex(o=>nr(o.p,2.5));if(i>=0){scene.remove(BC.tm[i].m);BC.tm.splice(i,1);}}
 else if(d.k==='spycam'){if(BC.cam&&nr(BC.cam.p,2.5)){scene.remove(BC.cam.m);BC.cam=null;BC.cv=false;}}
 else if(d.k==='trapwire'){const i=BC.cw.findIndex(W=>nr(W.a,2.5)||nr(W.b,2.5));if(i>=0){cyRm(BC.cw[i]);BC.cw.splice(i,1);}}
 else if(d.k==='blastpack'){const i=RS.pk.findIndex(o=>o.m&&nr(o.m.position,4));if(i>=0){scene.remove(RS.pk[i].m);RS.pk.splice(i,1);}}
 else if(d.k==='owl'){if(J.dr&&!J.dr.tb&&J.dr.t>.4)drEnd();}}
function netSyncDevices(rows){const seen=new Set(),own=new Set();for(const r of rows){if(r.kind!=='dev'||!Object.hasOwn(NET_DEV,r.d)||!Number.isFinite(r.id)||!Array.isArray(r.p)||r.p.length!==3||!r.p.every(Number.isFinite))continue;if(r.o===MP.me&&r.d!=='hunter'){own.add(r.id);netOwnDevs.set(r.id,{k:r.d,p:r.p.slice()});continue;}/* our own: the local cast draws it (netOwnGone takes it away when the server's row stops) */
  seen.add(r.id);let d=netDevs.get(r.id);if(d&&d.k!==r.d){netDevDrop(r.id);d=null;}const al=r.tm===MP.team||allies.some(a=>a&&a.nid===r.o);
  if(!d){d={k:r.d,parts:[],al};if(r.d==='trapwire'){d.parts.push(netDevPart('trapwire',al),netDevPart('trapwire',al));const w=new THREE.Mesh(new THREE.BoxGeometry(.03,.03,1),okMat(0x3fd0c0));w.userData.ownGeo=true;w.raycast=()=>{};scene.add(w);d.parts.push(w);}else d.parts.push(netDevPart(r.d,al));netDevs.set(r.id,d);}
  const [x,y,z]=r.p,m=d.parts[0];d.hp=+r.hp||0;
  if(r.d==='trapwire'){const q=Array.isArray(r.q)&&r.q.length===3&&r.q.every(Number.isFinite)?r.q:r.p,w=d.parts[2];m.position.set(x,y+.3,z);d.parts[1].position.set(q[0],q[1]+.3,q[2]);w.position.set((x+q[0])/2,(y+q[1])/2+.3,(z+q[2])/2);w.scale.z=Math.max(.05,Math.hypot(q[0]-x,q[2]-z));w.rotation.y=Math.atan2(q[0]-x,q[2]-z);continue;}
  m.position.set(x,y+(r.d==='turret'?.45:r.d==='alarmbot'?.225:r.d==='trademark'?.12:0),z);if(Number.isFinite(r.yaw))m.rotation.y=Math.atan2(-Math.sin(r.yaw),-Math.cos(r.yaw));
  if(r.d==='trademark'){const f=Array.isArray(r.fp)&&r.fp.length===3&&r.fp.every(Number.isFinite)?r.fp:null;m.visible=!f;/* spent: the trap is gone, its 6 m slow field shows */if(f&&!d.parts[1]){const z2=new THREE.Mesh(slowGeo,fireMat(0xd4a640,.35));z2.rotation.x=-Math.PI/2;z2.scale.setScalar(XTMK.r/3.5);z2.userData.shared=true;z2.raycast=()=>{};scene.add(z2);d.parts[1]=z2;}if(f)d.parts[1].position.set(f[0],f[1]+.06,f[2]);}}
 for(const id of [...netDevs.keys()])if(!seen.has(id))netDevDrop(id);
 for(const [id,d]of [...netOwnDevs])if(!own.has(id)){netOwnDevs.delete(id);try{netOwnGone(d);}catch(err){}}}
function netSyncEffects(rows){if(J.sw)sgWallEnd();const ids=new Set();netSyncCb(rows);netSyncDevices(rows);for(const e of rows){if(e.kind!=='barrier'||!Array.isArray(e.p)||e.p.length!==3)continue;ids.add(e.id);let m=netWalls.get(e.id);if(!m){/* Barrier Orb: the server's 4 segments (abilities.js BARRIER = XBAR), each hidden once its HP is gone */m=new THREE.Group();m.userData.netBarrier=true;m.userData.seg=[];const W=XBAR.len/XBAR.segs;for(let i=0;i<XBAR.segs;i++){const q=new THREE.Mesh(new THREE.BoxGeometry(W,XBAR.h,XBAR.th),new THREE.MeshLambertMaterial({color:0xb5f1fa,transparent:true,opacity:.85}));q.position.x=-XBAR.len/2+(i+.5)*W;q.userData.netBarrier=true;m.add(q);}scene.add(m);netWalls.set(e.id,m);}
 m.position.set(e.p[0],e.p[1]+1.5,e.p[2]);m.rotation.y=e.yaw;const S=Array.isArray(e.seg)&&e.seg.length===m.children.length?e.seg:m.children.map(()=>e.hp/m.children.length);m.userData.seg=S.map(Number);m.children.forEach((q,i)=>{const h=+S[i]||0;q.visible=h>0;q.material.opacity=.55+.3*Math.max(0,Math.min(1,h/(XBAR.hp+XBAR.fort)));});}for(const [id,m]of netWalls)if(!ids.has(id)){scene.remove(m);m.children.forEach(q=>{q.geometry.dispose();q.material.dispose();});netWalls.delete(id);}}
const netSgBlk0=sgBlk;sgBlk=function(x,z,r,y=0){if(!NET.socket)return netSgBlk0(x,z,r,y);for(const m of netWalls.values()){const low=m.position.y-1.5;if(y>=low+3||y+1.8<=low)continue;const c=Math.cos(m.rotation.y),s=Math.sin(m.rotation.y),dx=x-m.position.x,dz=z-m.position.z,a=c*dx-s*dz,b=s*dx+c*dz,W=XBAR.len/XBAR.segs;for(let i=0;i<m.children.length;i++){if(!(m.userData.seg[i]>0))continue;const mid=-XBAR.len/2+(i+.5)*W;if(Math.hypot(Math.max(0,Math.abs(a-mid)-W/2),Math.max(0,Math.abs(b)-XBAR.th/2))<r)return true;}}return false;};/* live segments only (a broken one is a gap) */
const netShoot0=shoot;shoot=function(){if(NET.socket&&(netReyna?.dismiss>0||netChannel?.remaining>0))return false;const before=ammo,k0=kSwing,ss=typeof RS!=='undefined'&&RS.ss,r=netShoot0.apply(this,arguments);const swung=rw==='knife'&&kSwing!==k0,rocket=ss&&!RS.ss;/* Showstopper: the click that launched the rocket is one fire pulse (the server's launcher fires on it; a semi-auto gun sends no held fire) */if(NET.socket&&MP.st==='game'&&(swung||rocket||(rw!=='knife'&&ammo<before))){NET.firePulse=performance.now()+80;NET.fireHeavy=swung&&kHv===1?NET.firePulse:0;/* ...and stays pending until an input message carried it: on a slow page the next 50 ms input tick runs after the frame, past the 80 ms window (online Showstopper launched no rocket) */NET.firePend=1;NET.firePendH=NET.fireHeavy?1:0;if(typeof xAD!=='undefined'&&xAD.bs&&rw!=='knife'){NET.altPulse=NET.firePulse;NET.firePendA=1;}/* qa-36: Classic ALT FIRE (xBurst) - the server fires the 3 rounds at once on alt:1 */if(rocket)NET.ssFiredAt=performance.now();}return r;}; // knife: one pulse per swing the client actually started (a click during a swing sent a pulse the server could turn into an extra hit); a heavy swing sends kh so the server applies the heavy cooldown/damage
/* window, not document: the keymap layer re-sends a rebound key on window only (it never reaches document) */addEventListener('keydown',e=>{if(e.code!=='KeyR'||!(NET.socket&&MP.st==='game')||xKbSkip(e)||e.repeat)return;netSend({t:'reload'});if(reloading>0)netReload=true;/* the page's own R handler already started the local reload: the loop must not send it again */});
// Camera, server shots and bots all treat positive pitch as looking up; send it unchanged.
function netInputMsg(kk,w){const seq=++NET.seq;const log=NET.inLog||(NET.inLog=[]);log.push({seq,t:performance.now()});if(log.length>240)log.shift();const fp=NET.firePend,fh=NET.firePendH,fa=NET.firePendA;NET.firePend=NET.firePendH=NET.firePendA=0;/* a pending click rides this message once */return {t:'in',seq,view:typeof MP==='undefined'?100:Math.max(100,Math.min(220,MP.snapClock?.delay||MP.DELAY||100)),r:yaw,p:pitch,f:(kk.KeyW?1:0)-(kk.KeyS?1:0),s:(kk.KeyD?1:0)-(kk.KeyA?1:0),j:kk.Space?1:0,c:kk.ControlLeft||kk.ControlRight?1:0,w:kk.ShiftLeft||kk.ShiftRight?1:0,ads:ads?1:0,az:ads===2&&w==='Operator'&&typeof xSC!=='undefined'&&xSC.lv===2?1:0/* Operator second zoom (5x): teammates spectating see it (roundState pov ADS 2) */,h4:kk.Digit4||kk.Numpad4?1:0,fire:(w!=='Knife'&&!WEAP[w]?.semi&&fireHeld)||NET.firePulse>performance.now()||fp?1:0,kh:NET.fireHeavy>performance.now()||fh?1:0,alt:NET.altPulse>performance.now()||fa?1:0,cb:J.pick==='Jett'&&kk.KeyC?1:0/* Cloudburst steering: C held */,u:kk.KeyF?1:0/* Use held: grabs / lets go of a rope ascender (shared motor) */};} // a held knife click is one swing on the client, so it is a pulse (not held fire) online
function netSyncSmokes(rows){const seen=new Set();for(const e of rows){if(e.kind!=='smoke'||!Number.isFinite(e.id)||!Array.isArray(e.p)||e.p.length!==3||!e.p.every(Number.isFinite)||!Number.isFinite(e.r)||e.r<=0||e.r>12||!Number.isFinite(e.tl)||!(e.tl>0))continue;seen.add(e.id);let S=J.smokes.find(s=>s.netId===e.id);if(!S)S=J.smokes.find(s=>s.netId==null&&!s.cb&&Math.hypot(s.p.x-e.p[0],s.p.y-e.p[1],s.p.z-e.p[2])<1);if(!S){netSmoke0(e.p[0],e.p[2],false,e.tl,e.p[1],e.r,e.cyl);S=J.smokes[J.smokes.length-1];}for(const other of J.smokes)if(other!==S&&other.netId==null&&!other.cb&&Math.hypot(other.p.x-e.p[0],other.p.y-e.p[1],other.p.z-e.p[2])<1)other.t=0;S.netId=e.id;S.t=e.tl;S.p.set(...e.p);S.a=1;S.m.scale.set(e.r/4,e.cyl?1:e.r/4,e.r/4);}J.smokes=J.smokes.filter(s=>{if(s.netId==null||seen.has(s.netId))return true;jRel(s.m);return false;});}
let netWeapon='',netReload=false,netEquipWant=null,netEquipUntil=0,netRec=false;
// The gun the server holds, in hand on the page: a sidearm goes in the sidearm slot, anything else in the primary slot, and the
// viewmodel / HUD are rebuilt (onSkin) even when that slot was already in hand. DM / TDM used to write every server gun into
// the primary slot without onSkin, so the viewmodel and the HUD gun name kept the previous gun (online 'ghost' report: a
// pistol in hand with a primary named on the HUD) while shots used the server's gun.
const NET_SIDEARMS=['Classic','Shorty','Frenzy','Ghost','Bandit','Sheriff'];
function netAdoptWeapon(n){if(!WEAP[n])return;const slot=NET_SIDEARMS.includes(n)?'pis':'pri';netRec=true;try{if((slot==='pri'?FV.pri:FV.sec)!==n)bEquip(n,slot);if(rw!==slot)swapW(slot);else{onSkin();try{setScope(false);}catch(er){}updHud();}}finally{netRec=false;}}
// A Deathmatch / TDM loadout pick (dmGive: the loadout menu, the TDM stage switch) changes the gun without swapW, so its equip
// went out only with the next 50 ms input tick and a snapshot that landed first (still naming the old gun) put the old gun
// back: the pick was lost. Send it at once and hold the reconcile until the server names it (or 1 s passes, e.g. refused).
if(typeof dmGive==='function'){const netDmGive0=dmGive;dmGive=function(n){const r=netDmGive0.apply(this,arguments);if(r!==false&&!netRec&&NET.socket&&NET.socket.readyState===1&&MP.st==='game'&&NET.ready){const w=rw==='knife'?'Knife':wName();netWeapon=w;netSend({t:'equip',w});netEquipWant=w;netEquipUntil=performance.now()+1000;}return r;};}
// A local swap sends its equip at once and holds the snapshot reconcile (above) until the server names that gun or 1 s passes.
const netSwap0=swapW;swapW=function(s){const r=netSwap0.apply(this,arguments);if(!netRec&&NET.socket&&NET.socket.readyState===1&&MP.st==='game'&&NET.ready){const w=rw==='knife'?'Knife':wName();if(w!==netWeapon){netWeapon=w;netSend({t:'equip',w});netEquipWant=w;netEquipUntil=performance.now()+1000;}}return r;};
setInterval(()=>{if(!NET.socket||NET.socket.readyState!==1||!MP.on||NET.reconnecting)return;const now=performance.now();if(MP.st==='game'&&running&&!window.xLdOn&&!NET.ready){NET.ready=true;NET.readyAt=now;NET.loadAt=0;MP.last=now;netSend({t:'ready'});if(NET.latest)mpCliMsg(NET.latest);}if(!NET.ready){/* Still loading the match: tell the server every 5 s how far along we are, so a slow load is kept rather than dropped at the 180 s idle limit. */if(NET.loadAt&&!(now-(NET.lpAt||0)<5000)){NET.lpAt=now;const f=v=>Number.isFinite(v)?Math.round(Math.max(0,Math.min(1,v))*1000)/1000:-1;let m=-1;try{m=f(NM.loaded);}catch(e){}netSend({t:'lp',p:f(window.xLdAgFrac),m});}return;}if((document.hidden?1:0)!==(NET.hid||0))netVisibility();const loading=reloading>0;if(loading&&!netReload)netSend({t:'reload'});netReload=loading;const kk=keys||{},w=rw==='knife'?'Knife':wName();if(w!==netWeapon){netWeapon=w;netSend({t:'equip',w});}netSend(netInputMsg(kk,w));},1000/60);
setInterval(netTransportTick,1000);
// Background-tab liveness. Hidden tabs throttle setInterval (about 1 Hz, then once a minute), which starved the
// server's idle check and dropped players who switched tabs. The client tells the server when the tab hides
// (the server then allows a longer silence and drops held input), releases held keys, and keeps a heartbeat on a
// dedicated Worker timer, with the transport timer as fallback when Workers are unavailable.
let netHbWorker=null;
function netHbTick(){if(MP.on&&NET.socket&&NET.socket.readyState===1)netSend({t:'hb'});}
function netHbStart(){if(netHbWorker!==null)return;try{const url=URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),2000)'],{type:'text/javascript'}));netHbWorker=new Worker(url);URL.revokeObjectURL(url);netHbWorker.onmessage=netHbTick;}catch(e){netHbWorker=false;}}
function netVisibility(){if(!MP.on||!NET.socket||NET.socket.readyState!==1)return;const h=document.hidden?1:0;NET.hid=h;if(h){for(const k in keys)keys[k]=false;fireHeld=false;NET.firePulse=0;NET.firePend=NET.firePendH=0;if(NET.ready)netSend(netInputMsg({},netWeapon||'Knife'));netHbStart();}netSend({t:'vis',h});}
document.addEventListener('visibilitychange',netVisibility);
// Online 5v5 Omen From the Shadows: the picked spot (tactical map, work/ability_target_runtime.js, or the legacy minimap) goes to the trusted
// server as p [x, z] (it checks the nav mesh and lands Omen at the floor there); the page only checks the spot and closes the pick.
const netOmenFts0=okFtsAt;okFtsAt=function(x,z){if(!(NET.socket&&MP.st==='game'&&(MP.m5||NET.tab)&&J.pick==='Omen'))return netOmenFts0(x,z);if(!J.ftp||!running||player.hp<=0||FV.buy>0)return false;const v=okFtsValid(x,z);if(!v){sgNo();say("Can't go there · pick an open spot",900);return false;}netSend({t:'ab',k:'x',p:[Math.round(v.x*100)/100,Math.round(v.z*100)/100]});J.ftp=false;MM.style.pointerEvents='';xPLock();return true;};
// Anchor placement/return have no local charge delta. Send intent before legacy optimistic movement.
// Chamber Headhunter (Q) is the server's: each press takes one charge and swaps in a 1-round Sheriff (Q again puts it
// away and refunds the round). The local overlay (BC.eq 'hp') only drew the HUD; online fire went to the held gun.
const netAbilityKey0=jKey;jKey=function(code){if(NET.socket&&MP.st==='game'&&(MP.m5||NET.tab)&&(J.pick==='Reyna'&&['KeyC','KeyQ','KeyE','KeyX'].includes(code)||(J.pick==='Chamber'||J.pick==='Breach')&&code==='KeyE'||J.pick==='Chamber'&&code==='KeyQ'||J.pick==='Omen'&&code==='KeyC'||J.pick==='Jett'&&(code==='KeyQ'||code==='KeyE'||code==='KeyX')||J.pick==='Skye'&&code==='KeyC')){if(running&&player.hp>0&&FV.buy<=0){const m={t:'ab',k:code[3].toLowerCase()};if(J.pick==='Jett'&&code==='KeyE'&&netTwReady()){const d=jDashKeys();m.f=d.f;m.s=d.s;m.r=+d.r.toFixed(4);J.dash=jDash(d);NET.tw=null;NET.dashUntil=performance.now()+XPAR2.dashTime*1000+250;}/* Tailwind dash predicted at once (the server runs the same shared-motor dash from these keys / yaw) */if(J.pick==='Breach'&&code==='KeyE'&&typeof XABT!=='undefined'&&XABT.hold)m.pw=+XABT.hold.pw.toFixed(3);/* Fault Line HOLD FIRE charge */netSend(m);}return;}return netAbilityKey0.apply(this,arguments);};
function netChamberAnchor(A,time){if(J.pick!=='Chamber')return;J.cd.e=Math.max(0,(A.cool?.e||0)-time);const a=A.anchor;if(!Array.isArray(a)){if(BC.an){scene.remove(BC.an.m);BC.an=null;}return;}if(!BC.an){const m=new THREE.Mesh(ringGeo,fireMat(0xd8b04a,.8));m.rotation.x=-Math.PI/2;scene.add(m);BC.an={m};}BC.an.x=a[0];BC.an.y=a[1];BC.an.z=a[2];BC.an.m.position.set(a[0],a[1]+.06,a[2]);}
// Online Showstopper: the launcher's 1.4 s equip and 10 s window run on the server's clock (status ssr = equip left, ssu =
// window left). The page counted RS.ssd / RS.sst down by its clamped frame dt (<= 0.1 s), so on a ~1 frame/s page the local
// equip lasted ~14 s: clicks after the server's launcher was up were swallowed by rsFire and no rocket left. A click that
// launched the rocket locally (NET.ssFiredAt) is not re-equipped by the stale status for 2 s; if the server still holds the
// launcher after that (the click never reached it), it comes back so the player can click again.
function netShowstopperSync(st){if(typeof RS==='undefined')return;const now=performance.now(),su=+st.ssu||0;if(su>0){if(now-(NET.ssFiredAt||-1e9)<2000)return;NET.ssSrv=1;NET.ssWait=0;RS.ss=1;RS.ssd=Math.max(0,+st.ssr||0);RS.sst=su;return;}if(NET.ssSrv){NET.ssSrv=0;RS.ss=0;RS.ssd=0;return;}/* local X the server never confirmed: dropped after 3 s */if(RS.ss){if(!NET.ssWait)NET.ssWait=now;else if(now-NET.ssWait>3000){RS.ss=0;RS.ssd=0;NET.ssWait=0;}}else NET.ssWait=0;}
// The rocket click goes through rsFire straight from the mouse / touch handlers (never shoot()), so online it sent no fire at
// all: a click that launches the rocket locally is one pending fire pulse here.
{const netRsFire0=rsFire;rsFire=function(){const ss=typeof RS!=='undefined'&&RS.ss,r=netRsFire0.apply(this,arguments);if(ss&&!RS.ss&&J.pick==='Raze'&&NET.socket&&MP.st==='game'){NET.firePulse=performance.now()+80;NET.fireHeavy=0;NET.firePend=1;NET.firePendH=0;NET.ssFiredAt=performance.now();}return r;};}
const netRS0=mpCliRS;mpCliRS=function(m){netRS0(m);if(NET.socket){netChannel=m.channel||null;if(J.pick==='Reyna')netReynaSync(m.reyna);if(J.pick==='Raze'&&m.status)netShowstopperSync(m.status);}if(NET.socket&&Array.isArray(m.rv)){const t=performance.now();for(const r of m.rv){const b=Array.isArray(r)&&bots.find(x=>x.nid===r[0]);if(b)b.netRvUntil=t+400;}}if(NET.socket&&m.status){const st=m.status;if(st.detain>0&&!(netDetainAt>performance.now())){netDetainAt=performance.now()+st.detain*1000;say('Detained · '+Math.ceil(st.detain)+' s',1200);}if(st.concuss>0){if(xCU<=performance.now())xConStart(st.concuss*1000);else xCU=performance.now()+st.concuss*1000;player.tagT=Math.max(player.tagT||0,st.concuss);player.tagK=.35;}if(st.nearsight>0)pNs(Math.min(3,st.nearsight));netStatusChips(st);if(st.slow>0){player.tagT=Math.max(player.tagT||0,st.slow);player.tagK=.35;}else if(st.sslow>0){/* Skye Seekers: 60 % Slow (server seekSlowUntil, wiki) */if(!(player.tagT>0)||!(player.tagK<=.4)){player.tagK=.4;player.tagS=0;}player.tagT=Math.max(player.tagT||0,st.sslow);}else if(st.oslow>0){/* Sage Slow Orb field: half speed (server SLOW_ORB.factor), never weaker than a slow already on */if(!(player.tagT>0)||!(player.tagK<=.5)){player.tagK=.5;player.tagS=0;}player.tagT=Math.max(player.tagT||0,st.oslow);}const el=document.getElementById('netBlind')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'netBlind'}));netBlindCss(el,st.blind); }if(NET.socket&&m.ab){for(const k of ['c','q','e','ult'])if(Number.isFinite(m.ab[k]))J[k]=m.ab[k];netChamberAnchor(m.ab,m.tm||0);if(J.pick==='Jett'){const was=J.bsOn;J.bs=Math.max(0,m.ab.blades||0);J.bsOn=!!m.ab.bladesActive;if(J.bsOn&&!was)swapW('knife');if(was&&!J.bsOn&&rw==='knife')swapW(FV.pri?'pri':'pis');}if(J.pick==='Skye')netSkyeState={pool:Math.max(0,Math.min(100,m.ab.regrowthPool||0)),active:!!m.ab.regrowthActive,used:!!m.ab.regrowthUsed};if(J.pick==='Breach')J.cd.e=Math.max(0,(m.ab.cool?.e||0)-(m.tm||0),(m.ab.rechargeAt||0)-(m.tm||0));}};
const netHud0=mpHud;mpHud=function(){netHud0();const h=mpEl('xMpHud');if(h&&NET.socket&&MP.st==='game')h.textContent='ONLINE · SERVER · '+MP.ping+' ms';};
const netStyle=document.createElement('style');netStyle.textContent='.x-mphud{inset:auto!important;bottom:72px!important;left:12px!important;width:auto!important;height:auto!important;max-height:24px;transform:none!important;font-size:10px;opacity:.75}#feed .kf__n{max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#feed .kf__n.kf__n--at{max-width:300px}/* hud_b5: an ally death row ("SAGE DIED AT ATTACKER SIDE") was cut at the 145 px name cap with no ellipsis (flex box) */';document.head.append(netStyle);
const netRsSl0=rsSl;rsSl=function(u){const rows=netRsSl0(u);if(NET.socket&&MP.st==='game'&&J.pick==='Skye'&&netSkyeState){const a=netSkyeState;rows[0]=['jC',J.c>0||a.used&&a.pool>0,a.active?Math.ceil(a.pool)+' HP':a.used?(a.pool>0?Math.ceil(a.pool)+' HP · ready':'Spent'):String(J.c),a.used?1-a.pool/100:0];}return rows;};
async function netLeaderboard(){try{const r=await fetch(NET.url+'/leaderboard'),data=await r.json(),body=mpEl('pLb');if(!body)return;body.textContent='';for(const p of data.rows||[]){const tr=document.createElement('tr');for(const text of [p.name,p.kills+' K · '+p.deaths+' D · '+p.wins+' W']){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}if(!body.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.textContent='No completed online matches yet';tr.append(td);body.append(tr);}const note=body.closest('.x-pp')?.querySelector('.x-cre');if(note)note.textContent=data.scope+' · saved globally';}catch(e){const body=mpEl('pLb');if(body)body.textContent='Global board unavailable';}}
let netProfileRequest=0;async function netProfileStats(){const request=++netProfileRequest;const dl=mpEl('pDl');if(!dl)return;let box=document.getElementById('netStats');if(!box){box=document.createElement('section');box.id='netStats';box.style.cssText='margin:12px 0 20px;padding:16px;border:1px solid #455c67;background:#142632';dl.parentNode.insertBefore(box,dl.parentNode.firstChild);}let token=netSessionToken;try{token=token||localStorage.getItem('vs.serverToken');}catch(e){}box.textContent=token?'Loading online record…':'Play an online match to create a saved online record on this browser.';if(!token)return;try{const r=await fetch(NET.url+'/stats',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Profile unavailable');const data=await r.json(),p=data.profile;if(request!==netProfileRequest)return;box.textContent='';const title=document.createElement('h3');title.textContent='ONLINE RECORD';title.style.cssText='margin:0 0 12px;font-size:14px;letter-spacing:.12em';box.append(title);const list=document.createElement('dl');list.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px;margin:0';for(const [name,value]of [['Matches',p.matches],['Kills',p.kills],['Deaths',p.deaths],['K/D',(p.kills/Math.max(1,p.deaths)).toFixed(2)],['Wins',p.wins]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=String(value);dd.style.margin='0';list.append(dt,dd);}box.append(list);const note=document.createElement('small');note.textContent=data.scope+(netTokenPersistent?'. Browser-linked anonymous identity, not account recovery.':'. Temporary session identity: browser storage is unavailable, so this record cannot be recovered after closing this page.');note.style.cssText='display:block;margin-top:12px;opacity:.65;font-size:11px';box.append(note);}catch(e){if(request!==netProfileRequest)return;box.textContent='Online record unavailable. Your saved local practice data is below.';}}
const netProfRender0=window.xProfRender;window.xProfRender=function(){const r=netProfRender0?.apply(this,arguments);netProfileStats();return r;};
const profileEyebrow=document.querySelector('#mProf .eyebrow');if(profileEyebrow)profileEyebrow.textContent='Online record + local practice';const localProfileLabel=document.createElement('h3');localProfileLabel.textContent='LOCAL PRACTICE · THIS DEVICE';localProfileLabel.style.cssText='font-size:11px;letter-spacing:.08em;margin:16px 0 8px;opacity:.7';const localProfileLevel=document.querySelector('#mProf .x-plv');if(localProfileLevel)localProfileLevel.parentNode.insertBefore(localProfileLabel,localProfileLevel);
const netPresence=document.createElement('small');netPresence.id='netPresence';netPresence.style.cssText='display:block;font-size:11px;opacity:.65';netPresence.textContent='Online count unavailable';const netRoomHeader=document.querySelector('.x-qon__h');if(netRoomHeader)netRoomHeader.append(netPresence);async function netPresenceRefresh(){if(document.hidden)return;try{const r=await fetch(NET.url+'/rooms');if(!r.ok)throw Error('Directory unavailable');const data=await r.json();if(!Number.isSafeInteger(data.online)||data.online<0)throw Error('Count unavailable');netPresence.textContent=data.online+' connected '+(data.online===1?'player':'players')+' · active server rooms';}catch(e){netPresence.textContent='Online count unavailable';}}netPresenceRefresh();setInterval(netPresenceRefresh,15000);
const netBoardTab=document.querySelector('[data-pt="w"]');if(netBoardTab)netBoardTab.textContent='Global board';
const netProfile=mpEl('profBtn');document.addEventListener('click',e=>{if(e.target.closest('[data-pt="w"],#profBtn,[aria-label="Open your profile"]'))setTimeout(netLeaderboard,50);});
const netHeader=document.querySelector('.x-qon__h small');if(netHeader)netHeader.textContent='Server-authoritative rooms · bots fill empty slots';

// Combat consistency (#10). Rows carry [17] crouch fraction and [18] aim pitch so remote rigs crouch where the
// server's hit volumes are crouched. Replayed enemy casts are visual only online: blind, nearsight and concussion
// come from the server's private status (mpCliRS), never from the local replay's own range/facing guesses.
const netPose0=mpCliSnap;mpCliSnap=function(m){const r=netPose0.apply(this,arguments);if(NET.socket&&m&&Array.isArray(m.u)){const all=bots.concat(allies);for(const e of m.u){if(!Array.isArray(e)||e[0]===MP.me)continue;const u=all.find(x=>x.nid===e[0]);if(!u)continue;if(Number.isFinite(e[17]))u.cr=e[17]>.5;if(Number.isFinite(e[18]))u.np=e[18];}}return r;};
let netFxReplay=0,netFxPoint=null;
const netMpFx0=mpFx;mpFx=function(u,ag,k,o,d,auth,p){if(!NET.socket)return netMpFx0.apply(this,arguments);netFxReplay++;netFxPoint=p&&Number.isFinite(p.y)?p.y:null;try{return netMpFx0.apply(this,arguments);}finally{netFxReplay--;netFxPoint=null;}};
const netPNs0=pNs;pNs=function(){if(NET.socket&&netFxReplay)return;return netPNs0.apply(this,arguments);};
const netCon0=xConStart;xConStart=function(){if(NET.socket&&netFxReplay)return;return netCon0.apply(this,arguments);};
const netEnPop0=enPop;enPop=function(p){if(!NET.socket)return netEnPop0.apply(this,arguments);const hp=player.hp;player.hp=0;try{return netEnPop0.apply(this,arguments);}finally{player.hp=hp;}};
// Server smokes sit on the floor they landed on (p[1] = floor + 0.1); keep the rendered sphere on that floor too (a Cyber Cage
// cylinder is centred on the floor itself, as the server's cageBlocks).
const netSmoke0=enSmoke;enSmoke=function(){const r=netSmoke0.apply(this,arguments);if(NET.socket&&netFxReplay&&netFxPoint!=null){const S=J.smokes[J.smokes.length-1];if(S&&S.m)S.m.position.y=netFxPoint-.1+(S.cyl?0:1.8);}return r;};
// Floor weapons (#4): the server owns every floor gun (snapshot fw rows [id,weapon,x,y,z]) and every swap.
// F asks for the gun under the crosshair by id, G asks to drop the gun in hand; the private round state's
// ld [primary,secondary] keeps both slots in step after a pick-up, drop or death.
const netFloor=new Map();
function xdFloorList(){return NET.socket&&MP.st==='game'&&MP.m5?[...netFloor.values()]:(xdOn()?XD.L:null);}
function netFloorClear(){for(const d of netFloor.values()){scene.remove(d.m);XD.P.push(d.m);}netFloor.clear();}
function netFloorSync(rows){if(!Array.isArray(rows))return;const ids=new Set();for(const r of rows){if(!Array.isArray(r)||r.length<5||!WEAP[r[1]])continue;const [id,w,x,y,z]=r;if(![x,y,z].every(Number.isFinite))continue;ids.add(id);let d=netFloor.get(id);
  if(!d){const m=xdMesh();m.rotation.set(0,(id*2.399)%6.283,0);scene.add(m);try{xdModel(m,w);}catch(e){}d={id,w,x,y,z,m};netFloor.set(id,d);}Object.assign(d,{w,x,y,z});if(typeof r[5]==='string')d.sk=r[5];else delete d.sk;d.m.position.set(x,y+.08,z);}
 for(const [id,d]of netFloor)if(!ids.has(id)){scene.remove(d.m);XD.P.push(d.m);netFloor.delete(id);}}
const netFloorSnap0=mpCliSnap;mpCliSnap=function(m){const r=netFloorSnap0.apply(this,arguments);if(NET.socket&&MP.m5&&m&&m.fw)netFloorSync(m.fw);return r;};
const netFloorRS0=mpCliRS;// The saved loadout (ld) is not the held gun while the server has swapped one in for an ult or device (Tour De Force's
// Operator, Headhunter's Sheriff: rs.tw). Re-applying ld then took the swapped gun out of the page's hand and sent
// 'equip' for the old one, which ended Tour De Force on the server the moment it started (ult points spent, no Operator).
mpCliRS=function(m){const r=netFloorRS0.apply(this,arguments);if(NET.socket&&MP.m5&&Array.isArray(m.ld)&&player.hp>0){const tw=xWOwn(m.tw)?m.tw:null,p=xWOwn(m.ld[0])?m.ld[0]:null,sec=xWOwn(m.ld[1])?m.ld[1]:null;if(!(tw&&(FV.pri===tw||FV.sec===tw))&&(p!==FV.pri||(sec&&sec!==FV.sec)))mpCliLoad(m.ld);}return r;};
const netFloorReset0=mpReset;mpReset=function(){netFloorClear();return netFloorReset0.apply(this,arguments);};
addEventListener('keydown',e=>{if(!(NET.socket&&MP.st==='game'&&MP.m5)||xKbSkip(e)||e.repeat||!running||paused||player.hp<=0)return;
 if(e.code==='KeyF'){const d=xdLook([...netFloor.values()]);if(d){netSend({t:'pick',id:d.id});e.stopImmediatePropagation();}return;}
 if(e.code==='KeyG'){if(FV.sp&&FV.sp.st==='carry'&&FV.sp.c===player&&!(FV.buy>0))return;/* the Spike can't be dropped in the buy phase (server), so a carrier's G drops the held gun for a teammate then */if(rw==='pri'&&FV.pri){netSend({t:'dropw'});e.stopImmediatePropagation();}}},true);

// Fog of war (server fog.js): an enemy row the server flags hidden ([22] = 1: no position, aim, HP or ammo) leaves the
// enemy known (scoreboard, alive pips, kill feed) but not drawn: before the page reads the row its position is pinned to
// where the enemy was last drawn (no jump toward 0,0,0); after, the model leaves the scene, its interpolation buffer is
// emptied and u.fog is set (shots, the minimap and name tags skip it). Its first relevant row brings it back where it is.
function netFogPre(m){if(!NET.socket||!m||!Array.isArray(m.u))return;const all=bots.concat(allies);for(const e of m.u){if(!Array.isArray(e)||e[0]===MP.me)continue;const u=all.find(x=>x.nid===e[0]);if(e[22]===1){/* a hidden row has no weapon (server fogRow [11] = ''): keep the gun last seen in the world (a new unit: Classic) */if(e[11]==='')e[11]=u&&u.w&&WEAP[u.w]?u.w:'Classic';if(u&&u.g){e[4]=u.g.position.x;e[5]=u.g.position.y;e[6]=u.g.position.z;e[7]=u.g.rotation.y;u.fog=1;/* before the page's event loop: no shot sound at a stale spot */}}else if(u&&u.fog){u.fog=0;if(u.nb)u.nb.length=0;u.fogBack=1;}}}
function netFogPost(m){if(!NET.socket||!m||!Array.isArray(m.u))return;const all=bots.concat(allies);for(const e of m.u){if(!Array.isArray(e)||e[0]===MP.me)continue;const u=all.find(x=>x.nid===e[0]);if(!u)continue;
  if(e[22]===1){u.fog=1;u.fogBack=0;if(u.nb)u.nb.length=0;if(u.g&&u.g.parent)u.g.parent.remove(u.g);}
  else if(u.fogBack){u.fogBack=0;if(u.alive&&u.g){u.g.position.set(e[4],e[5]||0,e[6]);u.g.rotation.y=e[7];if(u.g.parent!==scene)scene.add(u.g);}}}}
const netFog0=mpCliSnap;mpCliSnap=function(m){netFogPre(m);const r=netFog0.apply(this,arguments);netFogPost(m);return r;};
if(typeof mpMkUnit==='function'){const netFogMk0=mpMkUnit;mpMkUnit=function(e){if(Array.isArray(e)&&e[22]===1&&e[11]==='')e[11]='Classic';const u=netFogMk0.apply(this,arguments);if(NET.socket&&u&&Array.isArray(e)&&e[22]===1){u.fog=1;if(u.nb)u.nb.length=0;if(u.g&&u.g.parent)u.g.parent.remove(u.g);}return u;};}/* guarded: test sandboxes slice this file without the page */
// Remote footsteps (online): the page played footsteps only for its own offline bots, so online nobody heard an enemy (or
// ally) run. Rows carry [23] = running footsteps (server simulation.js loud = shared Motor.runs: faster than 0.65x its weapon's
// run speed, no walk / duck). qa-34: a drawn, live, relevant unit with it steps by DISTANCE like the player and the offline bots
// (Motor.footfall: one step per 1.85 m its drawn model moves while running; the first step is silent), not on a fixed 0.4 s
// timer (2.16 m per step at rifle speed, 2.7 m with the knife). Rows carry no velocity; the drawn position moves at the
// server's speed, so the bank follows it.
function netStepFlags(m){if(!NET.socket||!m||!Array.isArray(m.u))return;const all=bots.concat(allies);for(const e of m.u){if(!Array.isArray(e)||e[0]===MP.me)continue;const u=all.find(x=>x.nid===e[0]);if(u)u.loud=e[23]===1&&e[22]!==1;}}
// hk-35: real time, at most one step per frame. A slow page (browser fog5 ~0.2 fps, frames 4.5 s apart) still hears the runner:
// a long frame banks the whole distance and sounds ONE step (Motor.footfall carries the rest mod 1.85 m, no burst). A jump faster
// than 15 m/s of real time (respawn / fog reappearance) is a teleport and banks nothing.
let netStepT=0;function netSteps(){if(!(NET.socket&&MP.st==='game'&&running)){netStepT=0;return;}const now=performance.now(),dt=netStepT?Math.max(0,(now-netStepT)/1000):0;netStepT=now;const M=typeof window!=='undefined'&&window.ValorantFeel;if(!M||!M.footfall)return;
 for(const L of [bots,allies])for(const u of L){if(!u)continue;const q=u.g&&u.g.position;if(!u.alive||u.fog||!u.g||u.g.parent!==scene){u.fd=0;u.fsP=null;continue;}
  const P=u.fsP,d=P?Math.hypot(q.x-P.x,q.z-P.z):0,mv=d>15*Math.max(dt,1/30)+.5?0:d;u.fsP={x:q.x,z:q.z};if(M.footfall(u,mv,Math.min(1,dt),!!u.loud)){try{SFX.step(q);}catch(err){}}}}/* walking / crouching (flag 0): the bank drains */
if(typeof window!=='undefined')(window.XHK||(window.XHK=[])).push(netSteps);
const netStep0=mpCliSnap;mpCliSnap=function(m){const r=netStep0.apply(this,arguments);netStepFlags(m);return r;};
// Fog of war, casts (server fog.js fogCast): a cast from an enemy we can't see or hear comes without the caster's eye and
// aim, flagged fog:1. With p (its effect point is in our sight) the effect is drawn there - the replay reads the caster's
// spot from its model, so the model stands at p for that call only; without p there is nothing to draw (no stale spot).
if(typeof mpCastFx==='function'){const netCastFx0=mpCastFx;mpCastFx=function(m){if(!(NET.socket&&m&&m.fog))return netCastFx0.apply(this,arguments);if(!Array.isArray(m.p)||m.p.length!==3||!m.p.every(Number.isFinite))return;
 const u=bots.find(x=>x&&x.nid===m.i)||allies.find(x=>x&&x.nid===m.i);if(!u||!u.g)return;const P=u.g.position,x=P.x,y=P.y,z=P.z;P.set(m.p[0],m.p[1],m.p[2]);
 try{return netCastFx0.call(this,{...m,o:[m.p[0],m.p[1]+1.6,m.p[2]]});}finally{P.set(x,y,z);}};}
// Online soul resources and buff presentation follow private server round state.
const netSouls=new Map();
function netReynaClear(){for(const m of netSouls.values()){scene.remove(m);m.material.dispose();}netSouls.clear();}
function netReynaSync(state){netReyna=state||null;const valid=player.hp>0&&state,rows=valid?state.souls||[]:[],ids=new Set(rows.map(s=>s.id));
 for(const [id,m]of netSouls)if(!ids.has(id)){scene.remove(m);m.material.dispose();netSouls.delete(id);}
 J.so=[];for(const s of rows){let m=netSouls.get(s.id);if(!m){m=new THREE.Mesh(orbGeo,fireMat(0xc04dff,.9));m.scale.setScalar(1.4);netSouls.set(s.id,m);}m.position.set(...s.p);scene.add(m);J.so.push({m,p:m.position,t:s.remaining});}
 J.emp=valid&&state.empress?1:0;J.dis=valid?state.dismiss:0;J.ohT=valid?state.overheal:0;J.hl=null;const overlay=document.getElementById('xEmp');if(overlay){overlay.classList.toggle('on',!!J.emp);overlay.classList.toggle('dis',J.dis>0);}
}
const netSoul0=rySoul;rySoul=function(){if(NET.socket)return;return netSoul0.apply(this,arguments);};
const netSgSl0=sgSl;sgSl=function(u,cq){if(!(NET.socket&&J.pick==='Reyna'&&netReyna))return netSgSl0(u,cq);const A=netReyna,n=(A.souls||[]).filter(s=>Math.hypot(s.p[0]-player.x,s.p[2]-player.z)<15).length,ready=n>0&&(J.q>0||A.empress)&&!(A.dismiss>0),label=(A.empress?'∞':J.q)+' · '+n+' orb'+(n===1?'':'s');return [['jC',J.c,J.c+'',0],['jQ',ready,A.devour>0?'Healing':label,0],['jE',ready,A.dismiss>0?A.dismiss.toFixed(1)+' s':label,0],['jX',A.empress||J.ult>=u,A.empress?'On':J.ult+'/'+u,0]];};


// Throw intent carries no damage, victim, position or remaining-knife claims.
const netThrow0=jThrow;jThrow=function(){if(!(NET.socket&&MP.st==='game'&&(MP.m5||NET.tab)))return netThrow0.apply(this,arguments);if(!running||player.hp<=0||FV.buy>0||!J.bsOn||J.bs<1||J.cd.x>0)return;J.cd.x=1/6;/* server Blade Storm fireRate 6 (wiki) */netSend({t:'blade'});kick=1;SFX.ab('bsThrow');};
const netBurst0=jBurst;jBurst=function(){if(!(NET.socket&&MP.st==='game'&&(MP.m5||NET.tab)))return netBurst0.apply(this,arguments);if(!running||player.hp<=0||FV.buy>0||!J.bsOn||J.bs<1||J.cd.x>0)return;J.cd.x=XBSD.un;J.bsU=XBSD.un;/* server fireBladeBurst: 0.45 s burst unequip */netSend({t:'blade',alt:1});kick=1;SFX.ab('bsThrow');};

// ---- PARTY MODES (modes-1, user 2026-10-26: "add more gamemodes for multiplayer and make it so you can change gamemode when in a team") ----
// The server room is the party. Its leader (host) picks the mode and map from the Online panel while the party is in the lobby; the
// server re-seats everyone and every member's panel follows the room live (read-only for members). START queues a countdown on the
// server that every member sees; a mode / map change, the leader cancelling or leaving cancels it. What the server offers comes from
// /health (modes, features); a server without them keeps the old behaviour (DM / TDM / Unrated buttons, immediate start).
// Modes: Escalation ('esc', a team respawn mode, the page runs its TDM path with the server's levels), Swiftplay / Spike Rush /
// Replication (Spike rounds on the 'five' path, rules on the server: server/src/modes.js). Skirmish 1v1 ('skm'): see the SKIRMISH block below.
const NM_NAMES={dm:'Deathmatch',tdm:'Team Deathmatch',esc:'Escalation',five:'Unrated (Spike) · 5v5',swift:'Swiftplay · first to 5',sr:'Spike Rush · first to 4',rep:'Replication · first to 5',skm:'Skirmish 1v1 · first to 5'};
const NM_LEGACY=['dm','tdm','five'],NM_MAPS=['ascent','bind','haven','split','lotus','breeze'];
function netHealth(){const now=performance.now();if(NET.healthReq||NET.health||(NET.healthAt&&now-NET.healthAt<30000))return;NET.healthAt=now;
 try{NET.healthReq=Promise.resolve(fetch(NET.url+'/health')).then(r=>r.json()).then(h=>{if(!h||!Array.isArray(h.modes))throw Error('bad health');NET.health={modes:h.modes.filter(m=>typeof m==='string'),features:Array.isArray(h.features)?h.features.filter(f=>typeof f==='string'):[]};mpUI();}).catch(()=>{NET.health=null;}).finally(()=>{NET.healthReq=null;});}catch(e){NET.healthReq=null;}}
const netFeat=f=>!!(NET.health&&NET.health.features.includes(f));
const netModeOk=m=>NET.health?NET.health.modes.includes(m):NM_LEGACY.includes(m);
const netLeader=()=>!!(MP.on&&NET.host&&MP.st==='room'&&netFeat('party-mode'));
// Lobby notes from the party flow (queue cancelled, mode changed) stay up for 4 s: the room frame that follows would say 'Connected'.
function nmNote(t){NET.nmNote={t:String(t),until:performance.now()+4000};mpMsg(t);}
const nmUI0=mpUI;mpUI=function(){nmUI0();try{netHealth();if(NET.nmNote&&MP.on&&NET.nmNote.until>performance.now()&&MP.msg!==NET.nmNote.t)mpMsg(NET.nmNote.t);const box=mpEl('xOn');if(!box)return;const R=MP.room,inR=!!MP.on,lead=netLeader(),q=inR&&R&&R.q>0&&MP.st==='room'?R.q:0;
 box.querySelectorAll('[data-om]').forEach(b=>{const m=b.dataset.om,ok=netModeOk(m);b.disabled=!ok||(inR?!lead:mpBusy());b.setAttribute('aria-pressed',m===MP.mode?'true':'false');b.title=!ok?'Not offered by the game server yet':inR&&!NET.host?'Only the party leader can change the mode':inR&&!netFeat('party-mode')?'This game server cannot change the mode of an open room':'';});
 const map=mpEl('xOnMap');if(map&&inR){map.disabled=!lead;if(R&&R.map&&map.value!==R.map)map.value=R.map;}
 if(inR){const set=(id,t)=>{const e=mpEl(id);if(e&&e.textContent!==t)e.textContent=t;};set('xOnRoomM',(NM_NAMES[MP.mode]||MP.mode)+' · '+String((R&&R.map)||MP.map||'ascent').replace(/^./,c=>c.toUpperCase())+(q?' · match starts in '+q+' s':'')+((R&&R.st)==='game'?' · match in progress':''));
  const st=mpEl('xOnStart');if(st&&NET.host&&MP.st==='room'){st.textContent=q?'Cancel queue ('+q+')':MP.pub?'Start now':'Start';st.disabled=false;}
  set('xOnWait',q?'Match starts in '+q+' s':NET.host?(MP.st==='room'?'Party leader · pick the mode and map':''):MP.st==='post'?'Match over · waiting for the party leader':'Party leader picks the mode · waiting to start');}
}catch(e){}};
mpStart=function(){if(!(NET.host&&MP.st==='room'))return;if(netFeat('queue'))netSend({t:'queue',on:MP.room&&MP.room.q>0?0:1});else netSend({t:'start'});};
try{mpEl('xOn').querySelectorAll('[data-om]').forEach(b=>b.addEventListener('click',()=>{if(!netLeader())return;const want=b.dataset.om;if(MP.room&&MP.room.mode===want)return;netSend({t:'mode',mode:want});nmNote('Changing the party mode to '+(NM_NAMES[want]||want).split(' · ')[0]+'…');mpUI();}));
 mpEl('xOnMap').addEventListener('change',()=>{if(!netLeader())return;let m=mpEl('xOnMap').value;if(m==='random')m=NM_MAPS[Math.floor(Math.random()*NM_MAPS.length)];if(!NM_MAPS.includes(m)||(MP.room&&MP.room.map===m))return mpUI();netSend({t:'mode',map:m});nmNote('Changing the map…');});}catch(e){}
// Room replies: a refused change ('mo') puts the selector back on the room's mode; a cancelled queue ('qx') says why.
const nmMsg0=mpCliMsg;mpCliMsg=function(m){
 if(m&&m.t==='mo'){if(!m.ok){if(MP.room){MP.mode=MP.room.mode;MP.map=MP.room.map;}nmNote(typeof m.why==='string'?m.why:'Mode not changed');}else{const n=(NM_NAMES[MP.mode]||MP.mode).split(' · ')[0];nmNote(performance.now()-(NET.qxAt||-1e9)<3000&&NET.nmNote?NET.nmNote.t+' · now '+n:'Party mode: '+n);}return mpUI();}
 if(m&&m.t==='qx'){NET.qxAt=performance.now();nmNote(typeof m.why==='string'?m.why:'Queue cancelled');return mpUI();}
 if(m&&m.t==='s'&&MP.st==='game'){if(m.esc)nmEscHud(m.esc);if(MP.gm==='esc')try{const me=(m.u||[]).find(e=>e[0]===MP.me);if(me&&me[11]==='Knife'&&rw!=='knife'&&running)swapW('knife');}catch(e){}}
 return nmMsg0.apply(this,arguments);};
// Match start: Escalation plays the TDM path (levels and weapons come from the server); Replication switches the page to the team's agent.
const nmStart0=mpCliStart;mpCliStart=function(m){MP.gm=m&&typeof m.gm==='string'?m.gm:m&&m.mode;
 if(m&&m.gm==='rep'&&m.rs&&typeof m.rs.rag==='string'&&KITS[m.rs.rag]&&m.rs.rag!==J.pick){MP.repPrev=MP.repPrev||J.pick;J.pick=m.rs.rag;try{xVmAg(J.pick);}catch(e){}}
 if(m&&m.mode==='esc')m=Object.assign({},m,{mode:'tdm'});const r=nmStart0.call(this,m);nmGmHud();return r;};
const nmRS0=mpCliRS;mpCliRS=function(rs){try{if(rs&&MP.gm&&rs.gm===MP.gm)nmVarHud(rs);}catch(e){}return nmRS0.apply(this,arguments);};
const nmMenu0=dmMenu;dmMenu=function(on){if(on&&MP.cl&&MP.gm==='esc'&&MP.st==='game'){say('No buy menu in Escalation',900);return;}return nmMenu0.apply(this,arguments);};
const nmReset0=mpReset;mpReset=function(){if(MP.repPrev){J.pick=MP.repPrev;MP.repPrev=null;}MP.gm=null;nmGmClear();return nmReset0.apply(this,arguments);};
// HUD line under the score bar for the new modes, and the Spike Rush power orbs.
function nmHudEl(){let el=document.getElementById('xGmHud');if(!el){el=document.body.appendChild(document.createElement('div'));el.id='xGmHud';el.setAttribute('role','status');el.style.cssText='pointer-events:none;position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:60;padding:3px 10px;background:rgba(15,25,35,.72);color:#ece8e1;font:600 12px var(--sans,sans-serif);letter-spacing:.12em;white-space:nowrap;display:none';}return el;}
function nmGmHud(){const n={esc:'ESCALATION',swift:'SWIFTPLAY · FIRST TO 5',sr:'SPIKE RUSH · FIRST TO 4',rep:'REPLICATION · FIRST TO 5'}[MP.gm];const el=nmHudEl();el.textContent=n||'';el.style.display=n?'block':'none';}
function nmEscHud(E){if(!Array.isArray(E.lv)||!Array.isArray(E.pt))return;const me=MP.team===1?1:0,th=1-me,lv=Math.min(12,E.lv[me]|0),el=nmHudEl();const w=Array.isArray(E.w)?String(E.w[me]||''):'';const need=Array.isArray(E.n)?E.n[me]:7;
 const t='ESCALATION · LV '+Math.min(12,lv+1)+'/12 '+w.toUpperCase()+' · '+(+E.pt[me]||0)+'/'+need+' · ENEMY LV '+Math.min(12,(E.lv[th]|0)+1);if(el.textContent!==t)el.textContent=t;el.style.display='block';
 if(MP.escLv!=null&&lv>MP.escLv)try{say('Your team · level '+(lv+1)+' · '+w,1400);}catch(e){}MP.escLv=lv;}
function nmVarHud(rs){const el=nmHudEl(),n={swift:'SWIFTPLAY',sr:'SPIKE RUSH',rep:'REPLICATION'}[rs.gm];if(!n)return;let t=n+' · FIRST TO '+(rs.win|0);if(rs.gm==='sr'&&typeof rs.gun==='string')t+=' · '+rs.gun.toUpperCase()+' FOR EVERYONE';if(rs.gm==='rep'&&typeof rs.rag==='string')t+=' · ALL '+rs.rag.toUpperCase();if(rs.fg>0)t+=' · FLASHGUARD '+Math.ceil(rs.fg)+'s';if(rs.gm==='sr'&&Array.isArray(rs.pw)&&rs.pw.length){const N=window.xSrPw&&xSrPw.names||{};t+=' · '+rs.pw.filter(x=>typeof x==='string'&&N[x]).map(x=>N[x].toUpperCase()).join(' · ');}/* active Spike Rush powerups (server srpowerups.js srActive) */if(el.textContent!==t)el.textContent=t;el.style.display='block';if(rs.gm==='sr')nmOrbs(Array.isArray(rs.orb)?rs.orb:[]);}
const NM_ORBS=new Map();
// Spike Rush powerup orbs: o[5] the type (server srpowerups.js), coloured as the offline ones (game_rules_runtime.js SRPW.col); keyed by id + type.
function nmOrbs(list){const keep=new Set(),C=window.xSrPw&&xSrPw.col||{};for(const o of list){if(!Array.isArray(o)||o.length<4||![1,2,3].every(i=>Number.isFinite(o[i])))continue;const ty=typeof o[5]==='string'?o[5]:'',key=o[0]+':'+ty+(o[4]?':f':'');keep.add(key);if(NM_ORBS.has(key))continue;try{const m=new THREE.Mesh(new THREE.OctahedronGeometry(o[4]?0.45:0.35),new THREE.MeshBasicMaterial({color:C[ty]||(o[4]?0xffd34d:0xb48cff)}));m.userData.srType=ty;m.position.set(o[1],o[2]+(o[4]?0.45:0.35),o[3]);scene.add(m);NM_ORBS.set(key,m);}catch(e){}}
 for(const [id,m]of NM_ORBS)if(!keep.has(id)){try{scene.remove(m);m.geometry.dispose();m.material.dispose();}catch(e){}NM_ORBS.delete(id);}}
// Ultimate orbs from the server (server/src/ultorbs.js; Unrated / Swiftplay / Replication): rs.uo [[id, x, y, z, channelled 0..1]] on
// the nav floor, rs.uoc this player's own 2 s channel (hold F, standing). The offline orb block stands down while connected.
// One shared geometry / material (never disposed: userData.shared), one mesh per orb id, the channel bar like the offline one.
const NM_UO=new Map();let nmUoG=null,nmUoM=null,nmUoB=null;
function nmUoBar(){if(!nmUoB){nmUoB=document.body.appendChild(document.createElement('div'));nmUoB.className='x-orbBar';nmUoB.id='xUoBar';nmUoB.style.cssText='position:fixed;left:50%;top:60%;width:120px;height:6px;margin-left:-60px;border-radius:3px;background:rgba(255,255,255,.18);z-index:61;display:none;overflow:hidden';const b=nmUoB.appendChild(document.createElement('b'));b.style.cssText='display:block;height:100%;width:0;background:#9ffff0';}return nmUoB;}
function nmUltOrbs(rs){const list=Array.isArray(rs&&rs.uo)?rs.uo:[],keep=new Set();
 for(const o of list){if(!Array.isArray(o)||o.length<4||![1,2,3].every(i=>Number.isFinite(o[i])))continue;keep.add(o[0]);let m=NM_UO.get(o[0]);
  if(!m){try{if(!nmUoG){nmUoG=new THREE.OctahedronGeometry(.22,0);nmUoG.userData.shared=true;nmUoM=new THREE.MeshBasicMaterial({color:0x9ffff0,transparent:true,opacity:.95});}m=new THREE.Mesh(nmUoG,nmUoM);m.scale.set(1,1.5,1);m.raycast=()=>{};scene.add(m);NM_UO.set(o[0],m);}catch(e){continue;}}
  m.position.set(o[1],o[2]+0.33,o[3]);}
 for(const [id,m]of NM_UO)if(!keep.has(id)){try{scene.remove(m);}catch(e){}NM_UO.delete(id);}
 const c=+(rs&&rs.uoc)||0,bar=c>0||nmUoB?nmUoBar():null;if(bar){bar.style.display=c>0?'block':'none';if(c>0)bar.firstChild.style.width=Math.min(100,c*100)+'%';}}
{const nmUo0=mpCliRS;mpCliRS=function(rs){try{nmUltOrbs(rs);}catch(e){}return nmUo0.apply(this,arguments);};}
function nmGmClear(){MP.escLv=null;nmOrbs([]);nmUltOrbs(null);const el=document.getElementById('xGmHud');if(el)el.style.display='none';}
setInterval(()=>{try{for(const m of NM_ORBS.values())m.rotation.y+=.1;for(const m of NM_UO.values())m.rotation.y+=.1;if(!MP.on||MP.st!=='game'){if(NM_UO.size)nmUltOrbs(null);const el=document.getElementById('xGmHud');if(el&&el.style.display!=='none'){el.style.display='none';nmOrbs([]);}}}catch(e){}},100);

// ---- SKIRMISH 1v1 (online only; server/src/modes.js SkirmishSimulation) ----
// Two players, one per team, no bots, elimination rounds without the Spike, first to 5. The page plays its Deathmatch path (free
// loadout, every other unit an enemy) with the server's rounds: the snapshot's skm row {r, sc, win, ph buy|live|end|wait|over, t, ld,
// lw, why} drives the HUD line (round score, round, phase), the round banners, the buy-phase hold (no walking / firing, as the
// server), the loadout menu (buy phase only) and the result screen. A server whose /health lacks 'skm' (the deployed worker until
// the owner deploys it) keeps the button disabled and the Online panel says why.
const SKM_MSG='Skirmish 1v1 needs the updated game server · not offered by this server yet';
const nmSkmOn=()=>!!(MP.on&&MP.cl&&MP.gm==='skm'&&MP.st==='game');
// The server holds walking in the buy phase only (jumping stays free) and fire outside 'live' (modes.js SkirmishSimulation):
// the page holds the same, or its prediction fights the server (between rounds the page stood still while the server walked
// the survivor; a buy-phase jump went up on the server only - reconcile eases / snaps of ~1 m).
const nmSkmHold=()=>nmSkmOn()&&!!MP.skm&&MP.skm.ph!=='live';/* no shots */
const nmSkmBuy=()=>nmSkmOn()&&!!MP.skm&&MP.skm.ph==='buy';/* no walking */
const NM_SKM_WALK=['KeyW','KeyA','KeyS','KeyD'];
function nmSkmScore(K){const me=MP.team===1?1:0,sc=Array.isArray(K&&K.sc)?K.sc:[0,0];return [sc[me]|0,sc[1-me]|0];}
function nmSkmHud(K){if(!K||!Array.isArray(K.sc))return;const prev=MP.skm;MP.skm=K;if(prev&&prev.ph==='buy'&&K.ph!=='buy'&&typeof DM!=='undefined'&&DM.menu)try{dmMenu(false);}catch(e){}const [mine,theirs]=nmSkmScore(K),el=nmHudEl(),ph=String(K.ph||'');
 /* round-1 load wait (skm.ld = the server's wait left, max 20 s): 'Waiting for opponent' with the seconds, not a buy timer that does not move */
 const ld=ph==='buy'&&+K.ld>0?Math.ceil(+K.ld):0,pld=prev&&prev.ph==='buy'&&+prev.ld>0?Math.ceil(+prev.ld):0;
 const tail=ld?' · WAITING FOR OPPONENT… '+ld+'s':ph==='buy'?' · BUY '+Math.ceil(+K.t||0)+'s':ph==='wait'?' · WAITING FOR OPPONENT '+Math.ceil(+K.t||0)+'s':ph==='end'?' · ROUND OVER':'';
 const t='SKIRMISH 1V1 · YOU '+mine+' – '+theirs+' ENEMY · FIRST TO '+(K.win|0)+' · ROUND '+(K.r|0)+tail;if(el.textContent!==t)el.textContent=t;el.style.display='block';
 if(ld){if(ld!==pld||!prev||prev.r!==K.r)try{say('Waiting for opponent to load… '+ld+'s',1500);}catch(e){}}
 else if(pld&&ph==='buy'&&prev.r===K.r)try{say('Round '+(K.r|0)+' · buy phase · B for loadout',1500);}catch(e){}
 else if(!prev||prev.ph!==ph||prev.r!==K.r)try{const me=MP.team===1?1:0;
  if(ph==='end')say(K.lw===me?'Round won · '+mine+' – '+theirs:K.lw===1-me?'Round lost · '+mine+' – '+theirs:'Round draw · '+mine+' – '+theirs,1800);
  else if(ph==='buy')say('Round '+(K.r|0)+' · buy phase · B for loadout',1500);
  else if(ph==='live')say('Fight · first to '+(K.win|0),900);
  else if(ph==='wait')say('Opponent left · waiting for them to rejoin',2200);}catch(e){}}
{const m0=mpCliMsg;mpCliMsg=function(m){if(m&&(m.t==='s'||m.t==='end')&&m.skm&&(MP.gm==='skm'||m.t==='end'&&MP.skm))try{nmSkmHud(m.skm);}catch(e){}return m0.apply(this,arguments);};}
{const s0=mpCliStart;mpCliStart=function(m){if(m&&m.mode==='skm'){MP.skm=null;m=Object.assign({},m,{mode:'dm',gm:'skm'});}const r=s0.call(this,m);if(m&&m.gm==='skm')try{say('Skirmish 1v1 · first to '+((m.win|0)||5)+' rounds · '+(MP.pub?'public match':'room '+MP.code),2200);}catch(e){}return r;};}
// buy phase: walking held (jump free); outside 'live': no shots - as the server
{const v0=moveP;moveP=function(dt,run,hold){if(!nmSkmBuy())return v0.apply(this,arguments);/* walk keys off for this step only: the motor's hold would also block the jump */const K=keys,was=NM_SKM_WALK.map(c=>K[c]);NM_SKM_WALK.forEach(c=>{K[c]=false;});try{return v0.apply(this,arguments);}finally{NM_SKM_WALK.forEach((c,i)=>{K[c]=was[i];});}};}
{const f0=shoot;shoot=function(){if(nmSkmHold())return false;return f0.apply(this,arguments);};}
{const d0=dmMenu;dmMenu=function(on){if(on&&nmSkmOn()&&!(MP.skm&&MP.skm.ph==='buy')){say('Loadout changes in the buy phase only',1000);return;}return d0.apply(this,arguments);};}
// a gun change is the buy phase's only (server refuses it after): no pick outside it, as the menu (it stayed open past the buy
// phase and its pick stayed on the page until the server's refusal put the old gun back)
{const g0=dmGive;dmGive=function(n){if(nmSkmOn()&&!nmSkmBuy()&&n!==FV.pri&&n!==FV.sec){say('Loadout changes in the buy phase only',1000);return false;}return g0.apply(this,arguments);};}
// top HUD: the round score boxes and the subtitle are Skirmish's (the Deathmatch path left them 0 - 0, 'Deathmatch · first to 5')
{const h0=xHud;xHud=function(){const r=h0.apply(this,arguments);if(nmSkmOn()&&MP.skm)try{const K=MP.skm,[mine,theirs]=nmSkmScore(K);setT('xSA',mine);setT('xSE',theirs);setT('xSub','Skirmish 1v1 · '+((typeof F_MAPN!=='undefined'&&F_MAPN[FV.map])||'Ascent')+' · first to '+((K.win|0)||5)+' · Round '+((K.r|0)||1));}catch(e){}return r;};}
{const r0=dmMR;dmMR=function(){const r=r0.apply(this,arguments);if(nmSkmOn()&&DM.el)try{const h=DM.el.querySelector('.x-dmg__head h2'),p=DM.el.querySelector('.x-dmg__head p');if(h)h.textContent='SKIRMISH 1V1';if(p)p.textContent='Free weapons · one primary + one sidearm · kept every round';}catch(e){}return r;};}
{const l0=dmLB;dmLB=function(){const r=l0.apply(this,arguments);if(nmSkmOn()&&DM.lb)try{const h=DM.lb.querySelector('.x-dmlb__h');if(h)h.textContent='SKIRMISH 1V1 · kills';}catch(e){}return r;};}
// own death: out until the next round (no respawn countdown, no spawn protection shown)
{const c0=mpCliSelf;mpCliSelf=function(e){const was=player&&player.hp>0;const r=c0.apply(this,arguments);if(nmSkmOn()){DM.pp=0;if(was&&player.hp<=0)try{say('Eliminated · out until the next round',1600);}catch(er){}}return r;};}
{const e0=dmEnd;dmEnd=function(){if(!(MP.cl&&MP.gm==='skm'&&MP.skm))return e0.apply(this,arguments);if(!running)return;running=false;fireHeld=false;if(DM.menu)dmMenu(false);FV.menu=false;
 const K=MP.skm,[mine,theirs]=nmSkmScore(K),won=mine>theirs,draw=mine===theirs,R=dmRank();if(won)stats.w++;try{showStats();}catch(e){}if(document.pointerLockElement)document.exitPointerLock();try{SFX.fanfare(won);}catch(e){}
 $('resTitle').textContent=won?'Victory':draw?'DRAW':'Defeat';$('resTitle').style.color=won?'#5fffb0':draw?'#f2f4f7':'#ff4655';
 $('resText').innerHTML='Skirmish 1v1 · '+mine+' – '+theirs+' rounds · first to '+(K.win|0)+(K.why==='forfeit'?' · '+(won?'opponent left':'forfeit'):'')+'<ol class="x-dmr">'+R.map((r,i)=>'<li'+(r.n==='You'?' class="me"':'')+'><span>'+(i+1)+'</span><b>'+r.n+'</b><em>'+r.k+' K · '+r.d+' D</em></li>').join('')+'</ol>';
 if(DM.lb)DM.lb.style.display='none';$('againBtn').textContent='Play again';$('result').style.display='flex';
 if(window.xCareerRec)try{const me=R.find(r=>r.n==='You')||{};xCareerRec({result:won?'win':draw?'draw':'loss',mode:'skirmish',map:(typeof F_MAPN!=='undefined'&&F_MAPN[FV.map])||FV.map,score:mine+' – '+theirs,kills:me.k,deaths:me.d});}catch(e){}};}
{const x0=mpReset;mpReset=function(){MP.skm=null;return x0.apply(this,arguments);};}
// End frame (mpsweep): the server names the leader in `over` whatever ended the match (worker.js: TDM / Escalation by team
// score, Deathmatch the top killer), so a match that ran out of time read "Enemy team reached 100 kills · 5–6". Only a target
// reached before the clock ran out keeps `over` (the end frame's tl is the match clock left: 0 when the time ran out).
// Online Escalation plays the TDM path (FV.esc off): its own end screen from the server's levels, never Team Deathmatch's.
{const m0=mpCliMsg;mpCliMsg=function(m){if(m&&(m.t==='s'||m.t==='end')&&m.esc&&Array.isArray(m.esc.lv))MP.escS=m.esc;if(m&&m.t==='end'&&NET.socket&&!m.skm&&!(m.tl>0))m.over=null;return m0.apply(this,arguments);};}
{const e0=dmEnd;dmEnd=function(){if(!(MP.cl&&NET.socket&&MP.gm==='esc'&&MP.escS))return e0.apply(this,arguments);if(!running)return;running=false;fireHeld=false;if(DM.menu)dmMenu(false);FV.menu=false;
 const E=MP.escS,me=MP.team===1?1:0,L=[E.lv[me]|0,E.lv[1-me]|0],P=Array.isArray(E.pt)?[E.pt[me]|0,E.pt[1-me]|0]:[0,0],top=12,fin=L[0]>=top?0:L[1]>=top?1:-1,sc=t=>L[t]*100+P[t],won=fin>=0?fin===0:sc(0)>sc(1),draw=fin<0&&sc(0)===sc(1),R=dmRank(),lvT=t=>Math.min(top,L[t]+1);
 const why=(fin>=0?(fin===0?'Your team':'Enemy team')+' finished the knife level':'Time up')+' · level '+lvT(0)+' vs '+lvT(1);
 if(DM.ts)DM.ts.style.display='none';if(DM.lb)DM.lb.style.display='none';DM.over=null;if(won)stats.w++;try{showStats();}catch(e){}if(document.pointerLockElement)document.exitPointerLock();try{SFX.fanfare(won);}catch(e){}
 $('resTitle').textContent=won?'Victory':draw?'DRAW':'Defeat';$('resTitle').style.color=won?'#5fffb0':draw?'#f2f4f7':'#ff4655';
 $('resText').innerHTML='Escalation · '+why+'<ol class="x-dmr">'+R.map((r,i)=>'<li'+(r.n==='You'?' class="me"':'')+'><span>'+(i+1)+'</span><b>'+r.n+'</b><em>'+r.k+' K · '+r.d+' D</em></li>').join('')+'</ol>';
 $('againBtn').textContent='Play again';$('result').style.display='flex';
 if(window.xCareerRec)try{const m=R.find(r=>r.n==='You')||{};xCareerRec({result:won?'win':draw?'draw':'loss',mode:'escalation',map:(typeof F_MAPN!=='undefined'&&F_MAPN[FV.map])||FV.map,score:'Lv '+lvT(0)+' – '+lvT(1),kills:m.k,deaths:m.d});}catch(e){}};}
{const x1=mpReset;mpReset=function(){MP.escS=null;return x1.apply(this,arguments);};}
// Online panel: say why Skirmish is greyed out on a server that does not offer it (and that it is 1v1 when it is selected)
{const u0=mpUI;mpUI=function(){u0.apply(this,arguments);try{const box=mpEl('xOn'),b=box&&box.querySelector('[data-om="skm"]');if(!b)return;let n=document.getElementById('xOnSkm');
  const off=!netModeOk('skm'),sel=MP.mode==='skm'&&!!MP.on,t=off?SKM_MSG:sel?'Skirmish 1v1 · two players, one per team · no bots · first to 5 rounds':'';
  if(off)b.title=SKM_MSG;if(!n){if(!t)return;n=document.createElement('p');n.id='xOnSkm';n.setAttribute('role','note');n.style.cssText='margin:4px 0 0;font:600 11px var(--sans,sans-serif);letter-spacing:.04em;color:#c9cdd3;opacity:.85';const seg=b.parentNode;seg.parentNode.insertBefore(n,seg.nextSibling);}
  if(n.textContent!==t)n.textContent=t;n.hidden=!t;}catch(e){}};}

// Online panel: a one-line description of the selected mode (user 2026-10-27: mode cards said only "NEW"), the rules the game
// server plays (simulation.js matchSeconds / maxKills, modes.js ESC / SKM / VARIANT_RULES, spike.js first to 13).
const NET_MODE_DESC={dm:'Deathmatch · free-for-all · first to 40 kills · 9:00',tdm:'Team Deathmatch · 5v5 · first team to 100 kills · weapons upgrade every stage · 9:30',five:'Unrated · plant or defuse the Spike · first to 13 rounds',esc:'Escalation · weapons change each level · first team through all 12 levels · 10:00',swift:'Swiftplay · plant or defuse the Spike · first to 5 rounds',sr:'Spike Rush · everyone carries a Spike, one random gun each round · first to 4 rounds',rep:'Replication · each team plays one agent · first to 5 rounds',skm:'Skirmish 1v1 · elimination rounds, free loadout, no abilities · first to 5 rounds'};
{const u0=mpUI;mpUI=function(){u0.apply(this,arguments);try{const e=mpEl('xOnDesc');if(e){const t=NET_MODE_DESC[MP.mode]||'';if(e.textContent!==t)e.textContent=t;}}catch(er){}};}

// Opt-in local browser capture. No telemetry endpoint, no timers, fixed memory, no wrappers while disabled.
(function(){
 const series=new Map(),undo=[];let active=false,observer=null,frameAt=0,packetAt=0;
 function sample(name,value){if(!active||!Number.isFinite(value))return;let s=series.get(name);if(!s){s={v:new Float64Array(600),n:0,total:0,max:0};series.set(name,s);}s.v[s.n++%600]=value;s.total+=value;s.max=Math.max(s.max,value);}
 function wrap(o,key,name,after){if(!o||typeof o[key]!=='function')return;const original=o[key],wrapped=function(){const t=performance.now();try{return original.apply(this,arguments);}finally{sample(name,performance.now()-t);if(after)after(t,arguments);}};o[key]=wrapped;undo.push(()=>{if(o[key]===wrapped)o[key]=original;});}
 const api={get active(){return active;},sample,start(){if(active)return;series.clear();frameAt=packetAt=0;active=true;
  wrap(globalThis,'loop','frameCpuMs',t=>{if(frameAt)sample('frameGapMs',t-frameAt);frameAt=t;try{if(typeof NET!=='undefined'&&NET.socket){sample('uplinkBufferedBytes',NET.socket.bufferedAmount||0);if(NET.receivedAt)sample('snapshotAgeMs',performance.now()-NET.receivedAt);}if(typeof MP!=='undefined'){if(Number.isFinite(MP.ping))sample('rttMs',MP.ping);if(MP.snapClock){sample('interpolationDelayMs',MP.snapClock.delay);sample('jitterMs',MP.snapClock.jitter);}}}catch{}});
  for(const [key,name]of [['xSimRun','simulationMs'],['xHud','hudMs'],['mpCliSnap','snapshotApplyMs'],['mpInterp','remoteInterpolationMs'],['netSyncEffects','effectSyncMs'],['netSyncSmokes','smokeSyncMs'],['xvLoad','assetRequestCpuMs']])wrap(globalThis,key,name);
  wrap(globalThis,'netReceive','snapshotParseDecodeCleanMs',(t,args)=>{if(packetAt)sample('incomingMessageGapMs',t-packetAt);packetAt=t;if(typeof args[0]==='string')sample('incomingMessageChars',args[0].length);});
  if(typeof renderer!=='undefined')wrap(renderer,'render','renderSubmitMs');
  if(typeof PerformanceObserver==='function')try{observer=new PerformanceObserver(list=>{for(const e of list.getEntries())sample('longTaskMs',e.duration);});observer.observe({entryTypes:['longtask']});}catch{}
 },stop(){if(!active)return;active=false;while(undo.length)undo.pop()();observer?.disconnect();observer=null;},report(){const out={note:'Local CPU wall times; render submission excludes asynchronous GPU time. Frame gaps include scheduling, GC and other tasks. Recent percentiles cover at most 600 samples per series.',active};for(const [name,s]of series){const v=Array.from(s.v.subarray(0,Math.min(600,s.n))).sort((a,b)=>a-b);out[name]={count:s.n,mean:s.total/s.n,max:s.max,recentP50:v[v.length>>1],recentP95:v[Math.floor(v.length*.95)],recentP99:v[Math.floor(v.length*.99)]};}return out;}};
 window.VSLag=api;
})();

// ---- END TRUSTED ONLINE SERVER ----
