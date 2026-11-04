// Voice management, per-shot variation, reload rate and enemy cue distance (lane-audio3).
// Before: own gun, enemy gunfire, equip, reload, inspect and knife shared one 'gun' group capped at 6, so six enemy
// shots silenced the player's own gun (a dropped shot, not a stolen tail); the same sample could stack 6 deep (phasing,
// +7.8 dB on full auto); a weapon switch stopped every enemy's gunfire; every shot played at rate 1 / one gain (the
// machine-gun effect); a reload clip was stretched to the reload time (Bucky's 2.5 s clip at 5x for its 0.5 s shell,
// Odin 0.63x); and enemy footsteps used the generic inverse curve (ref 3 m, rolloff 1.3: 0.25 at 10 m).
'use strict';
const assert=require('assert/strict');const {make}=require('./fake_mix.cjs');
const live=(F,pred)=>F.x('GA.slots').filter(s=>s.source&&(!pred||pred(s)));
// 1. same-sample cap: rapid own Vandal shots all start, at most 3 voices of the sample live, older ones stolen with a fade
{const F=make();for(let i=0;i<8;i++){F.x('SFX.gun("Vandal")');F.ac.currentTime+=0.01;}
 const k='standard/Vandal/fire',starts=F.rec.sources.filter(s=>s.startArgs).length;assert.equal(starts,8,'every own shot starts (newest wins)');
 const n=live(F,s=>s.key===k).length;assert(n<=3&&n>=2,'<= 3 live voices of one sample (got '+n+')');
 const stolen=F.rec.sources.filter(s=>s.stopAt!=null);assert(stolen.length>=5&&stolen.every(s=>s.stopAt>s.stopCalledAt),'stolen voices fade out');}
// 2. own gun is never dropped by enemy gunfire
{const F=make();for(let i=0;i<6;i++)F.x(`SFX.at({x:${10+i},y:0,z:5},"Phantom")`);const n=F.rec.sources.length;F.x('SFX.gun("Vandal")');assert.equal(F.rec.sources.length,n+1,'own shot plays while 6 enemy shots ring');
 assert(F.rec.sources[n].startArgs,'own shot started');}
// 3. weapon switch stops own gun / foley only
{const F=make();F.x('gaTick()');F.x('SFX.at({x:12,y:0,z:4},"Vandal")');const enemy=F.rec.sources[F.rec.sources.length-1];F.c.held='Sheriff';F.x('gaTick()');assert(enemy.stopAt==null,'enemy gunfire survives the local weapon switch');}
// 4. per-shot variation: small, present
{const F=make();const r=[],g=[];for(let i=0;i<24;i++){F.x('gaStop()');F.x('SFX.gun("Vandal")');const s=F.rec.sources[F.rec.sources.length-1];r.push(s.playbackRate.v);const lin=s.outs[0].gain.ev.find(e=>e[0]==='linear'&&e[1]>0);g.push(lin?lin[1]:s.outs[0].gain.v);}
 assert(r.every(x=>x>=0.97&&x<=1.03),'rate within +-3%: '+r.map(x=>x.toFixed(3)));assert(new Set(r.map(x=>x.toFixed(4))).size>=8,'rate varies per shot');
 const gd=g.map(x=>20*Math.log10(x/g[0]));assert(Math.max(...gd)-Math.min(...gd)>0.3&&Math.max(...gd)-Math.min(...gd)<=2.01,'gain varies <= 2 dB peak to peak: '+gd.map(x=>x.toFixed(2)));}
// 5. reloads play at their recorded speed (no time stretch by playbackRate)
for(const [w,rem] of [['Bucky',0.5],['Odin',5],['Vandal',2.5],['Operator',3.7]]){const F=make();F.c.held=w;F.x('gaTick()');F.c.reloading=rem;F.x('gaTick()');const s=F.rec.sources.find(x=>x.buffer&&x.buffer.duration===F.man.files[F.man.weapons[w].reload].duration&&x.startArgs);assert(s,w+' reload plays');assert(Math.abs(s.playbackRate.v-1)<=0.03,w+' reload rate '+s.playbackRate.v.toFixed(2)+' (was clip/reload time)');}
// 6. enemy footsteps: HRTF, a footstep distance curve clear at 10 m
{const F=make();F.x('SFX.step({x:10,y:0,z:0})');const s=F.rec.sources[F.rec.sources.length-1],pan=s.outs[0].outs[0];assert(pan&&pan.kind==='panner','step is positioned');assert.equal(pan.panningModel,'HRTF');
 const d=10,gd=pan.refDistance/(pan.refDistance+pan.rolloffFactor*(Math.max(d,pan.refDistance)-pan.refDistance));assert(pan.distanceModel==='inverse'&&gd>=0.35,'enemy footstep distance gain at 10 m >= 0.35 (got '+gd.toFixed(3)+')');
 F.x('SFX.gun("Vandal")');const own=F.rec.sources[F.rec.sources.length-1];assert(own.outs[0].outs[0]===F.master,'own gun is not panned (close, centred)');}
console.log('audio voices: same-sample cap 3 with steal+fade, own gun priority, switch keeps enemy fire, +-2.5% / +-0.75 dB per shot, reloads at rate 1, footsteps clear at 10 m');
