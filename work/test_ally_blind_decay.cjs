// Teammates' blind / concuss wears off (UI lane 2: "screenshot right after death was a blank white frame").
// Enemy Skye Trailblazer / Breach Rolling Thunder / Spike Rush Twin Hunters set .blind on the player's offline allies, but
// jFxTick only counted down the enemy bots' .blind. spectate_runtime xspvBlind(a.blind) paints #xSpvBlind white at
// min(1, blind / 1.5), so after dying, spectating a teammate who had ever been concussed showed a permanent white screen
// (and that teammate played "blind" for the rest of the match).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const i=html.indexOf('function jFxTick(dt) {');assert(i>0,'jFxTick missing');const j=html.indexOf('\n}\n',i);assert(j>i);
const src=html.slice(i,j+2);
const ctx=vm.createContext({Math,player:{hp:0,x:0,z:0},J:{walls:[],zones:[],orbs:[],arrows:[],fx:[],dr:0,rib:0,rvT:0,hf:0},
 bots:[{alive:true,blind:1}],allies:[{alive:true,blind:1.2},{alive:false,blind:0.5},{alive:true}],
 jRel(){},drTick(){},xBoltMove(){},jUnreveal(){},scene:{remove(){}}});
vm.runInContext(src,ctx);
for(let k=0;k<30;k++)ctx.jFxTick(0.05); // 1.5 s
assert.ok(ctx.bots[0].blind<=0,'enemy bot blind wears off: '+ctx.bots[0].blind);
assert.ok(ctx.allies[0].blind<=0,'teammate blind / concuss wears off (was never counted down): '+ctx.allies[0].blind);
assert.ok(ctx.allies[1].blind<=0,'a dead teammate\'s blind wears off too (spectate reads it on revive): '+ctx.allies[1].blind);
assert.ok(!(ctx.allies[2].blind>0),'a teammate never blinded stays unblinded');
// the spectate overlay follows the teammate's blind: none left -> no white screen
const sp=fs.readFileSync(path.join(root,'work/spectate_runtime.js'),'utf8');
assert.match(sp,/xspvBlind\(pov \? pov\.blind : a\.blind > 0 \? a\.blind : 0\)/,'spectate overlay reads the teammate\'s .blind');
console.log('test_ally_blind_decay: PASS');
