// dmGive (the page's actual loadout function, cut from index.html) in Team Deathmatch: the four VALORANT stages
// (wiki.playvalorant.com/en-us/Team_Deathmatch) with the page's own TDM_C / TDM_BW / tdmOk table - a Stage 1 sidearm all match,
// from Stage 2 only the current stage's guns; the stage pick is remembered (DM.stPick) for the forced switch; prototype names reject;
// the other slot keeps its live ammo.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),h=fs.readFileSync('index.html','utf8');
const cut=(from,to)=>{const i=h.indexOf(from);assert(i>=0,from);const j=h.indexOf(to,i);assert(j>i,to);return h.slice(i,j);};
const mags={Classic:12,Frenzy:13,Ghost:15,Sheriff:6,Stinger:20,Ares:50,Spectre:30,Bulldog:24,Guardian:12,Phantom:30,Vandal:25,Operator:5,Marshal:5,Shorty:2,Outlaw:2};
const c={Object,Math,WEAP:Object.fromEntries(Object.entries(mags).map(([k,m])=>[k,{mag:m}])),FV:{tdm:true,pri:null,sec:'Classic'},DM:{},stage:0,rw:'pis',slots:{},ammo:12,rsv:36,reloading:0,fcd:0,spray:0,onSkin(){},setScope(){},updHud(){},blip(){}};
vm.createContext(c);
const rsvSrc=(()=>{const i=h.indexOf('const XRSV = ');return h.slice(i,h.indexOf('\n',h.indexOf('const xRsv',i)));})();
const tdmSrc=cut('const TDM_C = {','\nconst tdmBW');
const dmc=cut('const DM_C = {','\nconst DM_BW');
vm.runInContext([rsvSrc,dmc,tdmSrc].join('\n').replace(/^const /gm,'var ')+'\nvar tdmTier=()=>stage;\n'+cut('function dmGive(','\nfunction dmPts(')+';globalThis.give=dmGive;',c);
const at=(s)=>{c.stage=s;};
assert.deepEqual(JSON.parse(JSON.stringify(c.TDM_BW)),[['Classic','Frenzy','Ghost'],['Sheriff','Stinger','Ares'],['Spectre','Ares','Bulldog','Guardian'],['Phantom','Vandal']],'page stage table');
// Stage 1: sidearms only
at(0);assert.equal(c.give('Vandal'),false);assert.equal(c.give('Spectre'),false);assert.equal(c.give('toString'),false);assert.equal(c.FV.pri,null);assert.equal(c.ammo,12);
c.ammo=9;c.give('Ghost');assert.equal(c.FV.sec,'Ghost');assert.equal(c.rw,'pis');assert.equal(c.ammo,15);assert.equal(c.DM.stPick,undefined,'Stage 1 picks are not stage picks');
// Stage 2: its guns, the Stage 1 sidearm stays allowed; the pick is remembered
at(1);c.ammo=11;assert.equal(c.give('Spectre'),false,'a Stage 3 gun is not open yet');c.give('Stinger');assert.equal(c.FV.pri,'Stinger');assert.equal(c.rw,'pri');assert.equal(c.slots.pis.ammo,11,'sidearm keeps its live mag');assert.equal(c.DM.stPick[1],'Stinger');
assert.notEqual(c.give('Ghost'),false,'Stage 1 sidearm kept all match');assert.equal(c.FV.sec,'Ghost');assert.equal(c.slots.pri.ammo,20,'primary keeps its mag');
// Stage 3: Stage 2 guns are gone
at(2);assert.equal(c.give('Stinger'),false,'a Stage 2 gun is not carried into Stage 3');assert.equal(c.give('Sheriff'),false);c.give('Bulldog');assert.equal(c.FV.pri,'Bulldog');assert.equal(c.DM.stPick[2],'Bulldog');
c.give('Ares');assert.equal(c.FV.pri,'Ares','Ares is in Stages 2 and 3');
// Stage 4: rifles; Operator never
at(3);assert.equal(c.give('Operator'),false);assert.equal(c.give('Bulldog'),false);c.give('Vandal');assert.equal(c.FV.pri,'Vandal');assert.equal(c.ammo,25);assert.equal(c.DM.stPick[3],'Vandal');
// plain Deathmatch: no stage lock
c.FV.tdm=false;assert.notEqual(c.give('Operator'),false);assert.equal(c.FV.pri,'Operator');
console.log('Actual loadout function enforces the four TDM stages (Stage 1 sidearm all match, current stage only from Stage 2, stage pick kept), rejects prototype names, preserves other slot live ammo; Deathmatch unlocked');
