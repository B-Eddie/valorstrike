# Native third-person body follow (main)

Automated rendered smoke check completed in headless Chromium using the page's Three.js r149 and r147 loader/utilities. `work/browser_tp_body.cjs` uses the real page, packed locomotion assets, `xvAgent`, contact correction and crouch IK. Jett, Sage and Breach have zero measured waist gap and a 0.45 m crouch head drop after jogging, with no page errors. Jett idle, jog, strafe and crouch captures and numeric results are in `work/validation/tp-body-browser/`.

Re-run with `PW_MODULE` pointing to an installed `playwright-core`, `CHROMIUM_PATH` pointing to Chromium, and optionally `THREE_QA_DIR` containing `three-149` and `three-147` npm packages for local script interception:

```sh
node work/browser_tp_body.cjs
```

The smoke check renders isolated native bodies. These gameplay checks remain manual:

- [ ] Check all 12 agents in a real match from front, side and back while idling, jogging, strafing, backpedaling and crouch-walking. Inspect coat/belt seams, especially Phoenix, Reyna and Raze.
- [ ] Jog, crouch, stand and repeat; check head height and both planted soles on flat ground, stairs, slopes and ledges.
- [ ] Repeat with rifle, pistol and knife, weapon skins, reload/cast/plant transitions, aim pitch extremes, and ragdoll deaths.
- [ ] Check lobby agent switching and drag rotation, distance/visibility animation throttling, and online remote crouch/strafe updates.
- [ ] Review shared server head-volume calibration against the lower rendered standing heads (Sage has the largest difference). The authored jog remains lower than standing.

Node regressions sample all 12 packed native rigs and actual waist skin edges. They complement these gameplay checks; they do not cover terrain, network interpolation or manual appearance review.
