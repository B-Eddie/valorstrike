(()=>{
const all=bots.concat(allies),out={};
if(!window.__cp){window.__cp={x:camera.position.x,y:camera.position.y,z:camera.position.z,gy:Math.round((camera.position.y-1.6)*1000)/1000};} // lineup ground: constant from the player's fixed spawn eye (was a randomly spawned teammate's y)
const C=window.__cp;
// player: still, level, alive
player.vx=player.vy=player.vz=0;player.air=false;if(player.hp<=0)player.hp=100;yaw=0;pitch=0;
try{VM.sx=VM.sy=0;}catch(e){}
// hide everything that is neither the map, an agent, a light, the sky nor the camera (pooled FX, tracers, devices, drops)
const M=NM.current.M.g,keepTop=new Set([M,camera,...all.map(b=>b.g)]);out.hid=[];
for(const c of scene.children){if(keepTop.has(c)||c.isLight||/sky/i.test(c.name||''))continue;if(c.visible){c.visible=false;out.hid.push(c.name||c.type);}}
// lineup: 3 x 3 grid in front of the player, each agent turned a different way, idle clip at a fixed time from its bind pose
all.forEach((b,i)=>{const row=Math.floor(i/3),col=i%3;b.g.visible=true;b.g.position.set(C.x+(col-1)*1.7,C.gy,C.z-3.2-row*2.4);b.g.rotation.set(0,i*0.83,0);b.g.updateMatrixWorld(true);
 const xm=b.xm;if(!xm){out['noxm'+i]=b.name;return;}xm.m.visible=true;
 let V=null;for(const k of Object.keys(xm)){const q=xm[k];if(q&&typeof q==='object'&&q.mx&&q.mx.isAnimationMixer!==false&&typeof q.mx.setTime==='function'){V=q;break;}}const mx=V&&V.mx;
 xm.m.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton&&!o.skeleton.__posed){o.skeleton.pose();}});
 if(mx){mx.stopAllAction();const A=V.a||{};const k=['idle','Idle','stand'].find(n=>A[n])||Object.keys(A)[0];const act=k?A[k]:null;
  if(act){act.reset();act.enabled=true;act.setEffectiveWeight(1);act.setEffectiveTimeScale(1);act.play();}mx.setTime(0.35+0.11*i);out['a'+i]=b.name+':'+k;}
 else out['a'+i]=b.name+':nomixer';
 xm.m.updateMatrixWorld(true);});
// first-person viewmodel: idle at a fixed phase, sway / bob state zeroed
// viewmodel layer: drop pending warm draws and any rig other than the current one (a stale / prefetched rig left in the
// layer by the buy race drew a second Vandal: +11..24 calls in some runs, base and lane alike)
try{VF_WARMQ.length=0;}catch(e){}out.vfDrop=[];{const F0=XV.fp;for(const c of VF_VIEW.scene.children.slice()){if(c.isLight||(F0&&c===F0.root))continue;out.vfDrop.push((c.name||c.type)+(c.visible?'':'(hid)'));VF_VIEW.scene.remove(c);}}
const F=XV.fp;if(F){const V=VF_VIEW;V.owner=player;V.dead=false;V.lastAir=false;V.phase=V.land=V.landT=V.vyo=V.bob=V.swayX=V.swayY=V.moveX=V.moveXLag=V.moveZ=V.moveZLag=0;
 try{VF_CAM.y=VF_CAM.v=0;}catch(e){}F.root.visible=true;F.am.stopAllAction();F.gm.stopAllAction();F.am.update(0);F.gm.update(0);F.kind=null;F.action=F.gaction=null;/* no prior action -> xvFPPlay does not crossFadeFrom (that froze the rig at the fade's weight 0) */xvFPPlay(F,'idle',0.3);out.fpAct=[F.am,F.gm].map(m=>m._actions.filter(a=>a.isRunning()).map(a=>a.getClip().name+'@'+a.time.toFixed(3)+'w'+a.getEffectiveWeight().toFixed(2)).join(','));try{vfViewTick(F,0);}catch(e){out.vfErr=String(e);}out.fp=F.w+':'+(F.skin&&(F.skin.id||F.skin))+':'+(F.kind);}
// camera views (eye height 1.6 above the lineup ground)
const ey=C.gy+1.6,cen={x:C.x,z:C.z-5.6};const look=(p,t)=>Math.atan2(-(t.x-p.x),-(t.z-p.z));
const V=[[C.x,ey,C.z,null,-0.06],[C.x,ey,C.z-1.6,null,-0.12],[C.x+4.5,ey,C.z-4.5,cen,-0.05],[C.x-4.5,ey,C.z-6.5,cen,-0.05],[C.x,C.gy+0.7,C.z-1.2,null,0.22],[C.x+0.5,ey+3,C.z-0.5,cen,-0.45],[C.x-1.7,ey-0.1,C.z-4.6,{x:C.x-1.7,z:C.z-3.2},-0.25],[C.x+1.7,ey-0.1,C.z-7.0,{x:C.x+1.7,z:C.z-5.6},-0.25]];
window.__views=V.map(v=>({p:[v[0],v[1],v[2]],yaw:v[3]?look({x:v[0],z:v[2]},v[3]):0,pitch:v[4]}));
window.__view=(i)=>{const q=window.__views[i];camera.position.set(q.p[0],q.p[1],q.p[2]);camera.rotation.set(q.pitch,q.yaw,0,'YXZ');camera.updateMatrixWorld(true);if(NM.current)NM.current.cullAt=null;};
window.__vmOnly=()=>{window.__view(0);window.__vmH=[];for(const b of all)if(b.g.visible){b.g.visible=false;window.__vmH.push(b);}M.visible=false;};
window.__vmOnlyOff=()=>{for(const b of window.__vmH||[])b.g.visible=true;M.visible=true;};
out.views=window.__views.length;out.cp=C;return JSON.stringify(out);})()
