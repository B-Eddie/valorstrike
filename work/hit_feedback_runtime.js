// ---- LOCALIZED HIT FEEDBACK ----
// Valorant's outgoing hit feedback (patch 1.07 + combat report), no crosshair hit marker and no damage numbers by default:
//  * the instant you fire: a tiny client-predicted spark at the game-space contact point; it stays put and is NOT a hit confirm
//  * on a confirmed hit (online: the server 'h' event; offline: the local sim result): a blood puff attached to the struck bone,
//    so it moves with the enemy (crouch carries a chest hit down); headshots use a distinct, smaller head variant
//  * audio: body tick, headshot ding, shield-break crack, escalating kill chime; prerendered buffers, voice-capped, one shared bus
//  * a short procedural flinch of the struck agent model (no material cloning or tint); tagging slow is the existing xTag / server tagUntil
//  * combat report on death, kept through spectate: damage dealt / taken per enemy with head / body / leg hit counts
// Everything is pooled and prewarmed: fixed VFX instances, fixed flinch slots, fixed report rows, buffers rendered once.
var XHIT=null,xHLeg=false;
var XHF={seq:0,v:new THREE.Vector3(),v2:new THREE.Vector3(),fl:[],cr:{el:null,rows:[],raw:-1,by:null,ui:0}};
for(let i=0;i<16;i++)XHF.fl.push({w:null,t:0,a:0,b:0});
function xHitOnline(){return typeof NET!=='undefined'&&!!NET.socket&&typeof MP!=='undefined'&&MP.st==='game';}
function xHitInit(){if(!XHIT&&window.HitImpact)XHIT=new window.HitImpact(scene,BFX.low?12:24);return XHIT;}
// struck bone: cached per rig so the hit path never walks the skeleton
function xHitAnchor(target,head,part){const M=target&&target.xm,sc=M&&M.sx&&M.sx.sc;
 if(sc){if(M.xHbS!==sc){const f=n=>sc.getObjectByName(n);M.xHbS=sc;M.xHb=[f('Spine2')||f('Spine1'),f('Head')||f('Spine2'),f('Pelvis')||f('pelvis')||f('Spine1')];}
  const b=M.xHb[head?1:part==='legs'?2:0];if(b)return b;}
 if(M){const p=head?M.hd:part==='legs'?(M.lL||M.bd):M.bd;if(p)return p;}
 return target&&target.g||null;}
function xHitPart(point,target,head,part){if(head)return 'head';if(part==='legs'||part==='body')return part;return target&&target.g&&point&&point.y-target.g.position.y<.9?'legs':'body';}
function xHitImpact(point,target,head,predicted,part){const fx=xHitInit();if(!fx)return false;return fx.emit(point,predicted?null:xHitAnchor(target,head,part),head,predicted);}
// ---- audio: synthesized once into AudioBuffers, played through one persistent gain bus ----
var XSF={ok:false,b:{},cap:{tick:4,head:3,brk:2,kill:2},end:{tick:[0,0,0,0],head:[0,0,0],brk:[0,0],kill:[0,0]},bus:null,plays:0};
function xSfRender(dur,fn){const sr=ac.sampleRate,n=Math.max(1,Math.round(sr*dur)),B=ac.createBuffer(1,n,sr),d=B.getChannelData(0);fn(d,sr);let pk=0;for(let i=0;i<n;i++)pk=Math.max(pk,Math.abs(d[i]));if(pk>1)for(let i=0;i<n;i++)d[i]/=pk;return B;}
function xSfTone(d,sr,f,dur,type,vol,dl,drop){const s0=Math.round(dl*sr),n=Math.round(dur*sr),k=Math.log(drop||1)/dur;let ph=0;
 for(let i=0;i<n&&s0+i<d.length;i++){const t=i/sr,fr=f*Math.exp(k*t);ph+=fr/sr;const x=ph%1,w=type==='square'?(x<.5?1:-1):type==='triangle'?1-4*Math.abs(x-.5):Math.sin(ph*6.2832);d[s0+i]+=w*vol*Math.exp(-6.9*t/dur)*Math.min(1,t*800);}}
