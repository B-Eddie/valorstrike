// read-only attach probe: does NOT call gl.getExtension (that would itself trigger the d405efb4 wrap).
// Reads three's cached WEBGL_multi_draw object via renderer.extensions.get (cache hit, no GL call once cached) and the WebGLMultiDraw prototype.
JSON.stringify((()=>{const gl=renderer.getContext();const P=WebGL2RenderingContext.prototype;let e=null,err=null;try{e=renderer.extensions.get('WEBGL_multi_draw');}catch(x){err=String(x).slice(0,120);}
const Q=window.WebGLMultiDraw?WebGLMultiDraw.prototype:null;const s=f=>f===undefined?'undef':String(f).replace(/\s+/g,' ').slice(0,80);
return {wrapInstalled:!!(P.getExtension&&P.getExtension.__md),cachedExt:!!e,err,cachedOwnProps:e?Object.getOwnPropertyNames(e):null,
 cached_mDE:e?s(e.multiDrawElementsWEBGL):null,cached_mDA:e?s(e.multiDrawArraysWEBGL):null,proto_mDE:Q?s(Q.multiDrawElementsWEBGL):'noWebGLMultiDraw',proto_mDA:Q?s(Q.multiDrawArraysWEBGL):null,
 attached:!!(e&&String(e.multiDrawElementsWEBGL)==='function(){}'&&String(e.multiDrawArraysWEBGL)==='function(){}'),drawElemNoop:String(P.drawElements)==='function(){}',calls:renderer.info.render.calls};})())
