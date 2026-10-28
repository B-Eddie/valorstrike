function mpCliSnap(m) {
  if (!running || MP.st !== "game") return;
  const now = performance.now(), seen = new Set(), units = new Map(bots.concat(allies).map((u) => [u.nid, u]));
  // Preserve the server's sample spacing: packets delivered together after jitter must not become simultaneous poses.
  // A minimum observed clock offset removes clock skew without treating network delay as movement time.
  const stamped = Number.isFinite(m.serverTime) || Number.isFinite(m.c), stamp = Number.isFinite(m.serverTime) ? m.serverTime : stamped ? m.c : now; // P2P host snapshots carry the host clock (c)
  if (stamped) {
    let C = MP.snapClock;
    if (!C || stamp < C.last - 1000 || now - C.at > 3000) C = MP.snapClock = { offset: now - stamp, last: stamp, at: now, jitter: 0, delay: MP.DELAY };
    if (stamp > C.last) {
      const gap = now - C.at, spacing = stamp - C.last;
      C.offset = Math.min(now - stamp, C.offset + Math.max(0, gap) * .001);
      C.jitter = Math.max(C.jitter * .95, Math.min(100, Math.abs(gap - spacing)) * .5);
      C.starve = (C.starve || 0) * .995; // stalls seen in mpInterp keep the buffer wide for a few seconds
      C.delay = Math.max(MP.DELAY, Math.min(220, MP.DELAY + Math.max(C.jitter * 2, C.starve)));
      C.last = stamp; C.at = now;
    }
  }
  if (typeof m.tl === "number") timeLeft = m.tl;
  for (const e of m.u || []) {
    if (e[0] === MP.me) { mpCliSelf(e); continue; }
    seen.add(e[0]); let u = units.get(e[0]);
    if (!u) { const ally = (FV.tdm || MP.m5) && e[1] === MP.team; u = mpMkUnit(e, ally); (ally ? allies : bots).push(u); try { SB[u.name] = SB[u.name] || { k: 0, d: 0, a: 0, fb: 0, pd: 0, hs: 0, dmg: 0, pl: 0, sp: 0, ping: 0 }; } catch (er) {} }
    const n = mpClean(e[2]); if (n && n !== u.name) { mpRename(u, n); XBA[n] = XAG[e[3]] ? e[3] : u.agent; }
    if (XAG[e[3]] && e[3] !== u.agent) { u.agent = e[3]; XBA[u.name] = e[3]; mpDropModel(u); }
    u.hum = e[12]; u.w = e[11]; u.armor = e[9]; u.ping = e[13];
    try { if (SB[u.name]) SB[u.name].ping = e[13]; } catch (er) {}
    const alive = !!e[10];
    if (u.alive && !alive) { u.alive = false; u.hp = 0; scene.remove(u.g); u.nb.length = 0; }
    else if (!u.alive && alive) { u.alive = true; u.hp = e[8]; u.nb.length = 0; u.g.position.set(e[4], e[5] || 0, e[6]); u.g.rotation.y = e[7]; dmLive(u); }
    else u.hp = alive ? e[8] : 0;
    if (alive) {
      const B = u.nb, L = B[B.length - 1], reset = L && (L.clock !== stamped || u.nsq !== e[14] || Math.hypot(L.x - e[4], L.y - e[5], L.z - e[6]) > 6);
      if (reset) { B.length = 0; u.nr = u.nrAt = null; u.g.position.set(e[4], e[5] || 0, e[6]); u.g.rotation.y = e[7]; }
      u.nsq = e[14];
      const sample = { t: stamp, clock: stamped, x: e[4], y: e[5] || 0, z: e[6], r: e[7], p: Number.isFinite(e[18]) ? e[18] : 0 };
      const last = B[B.length - 1];
      if (!last || stamp > last.t) B.push(sample); else if (stamp === last.t) B[B.length - 1] = sample;
      if (B.length > 32) B.shift();
    }
  }
  for (const L of [bots, allies]) for (let i = L.length - 1; i >= 0; i--) if (!seen.has(L[i].nid)) { scene.remove(L[i].g); L.splice(i, 1); }
  mpCliKD(m.k, m.d);
  for (const v of m.ev || []) try {
    if (v[0] === "k") { const k = mpIn(v[1] || v[4] || "Utility"), d = mpIn(v[2]); /* blank killer: ownerless utility from an older server */ kfeed(k, d, !!v[3], v[4], v.length > 5 ? v[5] : null); if (d === "You") { try { xKLDie(k, v[4]); } catch (e) {} stats.d++; } if (k === "You") { stats.k++; if (v[3]) stats.hs = (stats.hs || 0) + 1; try { jKill(); } catch (e) {} } }
    else if (v[0] === "n") feed(v[1]);
    else if (v[0] === "sp") { feed(mpIn(v[2]) + " planted the Spike on " + v[3]); say("Spike planted · " + v[3], 1500); try { SFX.planted(); } catch (e) {} }
    else if (v[0] === "s" && v[1] !== MP.me) { const u = bots.concat(allies).find((x) => x.nid === v[1]); if (u && u.alive && !u.fog) SFX.at(u.g.position, WEAP[v[2]] || v[2] === "Blade Storm" ? v[2] : "Vandal"); } // Blade Storm: a knife throw (ability_fp_runtime SFX.at route), not a Vandal
  } catch (e) {}
  try { showStats(); } catch (e) {}
}
function mpInterp(u, now) {
  const B = u.nb; if (!B || !B.length || !u.alive) return;
  const C = B[0].clock && MP.snapClock, target = C ? now - C.offset - C.delay : now - MP.DELAY;
  const elapsed = u.nrAt == null ? 0 : Math.max(0, now - u.nrAt);
  // A changing jitter buffer must not reverse the render clock or race through a burst of queued snapshots.
  let rt = u.nr == null || elapsed > 1000 ? target : u.nr + Math.max(elapsed * .9, Math.min(elapsed * 1.1, target - u.nr));
  // Starved (a lost packet held back by TCP, a long stall): the render clock stops at the 50 ms extrapolation bound instead of
  // running on (it jumped the unit ahead by the whole stall when the data resumed), and the buffer widens by the shortfall.
  const nw = B[B.length - 1].t;
  if (u.nr != null && B.length > 1 && rt > nw + 50) { if (C) { C.starve = Math.max(C.starve || 0, Math.min(150, target - nw)); C.delay = Math.max(C.delay, Math.min(220, MP.DELAY + C.starve)); } rt = Math.max(u.nr, nw + 50); }
  u.nr = rt; u.nrAt = now;
  while (B.length > 2 && B[1].t <= rt) B.shift();
  const a = B[0], b = B[1] || a, span = b.t - a.t, p = u.g.position;
  let k = span > 0 ? Math.max(0, Math.min(1, (rt - a.t) / span)) : 1;
  // Carry one missed snapshot smoothly, then stop. Never project a teleport or dash at an unbounded velocity.
  if (span > 0 && rt > b.t && Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / span < .012) k += Math.min(50, rt - b.t) / span;
  p.x = a.x + (b.x - a.x) * k; p.z = a.z + (b.z - a.z) * k; p.y = a.y + (b.y - a.y) * k;
  const aim = Math.min(1, k); u.g.rotation.y = a.r + xAng(b.r - a.r) * aim;
  if (Number.isFinite(a.p) && Number.isFinite(b.p)) u.np = a.p + (b.p - a.p) * aim;
}
// Snapshot time on the receiver's clock (remote smoothness). Stamping by arrival time put network jitter straight into the
// interpolation: snapshots sent every 50-66 ms arriving +-20 ms off made a remote run at 5.4 m/s render at ~3-8 m/s from
// one segment to the next (legs and footsteps stuttered, the body surged and hitched). With the sender's clock (trusted
// server: serverTime; P2P host / client: c) the stamp is sent + offset, the offset easing toward the smallest one-way delay seen
// (down at 10 % per packet, up at 0.5 %: no segment changes length by more than a few ms; a jump over 250 ms resyncs at once); without it, arrival time as before. Stamps never go backwards.
function mpStamp(B, sent, now) {
  let t = now;
  if (Number.isFinite(sent)) { const d = now - sent; if (B.off == null || Math.abs(d - B.off) > 250) B.off = d; else B.off += (d - B.off) * (d < B.off ? 0.1 : 0.005); t = sent + B.off; }
  const L = B.length ? B[B.length - 1] : null; if (L && t <= L.t) t = L.t + 1; return t;
}
const netPose0=mpCliSnap;mpCliSnap=function(m){const r=netPose0.apply(this,arguments);if(NET.socket&&m&&Array.isArray(m.u)){const all=bots.concat(allies);for(const e of m.u){if(!Array.isArray(e)||e[0]===MP.me)continue;const u=all.find(x=>x.nid===e[0]);if(!u)continue;if(Number.isFinite(e[17]))u.cr=e[17]>.5;if(Number.isFinite(e[18]))u.np=e[18];}}return r;};