function xSfWarm(){if(XSF.ok||typeof ac==='undefined'||!ac||!master)return XSF.ok;XSF.bus=ac.createGain();XSF.bus.gain.value=1;XSF.bus.connect(master);
 let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647)*2-1;
 // body: short dry "thwack" tick
 XSF.b.tick=xSfRender(.045,(d,sr)=>{xSfTone(d,sr,1650,.035,'sine',.55,0,.55);for(let i=0;i<d.length;i++){const t=i/sr;d[i]+=rnd()*.35*Math.exp(-t/.004);}});
 // headshot: bright metallic "ding" (inharmonic partials, longer ring)
 XSF.b.head=xSfRender(.3,(d,sr)=>{for(const[f,v,l]of[[2637,.5,.26],[3951,.3,.17],[5933,.16,.1],[1318,.22,.3]])xSfTone(d,sr,f,l,'sine',v,0,.97);for(let i=0;i<d.length;i++){const t=i/sr;d[i]+=rnd()*.25*Math.exp(-t/.003);}});
 // shield break: glassy crack, filtered noise burst with falling shards
 XSF.b.brk=xSfRender(.34,(d,sr)=>{let lp=0;for(let i=0;i<d.length;i++){const t=i/sr,n=rnd();const hp=n-lp;lp+=.35*(n-lp);d[i]+=hp*.55*Math.exp(-t/.07)*(1+.6*Math.sin(t*310));}
  xSfTone(d,sr,3300,.22,'triangle',.22,0,.5);xSfTone(d,sr,4400,.16,'sine',.18,.02,.45);xSfTone(d,sr,2200,.28,'sine',.16,.04,.5);});
 // kill confirm: escalating chime per kill in the round (5 steps), headshot kill brighter; same notes as the old blips
 for(let i=0;i<5;i++){const f=880*Math.pow(1.122,i);
  XSF.b['k'+i]=xSfRender(.32,(d,sr)=>{xSfTone(d,sr,f,.16,'sine',.18,0,.3);xSfTone(d,sr,f*1.5,.2,'sine',.12,.07,.3);});
  XSF.b['kh'+i]=xSfRender(.32,(d,sr)=>{xSfTone(d,sr,f*1.5,.06,'square',.12,0,.3);xSfTone(d,sr,f*2,.18,'sine',.18,0,.3);xSfTone(d,sr,f*3,.16,'triangle',.12,.045,.3);});}
 XSF.ok=true;return true;}
function xSfDone(){this.disconnect();}
function xSfPlay(key,group){try{if(S.muted)return false;audio();if(typeof ac==='undefined'||!ac||!xSfWarm())return false;const B=XSF.b[key],E=XSF.end[group],t=ac.currentTime;if(!B||!E)return false;
 let slot=-1;for(let i=0;i<E.length;i++)if(E[i]<=t){slot=i;break;}if(slot<0)return false;E[slot]=t+B.duration;
 const s=ac.createBufferSource();s.buffer=B;s.onended=xSfDone;s.connect(XSF.bus);s.start(t);XSF.plays++;return true;}catch(e){return false;}}
// confirmed-hit sounds: headshot ding on every headshot (lethal too), shield crack when the shot emptied armor, body tick otherwise;
// the kill chime itself comes from xKiAdd (xHitKillSfx) so a kill is never two chimes
function xHitSfx(head,dead,broke){if(head)xSfPlay('head','head');else if(!dead&&!broke)xSfPlay('tick','tick');if(broke&&!dead)xSfPlay('brk','brk');}
function xHitKillSfx(i,hs){xSfPlay((hs?'kh':'k')+Math.max(0,Math.min(4,i|0)),'kill');}
// ---- flinch: brief pitch-back of the struck agent's visual wrapper (hitboxes are separate meshes, gameplay unaffected) ----
function xHitFlinch(target,head){const M=target&&target.xm,w=M&&!M.dead&&M.sx&&M.sx.sc&&M.sx.sc.parent;if(!w||!w.rotation)return false;
 let s=null;for(const f of XHF.fl)if(f.w===w){s=f;break;}if(!s){for(const f of XHF.fl)if(!f.w){s=f;break;}if(!s)return false;s.w=w;s.b=w.rotation.x;}
 s.t=0;s.a=head?.075:.045;w.rotation.x=s.b-s.a;return true;}
