# modes-1: more online game modes + party mode switching (2026-10-26)

## Sources (fetched 2026-10-26)
- Swiftplay https://valorant.fandom.com/wiki/Swiftplay : Bo9 first to 5, halves of 4 rounds (swap after 4), 4-4 -> round 9 Endgame (no win-by-two).
  Ult: every player starts each half with 2 ult points (3 for 9-point ults). No loss-streak bonus. Credits per round in the half,
  same for both teams: R1 800; R2 +2400 (+600 if the team won the previous round); R3 +4250; R4 +4250; Endgame 5000.
- Spike Rush https://valorant.fandom.com/wiki/Spike_Rush : Bo7 first to 4, swap after 3 rounds, pre-round 20 s, round 80 s, every attacker
  carries a Spike. Same random weapon for all each round: R1 any sidearm (Classic Shorty Frenzy Ghost Bandit Sheriff), 0 shields;
  R2 primary <= 2050 (Stinger Spectre Bucky Judge Bulldog Marshal Ares), Light 25; R3 / Endgame primary >= 2250 (Guardian Phantom
  Vandal Outlaw Operator Odin), Heavy 50. All abilities but ult charged every round; ult points from kills and deaths 2 each;
  Endgame: everyone 3 short of ult. Powerup orbs (1-5 per round) each +1 ult point; Full Ultimate orb always in the set.
- Escalation https://valorant.fandom.com/wiki/Escalation : 5v5, 12 levels, 7 team points per level (kill on the team's current level 1,
  on a previous level 0.5), individual weapon level needs >= 1 kill to unlock the next, health pack on the victim 10 s (full hp,
  shields, ammo), random respawn, 10 min or level 12 finished, random agent, abilities removed.
- Replication https://valorant.fandom.com/wiki/Replication : Bo9 first to 5, 80 s rounds, whole team one agent (vote, random among votes),
  every round basics/signature refreshed, +1 ult point per round (not Endgame), weapons and shields reset, credits per round in the
  half regardless of result: 900 / 2400 / 3900 / 6000 (R4 and Endgame). FLASHGUARD: flashed twice in 4 s -> 5 s flash immunity.
  (Removed from live since v7.0; custom-game only.)

## What was built (worktree /workspace/work/valorstrike-modes)
- server/src/modes.js: EscalationSimulation ('esc'), VariantSpikeSimulation (gm 'swift' / 'sr' / 'rep' on a mode-'five' sim), createSim().
- server/src/worker.js: modes dm, tdm, esc always; five, swift, sr, rep only with ENABLE_SPIKE. /health adds `features:['party-mode','queue']`.
  Room messages: `{t:'mode',mode?,map?}` (leader only, lobby only) -> new sim, members re-seated, `welcome{switched:1}` with new ids,
  `room` to all, reply `mo{ok,why}`; `{t:'queue',on:1|0}` -> 5 s countdown in `room.q` (re-broadcast each second), start uses the
  room's mode + map; `qx{why}` when cancelled (mode / map change, leader cancel, leader leaves). `start` (immediate) kept.
  `start` frames carry `gm` (game mode id) beside `mode` (sim mode: esc / five / dm / tdm).
- work/server_runtime.js (PARTY MODES block): /health capability check, leader-only selector + map select in the room, START = queue
  / Cancel queue, countdown text for everyone, notes for cancelled queue / refused change, Escalation on the TDM path with a level HUD,
  Spike variants on the Unrated path with a mode HUD, Spike Rush orbs drawn from round state, Replication switches the page agent.
- index.html: four new Online mode buttons (Escalation, Swiftplay, Spike Rush, Replication); the segment wraps.

## Judgment calls
- Spike variants share Unrated's release gate (ENABLE_SPIKE, remaining-validation row 11). Production /health today offers dm / tdm
  only; after a worker deploy it offers dm / tdm / esc. Swiftplay / Spike Rush / Replication online need the owner to enable Spike.
- The worker is NOT deployed by this work (no wrangler deploy). The page detects the server's modes / features from /health: on the
  current production worker the new buttons stay disabled ("Not offered by the game server yet") and START keeps the immediate start.
- Queue = a 5 s server countdown in the party room (there is no separate matchmaking queue in this game); 'start' stays immediate for
  older pages and tools.
- A mode change re-seats every member in a new simulation (new unit ids are sent); teams are kept between team modes.
- Escalation: ladder = the offline page's 12 weapons (no Snowball Launcher / ability / Big Knife levels: not in this game); final
  Knife level ends on 1 point (offline parity; the wiki's 7 points per level is used for levels 1-11); individual levels need a kill;
  0.5 points for a kill behind the team level; agents are the players' picks (the live mode randomises them); no Escalation health
  packs yet (fog-spec-3 is adding DM packs to simulation.js; to be reused for Escalation after it lands: open item).
- Swiftplay: the wiki round table is applied at the START of each round (R2 +2400, +600 to the round-1 winners; R3 / R4 +4250;
  Endgame set 5000); kill (+200) and plant (+300) money stays; Endgame side drawn at random; second half resets abilities as
  Unrated's round 13 and sets ult to 2 (3 for 9-point ults).
- Spike Rush: "every attacker carries a Spike" is modelled as the one Spike moving to whichever living attacker stands in a site (as
  the offline page does); orbs = ult orbs only (+1, one Full Ultimate per round), not the other powerup effects; kill / death ult
  points doubled by counting kills and deaths again each tick (ability kills included).
- Replication: team agent = random among the team's human picks (bots' agents when no human); a late joiner takes the team agent;
  FLASHGUARD clears a blind applied during the guard on the next 50 ms tick. Offline Replication not added (not cheap: agent select).
- Offline: Swiftplay, Spike Rush and Escalation already existed offline; unchanged.
