// Guiding Light equip/launch/hold/release state machine (xEqFire + xEqTick, real source, stubbed world): FIRE down at launch = steerable until FIRE up, click = never; unequip starts at release.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const cut=(a,b,o)=>{const i=html.indexOf(a),j=html.indexOf(b,i+(o||0));assert(i>0&&j>i,a);return html.slice(i,j);};
const src=cut('const XAB_HOLD = ','var XDARK')+cut('function xEqHold(q)','\n',1)+cut('function xEqFire(alt)','function xEqCast(q)')+cut('function xEqTick(dt) {','\nconst xEqKey0');
const c={Math,Number,RS:{hk:null},J:{pick:'Skye',eq:null},XABT:{rec:.45,rel:.2,draw:.8},VM:{sw:0,swT:0,ins:0},running:true,player:{hp:100},mode:'five',FV:{buy:0},fireHeld:false,jOn:()=>true,xRotKind:()=>false,xRotOn:()=>false,xRotFace:()=>0,xDarkInit(){},xUneqT:()=>.85,xReeqT:()=>.3,xEqWeap:()=>'Classic',typeof_:0};
c.xEqCast=q=>{c.RS.hk={hold:!!(c.fireHeld&&c.J.eq&&c.J.eq.k==='e'),w:null};return true;};
vm.createContext(c);vm.runInContext(src+';this.fire=xEqFire;this.tick=xEqTick;',c);
const run=(heldAtCast)=>{c.RS.hk=null;c.J.eq={k:'e',code:'KeyE',st:'ready',t:0,buf:0,h:0,bn:0};c.fireHeld=true;c.fire(false);assert.equal(c.J.eq.st,'rel');if(!heldAtCast)c.fireHeld=false;c.tick(.25);};
run(true);assert.equal(c.J.eq.st,'steer','FIRE still down at launch: ability stays in hand');assert.equal(c.RS.hk.hold,true);
c.tick(.5);assert.equal(c.J.eq.st,'steer','held: still steering');
c.fireHeld=false;c.tick(.016);assert.equal(c.J.eq.st,'rec','release: unequip starts');assert.equal(c.RS.hk.hold,false,'release latches steering off');
run(false);assert.equal(c.J.eq.st,'rec','click launch: straight hawk, unequip right away');assert.equal(c.RS.hk.hold,false);
run(true);c.RS.hk.w=0.3;c.tick(.016);assert.equal(c.J.eq.st,'rec','pop while held ends the hold');
run(true);c.RS.hk=null;c.tick(.016);assert.equal(c.J.eq.st,'rec','flight end ends the hold');
console.log('skye hawk hold client state machine ok (real source, stubbed world)');
