# PickleLARP Live

You don't need to be good at pickleball. You just need to look like it.

A webcam computer-vision app (MediaPipe Pose, runs entirely in the browser) that turns a rec player into a televised pro. Swing a paddle at air and get a broadcast. Step over the taped kitchen line and get ticketed. Built for LarpHacks (theme: LARP as someone you're not) and the Sportiner Challenge.

## Features

- **Kitchen Police**: tape a line on the floor, click its two ends and a point inside the kitchen. If a heel or foot lands in the kitchen: siren, red/blue flash, and a citation with your face. Challenge the call (it always stands). Three offenses and you're WANTED.
- **Pro Swing Broadcast + Inflated Radar Gun**: wrist-speed swing detection, a flying ball, pro grunt, commentator, and a fake ESPN lower-third. Speed is estimated from wrist motion and torso length, then multiplied by a "Confidence Coefficient". **Honest mode** shows the real number.
- **Victory Jumbotron**: both arms up for confetti and a crowd roar, one arm for a single sad clap.
- A DUPR that only goes up, a sponsor ticker, and "TENNIS PLAYER DETECTED" for big full-arm swings.

## Run it

Camera access needs `localhost` or https:

```
python3 -m http.server 8000
```

Open http://localhost:8000, click **GO LIVE**, allow the camera.

## Setup tips

- Put the laptop 3 to 4 m away with your whole body, feet included, in frame. Good front lighting helps.
- Press **Set kitchen line** and click: end 1, end 2, then any point inside the kitchen.
- No camera or no body? Test keys: `S` swing, `K` kitchen fault, `J` jumbotron, `U` sad clap, `T` tennis.

## Notes and limits

- Pose-based swing speed is a rough estimate (30 fps camera, paddle in hand degrades wrist tracking). The multiplier is the joke; the detection is real.
- Pinned `@mediapipe/tasks-vision@0.10.35`, pose_landmarker lite model, loaded from CDN. All sounds are synthesized with WebAudio.
- Research notes are in `research/`, the build plan is in `PLAN.md`.
