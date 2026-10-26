// Crosshair placement at first contact on the real maps (bots-tune-2): the angle between a bot's view and the enemy the
// tick a new fight starts (bots.js engage u.cp0), collected by tools/soak.mjs over Spike rounds. Benchmark (tracker.gg
// insights): Gold 6.1-6.4 deg, Plat 5.8-6.0 deg median. Usage: node --expose-gc tools/bot-placement.mjs [maps] [seconds] [seed]
import {soakRun} from './soak.mjs';
const maps=(process.argv[2]||'ascent,bind').split(','),secs=+(process.argv[3]||120),seed=+(process.argv[4]||5);
const q=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.floor(p*b.length))]:NaN;};
export async function placement({maps=['ascent'],secs=90,seed=5,humans=2}={}){const all=[],per={};
 for(const map of maps){const r=await soakRun({map,mode:'five',seconds:secs,humans,seed,stuckSeconds:12});const c=r.stats.cp||[];per[map]={n:c.length,med:+q(c,.5).toFixed(1),p25:+q(c,.25).toFixed(1),p75:+q(c,.75).toFixed(1),under10:+(c.filter(v=>v<10).length/Math.max(1,c.length)*100).toFixed(0),alt:Object.fromEntries(Object.entries(r.stats.cpAlt||{}).map(([k,v])=>[k,{n:v.length,med:+q(v,.5).toFixed(1),under10:+(v.filter(x=>x<10).length/Math.max(1,v.length)*100).toFixed(0)}]))};all.push(...c);}
 return {per,n:all.length,med:+q(all,.5).toFixed(1),p25:+q(all,.25).toFixed(1),p75:+q(all,.75).toFixed(1)};}
if(import.meta.url===`file://${process.argv[1]}`)console.log(JSON.stringify(await placement({maps,secs,seed})));
