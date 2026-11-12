// Ability animation matrix (user: "some agents' abilities don't have animations"; work/ability_anim_runtime.js ABILITY ANIM,
// matrix work/validation/ability-anim-matrix.md, audit tool work/abil_anim_audit.cjs). Every agent x C / Q / E / X must change
// the pose in FIRST person (the agent's ability arms play a moving clip instead of the frozen gun) and in THIRD person (what
// other players, spectators and bots see: a typed cast pose on the upper body with the gun holstered, not the gun pose).
//  1. installed block, unique top-level names, the relay path no longer throws (xEqType was deleted in f95aa9e);
//  2. pure key poses: every agent x key has a style (Jett X = the Blade Storm pose of its own), each style winds up and releases
//     away from the rest pose and starts / ends at rest, envelope 0 at both ends;
//  3. third person on REAL rigs (Jett f, Breach m: the shipped xUbAnim / xUbPost + weapon grip + this block): for every style
//     the right hand moves > 0.2 m from the gun pose, the gun is holstered mid-cast and back after, style landmarks (throw wind-up
//     behind / above the shoulder then forward, place leans the head down, bow arm out), every bone is handed back exactly after
//     the cast, and legs / pelvis are bit-identical to a no-cast unit while walking (locomotion untouched);
//  4. first person on REAL FP rigs: every agent x key's ability clip set moves the holding palm between its phases;
//  5. the live page offline (work/page_harness.cjs, 12 agents x 4 keys): pressing the key (FIRE when equipped) drives the FP
//     ability layer with a moving clip; the TP triggers - relay (xEqTpGo), bot ability charge (xBUse), bot ult (FEEL XU.c) -
//     each start the typed pose on the caster; Omen From the Shadows holds the orb while picking and through the channel;
//  6. ONLINE (page <-> in-process server, Jett / Reyna / Skye / Omen: the keys the server casts straight from the press):
//     the FP layer runs a quick cast (was: nothing).   QUICK=1 skips 6.
//   node work/test_ability_anim.cjs
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{pathToFileURL}=require('url');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const A0='// ---- ABILITY ANIM ----',B0='// ---- END ABILITY ANIM ----',a0=html.indexOf(A0),b0=html.indexOf(B0);
let n=0;const fails=[];const ok=(c,m)=>{if(c)n++;else{fails.push(m);if(process.env.VERBOSE)console.log('FAIL',m);}};
const AG=['Jett','Phoenix','Sova','Sage','Reyna','Omen','Killjoy','Raze','Skye','Breach','Cypher','Chamber'],KEYS='cqex';
(async()=>{
 // ---- 1. installed ------------------------------------------------------------------------------------------------
 ok(a0>0&&b0>a0,'ABILITY ANIM block installed in index.html');
 if(!(a0>0&&b0>a0)){console.error(fails.join('\n'));process.exit(1);}
 const BLOCK=html.slice(a0,b0+B0.length);
 {const names=[...BLOCK.matchAll(/^(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]),rest=html.slice(0,a0)+html.slice(b0);
  for(const nm of names)if(nm!=='xEqType')ok(!new RegExp('(?:^|[\\s;{(])(?:var|let|const|function)\\s+'+nm.replace('$','\\$')+'\\b').test(rest),'top-level name '+nm+' declared only by the block');
  ok(/xEqType\(k, ag\)/.test(rest)&&!/function xEqType\(/.test(rest),'base page calls xEqType without defining it (the relay ReferenceError this block fixes)');}
 // ---- 2. pure key poses -------------------------------------------------------------------------------------------
 const P={THREE:require('./valorant_rigs').T,window:{},console,Math};vm.createContext(P);vm.runInContext(BLOCK,P);const L=P.window.xAbilityAnim;ok(!!L,'block export');
 for(const ag of AG)for(const k of KEYS){if(ag==='Jett'&&k==='x')continue;const t=L.type(ag,k);ok(!!L.XABA_ST[t]&&L.XABA_TY[ag]&&L.XABA_TY[ag][k]===t,`${ag} ${k}: typed third-person cast style (${t})`);}
 const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 for(const ty in L.XABA_ST){const S=L.XABA_ST[ty],r0=L.key(ty,0),r1=L.key(ty,1);let far=0;for(let u=0;u<=1;u+=.02)far=Math.max(far,d(L.key(ty,u).R,r0.R),d(L.key(ty,u).L,r0.L));
  ok(far>.25,`${ty}: a hand leaves the rest pose by ${far.toFixed(2)} m`);ok(d(r0.R,r1.R)<1e-9&&Math.abs(r1.tw)<1e-9&&Math.abs(r1.le)<1e-9,`${ty}: ends at rest`);ok(L.env(0,S.T)===0&&L.env(S.T,S.T)===0&&L.env(S.T/2,S.T)===1,`${ty}: envelope 0 -> 1 -> 0`);}
 {const w=L.key('throw',.24),r=L.key('throw',.44);ok(w.R[2]<-.1&&w.R[1]>.05,'throw wind-up: hand behind and above the shoulder');ok(r.R[2]>.45,'throw release: arm forward');}
 ok(L.key('place',.5).le>.4,'place: leans forward to set it down');ok(L.key('bow',.5).L[2]>.5,'bow: the bow arm out in front');
 // ---- 2b. cast pipeline (pure: the installed block on a stub page; a server-cast key, its answers, local refusals) -------
 {const C={window:{},console,Math,THREE:P.THREE,__t:1000};C.performance={now:()=>C.__t};vm.createContext(C);
  vm.runInContext(`var J={pick:"A",c:1,q:1,e:1,ult:0,cd:{c:0,q:0,e:0,x:0}},running=true,player={hp:100},NET={socket:{}},XCA={on:false},XAF={},XABT={},XPAR2={},ABI_M={A:["dash","dash","dash","ult"]},XCA_T={dash:"buff"},XAB_INST={},toast={textContent:""},__st=0,__end=0,__sent=[],__said=[],__local=false,__own=false;
   function K(){return {u:7,n:["slot 1","slot 2","slot 3","slot 4"]};}
   function xCaStart(){__st++;XCA.on=true;}function xCaEnd(){__end++;XCA.on=false;}function xInstGo(){}
   function blip(f,d,t){}const sgNo=()=>blip(120,0.08,"square",0.1);function say(t){toast.textContent=t;__said.push(t);}
   function netSend(m){__sent.push(m);}
   function jKey(code){const k=code[3].toLowerCase();if(__own){say("own text");sgNo();return true;}if(__local){if(J.cd[k]>0||!(J[k]>0)){sgNo();return true;}J[k]--;J.cd[k]=0.6;return true;}netSend({t:"ab",k});}`,C);
  vm.runInContext(BLOCK,C);const g=c=>vm.runInContext(c,C),press=code=>{g(`jKey(${JSON.stringify(code)})`);const m=g('__sent[__sent.length-1]');return m&&m.n;},ans=(n,k,ok,x)=>g(`xAbcAo(${JSON.stringify(Object.assign({t:'ao',k,n,ok},x||{}))})`);
  let n1=press('KeyQ');ok(Number.isSafeInteger(n1),'pipeline: a cast request carries an id');ok(g('__st')===1,'pipeline: predicted cast animates at the press');
  ans(n1,'q',true);ok(g('__st')===1,'pipeline: its confirmation does not animate it again');ans(n1,'q',true);ok(g('__st')===1,'pipeline: a repeated confirmation of the same request animates nothing');
  ok(g('XCA.on')===true,'pipeline: gesture still playing');let n2=press('KeyE');ok(g('__st')===2,'pipeline: rapid re-activation inside the gesture window animates the second cast (was dropped: !XCA.on gate)');ans(n2,'e',true);ok(g('__st')===2,'pipeline: rapid second cast confirmed: still exactly one animation each');
  g('J.q=0;XCA.on=false;true');let n3=press('KeyQ');ok(g('__st')===2,'pipeline: stale local state (no charge seen) -> nothing at the press');ans(n3,'q',true);ok(g('__st')===3&&g('XABC.n.late')===1,'pipeline: the server confirmed it -> the animation starts on the answer (late, not skipped)');
  g('J.e=1;true');let n4=press('KeyE');ok(g('__st')===4,'pipeline: predicted');ans(n4,'e',false,{r:'charges'});ok(g('__end')===1&&g('XABC.n.cut')===1,'pipeline: refused after the prediction -> the gesture is cut');ok(/slot 3 · no charges left/.test(g('__said[__said.length-1]')),'pipeline: refusal shows its reason (no charges): '+g('__said[__said.length-1]'));
  let n5=press('KeyC');ans(n5,'c',false,{r:'cooldown',cd:1.5});ok(g('__said[__said.length-1]')==='slot 1 · on cooldown · 1.5 s','pipeline: cooldown refusal shows the seconds left: '+g('__said[__said.length-1]'));
  ans(999,'c',false,{});ok(/slot 1 · can't be used right now/.test(g('__said[__said.length-1]')),'pipeline: an unknown refusal still says something (invalid state)');
  let n6=press('KeyQ');C.__t+=4000;ans(n6+50,'q',true);ok(g('XABC.pend.length')===0&&g('XABC.n.lost')>=1,'pipeline: an unanswered request expires (no pending state left behind)');
  // rapid burst: every press is answered; one animation per confirmed cast, one reason per refusal
  {g('J.q=9;XCA.on=false;__st=0;__end=0;__said.length=0;true');const ns=[];for(let i=0;i<6;i++)ns.push(press('KeyQ'));const st0=g('__st');ns.forEach((n,i)=>ans(n,'q',i%2===0,i%2?{r:'cooldown',cd:.4}:{}));
   ok(st0===6&&g('__st')===6&&g('__end')===1&&g('__said.length')===3&&g('XABC.pend.length')===0,`pipeline: 6 rapid presses -> 6 answered, 3 cast with their animation, 3 refused with a reason (only the refusal of the gesture still playing cuts it), nothing pending (st ${g('__st')} end ${g('__end')} said ${g('__said.length')})`);}
  // offline: the kit's own refusal (bare blip) gets the reason from the slot's state; a cast or a refusal with its own text gets none
  g('__local=true;NET.socket=null;__said.length=0;J.c=1;J.cd.c=0.4;true');press('KeyC');ok(g('__said[0]')==='slot 1 · on cooldown · 0.4 s','offline refusal on cooldown: '+g('__said[0]'));
  g('J.cd.c=0;J.c=0;true');press('KeyC');ok(g('__said[1]')==='slot 1 · no charges left','offline refusal with no charge: '+g('__said[1]'));
  g('J.c=1;true');press('KeyC');ok(g('__said.length')===2&&g('J.c')===0,'offline cast: no refusal line');
  g('__own=true;__said.length=0;true');press('KeyC');ok(g('__said.length')===1&&g('__said[0]')==='own text','offline refusal with its own text: no second line');g('__own=false;true');}
 // ---- 3. third person on real rigs --------------------------------------------------------------------------------
 const {sim,T}=require('./tp_anim_sim.cjs'),grip=fs.readFileSync(path.join(__dirname,'grip_runtime.js'),'utf8');
 const gripFns="var XG_FINGERS=['Index','Middle','Ring','Pinky','Thumb'];"+grip.slice(grip.indexOf('function xgSetup('),grip.indexOf('function xgGrip('));
 async function tp(slug,withBlock){const S=await sim(slug),c=S.c;Object.assign(c,{XGRIP:c.XGRIP||{},window:c.window||{}});vm.runInContext(gripFns,c);
  if(withBlock)vm.runInContext(BLOCK,c);const {M,X,b}=S;M.gun=new T.Group();M.gun.add(new T.Mesh(new T.BoxGeometry(.05,.1,.5)));M.gun.visible=true;X.sc.getObjectByName('R_Hand').add(M.gun);M.valorant=1;
  b.xm=M;M.unit=b;
  let last=null;const frame=(dt,x=0,z=0,yaw=0)=>{const P=b.g.position,sp=last?Math.hypot(x-last.x,z-last.z)/dt:0;last={x,z};P.set(x,0,z);b.g.rotation.y=yaw;M.m.position.set(x,0,z);M.m.rotation.y=yaw;M.m.updateMatrixWorld(true);
   c.api2.xUbAnim(b,M,sp,dt);X.poseDt=dt;c.api.xUbPre(M);X.mx.update(dt);c.xUbPost(M);M.m.updateMatrixWorld(true);};
  const run=(s,f)=>{for(let i=0;i<Math.round(s*60);i++){if(f)f(i);frame(1/60,...(S.path?S.path(i):[]));}};
  const rel=n=>M.m.worldToLocal(S.at(n));
  return {...S,c,frame,run,rel};}
 const snap=(S,re)=>{const q=[];S.X.sc.traverse(o=>{if(o.isBone&&(!re||re.test(o.name)))q.push(...o.quaternion.toArray(),...o.position.toArray());});return q;};
 const maxd=(a,b)=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]-b[i]));return m;};
 for(const slug of (process.env.RIGS||'jett,breach').split(',')){
  for(const ty of Object.keys(L.XABA_ST)){const S=await tp(slug,true),C=await tp(slug,true);S.run(.5);C.run(.5);
   const ag=Object.keys(L.XABA_TY).find(a=>Object.values(L.XABA_TY[a]).includes(ty)),k=Object.keys(L.XABA_TY[ag]).find(x=>L.XABA_TY[ag][x]===ty);
   const r=S.c.xAbaTp(S.b,ag,k);ok(r&&r.ty===ty,`${slug} ${ty}: cast started (${ag} ${k})`);const T0=r.T;
   let far=0,hid=0,frames=Math.round(T0*60),wHand=null,relHand=null,head=0,lhFwd=0;const sh0=S.rel('R_Shoulder');
   for(let i=0;i<frames;i++){S.frame(1/60);C.frame(1/60);const h=S.rel('R_Hand'),hc=C.rel('R_Hand');far=Math.max(far,h.distanceTo(hc));if(!S.M.gun.visible)hid++;
    const u=(i+1)/frames;if(Math.abs(u-.24)<.01)wHand=h.clone().sub(S.rel('R_Shoulder'));if(Math.abs(u-.45)<.01)relHand=h.clone().sub(S.rel('R_Shoulder'));
    if(Math.abs(u-.5)<.02){head=C.rel('Head').y-S.rel('Head').y;lhFwd=S.rel('L_Hand').z-S.rel('L_Shoulder').z;}}
   ok(far>.2,`${slug} ${ty}: right hand moves ${far.toFixed(2)} m from the gun pose`);ok(hid>frames*.5,`${slug} ${ty}: gun holstered during the cast (${hid}/${frames} frames)`);
   if(ty==='throw')ok(wHand&&wHand.z<0&&wHand.y>0&&relHand&&relHand.z>.3,`${slug} throw: wind-up behind/above the shoulder (${wHand&&wHand.toArray().map(v=>v.toFixed(2))}) then forward (${relHand&&relHand.z.toFixed(2)})`);
   if(ty==='place')ok(head>.08,`${slug} place: leans down to set it (head ${head.toFixed(2)} m lower)`);
   if(ty==='bow')ok(lhFwd>.35,`${slug} bow: bow arm out in front (${lhFwd.toFixed(2)} m)`);
   S.run(.3);C.run(.3);ok(S.M.gun.visible,`${slug} ${ty}: gun back after the cast`);ok(!S.M.xab.on,`${slug} ${ty}: pose over`);
   const dd=maxd(snap(S),snap(C));ok(dd<1e-4,`${slug} ${ty}: every bone handed back after the cast (max diff ${dd.toExponential(1)})`);
   ok(!S.c.XABA.err,`${slug} ${ty}: no runtime error ${S.c.XABA.err}`);}
  // walking: legs / pelvis untouched by a cast; whole skeleton identical with the block installed and no cast
  {const Sa=await tp(slug,false),Sb=await tp(slug,true),Sc=await tp(slug,true);const pth=i=>{const t=i/60;return [Math.sin(t)*2,t*(i<60?1.2:4),.2*Math.sin(t)];};
   const LOW=/^(Pelvis|Spine1|[LR]_(Hip|Knee|Ankle|Ball|Toe|Thigh|Calf|Foot))/;let dA=0,dL=0;
   for(let i=0;i<150;i++){if(i===50)Sc.c.xAbaTp(Sc.b,'Raze','q');const p=pth(i);Sa.b.cr=Sb.b.cr=Sc.b.cr=i>110;Sa.frame(1/60,...p);Sb.frame(1/60,...p);Sc.frame(1/60,...p);
    if(i%5===4){dA=Math.max(dA,maxd(snap(Sa),snap(Sb)));dL=Math.max(dL,maxd(snap(Sb,LOW),snap(Sc,LOW)));}}
   ok(dA===0,`${slug}: walk / run / crouch-walk bones identical with the block installed (max diff ${dA})`);ok(dL===0,`${slug}: a cast while walking leaves legs / pelvis untouched (max diff ${dL})`);}
 }
 // ---- 4. first person on real FP rigs -----------------------------------------------------------------------------
 {const FP=await import(path.join(root,'server/tools/ability-fp-view.mjs')),api=FP.runtime();
  for(const ag of (process.env.AGENTS?process.env.AGENTS.split(','):AG)){const B=await FP.build(ag,api);
   for(const k of KEYS){if(ag==='Jett'&&k==='x')continue;const e=await FP.pose(B,k,'equip',.05),i=await FP.pose(B,k,'idle',.3),c=await FP.pose(B,k,'cast',.6);const mv=Math.max(d(e.palm,i.palm),d(i.palm,c.palm),d(e.palm,c.palm));
    ok(mv>.03,`${ag} ${k} FP: the holding palm moves ${mv.toFixed(3)} m between equip / idle / cast (${e.clip} / ${i.clip} / ${c.clip})`);}}}
 // ---- 5. the live page offline ------------------------------------------------------------------------------------
 {const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:5}),xe=H.xe;
  const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
  const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);};const click=async(b=0,ms=60)=>{H.mouse(b,true);await adv(ms);H.mouse(b,false);};
  const through=async agent=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
   if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}await adv(100);}return false;};
  xe(`window.__fr=[];{const v0=vmTick;vmTick=function(dt){const r=v0.apply(this,arguments);try{if(window.__rec){const L=XAF.last;window.__fr.push({on:!!XAF.on,c:XAF.on&&L?L.clip:"",u:XAF.on&&L?+L.u:-1,sus:XABA.fp.on?XABA.fp.ph:""});}}catch(e){}return r;};}true`);
  const fpOf=fr=>{const on=fr.filter(f=>f.on&&f.c),us=on.map(f=>f.u).filter(u=>u>=0);return {n:on.length,mv:us.length>1?Math.max(...us)-Math.min(...us):0,clips:[...new Set(on.map(f=>f.c))]};};
  const e0=H.errors.length;
  for(const agent of (process.env.AGENTS?process.env.AGENTS.split(','):AG)){H.$('pm5v5').click();await adv(50);if(!(await through(agent))){ok(false,agent+': offline match did not start');continue;}xe('FV.buy=0.05;true');await adv(300);
   for(const code of ['KeyC','KeyQ','KeyE','KeyX']){const k=code[3].toLowerCase(),tag=`${agent} ${k}`;
    xe(`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};player.hp=Math.max(player.hp,100);J.dr=null;J.ftp=false;
     if(J.pick==="Reyna"){for(let i=0;i<2;i++){const b=bots.find(x=>x&&x.g);if(b)rySoul(b);}for(const s of J.so){s.p.set(player.x+1,1.2,player.z);s.t=9;}}})()`);await adv(150);
    xe('window.__fr=[];window.__rec=1;true');await tap(code,80);await adv(300);
    if(xe('!!(J.eq&&J.eq.st!=="rec")')){await adv(400);await click(0);await adv(1100);}
    else if(agent==='Omen'&&k==='x'){await adv(500);const pick=xe('XABA.fp.on&&XABA.fp.ph');ok(pick==='ready'||pick==='draw',`Omen x FP: arms hold the shadow orb while picking the spot (${pick})`);
     xe('J.ftp=false;J.ult=0;J.fts={t:XPAR2.shadows,x:player.x,z:player.z,y:0,m:okMark(player.x,player.z,0x6a4cff)};true');await adv(1500);const ch=xe('XABA.fp.on&&XABA.fp.ph');ok(ch==='hold',`Omen x FP: held through the shadow channel (${ch})`);}
    else await adv(900);
    if(agent==='Jett'&&k==='x'){await click(0);await adv(600);}
    xe('window.__rec=0;true');const F=fpOf(xe('window.__fr'));ok(F.n>=8&&F.mv>.1,`${tag} FP: ability arms drive a moving clip (${F.n} frames, clip span ${F.mv.toFixed(2)}, ${F.clips.join('|')})`);
    // TP triggers (the page harness has no native rigs: an ally / bot stands in as a native rig for the trigger)
    const tp=xe(`(()=>{const out={};const u=allies.find(a=>a&&a.alive&&a.xm),b=bots.find(a=>a&&a.alive&&a.xm);if(!u||!b)return null;for(const x of [u,b]){x.xm.ub=1;x.xm.xab=null;}
      xEqTpGo(u,J.pick,${JSON.stringify(k)});out.relay=u.xm.xab&&u.xm.xab.on?u.xm.xab.ty:"";
      if(${JSON.stringify(k)}!=="x"){const ch=xBCh(b);ch[${JSON.stringify(k)}]=Math.max(1,ch[${JSON.stringify(k)}]|0);const ag0=b.agent;out.bag=xBAg(b);xBUse(b,${JSON.stringify(k)});out.bot=b.xm.xab&&b.xm.xab.on?b.xm.xab.ty:"";}
      else{window.xBotUC[b.name]=9;xAbaUltPoll();window.xBotUC[b.name]=0;xAbaUltPoll();out.bag=xBAg(b);out.bot=b.xm.xab&&b.xm.xab.on?b.xm.xab.ty:"";}
      for(const x of [u,b]){if(x.xm.xab)xAbaEnd(x.xm);x.xm.ub=0;}return out;})()`);
    if(agent==='Jett'&&k==='x')ok(tp&&tp.relay==='',`Jett x TP: Blade Storm keeps its own knife-hands pose (no cast pose on top)`);
    else ok(tp&&tp.relay===XABA_TYof(agent,k),`${tag} TP relay (online / P2P observers, spectators): typed cast pose ${tp&&tp.relay} (want ${XABA_TYof(agent,k)})`);
    if(tp&&tp.bag&&!(tp.bag==='Jett'&&k==='x'))ok(tp.bot===XABA_TYof(tp.bag,k),`${tag} TP offline bot (${tp.bag}) ${k}: typed cast pose ${tp.bot}`);
    await tap('Digit1',40);await adv(300);}
   xe('if(running){FV.sp.st="carry";fCheck(true,"QA")}true');await adv(7600);H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();await adv(1500);}
  ok(H.errors.length===e0,'offline page: no exceptions '+JSON.stringify(H.errors.slice(e0,e0+3).map(String)));ok(!xe('XABA.err'),'offline page: no ABILITY ANIM error '+xe('XABA.err'));}
 function XABA_TYof(ag,k){return L.type(ag,k);}
 // ---- 6. online: the keys the server casts straight from the press --------------------------------------------------
 if(!process.env.QUICK){const {online}=require('./abil_anim_audit_online.cjs');
  const REC=fs.readFileSync(path.join(__dirname,'abil_anim_audit.cjs'),'utf8').match(/const REC=`([\s\S]*?)`;/)[1];
  const sum=fr=>{const on=fr.filter(f=>f.on&&f.c),us=on.map(f=>f.u).filter(u=>u>=0);return {n:on.length,mv:us.length>1?Math.max(...us)-Math.min(...us):0,clips:[...new Set(on.map(f=>f.c))]};};
  const want={Jett:'qe',Reyna:'x',Skye:'c'};const O=await online(REC,sum,Object.keys(want));
  for(const ag in want)for(const k of want[ag]){const r=O[ag]&&O[ag][k];ok(r&&r.press.n>=8&&r.press.mv>.1,`ONLINE ${ag} ${k} FP: quick cast on the ability arms (${r&&r.press.n} frames, span ${r&&r.press.mv.toFixed(2)})`);}
  ok(!O.__err&&!(O.__pageErrors||[]).length,'online page: no errors '+JSON.stringify([O.__err,O.__pageErrors]));}
 if(fails.length){console.error(fails.slice(0,40).join('\n')+`\n${fails.length} failed, ${n} passed`);process.exit(1);}
 console.log(`Ability animations: ${n} checks - every agent x C/Q/E/X has a typed third-person cast pose (real Jett / Breach rigs: hands move, gun holstered, exact hand-back, legs untouched) and a moving first-person ability clip (offline page, real FP rigs${process.env.QUICK?'':', online server-cast keys'})`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
