// Knife skins + knife attacks (user 13:12: switching to the knife with a knife SKIN equipped threw "TypeError: can't access
// property "userData", m is undefined"; user 13:18: "right click knife is wrong").
// Root cause of the crash: xskTemplate (work/skins_runtime.js) borrows XGM.F / XGM.sk[w] while it builds a skin's third-person
// template and restored them with XGM.sk[w] = old - for the Knife (no recolour material: XGM.sk.Knife never set) that CREATED
// the key with the value undefined, and the next weapon swap's xVM (onSkin) loop `for (n in XGM.sk) { m = XGM.sk[n] ... m.userData }`
// threw. Fails on 8f1721e at the first knife skin.
// Real page (work/page_harness.cjs), live 5v5 round; xvLoad / xskModelData answer with a small GLTF-shaped scene (no downloads).
// For EVERY knife skin variant in server/src/skins.json: equip it, build its template (resolved or failed), switch to the knife,
// inspect (Y), light swing, heavy (right click), touch scope button heavy, back to the gun - no page exception, no undefined XGM.sk key.
// Knife ALT FIRE = wiki Melee: one heavy stab, 1 s recovery, 75 front / 150 back, 2 m like the light swing, NO lunge (the player does
// not move), the native 'Alt Attack' FP clip (not a combo swing), its own heavier sound; light swings alternate the combo clips, 50 / 100.
//   node work/test_knife_skins.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const cat=JSON.parse(fs.readFileSync(path.join(__dirname,'../server/src/skins.json'),'utf8'));
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7}),xe=H.xe,e0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
const noErr=tag=>{if(H.errors.length>e0||H.xErrCalls.length>x0)throw new Error(tag+': page exceptions '+JSON.stringify({e:H.errors.slice(e0,e0+4),x:H.xErrCalls.slice(x0,x0+4)}).slice(0,1500));};
(async()=>{
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 for(let i=0;i<300&&!xe('running&&player.hp>0&&!(FV.buy>0)');i++){if(xe('FV.buy>0'))xe('FV.buy=0.05;true');await adv(200);}
 assert(xe('running&&player.hp>0'),'live round');xe('bots.concat(allies).forEach(b=>{b.det=1e9;});timeLeft=Math.max(timeLeft,600);true');
 xe(`window.__mk=function(name){const sc=new THREE.Group();const m=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.03,0.3),new THREE.MeshStandardMaterial());m.name='authentic:'+name;sc.add(m);return {scene:sc,animations:[]};};
  xvLoad=function(name){return Promise.resolve(__mk(name));};
  xskModelData=function(a){return Promise.resolve({descriptor:{Constraints:[],FPExclusiveObjects:[]},fp:null});};
  window.__snd=[];{const k0=SFX.knife;SFX.knife=function(){__snd.push('light');return k0.apply(this,arguments);};if(SFX.knifeHeavy){const h0=SFX.knifeHeavy;SFX.knifeHeavy=function(){__snd.push('heavy');return h0.apply(this,arguments);};}}
  true`);
 const pre=xe('JSON.stringify(Object.keys(XGM.sk||{}).filter(k=>XGM.sk[k]===undefined))');assert.equal(pre,'[]','no undefined XGM.sk keys at the start');
 let n=0;
 for(const col of cat.collections){const sk=col.skins.Knife;if(!sk)continue;
  for(let i=0;i<sk.ch.length;i++){const id=i?col.id+'.'+i:col.id,tag='Knife '+id;
   xe(`XSK.owned.add(${JSON.stringify(col.id+':Knife')});true`);if(id!=='standard')assert.equal(xe(`xskEquip("Knife",${JSON.stringify(id)})`),true,tag+' equip');
   // the template build (what xskApply / skGroups start for a skinned knife): resolved or rejected, it must leave XGM as it was
   await xe(`(window.__tp=Promise.resolve().then(()=>xskTemplate("Knife",${JSON.stringify(id)})).then(()=>1,()=>0),true)`);await adv(50);
   assert.equal(xe('JSON.stringify(Object.keys(XGM.sk).filter(k=>XGM.sk[k]===undefined).concat(Object.keys(XGM.F).filter(k=>XGM.F[k]===undefined)))'),'[]',tag+': XGM.sk / XGM.F left with an undefined key');
   xe('player.hp=100;swapW("knife");xskApplyAll(true);true');await adv(200);noErr(tag+' switch to knife');assert.equal(xe('rw'),'knife');
   xe('VM.sw=0;VM.ins=0;kSwing=0;true');H.key('KeyY',true);await adv(60);H.key('KeyY',false);assert(xe('VM.ins>0'),tag+' inspect started');await adv(300);noErr(tag+' inspect');
   xe('VM.ins=0;kSwing=0;shoot();true');assert.equal(xe('kSwing'),.5,tag+' light swing');await adv(600);noErr(tag+' light');
   const p0=xe('JSON.stringify([player.x,player.z])');xe('kSwing=0;shoot(true);true');assert.deepEqual([xe('kSwing'),xe('kHv')],[1,1],tag+' heavy: 1 s recovery');
   await adv(400);assert.equal(xe('JSON.stringify([player.x,player.z])'),p0,tag+' heavy: no lunge');await adv(700);noErr(tag+' heavy');
   if(process.env.KV)console.log('..',tag);xe('swapW("pri");true');await adv(100);noErr(tag+' back to the gun');xe('swapW("knife");true');await adv(100);noErr(tag+' knife again');xe('swapW("pri");true');n++;}}
 const total=cat.collections.reduce((t,c)=>t+(c.skins.Knife?c.skins.Knife.ch.length:0),0);assert.equal(n,total,'every knife skin variant');
 // Knife attack values (wiki Melee): a bot 1.5 m in front, facing the player (front) or away (back)
 xe('xskEquip("Knife","standard");swapW("knife");true');await adv(200);
 const put=back=>xe(`(()=>{const b=bots.find(b=>b.g&&b.alive)||bots[0];bots.forEach(q=>{if(q!==b)q.g.position.set(player.x+200,q.g.position.y,player.z);});b.alive=true;b.hp=500;b.armor=0;b.det=1e9;
   const fx=-Math.sin(yaw),fz=-Math.cos(yaw);b.g.position.set(player.x+fx*1.5,b.g.position.y,player.z+fz*1.5);b.r=${back?'Math.atan2(fx,fz)':'Math.atan2(-fx,-fz)'};b.g.rotation.y=b.r;pitch=-0.25;window.__b=b;b.g.updateMatrixWorld(true);camera.updateMatrixWorld(true);return true;})()`);
 const hit=async(back,hv)=>{put(back);xe('kSwing=0;VM.sw=0;true');xe(hv?'shoot(true);true':'shoot();true');return xe('500-__b.hp');};
 const lf=await hit(false,false);await adv(600);const lb=await hit(true,false);await adv(600);const hf=await hit(false,true);await adv(1100);const hb=await hit(true,true);await adv(1100);
 assert.deepEqual([lf,lb,hf,hb],[50,100,75,150],'light front / back, heavy front / back = wiki Melee 50 / 100 / 75 / 150');
 // the heavy is one stab: the native 'Alt Attack' clip is asked for, never a combo swing; lights alternate the combo
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');assert(src.includes("XV.event=kHv?'alt Attack':xvKnCombo(F)"),'FP: heavy = Alt Attack clip, light = combo');
 const fake={entries:[{Translatable:'Attack 1'},{Translatable:'Attack 2'},{Translatable:'Attack 3'}],kt:0,kc:0};const combo=[];for(let i=0;i<4;i++)combo.push(xe(`(()=>{window.__F=window.__F||${JSON.stringify(fake)};return xvKnCombo(__F);})()`));
 assert.deepEqual(combo,['attack 1','attack 2','attack 3','attack 1'],'light swings in a row alternate the combo clips');
 // touch: the scope button with the knife out = ALT FIRE (heavy), as right click; Blade Storm out = its burst (hark-41's)
 {const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),i=html.indexOf('if (k === "zoom")'),line=html.slice(i,html.indexOf('\n',i));const vm=require('vm');
  const run=(rw,bs,md)=>{const ev=[];const C={rw,mode:md||'five',J:{dr:0,bs},jOn:()=>true,jBurst:()=>ev.push('burst'),shoot:h=>ev.push(h?'heavy':'shoot'),xScopeT:()=>ev.push('zoom'),aimW:()=>rw==='knife'?'Knife':'Vandal',aimFire:h=>ev.push(h?'aimheavy':'aim')};vm.createContext(C);vm.runInContext('(function(k){'+line+'\n})("zoom")',C);return ev;};
  assert.deepEqual(run('knife',0),['heavy'],'touch scope button with the knife = heavy');assert.deepEqual(run('knife',3),['burst'],'Blade Storm out = burst');assert.deepEqual(run('pri',0),['zoom'],'a gun = zoom');assert.deepEqual(run('knife',0,'aim'),['aimheavy'],'aim trainer knife = heavy');}
 // distinct heavy sound
 xe('__snd.length=0;kSwing=0;shoot();true');await adv(600);xe('kSwing=0;shoot(true);true');await adv(1100);
 assert.deepEqual(JSON.parse(xe('JSON.stringify(__snd)')),['light','heavy'],'the heavy plays its own sound (SFX.knifeHeavy), the light the swing');
 noErr('end');
 console.log(`knife skins: ${n} knife skin variants equip / template / switch / inspect / light / heavy / touch heavy / swap back with no page exception and no undefined XGM.sk key; knife 50 / 100 light, 75 / 150 heavy, heavy = 1 s, no lunge, Alt Attack clip, own sound; light combo alternates`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
