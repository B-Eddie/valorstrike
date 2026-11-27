(()=>{const all=bots.concat(allies),out=[];const v=new THREE.Vector3();
for(const b of all){const xm=b.xm;if(!xm)continue;const o={n:b.name,mx:[],bones:{},meshes:0};
 for(const k of Object.keys(xm)){const q=xm[k];if(q&&typeof q==='object'&&q.mx&&q.mx._actions){o.mx.push(k+':'+q.mx._actions.filter(a=>a.isRunning()).map(a=>a.getClip().name+'@'+a.time.toFixed(3)+'w'+a.getEffectiveWeight().toFixed(2)+'#'+a.getClip().tracks.length).join(','));}}
 xm.m.updateMatrixWorld(true);o.w=b.w&&(b.w.name||b.w);o.chain=[];{let sk=null;xm.m.traverse(m=>{if(!sk&&m.isSkinnedMesh)sk=m;});if(sk){let r=sk.skeleton.bones[0];while(r.parent&&r.parent.isBone)r=r.parent;for(let p=r;p&&p!==b.g.parent;p=p.parent)o.chain.push((p.name||p.type)+':'+p.position.toArray().map(x=>x.toFixed(4))+'|'+p.quaternion.toArray().map(x=>x.toFixed(4))+'|'+p.scale.toArray().map(x=>x.toFixed(3)));}}
 for(const k of Object.keys(xm)){const q=xm[k];if(q&&typeof q==='object'&&q.mx&&q.mx._actions){for(const a of q.mx._actions)if(a.isRunning())o.tracks=(o.tracks||[]).concat(a.getClip().tracks.map(t=>t.name));}}
 xm.m.traverse(m=>{if(m.isSkinnedMesh){o.meshes++;for(const bn of m.skeleton.bones){if(o.bones[bn.name])continue;bn.getWorldPosition(v);o.bones[bn.name]=[+v.x.toFixed(4),+v.y.toFixed(4),+v.z.toFixed(4)];}}});
 out.push(o);}
return JSON.stringify(out);})()
