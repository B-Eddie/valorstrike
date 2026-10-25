import fs from 'node:fs';
for(const key of ['bind','breeze','ascent','haven','split','lotus']){
 const root='../models/valorant/maps/'+key+'/';
 const nav=JSON.parse(fs.readFileSync(root+'navigation.json')),map=JSON.parse(fs.readFileSync(root+'map.json'));
 const nodes=nav.nodes,valid=nav.valid;
 const seen=new Set(),comps=[];
 for(let i=0;i<nodes.length;i++){if(seen.has(i)||!valid[i])continue;const c=[i];seen.add(i);for(let k=0;k<c.length;k++)for(const j of nav.adj[c[k]]||[])if(!seen.has(j)&&valid[j]){seen.add(j);c.push(j);}comps.push(c);}
 comps.sort((a,b)=>b.length-a.length);
 console.log('==',key,'components',comps.length,'sizes',comps.slice(0,6).map(c=>c.length).join(','));
 for(const c of comps.slice(1).filter(c=>c.length>20)){
  const pts=c.map(i=>nodes[i]),cx=pts.reduce((a,p)=>a+p[0],0)/c.length,cz=pts.reduce((a,p)=>a+p[2],0)/c.length;
  const callouts=(map.callouts||[]).filter(co=>{const p=co.position;return p&&Math.hypot(p[0]-cx,p[2]-cz)<15;}).map(co=>co.name);
  console.log('  island',c.length,'nodes at',cx.toFixed(1),cz.toFixed(1),'callouts:',callouts.join(' | ')||'NONE');
 }}
