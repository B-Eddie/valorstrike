// Ultimate orbs (offline 5v5) = VALORANT (vs-lane-parity 2026-10-28). wiki.playvalorant.com/en-us/Orbs: an agent "must interact
// with it ... and channel for 2 seconds whilst they hold down the hotkey"; "Once captured, the orb disappears for the rest of the
// round. They will also disappear when a spike is planted or when a round enters its end phase."
// Was: a 3 s hold (player and bots) and orbs that stayed capturable after the plant.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('// feel pass: ultimate orbs (5v5).');assert(i>=0,'orb block');const blk=html.slice(i,html.indexOf('(window.XHK = window.XHK || []).push(tick);',i));
assert(/const CAP = 2;/.test(blk),'2 s capture channel');
assert(!/>= 3\)|hold \/ 3|bh >= 3/.test(blk),'no 3 s hold left (player or bot)');
assert((blk.match(/CAP/g)||[]).length>=4,'player hold, progress bar and bot hold all use CAP');
const {boot}=require('./page_harness.cjs');const H=boot({real3:true,seed:5}),xe=H.xe;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
(async()=>{xe('J.pick="Jett";FV.pick="ascent";FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true');await adv(400);
 for(let k=0;k<200&&!xe('running');k++)await adv(200);assert(xe('running'),'round live');
 assert(xe('xOrbs.some(o=>o.on)'),'orbs out at round start');
 // the player stands on an orb holding F: captured after 2 s, not before
 xe('FV.buy=0;const o=xOrbs.find(o=>o.on);player.x=o.x;player.z=o.z;player.hp=100;J.ult=0;window.__o=o;true');
 await adv(100);xe('player.x=__o.x;player.z=__o.z;true');await adv(50);/* the orb block sees the player in range first (F near an orb captures) */
 xe('dispatchEvent(new KeyboardEvent("keydown",{code:"KeyF"}));true');
 for(let t=0;t<1700;t+=50){xe('player.x=__o.x;player.z=__o.z;true');await adv(50);}
 assert.equal(xe('__o.on'),true,'still channelling at 1.7 s');
 for(let t=0;t<600;t+=50){xe('player.x=__o.x;player.z=__o.z;true');await adv(50);}
 assert.equal(xe('__o.on'),false,'captured by 2.3 s');assert.equal(xe('J.ult'),1,'+1 ult point');
 xe('dispatchEvent(new KeyboardEvent("keyup",{code:"KeyF"}));true');
 // a planted Spike removes the remaining orb
 assert(xe('xOrbs.some(o=>o.on)'),'the other orb is still out');
 xe('FV.sp.st="plant";true');await adv(300);
 assert.equal(xe('xOrbs.some(o=>o.on)'),false,'orbs gone once the Spike is planted');
 assert.equal(xe('xOrbs.some(o=>o.g.visible)'),false,'and hidden');
 console.log('ult orbs: 2 s channel, +1 ult point, gone after the plant');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
