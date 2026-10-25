# Valorstrike authoritative server (unfinished)

Cloudflare Workers Free + SQLite Durable Objects. Do not upgrade or add a card.

Current endpoint: https://valorstrike-game.itsmybirthdayim7.workers.dev

DM/TDM prototype consumes control inputs only. Movement, collision, weapon cadence,
ammo, reload, hit rays, damage and scoring run on the server. Client-reported damage,
positions, score and credits are ignored. This does not prevent aim assistance,
multiple identities or denial of service.

## Build and test

```
npm ci
npm run build:worlds
npm test
npm run test:client
npm run dev
```

`build:worlds` derives immutable collision buffers/BVHs from the repository's map
collision files. It preserves source triangles inside the playable bounds and
removes exact duplicate triangles. Raw source scenes are not loaded in a room.
Generated world assets are not checked into git.

The dev command runs locally, allows loopback browser origins and enables the local Spike prototype. Serve the repository root separately (for example, `python3 -m http.server 8876 --bind 127.0.0.1`). On localhost the browser uses port 8787 for rooms and prebuilt collision assets.

Spike is disabled by default in deployed source. Only an explicit `ENABLE_SPIKE=true` binding enables it; keep that binding unset until its release gate passes. `ALLOW_LOCAL_ORIGIN=true` is a local development flag and must stay unset in production.

Deploy only after tests, load checks and explicit plan verification. A prebuilt
world consumes 19-51 MB of typed buffers, plus application/runtime overhead. Live
DM/TDM rooms on all six maps passed short 10-unit snapshot tests. That is not a
concurrency/capacity guarantee. Free quota exhaustion stops service.

Local Spike rounds/economy/abilities, signature recharge, Sage barriers/heal/resurrection and flash facing/LOS have unit and socket tests but remain disabled in the deployed mode list. Natural DM/TDM completed-result persistence was verified; QA identities are excluded from the public board.

Open work: rendered gameplay performance/crash, full Spike browser regression, ability/device parity,
identity/abuse limits, full browser two-client and map/weapon QA. Firebase remains
locked. Never accept host/browser results as verified statistics.

Full remaining acceptance checklist: [../work/remaining-validation.md](../work/remaining-validation.md). Browser barrier snapshots own client visual lifetime; isolated adapter tests do not establish integrated visual parity.
