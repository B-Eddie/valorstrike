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
 const dist=(x,z)=>{let bd=Infinity;for(const i of largest){const p=N[i],d=Math.hypot(p[0]-x,p[2]-z);if(d<bd)bd=d;}return bd;};
 const spots=[];
 for(const c of meta.callouts||[])if(/exit|teleporter/i.test(c.name))spots.push([c.name,c.position]);
 for(const [k,i]of Object.entries(nav.siteNodes||{}))spots.push(['site '+k,N[i]]);
 (nav.spawnNodes||[]).forEach((i,k)=>spots.push(['spawn '+k,N[i]]));
 assert(spots.length>=3,key+': expected scripted destinations');
 for(const [name,p]of spots){const d=dist(p[0],p[2]);assert(d<=1.5,key+' '+name+' is '+d.toFixed(2)+' from playable nav (OOB watch must spare it)');}
}
console.log('OOB destinations: teleporter entries/exits, sites and spawns sit within 1.5 of playable nav on all six maps');
