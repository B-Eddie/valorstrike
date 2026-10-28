# Skirmish map asset search — 2026-10-28

Status: **blocked; requested map replacement is not implemented**. Usable Skirmish maps found/downloaded/installed: **0**. No gameplay source, generated page, existing asset, package manifest or lockfile was changed. This report is the only added project file. No git commands, pushes or deployments were performed.

The existing standard-map rotation for `skm` is still present. It is not a completed Skirmish map implementation. Replacing it requires an actual obtainable arena mesh and its validated collision, navigation and spawn data; no geometry was fabricated and no standard map was relabeled.

## Compatible project format

Inspected the existing Ascent directory, source attribution, native loader and world builder:

- Browser rendering uses Three.js GLTFLoader on `models/valorant/maps/<key>/scene.gltf`: glTF 2.0, external `geometry-*.bin` buffers and local `textures/` images.
- `collision.bin` starts with two little-endian uint32 counts (vertices, indices), followed by float32 XYZ vertices and uint32 triangle indices. Optional collision patches/exclusions also exist.
- The native loader additionally requires `map.json`, `navigation.json` and `plants.json`. Metadata supplies spawns, world coordinates and navigation; minimap/loading artwork and `source.json` accompany the established layout.
- `work/native_maps_runtime.js` loads these assets; `server/build-world.cjs` creates server collision/BVH assets; `server/build-all.cjs` copies metadata into `server/public/worlds/<key>/`.
- A Blender/FBX/OBJ source could only be usable after conversion to the established scene/data format and validation. Screenshots, minimaps, videos, API map names and Unreal packages alone cannot be dropped into this loader.

Read-only static inspection passed for all six existing maps: every glTF buffer/image URI resolved to a local file; all collision file lengths matched their headers; map/navigation/plant metadata parsed as JSON. This does not certify rendering or gameplay.

## Search and sources

Used web search/open and the connected GitHub search tools. Searches included:

- `Valorant Skirmish map 3d model download glb fbx`
- `Valorant Skirmish A B C map assets download`
- `"valorant" "skirmish" "blend"`, plus `fbx`, `gltf`, `glb` and `obj` variants
- `"valorant" "skirmish" "map port"` and `"asset rip"`
- Targeted searches for Skirmish geometry on GitHub, Sketchfab, ArtStation, Gumroad and Google Drive.
- GitHub repository search `valorant skirmish`; code searches `Skirmish scene.gltf`, `Valorant Skirmish blend` and `Valorant Skirmish glb`.

Findings:

