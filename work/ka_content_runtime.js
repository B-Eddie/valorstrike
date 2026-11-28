// ---- KINGDOM ARCHIVES CONTENT ----
// Playercards, kill banners, event voicelines and lobby homescreens mirrored from
// kingdomarchives.com into assets/ (playercards / killbanners / voicelines / homescreens).
// Everything lazy-loads on first use; the initial payload carries only this block and the
// audio manifest keys. Assets (c) Riot Games, sourced via Kingdom Archives - fan project,
// see models/valorant/SOURCES.md. Install: appended by work/install_valorant.py.
(function () {
"use strict";
var LS = "vs.kac";
var KAC = (window.KAC = { v: 1 });
var state = (KAC.state = (function () {
  try {
    return Object.assign({ card: null, banner: "default", bg: true, voices: true }, JSON.parse(localStorage.getItem(LS) || "{}"));
  } catch (e) {
    return { card: null, banner: "default", bg: true, voices: true };
  }
})());
function save() {
  try {
    localStorage.setItem(LS, JSON.stringify(state));
  } catch (e) {}
}
var _cache = {};
function data(name, url) {
  if (!_cache[name])
    _cache[name] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      })
      .catch(function () {
        _cache[name] = null;
        return null;
      });
  return _cache[name];
}
KAC.cards = function () { return data("cards", "assets/playercards/index.json"); };
KAC.banners = function () { return data("kb", "assets/killbanners/sets.json"); };
KAC.voices = function () { return data("vl", "assets/voicelines/index.json"); };
KAC.homes = function () { return data("hs", "assets/homescreens/index.json"); };

// ---------- event voicelines (audio manifest keys ka/vl/<Agent>/<event>) ----------
var VL_LAST = {};
function vlPlay(agent, ev, gain) {
  if (!state.voices || !agent || typeof gaPlay !== "function") return false;
  var key = "ka/vl/" + agent + "/" + ev, now = performance.now();
  if (VL_LAST[key] && now - VL_LAST[key] < 4000) return false; // no back-to-back repeats
  VL_LAST[key] = now;
  return gaPlay(key, "voice", { gain: gain || 0.7 });
}
KAC.vlPlay = vlPlay;
try {
  var as0 = agentSelect;
  agentSelect = function (go) {
    const r = as0.apply(this, arguments);
    try {
      const heard = {};
      const tiles = document.querySelectorAll("#xAg .x-ag");
      tiles.forEach(function (b) {
        const oc = b.onclick;
        b.onclick = function () {
          if (!heard[b.dataset.a]) { heard[b.dataset.a] = 1; vlPlay(b.dataset.a, "select", 0.8); }
          return oc && oc.apply(this, arguments);
        };
      });
      const lb = $("xAgL");
      if (lb) {
        const ol = lb.onclick;
        lb.onclick = function () {
          try { if (!heard[J.pick]) vlPlay(J.pick, "select", 0.8); } catch (e) {}
          return ol && ol.apply(this, arguments);
        };
      }
    } catch (e) {}
    return r;
  };
} catch (e) {}
try {
  var rs0 = SFX.roundStart, round0 = 0;
  SFX.roundStart = function () {
    round0++;
    try {
      const ag = J && J.pick;
      if (ag) vlPlay(ag, round0 === 1 ? "match_start" : round0 % 2 ? "round_start" : "barrier_down", 0.7);
    } catch (e) {}
    return rs0.apply(this, arguments);
  };
} catch (e) {}
try {
  var fan0 = SFX.fanfare;
  SFX.fanfare = function (win) {
    try { if (win && J && J.pick) vlPlay(J.pick, "match_win", 0.75); } catch (e) {}
    return fan0.apply(this, arguments);
  };
} catch (e) {}

