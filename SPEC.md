# PickleLARP Live v2: spec

Mac app + refined CV pipeline. Submit deadline: 17:45 Toronto, 2 devs, each with their own Claude, working from GitHub issues.

## Why

v1 (`index.html`) works as a browser demo but has four problems:
1. Pose skeleton is jittery.
2. Swings fire on random motion, and the ball sometimes flies into the ground.
3. "Tennis player detected" fires randomly.
4. The app goes live immediately on launch, before the player is in position.

## Decisions (settled)

- **Shell:** Electron now (`npm start`, then a packaged `.app`). A Swift/Apple Vision port is post-hackathon (POST-1).
- **Pose:** MediaPipe Pose Landmarker **full**, GPU delegate (CPU fallback), all confidence thresholds 0.65. Smooth every landmark with a **One Euro filter** (the tasks-vision API has no smoothing option). RTMPose via a Python sidecar is an optional fallback (CV-7), only if jitter persists.
- **Swings:** dominant hand only, a phase-gated state machine, and a ball that always flies on a fixed upward broadcast arc.
- **Cut entirely:** tennis detection, Kitchen Police (line, citation, rap sheet, challenge, offenses HUD).
- **Setup:** gesture-gated flow WAITING → ALIGN → READY (T-pose) → CALIBRATE → LIVE.
- **Tracking:** this file plus one GitHub issue per ticket, labeled `track-cv` / `track-app`.

Environment: Node 25, Xcode. No Rust (so no Tauri). Python 3.14 has no mediapipe wheels (use 3.12 via `uv` if CV-7 is ever needed).

## Target layout

```
index.html              markup + CSS only, loads src/main.js as a module
src/main.js             camera, loop, wires modules together
src/cv/pose.js          PoseLandmarker load (vendored assets), detect → raw landmarks
src/cv/filter.js        OneEuroFilter + LandmarkSmoother (33 × x,y)
src/cv/swing.js         pure swing state machine: update(frame, calib, t) → event|null
src/cv/setup.js         pure setup state machine: update(frame, t) → {phase, progress, message, calib}
src/cv/geometry.js      angle, distance, shoulder width, torso, isTPose, isStill, armsUp
src/fx/audio.js         WebAudio synth + speech
src/fx/effects.js       ball arc, confetti, jumbotron, lower-third
src/ui/setup-overlay.js renders setup phases
vendor/mediapipe/       wasm/ + pose_landmarker_full.task (no CDN on stage)
electron/main.js        BrowserWindow, 127.0.0.1 static server, media permission handler
test/*.test.js          node:test on the pure cv modules with synthetic landmark sequences
```

## Contract between tracks

Do not change these without telling the other track.

- Landmarks are display-space (mirrored) arrays of 33 `{x, y, v}` (pixels, visibility 0..1).
- `setup.update(landmarks|null, tMs)` returns
  `{ phase: 'WAITING'|'ALIGN'|'READY'|'CALIBRATE'|'LIVE', progress: 0..1, message: string, calib: { shoulderW, torso, armLen, dominant: 'l'|'r' } | null }`.
- Optional, additive: `setup.update()` also returns `stage: 'still' | 'raise' | null`. During CALIBRATE it says which of the two steps (hold still 2 s, then raise the paddle hand) is running, because `progress` restarts for each; it is `null` in every other phase. UIs must tolerate it being absent.
- `calib` values (`shoulderW`, `torso`, `armLen`) are display-space pixels, measured on the same frame as the landmarks. `DEFAULT_CALIB` is a pixel estimate for 1280x720.
- `swing.update(landmarks, calib, tMs)` returns `null` or
  `{ type: 'swing', realMph, power: 0..1, wrist: {x, y}, side: 'l'|'r', t }`.
- Swing and jumbotron detection run only when `phase === 'LIVE'`.
- Test keys that must keep working: `S` swing, `J` jumbotron, `U` sad clap, `L` skip to LIVE with default calibration, `D` toggle debug skeleton.

## Tickets

Issue numbers are assigned by `scripts/create-issues.sh`. Titles are the canonical IDs.

### Track CV

