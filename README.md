# PickleLARP Live

You don't need to be good at pickleball. You just need to look like it.

A webcam computer-vision app (MediaPipe Pose, runs entirely on your machine) that turns a rec player into a televised pro. Swing a paddle at air and get a broadcast. Built for LarpHacks (theme: LARP as someone you're not) and the Sportiner Challenge.

## Features

- **Guided setup**: step into frame, T-pose, hold still while it calibrates, raise your paddle hand, and "YOU ARE LIVE". It re-arms when you leave frame, so the next person gets the same flow.
- **Pro Swing Broadcast + Inflated Radar Gun**: dominant-hand swing detection, a ball on a fixed upward broadcast arc, pro grunt, commentator, and a fake ESPN lower-third. Speed is estimated from wrist motion and body proportions, then multiplied by a "Confidence Coefficient". **Honest mode** shows the real number.
- **Victory Jumbotron**: both arms up for confetti and a crowd roar, one arm for a single sad clap.
- A DUPR that only goes up and a sponsor ticker.

## Run it

Desktop app (Electron):

```
npm install
npm start
```

Packaged `.app`:

```
npm run package
open "dist/PickleLARP Live-darwin-arm64/PickleLARP Live.app"
```

Double-click it, allow the camera, click **GO LIVE**. Press `F` for fullscreen.

Browser fallback (camera access needs `localhost` or https):

```
python3 -m http.server 8000
```

Open http://localhost:8000, click **GO LIVE**, allow the camera.

## Setup tips

- Put the laptop 3 to 4 m away with your whole body, feet included, in frame. Good front lighting helps.
- The app walks you through setup on screen (4 steps, shown as STEP 1 OF 4 and so on). Once LIVE, a HOW TO PLAY card lists the moves; press `?` to hide or show it. If you go 8 s without a swing it nudges you.
- A swing is: arm out wide to the side, then whip it across your body. Both arms up = jumbotron, one arm up = sad clap.
- No camera or no body? Test keys: `S` swing, `J` jumbotron, `U` sad clap, `L` skip setup to LIVE, `D` debug skeleton (raw red vs smoothed lime).

## Notes and limits

- Pose-based swing speed is a rough estimate (30 fps camera, paddle in hand degrades wrist tracking). The multiplier is the joke; the detection is real.
- Pinned `@mediapipe/tasks-vision@0.10.35` with the full pose model, vendored in `vendor/mediapipe/` so it works offline. Landmarks are smoothed with a One Euro filter. All sounds are synthesized with WebAudio.
- Research notes are in `research/`, the build plan is in `PLAN.md`, the v2 spec is in `SPEC.md`.