function xHitFlinchTick(dt){for(const f of XHF.fl){if(!f.w)continue;f.t+=dt;const k=f.t/.14;if(k>=1){f.w.rotation.x=f.b;f.w=null;continue;}f.w.rotation.x=f.b-f.a*(1-k)*(1-k);}}
function xHitFlinchClear(){for(const f of XHF.fl)if(f.w){f.w.rotation.x=f.b;f.w=null;}}
// shooter-side confirmed hit: anchored VFX, sound, flinch. Used for our own shots and (with sound) for the teammate we spectate.
function xHitConfirm(point,target,head,dead,part,broke,sound){const pt=xHitPart(point,target,head,part);xHitImpact(point,target,head,false,pt);if(sound)xHitSfx(!!head,!!dead,!!broke);if(target&&!dead)xHitFlinch(target,head);}
{const hit=vmHit;vmHit=function(point,damage,head,dead,target,part){
 const online=xHitOnline(),broke=!!(target&&target.xBrk===XHF.seq&&XHF.seq>0);if(target)target.xBrk=0;
 if(!(online&&MP.nc)&&point)xHitImpact(point,null,false,true); // the instant we fire: world-space predicted spark
 if(online&&!MP.nc)return; // online prediction never claims damage, headshots, kills or sound: the server event does
 xHitConfirm(point,target,head,dead,part,broke,true);return hit.apply(this,arguments);
};}
// another shooter's confirmed hit (offline teammates/bots; online events for other players): VFX on the struck part,
// sound only when it is the teammate we are spectating
function xHitOther(target,head,by,point,part){try{if(!target||!target.g||target===player)return false;let p=point;
 if(!p){const a=xHitAnchor(target,head,part);if(!a)return false;a.getWorldPosition(XHF.v);p=XHF.v;
  if(by&&by.g){XHF.v2.set(by.g.position.x-p.x,0,by.g.position.z-p.z);const L=XHF.v2.length();if(L>.01)p.addScaledVector(XHF.v2,.12/L);}}
 const spec=typeof xKL!=='undefined'&&xKL.sp&&xKL.cur&&by&&xKL.cur===by;xHitConfirm(p,target,head,!(target.hp>0)||target.alive===false,part,false,spec);return true;}catch(e){return false;}}
// shields: remember which hurt emptied the target's armor, read by the vmHit that follows it
{const a0=armAbs;armAbs=function(t,n){const before=t&&t.armor||0,r=a0.apply(this,arguments);XHF.seq++;if(t&&before>0&&!(t.armor>.001))t.xBrk=XHF.seq;return r;};}
// Whole-body emissive flashes obscure the hit location and clone character materials on first hit.
flash=function(){};xDeathFlash=function(){};
// ---- combat report ----
// Valorant counts the damage a shot dealt (health + shield, capped at what the target had left), with head / body / leg hits.
xKLe=function(nm){const L=xKL.log;for(let i=0;i<xKL.n;i++)if(L[i].nm===nm)return L[i];if(xKL.n>=L.length)return null;const e=L[xKL.n++];e.nm=nm;e.dd=e.dh=e.dhs=e.td=e.th=e.ths=e.db=e.dl=e.tb=e.tl=0;return e;};
function xCrAdd(t,by,d,part){if(!(d>0)||!player||!xKLm())return false;let e=null;
 if(t===player&&typeof by==='string'){e=xKLe(by);if(e){e.td+=d;e.th++;if(part==='head')e.ths++;else if(part==='legs')e.tl++;else e.tb++;}}
 else if(by===undefined&&t!==player&&t&&t.name&&player.hp>0){e=xKLe(t.name);if(e){e.dd+=d;e.dh++;if(part==='head')e.dhs++;else if(part==='legs')e.dl++;else e.db++;}}
 return !!e;}
{const h=hurt;hurt=function(t,n){XHF.cr.raw=t&&Number.isFinite(n)?Math.max(0,Math.min(n,Math.max(0,t.hp||0)+Math.max(0,t.armor||0))):-1;try{return h.apply(this,arguments);}finally{XHF.cr.raw=-1;}};}
xKLog=function(t,by,d){const hs=xHS,lg=xHLeg;xHS=false;xHLeg=false;if(xHitOnline())return; // online: logged from server 'h' events only
 xCrAdd(t,by,XHF.cr.raw>=0?XHF.cr.raw:d,hs?'head':lg?'legs':'body');};
