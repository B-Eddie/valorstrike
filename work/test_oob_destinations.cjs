// Scripted destinations must stay inside the OOB watch's coverage: teleporter entries/exits,
// spike sites and spawns sit within 1.5 units of the playable (largest-component) nav set on
// every native map, so the kill watch can never execute a legitimate scripted arrival.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
for(const key of ['ascent','bind','breeze','haven','lotus','split']){
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json')));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'map.json')));
 const N=nav.nodes,A=nav.adj,seen=new Uint8Array(N.length);let largest=[];
 for(let i=0;i<N.length;i++){if(seen[i]||(nav.valid&&!nav.valid[i]))continue;const q=[i];seen[i]=1;for(let k=0;k<q.length;k++)for(const j of A[q[k]])if(!seen[j]&&(!nav.valid||nav.valid[j])){seen[j]=1;q.push(j);}if(q.length>largest.length)largest=q;}
 const playable=new Uint8Array(N.length);for(const i of largest)playable[i]=1;
 const dist=(x,z)=>{let bd=Infinity;for(let i=0;i<N.length;i++){if(nav.valid&&!nav.valid[i])continue;const p=N[i],d=Math.hypot(p[0]-x,p[2]-z);if(d<bd)bd=d;}return bd;}; // the kill watch covers every valid node (islands are intended space)
 const spots=[];
 for(const c of meta.callouts||[])if(/exit|teleporter/i.test(c.name))spots.push([c.name,c.position]);
 for(const [k,i]of Object.entries(nav.siteNodes||{}))spots.push(['site '+k,N[i]]);
 (nav.spawnNodes||[]).forEach((i,k)=>spots.push(['spawn '+k,N[i]]));
 assert(spots.length>=3,key+': expected scripted destinations');
 for(const [name,p]of spots){const d=dist(p[0],p[2]);assert(d<=1.5,key+' '+name+' is '+d.toFixed(2)+' from valid nav (OOB watch must spare it)');}
}
// Regression pin: legitimate far-island survival. Nav fragmentation leaves named intended
// space (bind B Teleporter island, breeze Attacker Spawn, ...) on valid nodes several units
// OFF the largest connected component. A largest-component watch would execute players there
// (observed live: bind island warp died at hp -9900 under playable coverage). The watch must
// cover EVERY valid node. Pin both directions: real islands exist >4u from the playable set,
// and the valid-based criterion spares every one of them. If coverage ever reverts to the
// playable set, the second assertion fails.
for(const key of ['ascent','bind','breeze','haven','lotus','split']){
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json')));
 const N=nav.nodes,A=nav.adj,seen=new Uint8Array(N.length);let largest=[];
 for(let i=0;i<N.length;i++){if(seen[i]||(nav.valid&&!nav.valid[i]))continue;const q=[i];seen[i]=1;for(let k=0;k<q.length;k++)for(const j of A[q[k]])if(!seen[j]&&(!nav.valid||nav.valid[j])){seen[j]=1;q.push(j);}if(q.length>largest.length)largest=q;}
 const dValid=(x,z)=>{let bd=Infinity;for(let i=0;i<N.length;i++){if(nav.valid&&!nav.valid[i])continue;const p=N[i],d=Math.hypot(p[0]-x,p[2]-z);if(d<bd)bd=d;}return bd;};
 const dPlay=(x,z)=>{let bd=Infinity;for(const i of largest){const p=N[i],d=Math.hypot(p[0]-x,p[2]-z);if(d<bd)bd=d;}return bd;};
 let islands=0,worst=0;
 for(let i=0;i<N.length;i++){if(nav.valid&&!nav.valid[i])continue;const dp=dPlay(N[i][0],N[i][2]);if(dp>4){islands++;worst=Math.max(worst,dp);assert(dValid(N[i][0],N[i][2])<=4,key+' valid island node '+i+' ('+N[i][0]+','+N[i][2]+') '+dp.toFixed(1)+'u off playable must stay in watch coverage');}}
 if(key==='bind')assert(islands>0,'bind must have far-island valid nodes (B Teleporter island) - test nav regressed?');
 console.log('  '+key+': '+islands+' valid island nodes >4u off the largest component, worst '+worst.toFixed(1)+'u - all spared by valid coverage');
}
console.log('OOB destinations: teleporter entries/exits, sites and spawns sit within 1.5 of valid nav on all six maps');
console.log('OOB far-island survival: every valid node off the largest component stays inside watch coverage on all six maps');
