(()=>{const L=[];const r=renderer,rbd=r.renderBufferDirect;r.renderBufferDirect=function(c,s,g,m,o,gr){L.push((o.name||o.type)+'|'+m.type+'|'+(o.isSkinnedMesh?'sk':'')+'|'+(o.parent&&o.parent.name||''));return rbd.apply(this,arguments);};
try{window.__view(0);renderer.render(scene,camera);}finally{r.renderBufferDirect=rbd;}
const c={};for(const k of L)c[k]=(c[k]||0)+1;return JSON.stringify({n:L.length,c});})()
