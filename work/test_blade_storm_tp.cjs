// hk-39: Blade Storm in third person (user 10:31 "third-person Blade Storm looks weird": remote players / bots kept the gun).
// Server rows carry [24] = knives left (fog-hidden rows 0); the page's BLADE STORM THIRD PERSON block (ability_fp_runtime.js)
// turns that (online) or the FEEL bot ult (offline: 5 knives, one per shot, a kill refills, over at 0) into the knife-hands
// pose (M.w 'Knife' -> Sword_Idle, gun hidden) + one floating dagger per knife, OverhandThrow per throw, a faster one for a burst.
//   node work/test_blade_storm_tp.cjs
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');const root=path.join(__dirname,'..');
(async()=>{
 // ---- server: row [24] ----
 const {SpikeSimulation}=await import('file://'+root+'/server/src/spike.js'),{fogRow}=await import('file://'+root+'/server/src/fog.js');
 const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity}; // = server/test-blades.js
 if(W){const s=new SpikeSimulation(W,'five','ascent',()=>.5),j=s.add('jet','Jett'),v=s.add('v0');s.start(false);s.buy=0;s.roundDelay=0;const row=()=>s.rows().find(r=>r[0]===j.id);
  assert.equal(row().length,25,'row has [24]');assert.equal(row()[24],0,'no knives out');
  j.ability.ult=8;assert(s.command(j,{t:'ab',k:'x'}));assert.equal(row()[24],5,'Blade Storm: 5 knives');assert.equal(row()[11],j.weapon,'the server weapon stays the gun');
  Object.assign(j,{x:0,y:0,z:0,look:0,pitch:0,air:true,sf:1});Object.assign(v,{x:0,y:0,z:-4,hp:200,armor:0,protectedUntil:0});s.time+=1;assert(s.command(j,{t:'blade'}));assert.equal(row()[24],j.ability.blades,'one throw: knives left');
  assert.equal(fogRow(row())[24],0,'fog-hidden row: no knives');
  s.time+=1;assert(s.command(j,{t:'blade',alt:1}));assert.equal(row()[24],0,'burst: none left');
  const ev=s.events.filter(e=>e[0]==='s'&&e[1]===j.id&&e[2]==='Blade Storm');assert(ev.length>=2,'burst = several Blade Storm shot events in one step ('+ev.length+')');
 }else console.log('(world.js not loadable here: server part skipped)');
 // ---- client block ----
 const T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));
 const src=fs.readFileSync(root+'/work/ability_fp_runtime.js','utf8'),a=src.indexOf('// ---- Blade Storm THIRD PERSON'),b=src.indexOf('// ---- END ABILITY FIRST PERSON',a);assert(a>0&&b>a,'block present');
 const clip=[],calls=[],sfx=[];const mkKnife=()=>{const g=new T.Group();g.add(new T.Mesh(new T.BoxGeometry(.02,.02,.24)));return g;};
 const c={THREE:T,window:{},NET:{socket:null},MP:{me:9},bots:[],allies:[],player:{hp:100},scene:new T.Group(),performance:{now:()=>1000},
  xvLoad:()=>Promise.resolve({scene:new T.Group()}),xAfKnife:()=>mkKnife(),jBurstDirs:n=>{const o=[];for(let i=0;i<n;i++)o.push((i-(n-1)/2)*2.5*Math.PI/180);return o;},
  SFX:{at:(p,w)=>sfx.push(['gun',w]),ab:(n,p)=>sfx.push(['ab',n,p])},renderer:{info:{render:{frame:1}}},xUbOnce:(X,n,set,dur)=>clip.push([n,set,dur]),xUbAnim:(bb,M)=>calls.push(['anim',M.w]),xUbShot:()=>{},kill:(x)=>{x.alive=false;},allyDie:(x)=>{x.alive=false;},pDie:()=>{},mpCliSnap:()=>{},xDie:()=>{}};
 vm.createContext(c);vm.runInContext(src.slice(a,b),c);const L=c.window.xBladeTP;assert(L,'export');
 // hk-41 kunai: real 3D geometry (user "it looks like 2d png's of knives"), not a flat card / sprite / textured quad
 {const ka=src.indexOf('var XKUN ='),kb=src.indexOf('function xAfDrawnBox',ka);assert(ka>0&&kb>ka,'kunai builder present');const kc={THREE:T,XNR:()=>{}};vm.createContext(kc);vm.runInContext(src.slice(ka,kb),kc);
  const w=vm.runInContext('xAfKnife(null,0)',kc);w.visible=true;w.updateMatrixWorld(true);const ms=[];w.traverse(o=>{if(o.isMesh)ms.push(o);});assert(ms.length>=6,'kunai = blade + edge glow + collar + grip + bands + ring ('+ms.length+')');
  assert(!/PlaneGeometry|Sprite|ShapeGeometry|alphaTest|map:/.test(src.slice(ka,kb)),'no flat card / sprite / texture in the kunai');
  const blade=ms[0],bb=new T.Box3().setFromBufferAttribute(blade.geometry.attributes.position),sz=bb.getSize(new T.Vector3());assert(sz.z>.14&&sz.y>.04&&sz.x>.008,'blade has length, width AND thickness (diamond section): '+sz.toArray().map(v=>v.toFixed(3)));
  const all=new T.Box3().setFromObject(w),as=all.getSize(new T.Vector3());assert(as.z>.22&&as.z<.3,'kunai ~0.25 m long: '+as.z.toFixed(3));
  const tip=new T.Vector3(0,0,.155+(-0.027)).applyMatrix4(ms[0].parent.matrixWorld);assert(Math.abs(all.max.z-tip.z)<.01||all.max.z>0,'blade end on +z');
  const n=blade.geometry.attributes.normal;let px=0,nx=0;for(let i=0;i<n.count;i++){const x=n.getX(i);if(x>.5)px++;if(x<-.5)nx++;}assert(px>0&&nx>0,'faceted both faces (ridge)');
  assert(blade.material.emissive.getHex()!==0&&blade.material.emissiveIntensity>0,'glowing blade');assert(ms.some(m=>m.material.blending===T.AdditiveBlending),'soft additive edge glow');
  const tr=vm.runInContext('xKunTrail()',kc);assert(tr.material.blending===T.AdditiveBlending&&tr.geometry.type==='ConeGeometry','thrown trail = additive 3D streak');}
 // layout
 const R5=L.ring(5,0);assert.equal(R5.length,5);assert.equal(L.ring(3,0).length,3,'one dagger per knife left');assert.equal(L.ring(0,0).length,0);
 for(const r of R5){assert(r.p[2]>.3,'in front of the agent');assert(r.p[1]>1&&r.p[1]<1.5,'at the hands / chest');assert(Math.abs(Math.hypot(...r.d)-1)<1e-9);assert(r.d[2]>.5,'points forward');}
 assert(R5[0].p[0]>0&&R5[1].p[0]>0&&R5[3].p[0]<0&&R5[4].p[0]<0&&R5[2].p[0]===0,'two left, centre, two right (FP slot order)');assert(R5[2].d[1]>.3,'centre dagger points up');
 assert.equal(R5[0].p[0],-R5[4].p[0],'symmetric');
 // offline knife count
 const UB={};c.window.xBotUB=UB;const bot={name:'BJ',alive:true,hp:100,xsh:0,agent:'Jett',g:new T.Group()};c.bots.push(bot);
 assert.equal(L.k(bot),0);UB.BJ=1;bot.bsK=5;bot.bsSn=0;assert.equal(L.k(bot),5);
 const shot=()=>{bot.xsh++;c.xUbShot();};shot();assert.equal(bot.bsK,4,'one knife per shot');shot();shot();shot();assert.equal(bot.bsK,1);
 const v1={alive:true};c.kill(v1,false,'BJ');assert.equal(bot.bsK,5,'a kill refills to 5');
 for(let i=0;i<5;i++)shot();assert.equal(bot.bsK,0);assert.equal(L.k(bot),0,'0 knives: no knives out');assert.equal(UB.BJ,1,'ult ends on the next shot unless that knife killed');
 const v2={alive:true};c.kill(v2,false,'BJ');assert.equal(bot.bsK,5,'the kill with the last knife refills too');
 for(let i=0;i<5;i++)shot();shot();assert.equal(UB.BJ,undefined,'out of knives, no kill: Blade Storm over (bot ult entry gone)');
 bot.bsK=3;assert.equal(L.k(bot),0,'no active ult: no knives');
 // a Blade Storm knife (online 's' event / offline bot knife): knife-throw sound at the unit, counted as a throw, never the gun chain (Vandal / tracer)
 {const P=new T.Vector3(1,0,1),u={name:'SJ',alive:true,hp:100,xsh:0,g:{position:P}};let n=0;const s0=c.xUbShot;c.xUbShot=()=>{n++;};
  sfx.length=0;c.SFX.at(P,'Blade Storm');assert.deepEqual(sfx.map(x=>x[0]+':'+x[1]),['ab:bsThrow'],'Blade Storm: knife-throw sound only (no gun sound / bfxBot tracer)');assert.equal(sfx[0][2],P,'3D at the thrower');assert.equal(n,1,'counted as a throw (xUbShot)');
  c.SFX.at(P,'Blade Storm');c.SFX.at(P,'Blade Storm');assert.equal(sfx.length,1,'a burst (same frame) = one throw sound');assert.equal(n,3,'every knife counted');
  c.renderer.info.render.frame=2;c.SFX.at(P,'Blade Storm');assert.equal(sfx.length,2,'next frame: next throw sound');
  sfx.length=0;c.SFX.at(P,'Vandal');assert.deepEqual(sfx,[['gun','Vandal']],'guns unchanged');c.xUbShot=s0;}
 // page (index.html): offline bots throw knives with knife damage, online 's' events route Blade Storm, no 1.3x
 {const H=fs.readFileSync(root+'/index.html','utf8');
  assert(/XU\.b\[u\.name\] = 1; u\.bsK = 5;/.test(H),'bot Blade Storm: XU.b = 1 (no gun damage x1.3)');assert(!/XU\.b\[u\.name\] = 1\.3/.test(H));
  const xb=H.match(/var XBSB = (\{[^}]*\})/);assert(xb,'XBSB');const XBSD={head:150,body:50,legs:42.5};const B=vm.runInNewContext('('+xb[1]+')',{XBSD});
  const {weapons}=await import('file://'+root+'/server/src/simulation.js'),dr=weapons['Blade Storm'].damageRanges[0];
  assert.equal(B.body,dr.bodyDamage);assert.equal(B.head,dr.headDamage);assert.equal(B.legs,dr.legDamage);assert.equal(B.rate,weapons['Blade Storm'].fireRate);assert.equal(B.head,3*B.body);assert.equal(B.legs,.85*B.body,'wiki: 50 body, x3 head, x0.85 legs');
  const wd=H.match(/function wDmg\(W, zone, dist\) \{[^\n]*\n[^\n]*\}/)[0];const WD=vm.runInNewContext(wd+';wDmg',{WEAP:{},xPelOn:false});for(const d of [2,30,80])assert.deepEqual(['body','head','legs'].map(z=>WD(B,z,d)),[50,150,42.5],'knife damage at '+d+' m (no falloff)');
  assert(H.includes('const bsw = xBsBot(b), w = bsw ? "Blade Storm" : b.w || "Classic", W = bsw ? XBSB : WEAP[w] || WEAP.Classic'),'enemy bot shot: knives while Blade Storm is out');
  assert(H.includes('aw = abs ? "Blade Storm" : a.w || "Vandal", AW = abs ? XBSB : WEAP[aw] || WEAP.Vandal')&&H.includes('SFX.at(p, aw)')&&H.includes('AW = abs ? XBSB : WEAP[a.w || "Vandal"]'),'ally bot shot: knives');
  assert(H.includes('(w === "Blade Storm" ? 0 : gSpread(w, W, { mv: b.mv, n }))'),'knives: no movement spread (server ignoreMovementSpread)');
  assert(H.includes('WEAP[v[2]] || v[2] === "Blade Storm" ? v[2] : "Vandal"'),'online shot event: Blade Storm routed, not Vandal');
  assert(H.includes('if (b.bsW && window.xBotUB && xBotUB[b.name]) return "Blade Storm";'),'kill feed: Blade Storm');
  const xs=H.match(/function xBsBot\(b\) \{[^\n]*\}/)[0];const ctx={NET:{socket:null},xBtpK:u=>u.k};const f=vm.runInNewContext(xs+';xBsBot',ctx);assert.equal(f({k:3}),true);assert.equal(f({k:0}),false);assert.equal(f({k:3,nt:1}),false,'remote units: server decides');ctx.NET.socket={};assert.equal(f({k:3}),false,'online: server bots');}
 // TP pose through the xUbAnim wrapper
 const M={m:new T.Group(),w:'Vandal',gun:new T.Group(),sx:{sn:0,shots:7},xap:0.3};bot.g.add(M.m);UB.BJ=1;bot.bsK=5;bot.bsSn=bot.xsh;
 c.xUbAnim(bot,M,0,1/60);await new Promise(r=>setTimeout(r,0));c.xUbAnim(bot,M,0,1/60);// first call starts the melee load
 assert(M.btp,'dagger rig built '+L.XBTP.err+' '+L.k(bot)+' '+!!L.XBTP.gl);assert.equal(calls.at(-1)[1],'Knife','knife hands while knives are out (Sword_Idle, grip off) '+L.XBTP.err);assert.equal(M.gun.visible,false,'gun hidden');
 assert.equal(M.btp.k.filter(k=>k.visible).length,5,'5 daggers float');assert(Math.abs(M.btp.g.rotation.x+0.24)<1e-9,'the arc pitches with the aim');assert.equal(M.sx.shots,0,'no visual reload count');
 bot.xsh++;bot.bsK=4;bot.bsSn=bot.xsh;c.xUbAnim(bot,M,0,1/60);assert.deepEqual(clip.at(-1),['throw','U',L.XBTP.single],'OverhandThrow per throw');assert.equal(M.btp.k.filter(k=>k.visible).length,4);
 assert.equal(M.sx.sn,bot.xsh,'no Pistol_Shoot recoil for a knife');assert(L.XBTP.live.length===1,'the thrown dagger flies');
 // online burst: 3 knives -> 0 in one snapshot
 c.NET.socket={};const rb={name:'RJ',nt:1,nid:4,alive:true,hp:100,xsh:0,g:new T.Group()},M2={m:new T.Group(),w:'Phantom',gun:new T.Group(),sx:{sn:0,shots:0},xap:0};rb.g.add(M2.m);c.bots.push(rb);
 c.mpCliSnap({u:[[4,1,'RJ','Jett',0,0,0,0,100,0,1,'Phantom',1,0,1,0,0,0,0,0,0,-1,0,0,3]]});assert.equal(rb.bsK,3,'online: knives from row [24]');
 c.xUbAnim(rb,M2,0,1/60);assert.equal(calls.at(-1)[1],'Knife');assert.equal(M2.btp.k.filter(k=>k.visible).length,3);
 c.mpCliSnap({u:[[4,1,'RJ','Jett',0,0,0,0,100,0,1,'Phantom',1,0,1,0,0,0,0,0,0,-1,0,0,0]]});rb.xsh+=3;c.xUbAnim(rb,M2,0,1/60);
 assert.deepEqual(clip.at(-1),['throw','U',L.XBTP.burst],'right-click burst: one faster throw');assert.equal(L.XBTP.live.length,1+3,'every dagger leaves together');assert.equal(M2.gun.visible,false,'gun still hidden during the throw tail');
 for(let i=0;i<40;i++)c.xUbAnim(rb,M2,0,1/60);assert.equal(M2.gun.visible,true,'gun back after the tail');assert.equal(M2.w,'Phantom','weapon pose restored');assert.equal(M2.btp.g.visible,false);
 c.mpCliSnap({u:[[4,1,'RJ','Jett',0,0,0,0,100,0,1,'Phantom',1,0,1,0,0,0,0,0,0,-1,1,0,5]]});assert.equal(rb.bsK,0,'fog-hidden row: no knives');
 // death: daggers hidden, gun back for the drop
 rb.bsK=5;c.xUbAnim(rb,M2,0,1/60);assert.equal(M2.gun.visible,false);rb.xm=M2;c.xDie(rb);assert.equal(M2.gun.visible,true,'death drops the gun');assert.equal(M2.btp.g.visible,false);
 // hk-43 knife-hands raise (user: TP Blade Storm "arms hang low"): on the real Jett rig (server/tools/grip-view.mjs, Sword_Idle upper body) the
 // installed xBtpHands lifts both hands from the hips to the chest, in front of the shoulders, pitched with the aim; off with the knives.
 {const hs=src.indexOf('var XBTP_HANDS'),he=src.indexOf('\nif (typeof xUbPost === "function") { const hp0',hs);assert(hs>0&&he>hs,'knife-hands block installed');
  assert(fs.readFileSync(root+'/index.html','utf8').includes(src.slice(hs,he)),'index.html carries the knife-hands block (rerun install_valorant.py)');
  const GV=await import('file://'+root+'/server/tools/grip-view.mjs'),api=GV.runtime();vm.runInContext(src.slice(hs,he)+';globalThis.api.xBtpHands=xBtpHands;',api.ctx);
  const _w=console.warn;console.warn=(...x)=>{if(!/boneTransform/.test(String(x[0])))_w(...x);};
  const R=await GV.build('jett','vandal',api),{M,X,bone}=R,V=api.ctx.THREE;M.w='Knife';R.play('idle','knife');R.step(30);
  const loc=n=>M.m.worldToLocal(bone(n).getWorldPosition(new V.Vector3()));
  const run=(n,pit)=>{X.pit=pit;for(let i=0;i<n;i++){X.poseDt=1/30;api.xUbPre(M);X.mx.update(1/30);api.xUbPost(M);api.xBtpHands(M,1/30);}M.m.updateMatrixWorld(true);};
  const meas=()=>{const o={};for(const s of ['R','L']){const h=loc(s+'_Hand'),sh=loc(s+'_Shoulder');o[s]={dy:h.y-sh.y,dz:h.z-sh.z};}return o;};
  run(1,0);const b0=meas();assert(b0.R.dy<-0.3&&b0.L.dy<-0.3,'stock Sword_Idle hands hang low ('+b0.R.dy.toFixed(2)+', '+b0.L.dy.toFixed(2)+')');
  M.btp={on:true};run(40,0);const a0=meas();
  for(const s of ['R','L']){assert(a0[s].dy>-0.26&&a0[s].dy<-0.12,s+' hand at chest height, ~0.2 m under the shoulder ('+a0[s].dy.toFixed(2)+')');assert(a0[s].dz>0.22,s+' hand in front of the shoulder ('+a0[s].dz.toFixed(2)+')');}
  run(40,0.5);const up=meas();assert(up.R.dy>a0.R.dy+0.05&&up.L.dy>a0.L.dy+0.05,'hands rise with an upward aim');
  run(40,-0.5);const dn=meas();assert(dn.R.dy<a0.R.dy-0.05,'hands lower with a downward aim');
  M.btp.on=false;run(40,0);const off=meas();assert(off.R.dy<-0.3&&M.btp.hw===0,'knives gone: back to the stock pose');
  console.warn=_w;console.log('knife hands: stock dy R '+b0.R.dy.toFixed(2)+' -> '+a0.R.dy.toFixed(2)+' (L '+b0.L.dy.toFixed(2)+' -> '+a0.L.dy.toFixed(2)+'), fwd '+a0.R.dz.toFixed(2));}
 console.log('Blade Storm TP: knife throw sound + no gun tracer for remote / bot knives; offline bot knife damage 50/150/42.5 (no x1.3); server row [24] knives (fog 0, burst = several shot events); offline bot 5 knives / kill refill / over at 0; knife hands + gun hidden + one floating dagger per knife pitched with the aim; OverhandThrow per throw, faster burst throw with the fan; tail then gun back; death drops the gun; kunai = real 3D geometry (diamond-section glowing blade, grip, ring, additive edge + trail)');
})().catch(e=>{console.error(e);process.exit(1);});
