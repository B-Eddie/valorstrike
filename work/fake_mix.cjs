// Mixer-graph fixture for the downloaded-audio runtime (work/audio_runtime.js): a recording fake Web Audio graph
// (every AudioParam keeps its automation events, every source its start(when, offset) / stop(when) and playbackRate,
// every node its outputs), the runtime loaded in a vm context with the real audio/manifest.json and audio/levels.json.
// Buffers are fakes with each file's manifest duration. Used by test_audio_levels / test_audio_fades / test_audio_voices.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
function make(opt = {}) {
  const man = JSON.parse(fs.readFileSync(path.join(root, 'audio/manifest.json'), 'utf8'));
  let levels = null; try { const L = JSON.parse(fs.readFileSync(path.join(root, 'audio/levels.json'), 'utf8')); levels = {}; for (const k in L.files) levels[k] = [L.files[k].g, L.files[k].o]; } catch (e) {}
  const rec = { sources: [], nodes: [] };
  class Param { constructor(v) { this.v = v; this.ev = []; } get value() { return this.v; } set value(x) { if (!Number.isFinite(x)) throw TypeError('non-finite'); this.v = x; this.ev.push(['set', x, ac.currentTime]); }
    setValueAtTime(v, t) { this.ev.push(['setValueAtTime', v, t]); this.v = v; return this; } linearRampToValueAtTime(v, t) { this.ev.push(['linear', v, t]); return this; }
    exponentialRampToValueAtTime(v, t) { if (v === 0) throw RangeError('exp to 0'); this.ev.push(['exp', v, t]); return this; } setTargetAtTime(v, t, c) { this.ev.push(['target', v, t, c]); return this; }
    cancelScheduledValues(t) { this.ev.push(['cancel', 0, t]); return this; } cancelAndHoldAtTime(t) { this.ev.push(['hold', 0, t]); return this; } }
  class N { constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.gain = new Param(1); this.playbackRate = new Param(1); this.positionX = new Param(0); this.positionY = new Param(0); this.positionZ = new Param(0); this.threshold = new Param(-24); this.knee = new Param(30); this.ratio = new Param(12); this.attack = new Param(0.003); this.release = new Param(0.25); this.outs = []; rec.nodes.push(this); }
    connect(n) { if (!(n instanceof N) || n.context !== this.context) throw TypeError('AudioNode.connect: Argument 1 is not valid'); this.outs.push(n); return n; }
    disconnect() { this.outs = []; }
    start(when, offset, dur) { if (this.startArgs) throw Error('InvalidStateError: start twice'); this.startArgs = [when, offset, dur]; this.startedAt = ac.currentTime; }
    stop(when) { this.stopAt = when == null ? ac.currentTime : when; this.stopCalledAt = ac.currentTime; } }
  const ac = { currentTime: 1, state: 'running', sampleRate: 48000 };
  ac.destination = new N(ac, 'destination');
  ac.createGain = () => new N(ac, 'gain'); ac.createPanner = () => new N(ac, 'panner'); ac.createDynamicsCompressor = () => new N(ac, 'comp');
  ac.createBufferSource = () => { const s = new N(ac, 'source'); s.loop = false; s.buffer = null; rec.sources.push(s); return s; };
  ac.decodeAudioData = (b, ok) => ok({ duration: 0.5, length: 24000, numberOfChannels: 1 });
  const master = new N(ac, 'master'); master.connect(ac.destination);
  const noop = function () {};
  const c = { window: {}, document: { hidden: false, addEventListener: noop }, S: { muted: false, vol: 70 }, ac, master, audio: noop,
    sPos(n, p) { n.positionX.value = p.x; n.positionY.value = p.y > 0.5 ? p.y : 1.5; n.positionZ.value = p.z; return n; }, sOk: () => true, sNz: noop, sTn: noop, blip: noop, annc: noop,
    SFX: { gun: noop, at: noop, step: noop, selfStep: noop, ab: noop, knife: noop, knifeHeavy: noop, rs: noop, stinger: noop, fanfare: noop, low: noop, empty: noop, land: noop, plantBeep: noop, planted: noop, whir: noop, boom: noop, smoke: noop, flash: noop, tp: noop, wall: noop, heal: noop, ult: noop, buy: noop, lowT: noop, roundStart: noop, defHalf: noop }, xDmgFlash: noop, ambTick: noop, AMB: {}, xHitSfx: noop, xHitKillSfx: noop, xKiAdd: noop, kill: noop, xskChanged: noop,
    addEventListener: noop, setTimeout: noop, requestIdleCallback: noop, fetch: async () => ({ ok: false, status: 404 }), console, performance: { now: () => 0 },
    Map, Set, Promise, Number, Math, Array, Object, Error, JSON, Response: function () {}, bots: [], allies: [],
    running: true, paused: false, player: { hp: 100 }, reloading: 0, mode: 'retake', VM: { ins: 0 }, vfWeapon: () => c.held, held: 'Vandal', J: { pick: 'Jett' } };
  for (const n of ['low', 'empty', 'land', 'plantBeep', 'planted', 'whir', 'boom', 'smoke', 'flash', 'tp', 'wall', 'heal', 'ult', 'buy', 'lowT', 'roundStart', 'defHalf']) c.SFX[n] = noop;
  c.window = c; vm.createContext(c);
  let src = fs.readFileSync(path.join(root, 'work/audio_runtime.js'), 'utf8').replace('/*GAME_AUDIO_JSON*/null', JSON.stringify(man));
  if (opt.levels !== false) src = src.replace('/*GAME_AUDIO_LEVELS*/null', JSON.stringify(levels));
  vm.runInContext(src, c);
  const x = (code) => vm.runInContext(code, c);
  // every manifest file decoded (fake buffer of the manifest's duration)
  for (const [k, f] of Object.entries(man.files)) x(`GA.buffers.set(${JSON.stringify(k)},{duration:${f.duration},length:${Math.round(f.duration * 48000)},numberOfChannels:1,sampleRate:48000})`);
  const gainPath = (s) => { let g = 1, n = s; const seen = new Set(); while (n && n !== master && !seen.has(n)) { seen.add(n); const o = n.outs[0]; if (o && o.kind === 'gain') g *= o.gain.v; n = o; } return g; };
  return { c, x, ac, master, rec, man, levels, N, Param, gainPath, tick(dt) { ac.currentTime += dt; for (const s of rec.sources) if (s.onended && s.stopAt != null && ac.currentTime >= s.stopAt && !s.ended) { s.ended = true; s.onended(); } } };
}
module.exports = { make, root };
