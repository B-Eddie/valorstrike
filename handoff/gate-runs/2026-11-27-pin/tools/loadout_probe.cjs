// Read-only observer (gate run 2026-11-27-pin): delegates to the unmodified harness agents.cjs and, with the game loop
// already frozen, records the match seed and every bot's loadout before each shot. It evaluates only property reads
// (xbvSeed() returns window.xBotSeed without drawing when it is set), so it cannot change what is rendered.
const orig = require('/workspace/work/qa/three/agents.cjs');
const Q = `JSON.stringify((()=>{const o={xBotSeed:window.xBotSeed===undefined?null:window.xBotSeed,xbvSeed:(window.xBotSeed!=null&&typeof xbvSeed==='function')?xbvSeed():null,XBVseed:(typeof XBV!=='undefined')?XBV.seed:null,bots:[]};
for(const b of bots.concat(allies)){const M=b.xm,n=b.name,bs=(FV.bs&&FV.bs[n])||{};let gn=[];try{if(M&&M.gun)M.gun.traverse(x=>{if(x.isMesh&&x.name)gn.push(x.name);});}catch(e){}
 const gk=[...new Set(gn.map(s=>(s.match(/^GN_([A-Za-z]+)/)||[])[1]).filter(Boolean))].join('+');
 o.bots.push([n,'bought='+bs.w,'u.w='+b.w,'xWeapOf='+(typeof xWeapOf==='function'?xWeapOf(b):'-'),'held='+(M?M.w:'-'),'gunMesh='+gk]);}return o;})())`;
module.exports = async (X, page, R, log, SHOT) => {
  let n = 0;
  const SHOT2 = async (name, js) => { const s = await X(Q); log('loadout', name, s); (R.loadout = R.loadout || {})[name] = JSON.parse(s); n++; return SHOT(name, js); };
  return orig(X, page, R, log, SHOT2);
};
