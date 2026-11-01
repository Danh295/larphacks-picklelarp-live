# PickleLARP Live: plan

Hard cutoff 18:45 Toronto on 2026-11-01 (earlier drafts said 17:45; `SPEC.md` timeline still shows the old times). Demo is 2 min live + 2 min Q&A.

## Concept (v2)

Mac app (Electron) with a webcam pose pipeline. You step in, T-pose, calibrate, then swing a paddle at air and get a fake ESPN broadcast. Under the joke sits a real swing-speed estimate and a guided, gesture-gated setup. Full details and tickets are in `SPEC.md`.

Why pickleball: the research found no zero-install webcam swing-speed product (verify with an App Store search before claiming it; see `research/sports-software.md`). Pro tracking (Hawk-Eye, Owl AI) is expensive.

## Evidence we can cite (hedge it, per the research notes)

- Pickleball 24.3M US players in 2025, +22.8% (SFIA). Counting methods differ across sports, so don't compare them.
- Imposter syndrome and lesson cost are unsourced. Use them as pitch framing only.

## Build order (cut from the bottom)

1. Webcam + MediaPipe Pose (full model, vendored) + One Euro smoothing + skeleton overlay.
2. Setup flow: WAITING, ALIGN, READY (T-pose), CALIBRATE, LIVE, with the overlay UI.
3. Swing detection (dominant hand, phase-gated) + Inflated Radar Gun (real mph x Confidence Coefficient, Honest mode toggle) + grunt + fixed-arc ball.
4. Commentator lines, rising DUPR, fake sponsor ticker.
5. Victory Jumbotron (both wrists above head = confetti + crowd; one wrist = sad clap).
6. Electron shell and packaged `.app`.

Cut order if late: packaging (run with `npm start`), the debug view, then overlay polish (plain text).

## Demo script (2:00)

- 0:00 to 0:25 Serious pitch, then step into frame. The setup flow plays: T-pose, calibration, "YOU ARE LIVE".
- 0:25 to 1:05 Swing at air twice: grunt, 14x mph, commentator, DUPR climbs. Toggle Honest mode once for the "real analytics" line.
- 1:05 to 1:30 Arms up: jumbotron.
- 1:30 to 2:00 Hand the paddle to a judge. The setup flow re-arms when the next person steps into frame.

## Rubric mapping

- Working Product: native app, live camera, no video.
- Usefulness: swing-speed analytics, Honest mode, and guided setup that calibrates to the player. Multiplier is a toggle.
- Theme: LARP as a televised pro.
- Creativity: physical and loud next to chatbots.
- Ease of Use: open the app, allow the camera, T-pose, swing.
- Demo: the judge swings.
- Sportiner: players (swing speed), coaches (webcam-only, no sensors).

## Timeline

See `SPEC.md` (freeze 17:30, push 17:40, submit by 17:45 Toronto).

## Known risks

- Pose speed at 30 fps is a rough estimate, hence the "Confidence Coefficient" framing.
- Paddle in hand degrades wrist landmarks. Test in the demo room.
- Camera needs a front view with feet in frame (setup waits for ankles). Test distance in the room.
- Camera permission needs a secure context: the Electron app serves from 127.0.0.1; the browser fallback needs `localhost` or https.
- Sound clips are not sourced yet. Generate with WebAudio so there are no downloads.
