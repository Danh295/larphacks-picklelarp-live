#!/usr/bin/env bash
# Creates labels and one GitHub issue per ticket in SPEC.md. Run once from the repo root.
set -euo pipefail

gh label create track-cv --color 0e8a16 --description "CV pipeline track" 2>/dev/null || true
gh label create track-app --color 1d76db --description "Mac app / UI track" 2>/dev/null || true
gh label create post-hackathon --color 6e7781 --description "After the hackathon" 2>/dev/null || true

issue() { # title, label, body
  gh issue create --title "$1" --label "$2" --body "$3

See SPEC.md for the full contract (landmark format, setup/swing return shapes, test keys)."
}

issue "CV-1 Module split + cuts" track-cv "Move the v1 JS out of index.html into src/ per the SPEC.md layout (src/main.js, src/fx/audio.js, src/fx/effects.js, ...). No behavior change except: delete tennis detection (tennis(), T key, path > 3.2) and Kitchen Police (line setup, inKitchen, citation, rap sheet, challenge, offenses HUD). Keep S/J/U test keys.

Done when: npm/python static server loads the app, S/J/U still work, no references to tennis/kitchen remain in src/.
Unblocks APP-3."

issue "CV-2 Model + vendored assets" track-cv "Vendor @mediapipe/tasks-vision@0.10.35 (wasm/ + vision_bundle.mjs) and pose_landmarker_full.task into vendor/mediapipe/. Use the full model, GPU delegate with CPU fallback, minPoseDetectionConfidence/minPosePresenceConfidence/minTrackingConfidence = 0.65.

Done when: the app loads the model and tracks a person with networking off."

issue "CV-3 One Euro smoothing" track-cv "src/cv/filter.js: OneEuroFilter(minCutoff=1.0, beta=0.02, dCutoff=1.0) per coordinate, using real timestamps. Wrap in a LandmarkSmoother for all 33 landmarks. Reset a landmark's filter if its visibility stays under 0.5 for over 300 ms. D key toggles a debug view (raw in red, smoothed in lime). Export the constants for live tuning.

Done when: node --test passes for the filter (a constant signal with noise has lower variance after filtering, a step input converges within ~300 ms) and the skeleton is visibly steady when standing still."

issue "CV-4 Swing state machine" track-cv "src/cv/swing.js: pure module, update(landmarks, calib, tMs) -> null | { type:'swing', realMph, power, wrist, side, t }.
Track the dominant wrist relative to the shoulder midpoint, normalized by shoulder width, on filtered landmarks.
States: IDLE -> BACKSWING (wrist behind the dominant-side shoulder line for >= 3 frames) -> FORWARD (speed >= threshold toward the front for >= 2 frames, elbow angle >= 120 deg, wrist visibility >= 0.5) -> fire once at peak speed.
1.5 s cooldown; reset to IDLE after 600 ms with no progress. realMph = peak * 0.4 m * 2.237.

Done when: node --test passes with synthetic landmark sequences: a real swing fires exactly once; walking sideways, raising both arms, fidgeting and a non-dominant-hand swing fire 0 times."

issue "CV-5 Broadcast ball arc" track-cv "In src/fx/effects.js the ball launches from the dominant wrist on a fixed parabola (up and toward the far side of the frame). Its y must never go below the launch y. The swing event triggers it; wrist velocity direction must not steer it.

Done when: 20 triggered swings (including the S key) all arc upward and never hit the ground."

issue "CV-6 Setup state machine" track-cv "src/cv/setup.js: pure module, update(landmarks|null, tMs) -> { phase, progress, message, calib }.
WAITING (no pose or ankles not visible) -> ALIGN (nose, shoulders, hips, ankles visibility >= 0.6 for 1 s, hips above knees) -> READY (T-pose held 1.5 s: wrists level with shoulders within 0.25 shoulderW, elbows >= 150 deg) -> CALIBRATE (2 s still to average shoulderW/torso/armLen, then raise the paddle hand above the head for 0.5 s to set dominant) -> LIVE.
No pose for over 3 s at any phase returns to WAITING. L key skips to LIVE with default calibration.

Done when: node --test covers every transition and the 3 s reset."

issue "CV-7 (optional) RTMPose sidecar" track-cv "Only start this if jitter persists after CV-3 has been tested on a real camera. sidecar/ running Python 3.12 via uv, rtmlib RTMPose-m, COCO-17 keypoints streamed over a WebSocket, with a source switch in src/cv/pose.js. Needs a ~100 MB ONNX download on first run and a second process Electron must spawn."

issue "APP-1 Electron shell" track-app "package.json with 'npm start' (electron .). electron/main.js: serve the repo root from a 127.0.0.1 ephemeral-port static server (secure context so ES modules and the camera work), allow the 'media' permission via session.setPermissionRequestHandler, F toggles fullscreen, hide the menu. Works against the current index.html; no dependency on CV-1.

Done when: npm start opens a window and the camera starts."

issue "APP-2 Packaging" track-app "npm run package via @electron/packager -> dist/PickleLARP Live-darwin-arm64/PickleLARP Live.app with extendInfo NSCameraUsageDescription and an app icon. dist/ in .gitignore.

Done when: double-clicking the .app opens it, macOS asks for the camera, and it runs."

issue "APP-3 Setup overlay UI" track-app "src/ui/setup-overlay.js: full-screen overlay per phase driven ONLY by the setup.update() return value (phase, progress, message, calib). Big instruction text, T-pose silhouette for READY, a fill ring for progress, calibration countdown, 'YOU ARE LIVE' sting on LIVE. Depends on CV-1 and the contract in SPEC.md; develop against a stub that cycles phases until CV-6 lands.

Done when: every phase renders correctly with the stub and with the real CV-6 module."

issue "APP-4 Copy + docs cleanup" track-app "Remove kitchen and tennis everywhere: README, PLAN.md, the sponsor ticker (NVZ Legal Defense, Kitchen Counter), the intro keys line. README run section for npm start and the .app. Update the PLAN.md demo script and rubric mapping for v2 (setup gesture, swing radar, jumbotron, judge tries it; Usefulness = swing-speed analytics, honest mode, guided setup)."

issue "APP-5 Demo hardening" track-app "After CV-2: run the app with networking off. Rehearse the 2-minute demo twice in the room. Record the threshold values that worked (swing threshold, filter constants) in a comment on this issue."

issue "POST-1 Swift/SwiftUI + Apple Vision native port" post-hackathon "Native macOS rewrite with AVCaptureSession + Vision body pose. Not for the 17:45 deadline. Note from research: Vision loses wrist confidence with a racket in hand, and has 19 joints."
