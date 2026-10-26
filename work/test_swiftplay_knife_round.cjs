// Swiftplay round end -> next round with a skinned knife (and the default knife) never throws or hangs.
// User 17:43 2026-10-26: "Swiftplay hung after a round ended"; their live console (Firefox, prod) 17:45:
//   TypeError: can't access property "userData", m is undefined   at xVM <- onSkin, called from fBuy, swapW AND fRound.
// fRound runs from the round-end timer (fCheck's FV.to), so the throw there aborted the round start before running = true:
// the game sat on the round banner forever. Root cause = 06fa3ce (xskTemplate restore created XGM.sk.Knife = undefined) +
// xVM's recolour loop skipping a missing material. This test drives all three call paths, both knife variants, across two
// Swiftplay round ends, and also with XGM.sk.Knife = undefined planted directly (the guard on its own).
// Fails on the parent of the knife fix (f21e239 in the qa37w stack).
//   node work/test_swiftplay_knife_round.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const cat=JSON.parse(fs.readFileSync(path.join(__dirname,'../server/src/skins.json'),'utf8'));
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:11}),xe=H.xe,e0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
const noErr=tag=>{if(H.errors.length>e0||H.xErrCalls.length>x0)throw new Error(tag+': page exceptions '+JSON.stringify({e:H.errors.slice(e0,e0+4),x:H.xErrCalls.slice(x0,x0+4)}).slice(0,1500));};
const col=cat.collections.find(c=>c.skins&&c.skins.Knife&&c.id!=='standard');assert(col,'a knife skin in skins.json');
(async()=>{
 xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=1;xLob0=false;startFive();true');await adv(400);
 assert.equal(xe('FV.sw'),true,'Swiftplay (FV.sw)');assert.equal(xe('mode'),'five');
 xe(`window.__mk=function(name){const sc=new THREE.Group();const m=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.03,0.3),new THREE.MeshStandardMaterial());m.name='authentic:'+name;sc.add(m);return {scene:sc,animations:[]};};
  xvLoad=function(name){return Promise.resolve(__mk(name));};
  xskModelData=function(a){return Promise.resolve({descriptor:{Constraints:[],FPExclusiveObjects:[]},fp:null});};true`);
 const round=()=>xe('FV.you+FV.them');
 const live=async tag=>{for(let i=0;i<200&&!xe('running');i++)await adv(200);noErr(tag);assert(xe('running'),tag+': next round started (running) - a throw in fRound leaves the game hung');};
 // one Swiftplay round with knife variant `id`: buy (fBuy -> onSkin), switch to the knife (swapW -> onSkin), end the round
 // (fCheck -> timer -> fRound -> onSkin), and check the next round is live, with the knife still switchable.
 const play=async(id,plant)=>{const tag='Swiftplay knife '+id+(plant?' (XGM.sk.Knife = undefined planted)':'');
  xe(`XSK.owned.add(${JSON.stringify(col.id+':Knife')});true`);assert.equal(xe(`xskEquip("Knife",${JSON.stringify(id)})`),true,tag+' equip');
  if(id!=='standard'){await xe(`(window.__tp=Promise.resolve().then(()=>xskTemplate("Knife",${JSON.stringify(id)})).then(()=>1,()=>0),true)`);await adv(100);}
  if(plant)xe('XGM.sk.Knife=undefined;true');
  await live(tag+' round live');
  xe('FV.buy=Math.max(FV.buy,5);FV.cr=9000;player.hp=100;true');xe('fBuy("Spectre");true');noErr(tag+' fBuy');
  xe('swapW("knife");xskApplyAll(true);true');await adv(200);noErr(tag+' swapW knife');assert.equal(xe('rw'),'knife',tag+' knife out');
  xe('swapW("pis");swapW("knife");true');await adv(100);noErr(tag+' swapW again');
  const r0=round();xe('FV.buy=0;FV.det=0;FV.sp.st="";fCheck(true,"Test round end");true');assert.equal(round(),r0+1,tag+' round scored');
  assert.equal(xe('running'),false,tag+' between rounds');
  if(plant)xe('XGM.sk.Knife=undefined;true');
  await live(tag+' after the round end');assert.equal(round(),r0+1);
  xe('player.hp=100;swapW("knife");true');await adv(100);noErr(tag+' knife in the new round');assert.equal(xe('rw'),'knife');
  assert.equal(xe('JSON.stringify(Object.keys(XGM.sk).filter(k=>XGM.sk[k]===undefined&&k!=="Knife"))'),'[]',tag+' no other undefined XGM.sk key');};
 await play('standard',false);
 await play(col.id,false);
 await play(col.id+(col.skins.Knife.ch.length>1?'.1':''),false);
 await play(col.id,true);
 assert(round()<5,'still mid-match (first to 5)');
 noErr('end');
 console.log(`swiftplay knife round: ${round()} Swiftplay round ends -> next round live with the default knife, skinned knife (${col.id}) and a planted XGM.sk.Knife = undefined; fBuy / swapW / fRound (onSkin -> xVM) throw nothing`);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
