// Native site goals: the meta site anchors sit at the very edge of their plant zones (breeze B's
// anchor is 0.15u inside a 15u zone), so carriers stopping at the movement arrival floor never
// entered the zone and never planted - the attacking team parked at the site edge. nmSiteGoals
// precomputes an in-zone point per site (zone centroid inverse-projected to world, snapped to a
// playable nav node, verified in-zone) and the xGoal wrapper sends attackers there instead.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert(html.includes('nmConnected(C);root.add(nmSkirt(nmSkirtSpec(nav.nodes,C.playable)))') && html.includes('nmSiteGoals(C);'),'site goals computed at native map build');
assert(html.includes('g=atk&&C.siteGoals&&(C.siteGoals[name]||C.siteGoals[names[0]])'),'xGoal wrapper sends attackers to the in-zone point');
const body=src.slice(src.indexOf('function nmPlant('),src.indexOf('// A* follows only edges'));
function mk(){
 const nodes=[[0.0151,0,-0.0298],[99,0,99]];
 const ctx={nodes,nmNear:(C,x,z)=>{let best=-1,bd=1e18;C.nav.nodes.forEach((p,i)=>{const d=(p[0]-x)**2+(p[2]-z)**2;if(d<bd){bd=d;best=i;}});return best;}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(body+';globalThis.api=(C)=>{nmSiteGoals(C);return C.siteGoals;};globalThis.plant=(C,x,z)=>nmPlant(C,x,z);',ctx);
 const C={meta:{transform:{cx:0,cz:0,angle:0},apiProjection:{xMultiplier:0.01,xScalarToAdd:0,yMultiplier:0.01,yScalarToAdd:0},sites:{S:[99,0,99],T:[50,0,50]}},plants:{rows:{'30':[[10,20,'S']]}},nav:{nodes}};
 return {ctx,C};}
{const t=mk(),g=t.ctx.api(t.C);assert(g&&g.S,'goal computed for site S');assert.equal(JSON.stringify(g.S),JSON.stringify([0.0151,-0.0298]),'goal snaps to the zone-centroid nav node, not the far anchor');assert.equal(t.ctx.plant(t.C,g.S[0],g.S[1]),'S','computed goal is verifiably in-zone');assert(!g.T,'site with no plant rows gets no override (meta anchor fallback preserved)');}
console.log('Native site goals: attackers path to a verified in-zone point (centroid-snapped nav node), anchor-edge plant stall fixed, rowless sites untouched');
