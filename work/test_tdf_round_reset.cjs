// Tour de Force across an online round reset (native maps, trusted server). The server swaps the held gun to a
// 5-round Operator and restores the saved one when the ult ends or the round resets (u.ultWeapon / spike round start);
// the client shows the server's held gun by bEquip'ing it into the slot, while the local overlay (BC.eq 'sn') is
// cleared by jRound -> jClear -> bcClear. The round-start message only reassigned FV.pri/FV.sec, so the Operator's
// 5-round slot and model (and, with no primary bought, an empty "pri" slot in hand) survived the reset. mpRdArm now
// re-arms the round loadout like offline fRound.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>=0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const src=cut('function swapW(s) {','\naddEventListener("keyup"')+'\n'+cut('function bEquip(n, sl) {','\nfunction bUndo')+'\n'+cut('function mpRdArm(ld) {','\nfunction mpCli5')+'\n'+cut('function xWOwn(n) {','\n')+'\n'+cut('const XRSV = ','\nconst xRsv')+'\n'+cut('const xRsv = ','\n');/* the page's reserve table */
const WEAP={Spectre:{mag:30},Classic:{mag:12},Operator:{mag:5},Sheriff:{mag:6}};
function boot(){const c=vm.createContext({WEAP,FV:{pri:null,sec:'Classic'},slots:{pri:{},pis:{ammo:12,rsv:36}},rw:'pis',ammo:12,rsv:36,reloading:0,fireHeld:false,skins:0,scope:null,MAG(){return 5;},blip(){},onSkin(){c.skins++;},setScope(v){c.scope=v;},updHud(){}});vm.runInContext(src.replace(/^let |^const /gm,'var '),c);vm.runInContext('var get=()=>({rw,ammo,rsv,reloading,fireHeld}),set=(o)=>{rw=o.rw;ammo=o.ammo;rsv=o.rsv;}',c);return c;}
// Spectre bought, Tour de Force: the snapshot's held Operator is bEquip'd into the primary slot, two shots fired
{const c=boot();c.bEquip('Spectre','pri');c.bEquip('Operator','pri');c.set({rw:'pri',ammo:3,rsv:0});c.fireHeld=true;const s0=c.skins;
 c.mpRdArm(['Spectre','Classic']);const g=c.get();
 assert.equal(c.FV.pri,'Spectre');assert.equal(g.rw,'pri');assert.equal(g.ammo,30,'Spectre magazine, not the Operator\'s 3 rounds');assert.equal(g.rsv,90);
 assert.deepEqual({...c.slots.pri},{ammo:30,rsv:90});assert.ok(c.skins>s0,'viewmodel refreshed (Operator model gone)');assert.equal(c.scope,false);assert.equal(g.fireHeld,false);}
// Classic only, Tour de Force: primary slot held the Operator; after the reset the Classic is in hand and pri is empty
{const c=boot();c.bEquip('Operator','pri');assert.equal(c.get().rw,'pri');c.mpRdArm([null,'Classic']);const g=c.get();
 assert.equal(c.FV.pri,null);assert.equal(g.rw,'pis','no primary: sidearm in hand');assert.equal(g.ammo,12);assert.deepEqual({...c.slots.pri},{});}
// Jett Blade Storm ending with the round (knife in hand): round start puts a gun back in hand
{const c=boot();c.bEquip('Sheriff','pis');c.set({rw:'knife',ammo:0,rsv:0});c.mpRdArm([null,'Sheriff']);assert.equal(c.get().rw,'pis');assert.equal(c.get().ammo,6);}
// missing ld (older host): Classic in hand
{const c=boot();c.mpRdArm(undefined);assert.equal(c.FV.sec,'Classic');assert.equal(c.get().rw,'pis');}
// wiring: the round-start message uses it, and the round start clears the local Tour de Force overlay (jClear's per-agent
// reset calls, df60c6c, put bcClear() ~1.1 k chars into its body: the window is 2000)
assert.ok(/if \(m\.t === "rd"\) \{[^\n]*\n\s*mpRdArm\(m\.ld\);/.test(html),'rd handler re-arms through mpRdArm');
assert.ok(/function jRound\(match\)[\s\S]{0,400}jClear\(\)/.test(html)&&/function jClear\(\)[\s\S]{0,2000}bcClear\(\)/.test(html)&&/function bcClear\(\)[\s\S]{0,600}BC\.td = 0; BC\.eq = ""/.test(html),'jRound -> jClear -> bcClear drops BC.eq/BC.td');
const ults=fs.readFileSync(path.join(__dirname,'..','server','src','spike.js'),'utf8');assert.ok(/u\.weapon=u\.primary\|\|u\.secondary/.test(ults),'server round start re-arms the saved loadout');
console.log('Tour de Force round reset (online/native): loadout re-armed (Spectre mag, Classic-only, knife, no ld), overlay cleared, server re-arms');
