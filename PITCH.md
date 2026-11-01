# PickleLARP Live: pitch

Built for LarpHacks (theme: LARP as someone you're not) and the Sportiner Challenge (players: swing speed; coaches: webcam only, no sensors).

## Overview (the 20-second version)

- **The problem:** most rec pickleball players are beginners who feel like they are pretending, and the tools that measure a swing are paid subscriptions or camera rigs.
- **The product:** a Mac app that uses only the laptop webcam. You do a 4-step guided setup, then swing a paddle at air and get a fake televised broadcast: a ball flying off your hand, a commentator, a radar-gun speed, a DUPR that only goes up.
- **The twist:** the joke is the multiplier; the tracking under it is real. Honest mode shows the actual estimated speed, and a skeleton replay gives rule-based tips for each phase of the swing.
- **Why it works as a demo:** nothing is pre-recorded. A judge picks up the paddle, the setup re-arms for them, and they swing.
- **Status:** working, packaged, fully offline, no video stored. Rough edges are listed under "Limits" below, and we state them up front.

## One-liner

Swing a paddle at air and a webcam turns you into a televised pickleball pro: real swing detection, a flying ball, and a radar gun that is generously wrong.

## The core idea

Most rec players are not good, and many know it. The first time you swing in front of strangers you can feel like you are pretending. So we made pretending the product. The joke is the multiplier (a fake ESPN broadcast with an inflated speed); the detection under it is real, and Honest mode shows the real number.

## 30-second pitch

Everyone at the pickleball court is LARPing a little. You don't need to be good, you need to look like it. PickleLARP Live opens your laptop webcam, walks you through a four-step setup (frame yourself, T-pose, hold still, raise your paddle hand), and then every swing at air gets a broadcast: the ball flies off your hand along the path your arm took, a commentator calls it, and a lower-third shows a radar-gun speed that has been multiplied by a Confidence Coefficient. Flip on Honest mode and you get your actual estimated speed, plus a swing replay with a tip for each phase of the swing. It runs offline on a Mac, with no sensors and no video stored.

## 2-minute pitch (matches the demo script in `PLAN.md`)

- **0:00 to 0:25, serious open.** "SFIA's latest report counts about 24 million US pickleball players, with roughly 4.5 million of them new in 2025. Most beginners feel like they are faking it, and the apps that measure your swing are paid subscriptions." Then: "So we let you fake it properly." Step into frame; the setup flow runs: T-pose, calibration, YOU ARE LIVE.
- **0:25 to 1:05, the swing.** Swing at air twice: grunt, ball arc, commentator, inflated mph, DUPR climbs. Toggle Honest mode: "Same detection, real number. This is the analytics."
- **1:05 to 1:30, the replay.** Press `R`: skeleton replay, jump to Contact, read the advice. "Rule-based tips from a 2D webcam, so treat them as hints, not a coach." Then both arms up: jumbotron.
- **1:30 to 2:00, hand it over.** Give the paddle to a judge. The setup flow re-arms when the next person steps in. Close: "The multiplier is the joke. The pose tracking is real."

Delivery notes: keep the open deadpan, let the first swing land before explaining anything, and say the limits yourself (below) before a judge finds them.

## How it works (5 bullets)

- MediaPipe Pose Landmarker (full model, vendored, runs offline) reads the webcam at about 30 fps.
- A One Euro filter smooths each joint; a setup state machine calibrates to your body (shoulder width, hand side) so thresholds scale to you.
- A phase-gated swing detector fires on a fast wrist burst that crosses the body's centerline. Up/down, pull-in and outward moves are rejected. This was checked with a seeded fuzz test on synthetic motion (0 of 200 false fires per non-swing family, 200 of 200 swings detected); it has not been measured on many real people.
- Speed is estimated from wrist motion relative to body proportions; the Confidence Coefficient multiplies it unless Honest mode is on.
- Effects (ball, commentator, lower-third, jumbotron, WebAudio sounds) are layered on top, and a replay recorder keeps landmarks only (no video) for the skeleton replay and per-phase advice.

## What is real vs. what is the joke

| Real | The joke |
| --- | --- |
| Pose tracking, calibration, swing detection (cross-body rule) | The mph multiplier and the radar-gun lower-third |
| Speed estimate shown in Honest mode (rough, 2D) | The commentator, sponsor ticker, jumbotron crowd |
| Rule-based swing tips and phase replay | A DUPR that only goes up |
| Fully offline, no video stored | The ball flying off your hand |

Limits we state up front: 2D webcam pose at about 30 fps is rough, a paddle in hand degrades wrist tracking, the tips are heuristics (not from a coaching source), and the app is unsigned, so another Mac may need right-click then Open.

## Likely questions (2 minutes of Q&A)

- **How accurate is the speed?** Rough. It is estimated from wrist motion and body proportions in 2D at about 30 fps, so treat Honest mode as a ballpark, not a radar gun. The inflated number is the joke; we label it.
- **What stops it firing when I just wave?** A swing has to be a fast wrist burst that crosses the centerline of your body. Up/down, pull-in and outward moves are rejected. We tested that on synthetic motion with a seeded fuzz loop; real-person testing is still limited.
- **Do you store video?** No. Pose runs locally and offline; the replay keeps only landmark coordinates for the last few swings.
- **Is the coaching real coaching?** No. It is rule-based tips from pose geometry, and the app says so. It is a starting point for a coach to build on, not a replacement.
- **Why not a native or server-side model?** Speed to build and zero-install. A native Swift/Apple Vision port is the planned next step, and an RTMPose sidecar is the fallback if jitter is a problem on other cameras.
- **Does anything like this exist?** We didn't find a zero-install webcam swing-speed product for pickleball in our searches, but we did not do an App Store search, so we won't claim there is none.

## Why it fits the rubric

- **Theme:** LARP as a televised pro.
- **Sportiner:** players get swing speed; coaches get a webcam-only, no-sensor way to review a swing.
- **Working product:** live camera, packaged Mac app, no pre-recorded video.
- **Demo:** the judge swings.

## Evidence to cite (hedged)

- US pickleball: 24.3M players in 2025, up 22.8%, about 4.5M new players (SFIA 2026 topline, via a summary; the primary PDF was not opened). Say "SFIA reports", and don't compare to the tennis count because the surveys differ. Source notes: `research/industry.md`.
- Tracking apps: SwingVision is a paid subscription, and sources disagree on the price (about $12.49 to $14.99 a month, or $179.99 a year). Say "paid subscription" and don't quote a number. See `research/sports-software.md`.
- We found no zero-install webcam swing-speed product for pickleball in our searches, but we did not do an App Store search. Say "we didn't find one", not "there is none".
- The imposter-syndrome and lesson-cost framing is unsourced. Use it as framing only.

## What's next

- **POST-1:** native Swift/SwiftUI + Apple Vision port.
- **CV-7:** optional RTMPose sidecar if jitter persists on real cameras.
- **Video replay (#16, UX-2):** replay with video frames, not only a skeleton.
- **Demo hardening (#12):** rehearse in the room and record the thresholds that worked.
