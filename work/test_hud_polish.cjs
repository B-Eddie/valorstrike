// Consolidated HUD polish invariants (parent review 2026-10-25 ~17:44):
// (a) barrier countdown clears the ann's lowest GLYPH (title+secondary can overflow the
//     container box), with a real margin, and re-measures after the ann's entry transition;
// (b) the ELIMINATED banner owns the bottom-center band: the control hint hides while it shows;
// (c) the DM SPAWN PROTECTED chip clears the touch cluster on short landscape viewports.
const fs=require('fs'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const fn=(name)=>{const a=s.indexOf('function '+name+'(');assert(a>=0,name);let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&!--d)break;}return s.slice(a,i+1);};
const cd=fn('cdText'),ab=fn('xAnnBottom');
assert.match(ab,/createTreeWalker/,'ann bottom measured from text-node glyph ranges');
assert.match(ab,/SHOW_TEXT|4 \/\*/,'tree walker visits text nodes');
assert.match(cd,/xAnnBottom\(an\)/,'cdText positions off glyph bounds');
assert.match(cd,/gb \+ 12/,'barrier clears the ann glyphs by 12px');
assert.match(cd,/attributeFilter: \["class"\], childList: true, characterData: true, subtree: true/,'ann observer covers text/content changes, not only class');
assert.match(cd,/300\)/,'settle re-measure after the 250ms entry transition');
assert.match(s,/#game:has\(\.x-kb\.on\) #hint\{opacity:0/,'hint hides while the ELIMINATED banner shows');
const mh=s.match(/@media \(max-height:560px\)\{[\s\S]*?\n\}/);
assert(mh,'short-landscape media block exists');
assert.match(mh[0],/\.x-dmprot\{left:36%!important\}/,'spawn-protection chip shifts clear of the touch cluster on short landscape');
console.log('HUD polish: barrier clears ann glyph bounds (+12px, settle re-measure), hint yields to ELIMINATED banner, DM chip clears the touch cluster on short landscape');
