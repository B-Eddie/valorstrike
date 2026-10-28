# Map/motor diagnostics

Run from anywhere (`node server/tools/<script>`); each script resolves paths relative to `server/`.

- `view-map.mjs map x y z heading pitch out.png` — software ray-cast view of a map's render meshes. Magenta = void (nothing drawn). Includes the runtime backdrop skirt unless `NOSKIRT=1`; prints total and below-horizon void fraction. `loadVisual`, `loadSkirt`, `view`, `png` are exported for tests.
- `eval-visual-holes.mjs [nodes] [maps…]` — below-horizon void survey from sampled playable nodes, raw meshes vs. with skirt (far 500/fog 260 and far 200/fog 90). Exits non-zero if any void remains with the skirt.
- `eval-floor-patches.mjs [maps…]` — walkable collision triangles with no render floor above them (`WRITE=1` writes `floor-patches.bin`). Currently 0 on all six maps, so no patches ship.
- `eval-holes.mjs [samples] [maps…]` — motor walks along flat nav edges, reporting fall-throughs.
- `eval-fall.mjs [walks] [maps…]` — random-walk fall survey (`MOTOR=path` to compare motors).
- `../eval-stairs.mjs [motor] [limit]` — step-up success on rising nav edges.
- `map-render-floors.mjs [maps…]` — appends render-only floors the exporter dropped from collision (Lotus C water floor, `/Water/` objects) plus the void pockets listed in `map-void-fill.json` (floor inside the official footprint, 3 m invisible wall boxes outside) to `collision-patch.bin`. Idempotent; `test-render-floors.js` checks it.
- `map-render-walls.mjs [maps…]` — solid render walls the exporter's object-name filter (/Water|Light|Shadow|Floater|…/) kept out of `collision.bin` (Lotus C Mound west rock wall, C Hall / C Site temple walls, Breeze Mid Bottom stall): render-only triangles of solid materials within reach of the playable navigation with no collision within 5 cm are appended to `collision-patch.bin` (repeats to a fixed point; idempotent). Shipped for lotus and breeze; `WRITE=0` dry run. `test-render-walls.js` checks it.
