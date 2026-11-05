// Reconcile recovered Nov 4 20:57:00 source-worker patch, not acceptance of its visuals.
const fs=require('fs'),assert=require('assert/strict');
for(const file of ['work/sova_fx_runtime.js','index.html']){
 const s=fs.readFileSync(file,'utf8');
 for(const a of ['float core=exp(-r*7.0)*0.4;','(0.28+0.55*sw)','svxFxShader(core, core.material, 0.3, 0.65, { grow: 0.4, bill: true });','xAdd("svxShkRingG", 0x4fc3ff, 0.1)','0.3, 2.2);','float seg=floor(v*9.0),f=fract(v*9.0);','vec3(0.2,0.5,1.0),vec3(1.0),core*0.3','Math.random() * 90, 1.1, 0.45, { a: i * 1.047'])assert(s.includes(a),file+' missing final patch anchor '+a);
 assert(s.includes('(1.0-smoothstep(0.9,1.0,r))'),'safe ordered Shock rim smoothstep retained');
 assert.equal((s.match(/svxSetLifeScale\s*\(/g)||[]).length,1,file+' only TEST helper declaration, never gameplay call');
}
console.log('Sova final reported patch anchors already integrated; safe smoothstep retained; no game lifeScale call (source-only)');
