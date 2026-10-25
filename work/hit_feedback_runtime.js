// ---- LOCALIZED HIT FEEDBACK ----
// Riot's 1.07 hit-impact model: modest body/head bursts attached to the struck character;
// predicted contact is only a tiny spark, never an online damage confirmation.
var XHIT=null;
function xHitInit(){if(!XHIT&&window.HitImpact)XHIT=new window.HitImpact(scene,BFX.low?12:24);return XHIT;}
function xHitAnchor(target,head,part){const M=target&&target.xm,sc=M&&M.sx&&M.sx.sc;
 return sc&&(sc.getObjectByName(head?'Head':part==='legs'?'Pelvis':'Spine2')||sc.getObjectByName('Spine1'))||target&&target.g||null;}
function xHitImpact(point,target,head,predicted,part){const fx=xHitInit();if(fx)fx.emit(point,xHitAnchor(target,head,part),head,predicted);}
{const hit=vmHit;vmHit=function(point,damage,head,dead,target,part){
 const online=typeof NET!=='undefined'&&NET.socket&&MP.st==='game';
 if(online&&!MP.nc){if(target)xHitImpact(point,target,false,true);return;}
 xHitImpact(point,target,head,false,part);return hit.apply(this,arguments);
};}
// Whole-body emissive flashes obscure the hit location and clone character materials on first hit.
flash=function(){};xDeathFlash=function(){};
{const init=bfxInit;bfxInit=function(){const r=init.apply(this,arguments);xHitInit();return r;};
 const tick=bfxTick;bfxTick=function(dt){tick(dt);if(XHIT)XHIT.tick(dt,camera);};
 const reset=xKiReset;xKiReset=function(){if(XHIT)XHIT.clear();return reset.apply(this,arguments);};}
function netHitFeedback(e){
 if(!Array.isArray(e)||e[0]!=='h'||!e.slice(1,10).every(Number.isFinite)||e.length<10||![0,1].includes(e[3])||![0,1].includes(e[4])||e[5]<=0||Math.max(Math.abs(e[6]),Math.abs(e[8]))>3||Math.abs(e[7])>3)return;
 if(e[2]===MP.me)return;
 const target=bots.find(u=>u.nid===e[2])||allies.find(u=>u.nid===e[2]);if(!target||!target.g)return;
 const p=XHV.set(target.g.position.x+e[6],target.g.position.y+e[7],target.g.position.z+e[8]);
 if(e[1]!==MP.me)xHitImpact(p,target,!!e[3],false,e[9]===2?'legs':'body');
 if(e[1]===MP.me){const prev=MP.nc;MP.nc=true;try{vmHit(p,e[5],!!e[3],!!e[4],target,e[9]===2?'legs':'body');}finally{MP.nc=prev;}}
}
{const snap=mpCliSnap;mpCliSnap=function(m){const r=snap.apply(this,arguments);if(typeof NET!=='undefined'&&NET.socket&&running&&MP.st==='game')for(const e of m.ev||[]){if(e&&e[0]==='h')netHitFeedback(e);else if(e&&e[0]==='k'&&mpIn(e[1])==='You'){vmKill(mpIn(e[2]),!!e[3]);xKiAdd(!!e[3]);}}return r;};}
if(window.requestIdleCallback)requestIdleCallback(()=>xHitInit(),{timeout:1500});else setTimeout(()=>xHitInit(),0);
// ---- END LOCALIZED HIT FEEDBACK ----