| Source | What was accessible | Asset outcome |
| --- | --- | --- |
| [Tobias Koepp — Valorant: Skirmish](https://tobiaskoepp.artstation.com/projects/Jr105n) | Riot environment artist's project page, warehouse/arena description and labeled images of variants and spawns | Actual Skirmish visual reference; no downloadable geometry found on the accessible page |
| [Michelle Lee — portfolio](https://leem3d.artstation.com/projects) | Portfolio index lists `VALORANT // SKIRMISH` | Project target [lG3wBG](https://leem3d.artstation.com/projects/lG3wBG) failed web open with `Cache miss`; its contents/download availability remain unverified |
| [Kingdom Archives models](https://kingdomarchives.com/models) | Web-readable catalogue of agents, weapons and related models | No Skirmish map download found in accessible catalogue content; sandbox HTTP fetch failed separately |
| [GitHub repository search](https://github.com/search?q=valorant+skirmish&type=repositories) | Connected search returned Skirmish bot/community repositories; code searches returned unrelated models, text references and API documentation | No usable VALORANT Skirmish geometry identified |
| Sketchfab / Gumroad / format-specific searches | No usable Skirmish geometry download identified in returned results; some model-marketplace results concerned standard maps or character models | Nothing compatible to install |

These are bounded search results, not proof that no public port exists anywhere. Riot patch-note findings and the inaccessible established Drive map-source listings supplied in the task were not re-investigated. Their geometry availability remains unverified.

## Exact network failures

The supported environment-status tool was not available in this session. `/etc/codex/network-policy.json` was absent (`No such file or directory`). Existing proxy settings were preserved.

| Sandbox fetch | Result |
| --- | --- |
| `curl -IL --max-time 20 https://kingdomarchives.com/models` | exit 7: `Failed to connect to hatch-egress-proxy port 3128 after 1 ms: Couldn't connect to server` |
| `curl -IL --max-time 20 'https://api.github.com/search/repositories?q=valorant+skirmish'` | exit 7: same proxy connection failure, after 2 ms |
| `curl --fail --show-error --location --max-time 15 --output /tmp/valorstrike-skm-portfolio.html https://tobiaskoepp.artstation.com/projects/Jr105n` | exit 7: same proxy connection failure, after 1 ms; no source asset downloaded |

The independent web-search service and connected GitHub search still returned results. They did not provide a verified downloadable arena file. The connected GitHub fetch tool is documented as text-only and cannot download binary geometry.

## Validation attempted

Node: v24.22.1. This tarball has no installed server dependencies or built server worlds.

| Check | Outcome |
| --- | --- |
| `cd server && node test-release-gate.cjs` | **PASS** |
| `node --check work/server_runtime.js` and `node --check server/src/worker.js` | **PASS** |
| Read-only glTF resource, collision-header/length and metadata JSON checks on all six existing map directories | **PASS**, static checks only |
| `cd server && node test-modes.js` | Could not execute assertions: `ERR_MODULE_NOT_FOUND` for `three` imported by `src/world.js` |
| `cd server && node test-skirmish.js` | Same missing `three` dependency; no Skirmish match assertions executed |
| `node work/test_map_select.cjs` | Could not boot page harness: `ENOENT` for `server/node_modules/three/build/three.cjs` |
| `node work/test_map_select_online.cjs` | Same missing Three.js file; stopped on initial `dm` case |
| `node work/test_client_skirmish.cjs` | Same missing Three.js file; no client Skirmish assertions executed |
| `cd server && npm run build:worlds` | Blocked on first Ascent build: `Cannot find module 'three'`; no worlds generated |
| `cd server && node test-bundle.cjs` | Blocked: `Cannot find module 'esbuild'`; worker bundle not verified |

Dependency recovery attempts:

- Offline `npm ci --offline --no-audit --no-fund --ignore-scripts --cache /tmp/valorstrike-skm-npm-cache` initially failed `ENOTCACHED` on `https://registry.npmjs.org/youch-core/-/youch-core-0.3.3.tgz`.
- Network `npm ci --no-audit --no-fund --ignore-scripts --fetch-retries=0 --fetch-timeout=10000 --cache /tmp/valorstrike-skm-npm-cache` exited 1 with `Exit handler never called!`. Its debug log records `EPERM` fetching tarballs including `https://registry.npmjs.org/three-mesh-bvh/-/three-mesh-bvh-0.7.8.tgz` and `https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz`.
- Copying the existing npm cache to writable `/tmp` hit ownership-preservation errors and `ENOSPC`; a following offline install also failed `ENOSPC`. The temporary copied cache was removed to recover that space. Read-only inspection of the original cache found only 16 of 94 lockfile tarballs, with both `three` and `three-mesh-bvh` missing, so a full offline installation is unavailable.
- Empty `server/node_modules` directories created by the failed installs were removed. Project package files were not modified. npm diagnostic logs remain under `/tmp/valorstrike-skm-npm-cache/_logs/` for this session.

The build cannot be reported as passing. Full map/mode/client suites, native browser rendering and an in-game match were not verified.

## In-game verification and remaining work

There are **no new maps to pick** under Online → Skirmish 1v1 in this tree. Existing standard choices and Random remain unchanged; selecting them does not verify the requested replacement.

To finish: obtain at least one real Skirmish arena source/complete export through a working download path; convert and validate its mesh, collisions, spawn floors and navigation; install it under the established map layout; then constrain `skm` selection, matchmaking and room validation to the installed Skirmish pool while retaining every other mode's pool. Rebuild client output and server worlds, rerun map/mode and release checks, and verify Online → Skirmish 1v1 with two players on each installed map and Random. No server/worker should be deployed as part of this handoff.
