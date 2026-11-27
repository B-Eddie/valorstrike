// DIAGNOSTIC trigger (added by the 2026-11-27-perf-noop rerun, not part of lane.cjs): calls getExtension once AFTER the noop step so the
// d405efb4 getExtension wrap runs and patches multiDraw* on the (same, cached) WEBGL_multi_draw object / its prototype.
JSON.stringify((()=>{const e=renderer.getContext().getExtension('WEBGL_multi_draw');let same=null;try{same=(e===renderer.extensions.get('WEBGL_multi_draw'));}catch(x){}return {got:!!e,sameAsThreeCache:same,mDE:e?String(e.multiDrawElementsWEBGL):null};})())