function xCrUi(){const C=XHF.cr;if(C.el&&C.el.parentNode)return C.el;if(!document.getElementById('xCrCss')){const st=document.createElement('style');st.id='xCrCss';
  st.textContent='.x-cbt{position:fixed;right:24px;top:38%;z-index:60;width:300px;padding:10px 12px;background:rgba(15,25,35,.86);border-right:3px solid #ff4655;color:#ece8e1;font:500 12px/1.3 var(--sans,sans-serif);pointer-events:none;display:none}.x-cbt.on{display:block}.x-cbt p{margin:0 0 6px;font-size:11px;letter-spacing:.18em;color:#ff4655}.x-cbt table{width:100%;border-collapse:collapse}.x-cbt th{font-size:10px;letter-spacing:.12em;opacity:.65;text-align:right;font-weight:600}.x-cbt th:first-child,.x-cbt td:first-child{text-align:left}.x-cbt td{padding:3px 0;text-align:right;border-top:1px solid rgba(236,232,225,.1);white-space:nowrap}.x-cbt td:first-child{max-width:96px;overflow:hidden;text-overflow:ellipsis}.x-cbt b{font-weight:700}.x-cbt small{opacity:.7;margin-left:4px}.x-cbt tr.k td:first-child{color:#ff4655}.x-cbt .lg{margin-top:5px;font-size:10px;opacity:.55;text-align:right}@media (max-height:560px) and (orientation:landscape){.x-cbt{top:auto;bottom:60px;right:8px;width:232px;max-height:calc(100vh - 176px);overflow:hidden;padding:6px 8px;font-size:10.5px}.x-cbt p{margin:0 0 3px;font-size:10px}.x-cbt td{padding:1px 0}.x-cbt .lg{display:none}body.x-cbt-on .x-kb.on{left:calc((100vw - 248px) / 2);max-width:calc(100vw - 264px)}body.x-cbt-on .x-dmlb{visibility:hidden}}';
  document.head.appendChild(st);}
 const mk=(tag,cls,txt,parent)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;if(parent)parent.appendChild(n);return n;};
 const el=mk('div','x-cbt');el.setAttribute('aria-live','polite');mk('p','','COMBAT REPORT',el);const tbl=mk('table','',null,el),hr=mk('tr','',null,mk('thead','',null,tbl));
 for(const h of['ENEMY','DEALT','TAKEN'])mk('th','',h,hr);const tb=mk('tbody','',null,tbl);mk('div','lg','hits: head · body · legs',el);C.rows.length=0;
 for(let i=0;i<xKL.log.length;i++){const tr=mk('tr','',null,tb),n=mk('td','',null,tr),d=mk('td','',null,tr),t=mk('td','',null,tr);tr.style.display='none';
  C.rows.push({tr,n,db:mk('b','',null,d),ds:mk('small','',null,d),tb:mk('b','',null,t),ts:mk('small','',null,t)});}
 document.body.appendChild(el);C.el=el;C.ui++;return el;}
function xCrRender(){const C=XHF.cr;if(!xKLm()||!xCrUi())return;let shown=0;
 for(let i=0;i<C.rows.length;i++){const r=C.rows[i],e=i<xKL.n?xKL.log[i]:null;if(!e){r.tr.style.display='none';continue;}shown++;r.tr.style.display='';r.tr.className=e.nm===C.by?'k':'';
  r.n.textContent=e.nm;r.db.textContent=String(Math.round(e.dd));r.ds.textContent=e.dhs+'·'+e.db+'·'+e.dl;r.tb.textContent=String(Math.round(e.td));r.ts.textContent=e.ths+'·'+e.tb+'·'+e.tl;}
 C.el.classList.toggle('on',shown>0&&xKL.on);document.body.classList.toggle('x-cbt-on',shown>0&&xKL.on);
 const k=C.by?xKLe(C.by):null;if(k){if(xKL.dd)xKL.dd.textContent=Math.round(k.dd)+' dmg · '+k.dh+' hits · '+k.dhs+' HS';if(xKL.tk)xKL.tk.textContent=Math.round(k.td)+' dmg · '+k.th+' hits · '+k.ths+' HS';}}
{const d0=xKLDie;xKLDie=function(by){const r=d0.apply(this,arguments);if(xKL.on){XHF.cr.by=by||null;xCrRender();}return r;};}
{const r0=xKLReset;xKLReset=function(){const r=r0.apply(this,arguments);XHF.cr.by=null;if(XHF.cr.el)XHF.cr.el.classList.remove('on');document.body.classList.remove('x-cbt-on');return r;};}
{const init=bfxInit;bfxInit=function(){const r=init.apply(this,arguments);xHitInit();return r;};
 const tick=bfxTick;bfxTick=function(dt){tick(dt);if(XHIT)XHIT.tick(dt,camera);xHitFlinchTick(Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0);};
 const reset=xKiReset;xKiReset=function(){if(XHIT)XHIT.clear();xHitFlinchClear();return reset.apply(this,arguments);};}