// ---------- kill banner (frame + emblem + pips + per-kill audio) ----------
var KB = { el: null, fr: null, em: null, pips: null, t: 0 };
function kbBuild() {
  if (KB.el) return;
  var el = document.createElement("div");
  el.id = "kaKb";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<img class="kaKb-fr" alt=""><img class="kaKb-em" alt=""><img class="kaKb-hs" alt="" hidden><div class="kaKb-pp"></div>';
  document.body.appendChild(el);
  KB.el = el; KB.fr = el.querySelector(".kaKb-fr"); KB.em = el.querySelector(".kaKb-em");
  KB.hs = el.querySelector(".kaKb-hs"); KB.pp = el.querySelector(".kaKb-pp");
  var st = document.createElement("style");
  st.textContent =
    "#kaKb{position:fixed;left:50%;bottom:17%;transform:translateX(-50%) scale(.9);width:340px;height:120px;" +
    "pointer-events:none;z-index:60;opacity:0;transition:opacity .18s,transform .18s;display:grid;place-items:center}" +
    "#kaKb.on{opacity:1;transform:translateX(-50%) scale(1)}" +
    "#kaKb .kaKb-fr{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}" +
    "#kaKb .kaKb-em{position:relative;width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}" +
    "#kaKb .kaKb-hs{position:absolute;top:-14px;right:26%;width:28px;height:28px;object-fit:contain}" +
    "#kaKb .kaKb-pp{position:absolute;bottom:-16px;display:flex;gap:6px}" +
    "#kaKb .kaKb-pp img{width:22px;height:22px;object-fit:contain;opacity:.35}" +
    "#kaKb .kaKb-pp img.on{opacity:1}" +
    "@media(max-height:480px){#kaKb{width:260px;height:92px}#kaKb .kaKb-em{width:48px;height:48px}}";
  document.head.appendChild(st);
}
function kbShow(n, hs) {
  kbBuild();
  KAC.banners().then(function (sets) {
    if (!sets) return;
    var s = sets[state.banner] || sets["default"];
    if (!s) return;
    var fr = null;
    if (s.meta && s.meta.type === "BannerSwap" && s.swap) fr = s.swap[String(Math.min(n, 6))] || s.swap["1"];
    if (!fr) fr = s.imgs && (s.imgs.frame || s.imgs.emblem);
    if (!fr) return;
    if (KB.fr.getAttribute("src") !== fr) KB.fr.src = fr;
    var em = s.imgs && (s.imgs.emblemV1 || s.imgs.emblem);
    if (em) { KB.em.hidden = false; if (KB.em.getAttribute("src") !== em) KB.em.src = em; } else KB.em.hidden = true;
    var hsi = s.imgs && s.imgs.headshot;
    KB.hs.hidden = !(hs && hsi);
    if (hs && hsi && KB.hs.getAttribute("src") !== hsi) KB.hs.src = hsi;
    var pip = s.imgs && (s.imgs.pipV1 || s.imgs.pip);
    KB.pp.innerHTML = "";
    for (var i = 1; i <= Math.min(n, 6); i++) {
      var im = document.createElement("img");
      im.alt = ""; if (pip) im.src = pip;
      if (i <= n) im.className = "on";
      KB.pp.appendChild(im);
    }
    KB.el.classList.remove("on"); void KB.el.offsetWidth; KB.el.classList.add("on");
    clearTimeout(KB.t); KB.t = setTimeout(function () { KB.el.classList.remove("on"); }, 3200);
    if (typeof gaPlay === "function") {
      var au = s.audios && (s.audios["audio-" + Math.min(n, 5) + (hs ? "-hs" : "")] || s.audios["audio-" + Math.min(n, 5)]);
      if (au) {
        var parts = au.split("/"), base = parts.pop().replace(/\.mp3$/, "");
        gaPlay("ka/kb/" + parts[2] + "/" + base, "kill", { gain: 0.65 });
      }
    }
  });
}
KAC.kbShow = kbShow;
try {
  var hk0 = xHitKillSfx;
  xHitKillSfx = function (i, hs) {
    const n = (i | 0) + 1;
    try {
      kbShow(n, hs);
      if (J && J.pick) vlPlay(J.pick, hs ? "headshot" : n >= 5 ? "ace" : n === 3 ? "triple" : "kill", 0.7);
    } catch (e) {}
    return hk0.apply(this, arguments);
  };
} catch (e) {}
try {
  var kf0 = kfeed;
  kfeed = function (k, v, hs, w, wbo) {
    try { if (v === "You" && J && J.pick) vlPlay(J.pick, "death", 0.7); } catch (e) {}
    return kf0.apply(this, arguments);
  };
} catch (e) {}

