// Phoenix Blaze online row: a18NetSync draws a visual-only wall of the server's length and drops it with the row.
const {boot}=require('./page_harness.cjs');
(async()=>{
 const H=boot({real3:true,seed:3}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 xe('J.pick="Phoenix";FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true');await adv(500);
 const w0=xe('J.walls.length');
 xe('a18NetSync([{id:77,kind:"blaze",p:[0,0,2],q:[0,0,-8],tl:8}]);true');
 const r=xe('JSON.stringify({n:J.walls.length,net:a18Net.has(77),len:J.walls.length?J.walls[J.walls.length-1].h*2+1:0,t:J.walls.length?J.walls[J.walls.length-1].t:0,vis:J.walls.length?J.walls[J.walls.length-1].m.visible:0,phx:!!(J.walls.length&&J.walls[J.walls.length-1].phx)})');
 console.log(w0,r);
 await adv(300);
 xe('a18NetSync([]);true');console.log('after drop',xe('JSON.stringify(J.walls.map(w=>w.t))'));
 console.log('errors',H.errors.length,H.errors.slice(0,3).map(e=>String(e&&e.message||e).slice(0,200)));
 process.exit(0);
})();
