// The crosshair follows the item in hand (user 2026-10-28: the shotgun ring stayed up after switching to the KNIFE).
// VALORANT: the knife (and an equipped ability, and the spike plant / defuse, which put the knife up here) shows the player's
// normal primary crosshair lines - no shotgun ring, no movement / firing error. The render loop used wName(), which names
// the primary even with the knife out. xhWeap() names the gun whose error / ring the crosshair shows ('' = none).
// Sidearm (rw 'pis') = the sidearm (a Shorty sidearm keeps its ring); aim trainer = its weapon (its knife has no WEAP row).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=s.indexOf('function xhWeap(');assert(i>=0,'xhWeap present in index.html');
const fn=s.slice(i,s.indexOf('\n',i));
assert(s.includes('const cw = xhWeap(), CW = cw ? WEAP[cw] : null;'),'render loop takes the crosshair weapon from xhWeap()');
assert(!s.includes('const cw = mode === "aim" && typeof aimW === "function" ? aimW() : wName(), CW = WEAP[cw];'),'old wName() pick gone');
const XSGUN=/const XSGUN = [^\n]*/.exec(s);assert(XSGUN,'XSGUN');
const c={mode:'five',rw:'pri',J:{eq:null},FV:{pri:'Bucky',sec:'Classic'},S:{weapon:'Bucky'},AM:{w:0},AIM_W:['Vandal','Knife']};
c.wName=()=>c.mode==='five'?(c.rw==='pis'||!c.FV.pri?c.FV.sec:c.FV.pri):c.rw==='pis'?'Classic':c.S.weapon;c.aimW=()=>c.AIM_W[c.AM.w];
vm.createContext(c);vm.runInContext(XSGUN[0].replace(/^const /,'var ')+';'+fn,c);
const W=()=>c.xhWeap();
assert.equal(W(),'Bucky','primary shotgun in hand: Bucky (ring)');assert(c.XSGUN.Bucky,'Bucky is a ring shotgun');
c.rw='knife';assert.equal(W(),'','knife out: no gun crosshair (no ring, no error)');
c.rw='pis';assert.equal(W(),'Classic','sidearm out: the sidearm');c.FV.sec='Shorty';assert.equal(W(),'Shorty','Shorty sidearm keeps its ring');
c.rw='pri';c.J.eq={k:'c',st:'ready'};assert.equal(W(),'','ability equipped: no gun crosshair');c.J.eq=null;
c.mode='tdm';c.rw='knife';assert.equal(W(),'','knife in other modes too');c.rw='pri';assert.equal(W(),'Bucky');
c.mode='aim';assert.equal(W(),'Vandal');c.AM.w=1;assert.equal(W(),'Knife','aim trainer knife (no WEAP row -> no error)');
c.mode='duel';c.du={w:'knife'};assert.equal(W(),'','duel knife');c.du={w:'op'};assert.equal(W(),'Operator','duel Operator');
console.log('Crosshair weapon: knife / equipped ability / duel knife -> no shotgun ring or error lines; primary, sidearm (Shorty ring kept), aim trainer and duel Operator unchanged');
