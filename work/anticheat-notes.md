# Anti-cheat research, unfinished

Verified public pricing sources:
- https://vercel.com/docs/plans/hobby : Hobby free tier, 1,000,000 included function invocations; usage limits can pause service. Account eligibility and application runtime suitability remain unverified.
- https://developers.cloudflare.com/workers/platform/pricing/ : Workers Free includes 100,000 requests/day and 10 ms CPU per invocation. Historical pre-provisioning finding; superseded by the verified Free plan below.

The prior proposed event-stream referee was not authoritative. Clients can fabricate causally plausible events, create multiple anonymous identities, and simulate opponents. Cross-checking two client reports does not establish real participants or server-computed outcomes. Do not implement or describe this as authoritative protection.

For authoritative results, trusted compute must own the game simulation, consume input commands rather than claimed outcomes, validate movement/fire/collision against server state and derive damage, kills and round results itself. Authentication alone is not anti-cheat. Free hosting feasibility, persistent state/concurrency, runtime limits, and deployment authority still need investigation. No strongest-free claim is supported.

Firebase database remains locked; no rules have been published. No match results should be accepted from browsers or browser hosts as verified. Presence and rooms are a separate feature and may be advertised only as live connections/room advertisements, not proof of active humans or verified matches.


## Current prototype, October 24

Cloudflare Workers Free was approved and provisioned on the user's Google SSO.
The verified dashboard showed Free $0 Current plan, without a card.
https://dash.cloudflare.com/43a99f29616fa11c066298d4877d3382/workers/plans

Deployed endpoint: https://valorstrike-game.itsmybirthdayim7.workers.dev
Source: server/. Browser adapter: work/server_runtime.js, generated into index.
The prototype simulates DM/TDM on trusted compute from control commands, traces
shots against immutable prebuilt collision and server unit volumes, and derives
ammo, damage and scores. It ignores client position/damage/score claims.

Limits: no aim-assistance prevention, anonymous devices can create alternate
identities, no durable user recovery, server Spike is local-only and unfinished, no confirmed
concurrent room capacity. The public leaderboard is all-time completed server
DM/TDM results INCLUDING bot kills. It is not a ranked human-only leaderboard.
A natural live Lotus TDM completion persisted 0 K / 4 D / 1 match / 1 win for the QA identity; a separate fresh GET confirmed it. QA identities are excluded from the public board. Firebase stays
locked. Do not treat the working transport as completion of the original queue.

Checks: local authority tests and two-WebSocket integration; all six live maps
passed 10-unit finite snapshots; a live Ascent room produced 600 snapshots in
31.35s. Node ping test: 11-14ms round trip. Browser multi-second ping was real
render/main-thread backlog, not server gameplay quality. Turning render off
recovered ~60fps/50-59ms ping. Corpse wall-time expiry added; actual rendered path
still needs testing. In-invocation runtime clocks returned zero CPU duration, so
zero values were rejected as CPU evidence. No capacity/CPU claim is supported.

Current live service version 3d13e49d-ab46-4135-b8e6-94bebd6339da. Spike disabled live; local Spike unit/socket tests cover economy, round state, plant/half-defuse, finite reserve, equip locks and basic ability authority. Full device/ult/penetration parity remains open.