// ---------- profile: playercard + banner picker tabs ----------
function pretty(slug) { return slug.replace(/(\d)/g, " $1").replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim(); }
function cardArt() {
  var panel = document.querySelector('#mProf [data-pp="p"] .x-plv');
  if (!panel || $("kaCard")) return;
  var im = document.createElement("img");
  im.id = "kaCard"; im.alt = "Playercard";
  im.style.cssText = "width:100%;max-width:360px;align-self:center;border:1px solid rgba(236,232,225,.12);margin-bottom:12px";
  panel.parentElement.insertBefore(im, panel);
  KAC.cardShow();
}
KAC.cardShow = function () {
  var im = $("kaCard");
  if (!im) return;
  if (!state.card) { im.hidden = true; return; }
  KAC.cards().then(function (idx) {
    var c = idx && idx[state.card];
    if (!c) { im.hidden = true; return; }
    im.hidden = false; if (im.getAttribute("src") !== c.wide) im.src = c.wide; im.title = state.card;
  });
};
function profTabs() {
  var tabs = document.querySelector("#mProf .x-tabs");
  if (!tabs || $("kaPcT")) return;
  tabs.insertAdjacentHTML("beforeend", '<button data-pt="pc" id="kaPcT">Playercard</button><button data-pt="kb" id="kaKbT">Kill banner</button>');
  var host = tabs.parentElement;
  host.insertAdjacentHTML("beforeend",
    '<div class="x-pp" data-pp="pc" hidden><div id="kaPcG" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;max-height:55vh;overflow:auto"></div></div>' +
    '<div class="x-pp" data-pp="kb" hidden><div id="kaKbG" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:55vh;overflow:auto"></div></div>');
  var all = host.querySelectorAll("[data-pt]");
  all.forEach(function (t) {
    t.onclick = function () {
      all.forEach(function (x) { x.classList.toggle("on", x === t); });
      host.querySelectorAll("[data-pp]").forEach(function (p) { p.hidden = p.dataset.pp !== t.dataset.pt; });
      if (t.dataset.pt === "pc") pcGrid();
      if (t.dataset.pt === "kb") kbGrid();
    };
  });
}
function pcGrid() {
  var g = $("kaPcG");
  if (!g || g.dataset.done) return;
  g.dataset.done = "1"; g.textContent = "Loading cards…";
  KAC.cards().then(function (idx) {
    g.textContent = "";
    if (!idx) { g.textContent = "Playercards unavailable."; return; }
    Object.keys(idx).forEach(function (name) {
      var c = idx[name], b = document.createElement("button");
      b.style.cssText = "padding:0;border:1px solid rgba(236,232,225,.12);background:none;cursor:pointer";
      if (name === state.card) b.style.borderColor = "#ff4655";
      b.title = name;
      var im = document.createElement("img");
      im.loading = "lazy"; im.src = c.small; im.alt = name; im.style.cssText = "width:100%;display:block";
      b.appendChild(im);
      b.onclick = function () { state.card = name; save(); KAC.cardShow(); pcGridRefresh(); };
      g.appendChild(b);
    });
  });
}
function pcGridRefresh() {
  var g = $("kaPcG");
  if (!g) return;
  Array.prototype.forEach.call(g.children, function (b) { b.style.borderColor = b.title === state.card ? "#ff4655" : "rgba(236,232,225,.12)"; });
}
function kbGrid() {
  var g = $("kaKbG");
  if (!g || g.dataset.done) return;
  g.dataset.done = "1"; g.textContent = "Loading banners…";
  KAC.banners().then(function (sets) {
    g.textContent = "";
    if (!sets) { g.textContent = "Kill banners unavailable."; return; }
    Object.keys(sets).sort().forEach(function (slug) {
      var s = sets[slug], img = s.imgs && (s.imgs.emblemV1 || s.imgs.emblem || s.imgs.frame);
      var b = document.createElement("button");
      b.style.cssText = "padding:8px;border:1px solid rgba(236,232,225,.12);background:#16212b;color:#ece8e1;cursor:pointer;font-size:11px;letter-spacing:.06em";
      if (slug === state.banner) b.style.borderColor = "#ff4655";
      b.title = slug;
      if (img) {
        var im = document.createElement("img");
        im.loading = "lazy"; im.src = img; im.alt = slug; im.style.cssText = "width:100%;height:64px;object-fit:contain;display:block;margin-bottom:6px";
        b.appendChild(im);
      }
      b.appendChild(document.createTextNode(pretty(slug)));
      b.onclick = function () {
        state.banner = slug; save();
        Array.prototype.forEach.call(g.children, function (x) { x.style.borderColor = x.title === slug ? "#ff4655" : "rgba(236,232,225,.12)"; });
        kbShow(1, false); // preview
      };
      g.appendChild(b);
    });
  });
}
try {
  var gp0 = goProf;
  goProf = function () {
    const r = gp0.apply(this, arguments);
    try { profTabs(); cardArt(); } catch (e) {}
    return r;
  };
  if (document.querySelector("#mProf")) { profTabs(); cardArt(); }
} catch (e) {}

// ---------- lobby homescreen ----------
KAC.lobbyBg = function () {
  if (!state.bg) return;
  KAC.homes().then(function (hs) {
    if (!hs || !hs.length) return;
    var pickH = hs[Math.floor(Math.random() * hs.length)], lb = $("lobby");
    if (!lb || !pickH || !pickH.img) return;
    lb.style.background =
      "linear-gradient(180deg,rgba(15,25,35,.55),rgba(15,25,35,.85) 60%,#0f1923),url(" + pickH.img + ") center/cover no-repeat";
  });
};
try { KAC.lobbyBg(); } catch (e) {}
KAC.ready = true;
})();
// ---- END KINGDOM ARCHIVES CONTENT ----
