(()=>{
// DL=1 debug-only draw-list instrumentation (harness copy only). Installed right before a shot's render, removed right after.
const r=renderer,info=r.info,gl=r.getContext();
const S={rows:[],orphan:[],gl:{drawElements:0,drawArrays:0,drawElementsInstanced:0,drawArraysInstanced:0,multiDrawElementsWEBGL:0,multiDrawArraysWEBGL:0,multiDrawElementsInstancedWEBGL:0,multiDrawArraysInstancedWEBGL:0}};
const nm=o=>o?(o.name||('<'+o.type+'>')):'';
const chain=o=>{const a=[];for(let p=o.parent;p;p=p.parent)a.push(nm(p));return a.join(' > ');};
const rtName=()=>{const t=r.getRenderTarget();if(!t)return 'screen';const tx=t.texture||(t.textures&&t.textures[0]);return (tx&&tx.name?tx.name+' ':'')+t.width+'x'+t.height+(t.isWebGLCubeRenderTarget?' cube':'');};
const rbd=r.renderBufferDirect,iu=info.update;
r.renderBufferDirect=function(cam,scn,geo,mat,obj,grp){
 const ix=geo&&geo.index,pos=geo&&geo.attributes&&geo.attributes.position;
 const row={seq:S.rows.length,obj:nm(obj),otype:obj&&obj.type,oid:obj&&obj.id,chain:chain(obj),
  mat:mat&&mat.type,mname:mat&&mat.name||'',mvis:mat&&mat.visible,mtr:mat&&mat.transparent,mop:mat&&mat.opacity,mside:mat&&mat.side,
  gtype:geo&&geo.type,gname:geo&&geo.name||'',dr:geo&&geo.drawRange?[geo.drawRange.start,geo.drawRange.count]:null,
  icount:ix?ix.count:null,vcount:pos?pos.count:null,ginst:geo&&geo.isInstancedBufferGeometry?geo.instanceCount:null,
  grp:grp?[grp.start,grp.count,grp.materialIndex]:null,inst:obj&&obj.isInstancedMesh?obj.count:null,
  sk:!!(obj&&obj.isSkinnedMesh),fc:obj&&obj.frustumCulled,ro:obj&&obj.renderOrder,
  pass:scn===null?'shadow/direct(scene=null)':'scene',cam:cam&&cam.type,rt:rtName(),
  draws:0,calls:0,tris:0,upd:[],gl:[]};
 S.rows.push(row);S.cur=row;
 try{return rbd.apply(this,arguments);}finally{S.cur=null;}};
info.update=function(count,mode,inst){const c0=info.render.calls,t0=info.render.triangles;const res=iu.apply(this,arguments);
 const dc=info.render.calls-c0,dt=info.render.triangles-t0;
 if(S.cur){S.cur.draws++;S.cur.calls+=dc;S.cur.tris+=dt;S.cur.upd.push([count,mode,inst]);}else S.orphan.push({count,mode,inst,calls:dc,tris:dt,rt:rtName()});return res;};
const W=[];const wrap=(o,k,lab)=>{if(!o||typeof o[k]!=='function')return;const f=o[k];W.push([o,k,f]);o[k]=function(){S.gl[lab]++;if(S.cur)S.cur.gl.push(lab);else (S.glOrphan=S.glOrphan||[]).push(lab);return f.apply(this,arguments);};};
for(const k of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])wrap(gl,k,k);
const md=gl.getExtension('WEBGL_multi_draw');if(md)for(const k of ['multiDrawElementsWEBGL','multiDrawArraysWEBGL','multiDrawElementsInstancedWEBGL','multiDrawArraysInstancedWEBGL'])wrap(md,k,k);
window.__dlOff=()=>{r.renderBufferDirect=rbd;info.update=iu;for(const [o,k,f] of W)o[k]=f;
 // census AFTER the render: every renderable reached by traverseVisible, with whether it drew this shot
 const drawn=new Set(S.rows.map(x=>x.oid));const C=[];
 const fr=new THREE.Frustum();const pm=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);fr.setFromProjectionMatrix(pm);
 scene.traverseVisible(o=>{if(!(o.isMesh||o.isPoints||o.isLine||o.isSprite))return;const g=o.geometry,ms=Array.isArray(o.material)?o.material:[o.material];
  let inF=null,bsrc=null,bs=null;try{if(o.isSprite)inF=fr.intersectsSprite(o);else{bsrc=(o.boundingSphere!==undefined)?'object':'geometry';const pre=bsrc==='object'?o.boundingSphere:(g&&g.boundingSphere);bs=pre?[+pre.center.x.toFixed(3),+pre.center.y.toFixed(3),+pre.center.z.toFixed(3),+pre.radius.toFixed(3)]:null;if(o.frustumCulled)inF=fr.intersectsObject(o);}}catch(e){inF='err '+e;}
  C.push({obj:nm(o),otype:o.type,oid:o.id,chain:chain(o),drawn:drawn.has(o.id),layers:o.layers.mask,fc:o.frustumCulled,inF,bsrc,bs,sk:!!o.isSkinnedMesh,
   mats:ms.map(m=>m?[m.type,m.name||'',m.visible,m.transparent,m.opacity]:null),gtype:g&&g.type,dr:g&&g.drawRange?[g.drawRange.start,g.drawRange.count]:null,icount:g&&g.index?g.index.count:null,vcount:g&&g.attributes&&g.attributes.position?g.attributes.position.count:null,groups:g&&g.groups?g.groups.length:0});});
 const tot={calls:S.rows.reduce((a,x)=>a+x.calls,0)+S.orphan.reduce((a,x)=>a+x.calls,0),tris:S.rows.reduce((a,x)=>a+x.tris,0)+S.orphan.reduce((a,x)=>a+x.tris,0)};
 const glTot=Object.values(S.gl).reduce((a,b)=>a+b,0);
 return JSON.stringify({rev:THREE.REVISION,info:{calls:info.render.calls,tris:info.render.triangles,points:info.render.points,lines:info.render.lines},sum:tot,glTot,gl:S.gl,glOrphan:S.glOrphan||[],orphan:S.orphan,rows:S.rows,census:C});};
return 'dl on';})()
