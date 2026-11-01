# PickleLARP Live: plan

Hard cutoff 6:00 PM Toronto. Submit by 5:45. Demo is 2 min live + 2 min Q&A.

## Concept (unchanged after research, no tennis pivot)

Webcam app, one `index.html`. You swing a paddle at air and get a fake ESPN broadcast. Under the joke sits a real kitchen (NVZ) fault detector and a real swing-speed estimate.

Why we kept pickleball: the research found no kitchen-fault or swing-speed product (to verify with an App Store search before claiming it; see `research/sports-software.md`). Pro line calling (Hawk-Eye, Owl AI) is expensive, and no zero-install webcam option turned up. Tennis shows up only as a gag ("TENNIS PLAYER DETECTED").

## Evidence we can cite (hedge it, per the research notes)

- Pickleball 24.3M US players in 2025, +22.8% (SFIA). Tennis 27.3M, ~4.9M first-timers (USTA). Counting methods differ, so don't compare the two.
- Kitchen foot-faults are a documented rule problem (momentum rule), but we have no stats on how often rec players dispute them. Say "commonly argued", never quote a number.
- Imposter syndrome and lesson cost are unsourced. Use them as pitch framing only.

## Build order (cut from the bottom)

1. Webcam + MediaPipe Pose + skeleton overlay (pinned `@mediapipe/tasks-vision@0.10.35`, lite model, mirrored).
2. Kitchen Police: click two points to set the line, heel/foot-index landmarks vs the line, siren + red/blue flash + citation card with face snapshot. The real, useful feature.
3. Swing detection (wrist speed spike) + Inflated Radar Gun (real px/s → mph guess × Confidence Coefficient, toggle shows real number) + grunt.
4. Commentator lines, rising DUPR, fake sponsor ticker.
5. Victory Jumbotron (both wrists above head = confetti + crowd; one wrist = sad clap).
6. Rap sheet → WANTED poster on 3rd offense. TENNIS PLAYER DETECTED.
7. Slow-mo replay, Challenge button.

Cut line: anything past 4 is optional. If behind at 5:00, drop 6 and 7 first, then 5.

## Demo script (2:00)

- 0:00 to 0:20 Serious pitch: fastest growing sport, new players are bad and everyone can tell, so we skipped being good.
- 0:20 to 0:50 Swing at air twice: grunt, 14x mph, commentator, DUPR climbs.
- 0:50 to 1:20 "We also care about the integrity of the game." Step over the taped line: siren, citation with face.
- 1:20 to 1:40 Arms up: jumbotron.
- 1:40 to 2:00 Hand the paddle to a judge.

## Rubric mapping

- Working Product: all live in the browser, no video.
- Usefulness: automatic kitchen-fault detection plus swing-speed estimate. Multiplier is a toggle.
- Theme: LARP as a televised pro.
- Creativity: physical and loud next to chatbots.
- Ease of Use: open the page, allow the camera, swing.
- Demo: the judge swings.
- Sportiner: players (fault + speed), coaches (webcam-only, no sensors), organizers (line-monitor booth).

## Timeline

- by 4:30 core features 1 to 3 working
- 4:30 to 5:00 eat, record commentator lines, features 4
- 5:30 feature freeze
- 5:45 push public repo and submit (team name, members, repo URL)
- Bring painter's tape for the kitchen line.

## Known risks

- Pose speed at 30 fps is a rough estimate, hence the "Confidence Coefficient" framing.
- Paddle in hand degrades wrist landmarks. Test in the demo room.
- Camera needs a side or front view with feet in frame. Test distance in the room.
- Camera permission needs `localhost` or https.
- Sound clips are not sourced yet. Generate with WebAudio so there are no downloads.