- **CV-1 Module split + cuts.** Move the v1 JS out of `index.html` into the layout above with no behavior change, except delete tennis (`tennis()`, `T` key, `path > 3.2`) and Kitchen Police (line setup, `inKitchen`, citation, rap sheet, challenge, offenses HUD). Keep `S`/`J`/`U`. Unblocks APP-3.
- **CV-2 Model + vendored assets.** Vendor `@mediapipe/tasks-vision@0.10.35` `wasm/` + `vision_bundle.mjs` and `pose_landmarker_full.task` into `vendor/mediapipe/`. Full model, GPU with CPU fallback, thresholds 0.65. App loads with networking off.
- **CV-3 One Euro smoothing.** `OneEuroFilter(minCutoff=1.0, beta=0.02, dCutoff=1.0)` per coordinate, timestamped. Reset a landmark's filter if its visibility is under 0.5 for over 300 ms. `D` toggles a debug view (raw red, smoothed lime). Constants exported for live tuning.
- **CV-4 Swing state machine.** Dominant wrist relative to the shoulder midpoint, normalized by shoulder width, on filtered landmarks. IDLE → BACKSWING (wrist behind the dominant-side shoulder line ≥ 3 frames) → FORWARD (speed ≥ threshold toward the front ≥ 2 frames, elbow ≥ 120°, wrist visibility ≥ 0.5) → fire once at peak. 1.5 s cooldown, reset to IDLE after 600 ms without progress. `realMph = peak × 0.4 m × 2.237`.
- **CV-5 Broadcast ball arc.** Ball launches from the dominant wrist on a fixed parabola (up, toward the far side of the frame). Its y never goes below the launch y. The swing event triggers it; wrist velocity direction does not steer it.
- **CV-6 Setup state machine.** WAITING (no pose or ankles not visible) → ALIGN (nose, shoulders, hips, ankles visibility ≥ 0.6 for 1 s, hips above knees) → READY (T-pose held 1.5 s: wrists level with shoulders ±0.25 shoulderW, elbows ≥ 150°) → CALIBRATE (2 s still to average shoulderW/torso/armLen, then raise the paddle hand above the head for 0.5 s to set `dominant`) → LIVE. No pose for over 3 s at any phase returns to WAITING.
- **CV-7 (optional) RTMPose sidecar.** Only if jitter persists after CV-3 is tested on camera. `sidecar/`, Python 3.12 via `uv`, rtmlib RTMPose-m, COCO-17 keypoints over a WebSocket, source switch in `pose.js`.

### Track APP

- **APP-1 Electron shell.** `package.json` with `npm start`. `electron/main.js` serves the repo root from a `127.0.0.1` ephemeral-port static server (secure context), allows the `media` permission via `session.setPermissionRequestHandler`, fullscreen on `F`, menu hidden. Works against the current `index.html`.
- **APP-2 Packaging.** `npm run package` via `@electron/packager` → `dist/PickleLARP Live-darwin-arm64/PickleLARP Live.app` with `NSCameraUsageDescription` and an icon. `dist/` gitignored. Double-click opens, asks for the camera, runs.
- **APP-3 Setup overlay UI.** Depends on CV-1 and the contract. Full-screen overlay per phase: large instruction text, T-pose silhouette for READY, fill ring driven by `progress`, calibration countdown, "YOU ARE LIVE" sting. Driven only by the `setup.update()` return value.
- **APP-4 Copy + docs cleanup.** Remove kitchen and tennis from README, PLAN.md, the sponsor ticker and the intro keys line. README run section for `npm start` and the `.app`. Update the PLAN.md demo script and rubric lines for v2.
- **APP-5 Demo hardening.** Offline run check after CV-2. Rehearse the 2-minute script twice in the room and record the threshold values that worked.

### Post-hackathon

- **POST-1 Swift/SwiftUI + Apple Vision native port.**

## v2 demo script (2:00)

- 0:00 to 0:25 Serious pitch, then step into frame. The setup flow plays: T-pose, calibration, "YOU ARE LIVE".
- 0:25 to 1:05 Swing at air twice: grunt, 14x mph, commentator, DUPR climbs. Toggle Honest mode once for the "real analytics" line.
- 1:05 to 1:30 Arms up: jumbotron.
- 1:30 to 2:00 Hand the paddle to a judge. The setup flow re-arms when the next person steps into frame.

## Timeline

- 16:35 CV-1 ∥ APP-1
- 16:50 CV-2, CV-3 ∥ APP-2
- 17:05 CV-4, CV-5 ∥ APP-4
- 17:15 CV-6 ∥ APP-3
- 17:30 freeze, camera test, tune constants
- 17:40 push, submit by 17:45

Cut order if late: APP-2 (run with `npm start`), then the CV-3 debug view, then APP-3 polish (plain text overlay).

## Verification

- `node --test test/*.test.js` passes (filter, swing, ball, setup). Use the glob: `node --test test/` fails on Node 25.
- `npm start` opens the window, the camera works, the setup flow reaches LIVE with a real person.
- Camera checklist (record results in the ticket): swings fire 5/5 real, 0/5 fidgets and walks; ball always arcs upward; still skeleton is steady in the `D` view; leaving frame for over 3 s returns to WAITING.
- Network off: the app still loads the model.
