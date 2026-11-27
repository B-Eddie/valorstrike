(()=>{cancelAnimationFrame(loop.id);loop=function(){};
const o={};const all=bots.concat(allies);o.n=[bots.length,allies.length];
o.agents=all.map(b=>({name:b.name,alive:b.alive,g:!!b.g,xm:b.xm?Object.keys(b.xm).slice(0,40):null,x:b.xm&&b.xm.x?Object.keys(b.xm.x).slice(0,50):null,pos:b.g?[b.g.position.x,b.g.position.y,b.g.position.z].map(v=>+v.toFixed(2)):null,vis:b.g&&b.g.visible,parent:!!(b.g&&b.g.parent)}));
o.fp=XV.fp?Object.keys(XV.fp):null;o.vf=typeof VF_VIEW!=='undefined'?Object.keys(VF_VIEW):null;
o.player=[camera.position.x,camera.position.y,camera.position.z,yaw,pitch];
let sk=0,mats={};scene.traverse(x=>{if(x.isSkinnedMesh)sk++;if(x.isMesh)for(const m of [].concat(x.material))mats[m.type]=(mats[m.type]||0)+1;});o.sk=sk;o.mats=mats;
o.mode=mode;o.FV=FV&&{phase:FV.ph||FV.phase,buy:FV.buy};
return JSON.stringify(o);})()
