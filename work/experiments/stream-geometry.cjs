// QA-only sequential geometry staging contract. A caller supplies its actual renderer upload.
// No scene/material cache loader is wired into the game.
const {decode}=require('./geometry-cache.cjs');
async function stage(T,entries,{fetch,upload,signal}){const made=[];const check=()=>{if(signal&&signal.aborted)throw signal.reason||new Error('cancelled');};
 try{for(let i=0;i<entries.length;i++){check();let bytes=await fetch(entries[i],i,signal);check();const g=decode(T,entries[i],bytes);made.push(g);bytes=null;check();await upload(g,i,signal);check();for(const a of [...Object.values(g.attributes),g.index].filter(Boolean))if(a.array!==null)throw new Error('upload did not release immutable CPU array');}return made;
 }catch(e){for(const g of made)g.dispose();throw e;}}
module.exports={stage};