function netHitUnit(id){for(const u of bots)if(u.nid===id)return u;for(const u of allies)if(u.nid===id)return u;return null;}
function netHitOk(e){return Array.isArray(e)&&e[0]==='h'&&e.length>=10&&e.slice(1,10).every(Number.isFinite)&&[0,1].includes(e[3])&&[0,1].includes(e[4])&&e[5]>0&&Math.max(Math.abs(e[6]),Math.abs(e[8]))<=3&&Math.abs(e[7])<=3;}
// combat-report damage: the event's damage capped at what the victim had left before this snapshot (health + shield)
function netHitLeft(u){if(u._crS===XHF.pass)return u._crL;const h=u.hp,a=u.armor;return Number.isFinite(h)?Math.max(0,h)+Math.max(0,Number.isFinite(a)?a:0):Infinity;}
function netHitTake(u,d){const L=netHitLeft(u),n=Math.min(d,L);u._crS=XHF.pass;u._crL=L-n;return n;}
// logged BEFORE the snapshot applies, so health is still pre-hit and a death ('k') in the same snapshot renders the full report
function netHitLog(e){if(!netHitOk(e))return false;const part=e[3]?'head':e[9]===2?'legs':'body';
 if(e[2]===MP.me){const s=netHitUnit(e[1]);return !!(s&&s.name&&player)&&xCrAdd(player,s.name,netHitTake(player,e[5]),part);}
 if(e[1]!==MP.me)return false;const t=netHitUnit(e[2]);return !!t&&xCrAdd(t,undefined,netHitTake(t,e[5]),part);}
// server hit event ['h', shooter, target, head, killed, damage, dx, dy, dz, part(0 body,1 head,2 legs), shieldBroken]
function netHitFeedback(e){
 if(!netHitOk(e)||e[2]===MP.me)return;const part=e[3]?'head':e[9]===2?'legs':'body';
 const target=netHitUnit(e[2]);if(!target||!target.g)return;
 const p=XHV.set(target.g.position.x+e[6],target.g.position.y+e[7],target.g.position.z+e[8]);
 if(e[1]!==MP.me){xHitOther(target,!!e[3],netHitUnit(e[1]),p,part);return;}
 if(e[10]===1){XHF.seq++;target.xBrk=XHF.seq;}
 const prev=MP.nc;MP.nc=true;try{vmHit(p,e[5],!!e[3],!!e[4],target,part);}finally{MP.nc=prev;}
}
XHF.pass=0;
{const snap=mpCliSnap;mpCliSnap=function(m){const on=typeof NET!=='undefined'&&NET.socket&&running&&MP.st==='game',ev=on&&m&&m.ev||null;
 if(ev){XHF.pass++;for(const e of ev)if(e&&e[0]==='h')netHitLog(e);}
 const r=snap.apply(this,arguments);
 if(ev&&running&&MP.st==='game'){for(const e of ev){if(e&&e[0]==='h')netHitFeedback(e);else if(e&&e[0]==='k'&&mpIn(e[1])==='You'){vmKill(mpIn(e[2]),!!e[3]);xKiAdd(!!e[3],e[4]);}}}
 return r;};}
{const a0=audio;audio=function(){const r=a0.apply(this,arguments);if(!XSF.ok&&typeof ac!=='undefined'&&ac)xSfWarm();return r;};}
if(window.requestIdleCallback)requestIdleCallback(()=>{xHitInit();try{xCrUi();}catch(e){}},{timeout:1500});else setTimeout(()=>{xHitInit();try{xCrUi();}catch(e){}},0);
// ---- END LOCALIZED HIT FEEDBACK ----
