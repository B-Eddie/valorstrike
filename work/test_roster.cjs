// Participant-scoped readiness: roster computation, kit mapping/dedupe, MP fallback, pre-draw consumption.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('work/valorant_runtime.js','utf8');
const a=s.indexOf('function xvReadyAgents'),b=s.indexOf('function xvFind');
assert(a>=0&&b>a,'region');
const region=s.slice(a,b);
const XUB_AG={Jett:1,Phoenix:1,Sova:1,Sage:1,Reyna:1,Raze:1,Omen:1,Killjoy:1,Breach:1,Skye:1,Chamber:1,Cypher:1};
function mk(env){
  const loaded=[];
  const sb={ window:{}, J:{pick:env.pick||'Jett'}, Promise, Object, Array, Set, String,
    XUB_AG, MP:env.mp?{on:true}:{on:false},
    F_EN:(env.en||['Phoenix','Sova','Sage','Reyna','Raze']).slice(),
    F_MATES:(env.mates||['Omen','Killjoy','Breach','Skye']).slice(),
    xTmPreDrawn:false,
    xBuildTeams(){ sb.xTmPreDrawn_called=(sb.xTmPreDrawn_called||0)+1; },
    xvAgentLoad(ag){ loaded.push(ag); return Promise.resolve({ag}); },
    xvAgentName(n){ return XUB_AG[n]?n:Object.keys(XUB_AG)[String(n||'').split('').reduce((t,c)=>t+c.charCodeAt(0),0)%12]; },
  };
  vm.createContext(sb); vm.runInContext(region+';globalThis.__r={ready:xvReadyAgents,roster:xvRoster};',sb);
  vm.runInContext('xvAgentLoad = (ag) => { globalThis.__loaded.push(ag); return Promise.resolve({ag}); };',sb);
  sb.__loaded=loaded; sb.window.J=sb.J;
  return {sb,loaded};
}
(async()=>{
  // 1. roster = pick + Chamber + drawn teams, mapped+deduped; pre-draw flag raised
  { const {sb,loaded}=mk({});
    const r=sb.__r.roster();
    assert.equal(sb.xTmPreDrawn,true); assert.equal(sb.xTmPreDrawn_called,1);
    assert.deepEqual(new Set(r),new Set(['Jett','Chamber','Phoenix','Sova','Sage','Reyna','Raze','Omen','Killjoy','Breach','Skye']));
    await sb.__r.ready(r);
    assert.equal(loaded.length,11); assert(!loaded.includes('Cypher')); }
  // 2. MP.on -> null roster -> all 12 kits
  { const {sb,loaded}=mk({mp:true});
    assert.equal(sb.__r.roster(),null);
    await sb.__r.ready(sb.__r.roster());
    assert.equal(loaded.length,12); }
  // 3. non-native names map through xvAgentName and dedupe
  { const {sb,loaded}=mk({en:['Brimstone','Viper','Brimstone','Sova','Sage'],mates:['Omen','Killjoy','Breach','Skye']});
    const r=sb.__r.roster(); await sb.__r.ready(r);
    assert.equal(loaded.length,new Set(loaded).size); assert(loaded.every(a=>XUB_AG[a])); }
  // 4. empty/invalid list falls back to all 12
  { const {sb,loaded}=mk({});
    await sb.__r.ready([]); assert.equal(loaded.length,12); }
  // 5. readiness failure rejects after retry (gate aborts the start: no invisible opponents)
  { const {sb}=mk({}); vm.runInContext('let __n=0; xvAgentLoad=()=>{__n++;globalThis.__n=__n;return Promise.reject(new Error("net"))};',sb);
    await assert.rejects(sb.__r.ready(['Jett'])); assert.equal(sb.__n,2); }
  console.log('participant roster: scoped set, MP all-12 fallback, name mapping/dedupe, retry-then-reject all pass');
})().catch(e=>{console.error(e);process.exit(1)});
