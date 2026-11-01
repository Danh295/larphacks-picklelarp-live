# Pitch

Built for LarpHacks (theme: LARP as someone you're not) and the Sportiner Challenge (players: swing speed; coaches: webcam only, no sensors).

## One-liner

Swing a paddle at air and a webcam turns you into a televised pickleball pro: real swing detection, a flying ball, and a radar gun that is generously wrong.

## The core idea

Most rec players are not good, and most of them know it. The first time you swing in front of strangers you feel like you are pretending. So we made pretending the product. The joke is the multiplier (a fake ESPN broadcast with an inflated speed); the detection under it is real, and Honest mode shows the real number.

## 30-second pitch

Everyone at the pickleball court is LARPing a little. You don't need to be good, you need to look like it. PickleLARP Live opens your laptop webcam, walks you through a four-step setup (frame yourself, T-pose, hold still, raise your paddle hand), and then every swing at air gets a broadcast: the ball flies off your hand along the path your arm took, a commentator calls it, and a lower-third shows a radar-gun speed that has been multiplied by a Confidence Coefficient. Flip on Honest mode and you get your actual estimated speed, plus a swing replay and tips per swing phase. It runs offline on a Mac, with no sensors and no install beyond the app.

## 2-minute pitch (matches the demo script in `PLAN.md`)

- **0:00 to 0:25, serious open.** "Pickleball added about 4.5 million new players last year (SFIA, 2025 activity). Most of them are beginners who feel like they are faking it, and a lesson or a tracking system costs real money." Then: "So we let you fake it properly." Step into frame; the setup flow runs: T-pose, calibration, YOU ARE LIVE.
- **0:25 to 1:05, the swing.** Swing at air twice: grunt, ball arc, commentator, inflated mph, DUPR climbs. Toggle Honest mode: "Same detection, real number. This is the analytics."
- **1:05 to 1:30, the replay.** Press `R`: skeleton replay, scrub to Contact, read the advice. "Rule-based tips from a 2D webcam, so treat them as hints, not a coach." Then both arms up: jumbotron.
- **1:30 to 2:00, hand it over.** Give the paddle to a judge. The setup flow re-arms when the next person steps in. Close: "The multiplier is the joke. The pose tracking is real."

## How it works (5 bullets)

- MediaPipe Pose Landmarker (full model, vendored, runs offline) reads the webcam at about 30 fps.
- A One Euro filter smooths each joint; a setup state machine calibrates to your body (shoulder width, hand side) so thresholds scale to you.
- A phase-gated swing detector fires on a fast wrist burst that crosses the body's centerline. Up/down, pull-in and outward moves are rejected, checked with a seeded fuzz test (see `test/`).
- Speed is estimated from wrist motion relative to body proportions; Confidence Coefficient multiplies it unless Honest mode is on.
- Effects (ball, commentator, lower-third, jumbotron, WebAudio sounds) are layered on top, and a replay recorder keeps landmarks only (no video) for the skeleton replay and per-phase advice.

## What is real vs. what is the joke

| Real | The joke |
| --- | --- |
| Pose tracking, calibration, swing detection (cross-body rule) | The mph multiplier and the radar-gun lower-third |
| Speed estimate shown in Honest mode (rough, 2D) | The commentator, sponsor ticker, jumbotron crowd |
| Rule-based swing tips and phase replay | A DUPR that only goes up |
| Fully offline, no video stored | The ball flying off your hand |

Limits we state up front: 2D webcam pose at about 30 fps is rough, a paddle in hand degrades wrist tracking, and the tips are heuristics.

## Why it fits the rubric

- **Theme:** LARP as a televised pro.
- **Sportiner:** players get swing speed; coaches get a webcam-only, no-sensor way to review a swing.
- **Working product:** live camera, packaged Mac app, no pre-recorded video.
- **Demo:** the judge swings.

## Evidence to cite (hedged)

- US pickleball: 24.3M players in 2025, up 22.8%, about 4.5M new players (SFIA 2026 topline, via summary; primary PDF not opened). Don't compare to the tennis count; the surveys differ.
- We found no zero-install webcam swing-speed product for pickleball in our searches, but we did not do an App Store search. Say "we didn't find one", not "there is none". See `research/sports-software.md`.
- Imposter-syndrome and lesson-cost framing is unsourced. Use it as framing only.

## What's next

- **POST-1:** native Swift/SwiftUI + Apple Vision port.
- **CV-7:** optional RTMPose sidecar if jitter persists on real cameras.
- **Video replay (#16, UX-2):** replay with video frames, not only a skeleton.
- Demo hardening (#12): rehearse in the room and record the thresholds that worked.
