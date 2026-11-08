// Iso Kill Contract pocket arena (work/agents18_runtime.js mirror of server/src/arena.js) on the real page with
// native Ascent (work/page_harness.cjs). The duel pulls both combatants into the analytic cell at x = 10000:
//  * the cast teleports the player and the target there; the arena shell (floor + 4 energy walls + 2 cover
//    blocks) renders at the cell
//  * the wrapped blocked / groundAt / los route arena coordinates to the analytic cell: the walls stop movement,
//    the floor carries, cover blocks break sight, map sight never crosses into the arena
//  * after the 13 s duel both return home and the shell is gone
//  * online: a 'duel' fx row renders the shell at the row's origin and removes it when the row drops
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:11,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async agent=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);await adv(60);};
const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};

(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through('Iso'),'offline 5v5 started');
 assert.equal(xe('J.pick'),'Iso');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9;b.hp=1e9});allies.forEach(a=>{a.cd=1e9});true');
 // a bot squarely in the catch column, 10 m ahead of the player (the page forward is (-sin yaw, -cos yaw))
 xe('(()=>{const b=bots[0];yaw=-Math.PI/2;pitch=0;b.g.position.set(player.x+10,0,player.z);b.x=player.x+10;b.z=player.z;return true;})()');
 const home=xe('({x:player.x,y:player.y,z:player.z})'),bHome=xe('({x:bots[0].g.position.x,y:bots[0].g.position.y,z:bots[0].g.position.z})');
 xe('J.ult=K().u;true');await tap('KeyX');
 let s=xe('({x:player.x,y:player.y,z:player.z,duel:J.a18.duel,bx:bots[0].g.position.x,shell:!!J.a18.duelM,kids:J.a18.duelM?J.a18.duelM.children.length:0,parts:J.a18.duelM?((k)=>({floor:k.filter(c=>c.isMesh&&c.material.isMeshLambertMaterial&&c.material.emissive.getHex()===0).length,walls:k.filter(c=>c.isMesh&&c.geometry.type==="PlaneGeometry").length,cover:k.filter(c=>c.isMesh&&c.material.isMeshLambertMaterial&&c.material.emissive.getHex()!==0).length}))(J.a18.duelM.children):null,onScene:J.a18.duelM?!!J.a18.duelM.parent:false})');
 check(s.duel>10&&s.x===10000-4&&Math.abs(s.bx-(10000+4))<0.5,'both combatants are pulled into the pocket cell '+JSON.stringify(s));
 // the merge's restyle (a18ArenaShell: floor rim, wall grids and rails, cover edge lines) adds trim to the group; count the
 // structural pieces, not the children
 check(s.shell&&s.parts&&s.parts.floor===1&&s.parts.walls===4&&s.parts.cover===2&&s.onScene,'the arena shell renders at the cell (floor + 4 walls + 2 cover) '+JSON.stringify(s));
 check(s.y<0.15&&s.z===0,'on the arena floor line');
 // the analytic cell through the wrapped globals
 check(xe('blocked(10014.8,0,.45,0)')===true,'the energy wall stops movement');
 check(xe('blocked(10000,0,.45,0)')===false,'the cell floor is open');
 check(xe('groundAt(10000,0,.45,1)')===0,'the floor carries at y=0');
 check(xe('los([9990,1.6,0],[10010,1.6,0])')===true,'sight crosses the open cell');
 check(xe('los([9991,0.7,-5],[9998,0.7,-5])')===false,'a cover block breaks low sight');
 check(xe('los([0,1.6,0],[10000,1.6,0])')===false,'map sight never crosses into the arena');
 check(xe('blocked(0,0,.45,0)')===xe('(()=>{const f=blocked;blocked=a18Blk0;const r=f(0,0,.45,0);blocked=f;return r;})()'),'map positions still reach the page collision');
 // the duel runs its 13 s, then both return home and the shell goes away
 await adv(14000);s=xe('({x:player.x,y:player.y,z:player.z,duel:J.a18.duel,shell:!!J.a18.duelM,bx:bots[0].g.position.x,bz:bots[0].g.position.z,bd:bots[0].duel||0})');
 check(s.duel===0&&!s.shell,'the shell is gone when the duel ends '+JSON.stringify(s));
 check(Math.hypot(s.x-home.x,s.z-home.z)<0.5,'the player returns home '+JSON.stringify([s,home]));
 check(Math.hypot(s.bx-bHome.x,s.bz-bHome.z)<0.5&&s.bd===0,'the target returns home');
 // online: the server duel fx row renders and removes the shell
 xe('netSyncEffects([{id:9001,kind:"duel",p:[10000,0,0],r:15,until:1e12}]);true');
 check(xe('scene.children.some(c=>c.type==="Group"&&c.position.x===10000)')===true,'online: the duel row renders the shell');
 xe('netSyncEffects([]);true');
 check(xe('scene.children.some(c=>c.type==="Group"&&c.position.x===10000)')===false,'online: the shell drops with the row');
 const errs=H.errors.filter(e=>!/WebGL|AudioContext|fetch|unexpected external script/i.test(String(e.msg||e)));
 check(errs.length===0&&H.xErrCalls.length===0,'no page errors '+JSON.stringify(errs.slice(0,3))+JSON.stringify(H.xErrCalls.slice(0,3)));
 if(fails.length){console.log(fails.length+' FAILED');process.exit(1);}
 console.log('PASS iso pocket arena: both pulled to the cell, shell renders, walls/floor/cover work through blocked/groundAt/los, sight stays inside, both return home after 13 s, online duel row renders and drops the shell');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
