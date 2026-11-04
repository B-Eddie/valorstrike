// Clicks at start / stop (lane-audio3): every downloaded voice gets its own envelope gain - a 1.5 ms attack ramp from 0,
// a 20 ms fade before the buffer ends (27 of 57 gun cuts end above -30 dBFS: Odin fire's last samples +1.9 dBFS, Bulldog
// -1.1, Ares -2.4), and a 12 ms fade-out when a voice is stopped / stolen (weapon switch, reload end, voice cap) instead
// of a hard source.stop() at full level.
'use strict';
const assert=require('assert/strict');const {make}=require('./fake_mix.cjs');
const F=make();F.x('SFX.gun("Odin")');const s=F.rec.sources[F.rec.sources.length-1],env=s.outs[0],ev=env.gain.ev,t=s.startArgs[0]||F.ac.currentTime;
assert(env&&env.kind==='gain','source feeds a gain node');
const z=ev.findIndex(e=>e[0]==='setValueAtTime'&&e[1]===0);assert(z>=0,'voice envelope starts from 0: '+JSON.stringify(ev));
const up=ev.find((e,i)=>i>z&&e[0]==='linear'&&e[1]>0);assert(up&&up[2]-ev[z][2]>0&&up[2]-ev[z][2]<=0.003,'attack ramp <= 3 ms');
const dur=(s.buffer.duration-(s.startArgs[1]||0))/s.playbackRate.v,end=ev.filter(e=>e[0]==='linear'&&e[1]===0).pop();
assert(end&&Math.abs(end[2]-(t+dur))<0.002,'fade to 0 at the buffer end ('+(t+dur).toFixed(3)+'): '+JSON.stringify(ev));
const hold=ev.filter(e=>e[0]==='setValueAtTime'&&e[1]>0).pop();assert(hold&&end[2]-hold[2]>=0.015,'end fade lasts >= 15 ms');
// stop: fade, then stop after the fade
F.ac.currentTime+=0.05;const n0=ev.length;F.x('gaStop()');const after=ev.slice(n0);
const rel=after.find(e=>e[0]==='linear'&&e[1]===0);assert(rel,'gaStop fades the voice out: '+JSON.stringify(after));const relMs=(rel[2]-F.ac.currentTime)*1000;assert(relMs>=8,'release fade >= 8 ms');
assert(s.stopAt!=null&&s.stopAt>=rel[2]-1e-9,'source stops after the fade ('+s.stopAt+' vs '+rel[2]+'), not at once');
assert.equal(F.x('GA.slots.filter(x=>x.source).length'),0,'slot freed at once (the fading tail needs no slot)');
// a looping ambience has no end fade but fades on stop
F.x('gaPlay("ambient/wind","ambient",{gain:.035,loop:true})');const a=F.rec.sources[F.rec.sources.length-1];assert(!a.outs[0].gain.ev.some(e=>e[0]==='linear'&&e[1]===0),'loop: no scheduled end fade');
F.ac.currentTime+=1;F.x('gaStop("ambient")');assert(a.outs[0].gain.ev.some(e=>e[0]==='linear'&&e[1]===0)&&a.stopAt>F.ac.currentTime,'loop fades on stop');
console.log('audio fades: attack '+((up[2]-ev[z][2])*1000).toFixed(1)+' ms, end fade '+((end[2]-hold[2])*1000).toFixed(0)+' ms, release '+relMs.toFixed(0)+' ms');
