# Loadout nondeterminism hunch (read-only, lane index.html @ 13005d5e; ~15 min of code reading, nothing fixed)

Symptom (gate-runs/2026-11-27-abil-drawlist dropped.txt): in some runs one lineup bot holds the Ghost (GN_Luger_* + GN_Silencer_*)
instead of the Vandal (GN_AK_*): 0 calls / 3550 tris on a shot. Internal model names: AK = Vandal, Luger(+Silencer) = Ghost.

## Where the Ghost comes from
1. Round 1 is a pistol round. The BotBrain economy wrapper around fBotBuy (index.html L25314-L25323) asks
   BotBrain.teamBuy (L24587, round 1 -> 'pistol') and then BotBrain.buyFor (L24600-L24602): pistol call, x in [0.40, 0.65) -> side 'Ghost'.
   buyFor's rand is BotRoutes.rng(BotRoutes.hash(xbvSeed() + '|' + n + '|' + key)) (L25320): per-bot deterministic GIVEN the match seed.
2. The match seed: xbvSeed() (L25093). Unless window.xBotSeed is set (the harness does not set it), round 0 takes
   XBV.seed = (Math.random() * 4294967296) >>> 0 on the first call. So which bots buy a Ghost is fixed by the POSITION of that one
   draw in the Math.random stream.
3. Bots are created with that weapon: fSpawn (L8771-L8780) -> fBotBuy(n) -> mkGuy(..., { w: s.w }); the held 3D gun is built in
   xAgent(name, rim, w) (L4751-L4760, xGun(w)).

## Why the harness's "every bot holds a Vandal" does not always stick
- agents.cjs prep sets u.w = 'Vandal' on every bot (VW=1), then runs the loop ~6 s, then freezes the loop.
- The held model only follows u.w in xgHeldSync (L22230-L22238), called only from xgPose (L22239) via the xUbPost wrapper (L22290),
  which runs only for a rig that is (a) M.valorant with M.sx (the real rig attached; async, xvAttach when the agent kit is in memory,
  comment at L4750-L4751) and (b) NOT culled in xSolTick: cull = dd > lod (XS.lod 25/40/60 m) || (dd > 2 && outside the camera
  frustum) (L4740-L4745; `if (cul) continue;` at L4744 skips xUbPost).
- js/agents_setup.js then teleports every bot into the lineup and poses it with the loop frozen; it never calls xgHeldSync / xgPose.
  So a bot that bought a Ghost and was off-screen, too far, or not yet rig-attached during the 6 s prep keeps its Ghost in every shot.

## Where randomness / timing can differ run to run
- L25093 xbvSeed: Math.random draw. The harness reseeds Math.random in PRE (runmatch.sh, s=777) in one page.evaluate, then starts the
  match in a SEPARATE evaluate via setTimeout(() => xGo(startFive), 0) (h.cjs L48-L50). Any rAF frames that run between the two
  evaluates (menu/lobby loop, per-frame Math.random users) shift the stream position before startFive -> fRound (L8783) -> fSpawn ->
  fBotBuy -> xbvSeed. The count depends on wall-clock time (CDP round trip, swiftshader frame time), so the seed, and with it which
  bots roll a Ghost, can change run to run. STRONGEST HUNCH.
- startFive (L8798-L8811) also draws Math.random before fSpawn only for FV.pick === 'random' (not the case: bind); fSpawn itself draws per
  bot for cd / strafe / xPer() (L8776) AFTER that bot's fBotBuy, so in-spawn draws shift later bots' personalities, not the buy (buyFor
  uses the hash RNG). xbAm (L25894 `j:.8+Math.random()*.4`) and xdDrop (L11094 rotation) are further per-frame/per-event stream users.
- L4741-L4744 xSolTick cull: depends on bot spawn positions (fSpawn mkGuy + the xNudgeAll wrapper L8830, and the BotBrain buy-phase "mill"
  xbbOn/xbbInit L25524-L25540 that walks bots during the buy phase) and the camera, both of which run on frame timing (performance.now()
  in the loop) during the 6 s prep -> whether a Ghost bot's xgHeldSync ever ran before the freeze.
- L4750-L4751 / xvAttach: async GLB / kit load order decides whether M.valorant/M.sx existed for that bot during the prep window.

## Cheap harness-side ways to remove it (not done; harness, not product)
- Set window.xBotSeed in PRE (xbvSeed honours it, L25091-L25093), or reseed Math.random inside the same evaluate as startFive.
- In agents_setup.js, call xgHeldSync(b.xm) for every bot after setting the lineup (or set u.w before spawn).

## Observed in this run (2026-11-27-parity), consistent with the above
- mbaseP1 vandal_a7: -5196 tris vs mbaseU1 = -3550 (Ghost-for-Vandal swap) - 1646 (the 1-call / 1646-tri object missing from
  mbaseP1 on 10 of 12 shots, same signature as gates2 mlaneNoAO; not identified, base-side nondeterminism).
- Lane runs and mbaseU1 have equal tris on vandal_a0..a5 / abil_*, yet the lineup diffs (diff_bbox.txt: all inside the bot lineup,
  never the FP viewmodel box) show the same bot's held rifle at a different angle (e.g. mlaneP1 vs mlaneP2 vandal_a7). Inferred
  cause: the grip blend in xgPose (xgPose L22239, blend on L22242: `G.w += ((grip ? 1 : 0) - G.w) * Math.min(1, dt*12)`, and the `G.w < 0.01` early
  return) is advanced per frame during the 6 s prep, so how many frames a bot was un-culled before the freeze decides where its
  gun sits. Same frame-count dependence as the held-model sync above.
- mlaneP2 vandal_a6 (+14 calls / +134344 tris) and vandal_a7 (+4 / +43331) vs mlaneP1 with 0 px on a6: extra off-screen /
  occluded geometry, not a loadout swap. Inferred (not probed): map-strip culling state differs between runs; a DL=1 dump of a6/a7
  would settle it.
