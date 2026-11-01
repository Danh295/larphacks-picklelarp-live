# Tennis and pickleball software: research notes

Budget: 6 web searches, 5 page fetches. Anything without a source is marked UNVERIFIED.

## 1. Existing products

- **SwingVision** (tennis + pickleball). Free download with in-app purchases. Tracks shot speed, depth, accuracy, rally length. Pro adds automated scoring, line calling, unlimited cloud storage. Price conflicts: $179.99/yr or $14.99/mo on the App Store (Singapore storefront), $12.49/mo cited elsewhere. https://apps.apple.com/us/app/swingvision-tennis-pickleball/id989461317 , https://www.imore.com/apps/level-up-your-serve-with-ai-powered-tennis-coaching-iphone-app-swingvision
- **PlaySight SmartCourt**. Camera system with built-in line calling, installed at clubs. USTA reportedly put it on 32 courts at Lake Nona (older source). https://en.wikipedia.org/wiki/PlaySight_Interactive , https://newyorktennismagazine.com/?p=13409
- **Hawk-Eye**. Pro tennis standard. A 2015 source puts installs at up to $80,000 per court for three weeks (dated). https://www.sportsbusinessdaily.com/Journal/Issues/2015/11/30/Research-and-Ratings/Company-Watch.aspx
- **Pickleball line calling (pro)**. Owl AI, using 4K phone or broadcast video, selected by Major League Pickleball and the PPA. https://www.thestar.com.my/sport/others/2025/12/05/pickleball-owl-ai-to-bring-electronic-line-calling-to-pro-pickleball-eyes-wider-sporting-impact , https://danielkaplan.substack.com/p/electronic-line-calling-coming-to
- **PlayReplay**. Raised $12M to extend electronic line calling to lower-level courts and other racquet sports. No confirmed link to PlaySight. https://www.pulse.bot/ai/deals/playreplay-raises-12m-to-expand-electronic-linecalling-tech-66e79cac-c42c-4c9a-8ee5-292e6499727e/
- **DUPR**. Free to join, with a rating from one match and opponent score verification. Paid DUPR+ tier, one source says $19.99/yr. Integrates CourtReserve and Life Time. https://www.dupr.com/post/updated-version-of-dupr-app-now-available-on-ios-and-android , https://www.thedinkpickleball.com/dupr-launches-new-features-pricing-and-free-trial/
- **Pickleheads RateMyGame**. Upload a short game video to get a DUPR rating. https://www.pickleheads.com/blog/ratemygame-announcement
- **PB Vision**. Listed on SourceForge; no features checked. UNVERIFIED. https://sourceforge.net/software/product/PB-Vision/
- **PlayYourCourt, CourtReserve**. No usable features found. CourtReserve appears only as a DUPR integration partner (see DUPR link above). PlayYourCourt NOT RESEARCHED.
- **Kitchen (NVZ) fault detection, swing-speed apps for pickleball**. None found in search. Kitchen rule: 7 ft zone each side of the net, the line counts as part of it. https://www.sportrx.com/blog/pickleball-kitchen-rules/

## Gaps we can exploit

- No pickleball kitchen-fault or swing-speed product surfaced in search. Verify with an App Store search before claiming this in a pitch.
- Pro line calling is camera-heavy and expensive (Hawk-Eye); casual pickleball players have no cheap, no-install option found (inference from the above).
- DUPR is a rating system, not a coaching or form tool. Pose-based feedback is not what DUPR does (inference).
- A browser-only, webcam-only, zero-install pose tool is not represented in these results (inference).

## Build gotchas (MediaPipe Pose)

- **Package version (conflict).** The npm registry `latest` dist-tag returns 1.2.0: https://registry.npmjs.org/@mediapipe/tasks-vision/latest . Search aggregators list 0.10.35: https://depscope.dev/pkg/npm/@mediapipe/tasks-vision . Registry is the primary source, so trust it, but 1.2.0 looks very new. Its registry tarball timestamp suggests late October 2026, which may fail the two-week-old rule. UNVERIFIED publish date. Run `npm view @mediapipe/tasks-vision time --json` and pin a release at least two weeks old.
- **CDN pattern.** The npm page says WASM loads from jsDelivr under `@mediapipe/tasks-vision/wasm`: https://www.npmjs.com/package/@mediapipe/tasks-vision . Standard import form (UNVERIFIED exact URL, substitute your pinned version): `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@VERSION`
- **Model URLs (verified).** All float16.
  - Lite: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
  - Full: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
  - Heavy: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
  - Source: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- **Web usage.** Use `detectForVideo()` for webcam frames. Run detection in a web worker so the UI does not block. Source: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- **Landmark indices (verified).** 15 left wrist, 16 right wrist, 27 left ankle, 28 right ankle, 29 left heel, 30 right heel, 31 left foot index, 32 right foot index. Source: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- **Input sizes (verified).** Detector 224x224, landmarker 256x256. Same source as the indices.
- **Realistic FPS.** No figures published on the page. UNVERIFIED. Measure on target hardware with `performance.now()`.
- **Failure modes.** Lighting, occlusion, camera angle, distance, paddle in hand (wrist and hand landmarks degrade), and mirrored video are all unsourced in this research. Test each one in the target room.
- **Swing speed vs frame rate.** Arithmetic only: at 30 fps a frame is about 33 ms, so a fast wrist can move a long distance between frames. Treat pose-derived speed as a rough estimate.
- **Mirrored video.** Flip the preview with CSS (`transform: scaleX(-1)`) and mirror the overlay x-coordinates the same way. Otherwise left and right landmarks look swapped. UNVERIFIED, from general practice.
