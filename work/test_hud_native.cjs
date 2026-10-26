// Native in-match scoreboard: local portrait assets, real equipment, hidden enemy
// equipment, safe names, and unchanged K/D/A positions for the online client.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const helpers=html.slice(html.indexOf('function hudPortrait('),html.indexOf('\nfunction sbUnit('));
const table=html.slice(html.indexOf('function sbTable('),html.indexOf('\n{ const k0 = sbKill;',html.indexOf('function sbTable(')));
const units=[{name:'Ally <&',agent:'Sage',w:'Phantom',armor:25},{name:'Enemy',agent:'Omen',w:'Operator',armor:50}];
const ctx={J:{pick:'Jett'},player:{armor:50},MP:{on:true,ping:37},kfAll:()=>units,xAg:u=>u.agent,sbUnit:n=>units.find(u=>u.name===n),vfWeapon:()=> 'Vandal',xWeapOf:u=>u.w,BUY_SIL:{Vandal:'M1 2h30v3H1z',Phantom:'M2 3h40v3H2z'},SB:{You:{k:4,d:2,a:1},'Ally <&':{k:1,d:3,a:2},Enemy:{k:2,d:4,a:0}},sbUlt:()=>[3,7],sbCred:()=>4300};
vm.createContext(ctx);vm.runInContext(helpers+'\n'+table+'\n'+html.slice(html.indexOf('function sbCredTxt('),html.indexOf('\n',html.indexOf('function sbCredTxt('))),ctx);/* sbTable formats credits through sbCredTxt (enemy-info: unknown = em dash) */
for(const agent of ['Jett','Phoenix','Sova','Sage','Reyna','Raze','Killjoy','Omen','Skye','Chamber','Breach','Cypher']){
 const file=path.join(__dirname,'..',ctx.hudPortrait(agent));const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(1,4).toString(),'PNG',agent+' has a valid bundled portrait');
}
assert.equal(ctx.hudPortrait('../../bad'),'', 'unknown agent cannot create a path');
assert.match(ctx.sbTile('You'),/portraits\/jett.png/);
assert.match(ctx.sbTile('Ally <&'),/portraits\/sage.png/);
assert.match(ctx.sbLoadout('You',true,true),/aria-label="Vandal"/);
assert.match(ctx.sbLoadout('Ally <&',true,true),/aria-label="Phantom"/);
ctx.mode='five';ctx.FV={pri:'Vandal',sec:'Classic'};ctx.vfWeapon=()=> 'Knife';
assert.match(ctx.sbLoadout('You',true,true),/aria-label="Vandal"/,'scoreboard shows purchased primary when melee is held');
assert(!ctx.sbLoadout('Enemy',false,true).includes('Operator'),'live enemy equipment stays hidden');
assert(!ctx.sbLoadout('You',true,false).includes('Vandal'),'dead players have no equipped weapon');
assert.equal(ctx.sbPing('You'),37);assert.equal(ctx.sbPing('Enemy'),'—','bots do not claim network latency');
const friendly=ctx.sbTable(['You','Ally <&'],'al',()=>true);
assert.match(friendly,/<td class="nm">Ally &lt;&amp;<\/td>/,'names cannot inject markup');
assert.match(friendly,/<td class="k">4<\/td><td class="d">2<\/td><td class="a">1<\/td>/,'KDA stays in protocol-compatible column order');
assert.match(friendly,/<td class="ec">4,300<\/td>/);
assert.match(friendly,/<th class="w">Loadout<\/th><th class="ec">Creds<\/th><th class="pg">Ping<\/th>/);
assert(!ctx.sbTable(['Enemy'],'en',()=>true).includes('aria-label="Operator"'));
console.log('Native HUD: bundled portraits, safe names, real allied loadout, hidden enemy loadout, credits, ping and KDA order');
