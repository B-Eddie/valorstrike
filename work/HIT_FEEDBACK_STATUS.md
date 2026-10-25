# Hit-feedback checkpoint — 25 October 2026

Implemented localized, depth-tested body/head impacts using a fixed pool, with effects following the struck character bone. Whole-character red emissive flashes are disabled. Online predicted contact produces only a tiny spark; damage confirmation comes from a server hit event, with separate head/body information. Confirmed online kills trigger the existing kill feedback. Optional damage-number layout work is skipped when disabled; kill animation restarts no longer force layout.

Reference: Riot’s [hit registration explanation](https://playvalorant.com/en-us/news/dev/the-state-of-hit-registration/) and [1.07 impact update](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-07/). These establish the attachment, prediction and confirmation behavior; this implementation uses original procedural effect geometry.

Verified: hit-impact pool, movement/crouch attachment, occlusion settings, cleanup, malformed events, prediction versus confirmation, no double emission; existing hit-performance and combat-consistency regressions; all 29 server regression files in the completed server run. Page regeneration is byte-identical and syntax/diff checks pass.

Pending: rendered impact tuning (the preview loader URL was corrected but has not been visually accepted), real online hit/headshot confirmation and bandwidth checks, and matching client/server deployment. This checkpoint is not a release sign-off.

## Bots following the same routes and bunching

Investigation found that the native-map goal override directs attackers to the same site point, overriding much of their personality variation. `vendor/bot-routes.cjs` is an unfinished routing/spacing utility. It is **not wired into gameplay** and is not a completed bot fix. Next work: distinct reachable approach/hold positions, crowd-aware routing and local separation, preserving exact plant/defuse/retrieval behavior; test chokepoints and actual six-map movement.
