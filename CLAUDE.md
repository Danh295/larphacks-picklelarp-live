# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PickleLARP Live: a webcam pose-tracking app (MediaPipe Pose Landmarker) that turns a swing at air into a fake pro broadcast (ball arc, inflated radar speed, commentator, jumbotron). Hackathon project for two devs split into `track-cv` and `track-app` (GitHub issues #1-#13, labeled). `SPEC.md` is the source of truth for tickets, decisions and the **"Contract between tracks"** section (landmark format, `setup.update()` / `swing.update()` return shapes, test keys). Do not change that contract without telling the other track. `README.md` and `PLAN.md` still describe v1 (Kitchen Police, tennis) until APP-4 lands; trust SPEC.md over them.

## Commands

```
node --test test/                                   # all tests (node:test, no install needed)
node --test test/filter.test.js                     # one file
node --test --test-name-pattern="step input" test/  # one test by name
python3 -m http.server 8000                         # browser fallback; camera + ES modules need localhost/https
npm start                                           # Electron shell
npm run package                                     # unsigned arm64 .app into dist/ (gitignored)
```

No build step, bundler or linter: the browser loads `src/main.js` as native ES modules.

## Architecture

Per-frame pipeline, wired in `src/main.js` (`loop()` -> `process()`):

`detect()` (`cv/pose.js`, returns mirrored display-space pixel landmarks `{x,y,v}`) -> `LandmarkSmoother` (`cv/filter.js`, One Euro) -> `setup.update()` (`cv/setup.js`) -> **only if `phase === 'LIVE'`**: `swing.update()` (`cv/swing.js`) and the inline `jumbotron()` -> `fx/effects.js` (`onSwing`, `boom`, `sad`) -> `fx/audio.js`.

- `src/cv/*` are pure, DOM-free modules driven by explicit timestamps, so they are unit-tested in Node with synthetic landmark sequences. Keep them DOM-free and keep `update()` signatures stable.
- `cv/swing.js` is the phase-gated state machine (CV-4) and `fx/ball.js` the fixed broadcast arc (CV-5). `cv/setup.js` is still a stub (always LIVE with `DEFAULT_CALIB`) until CV-6 lands.
- The filter works in normalized units (x/W, y/H), so its constants are resolution-independent and differ from the numbers in SPEC.md (`BETA` is 8 in code vs 0.02 in the spec). Tune live from the console via `window.PLARP_FILTER`. The `D` key shows raw (red) vs smoothed (lime) joints.
- All MediaPipe assets live in `vendor/mediapipe/` (pinned tasks-vision 0.10.35, full model) so the app works offline; never reintroduce a CDN. Any server must serve `.wasm` as `application/wasm`.
- `src/package.json` and `test/package.json` exist only to set `"type":"module"`.
- Test keys that must keep working: `S` swing, `J` jumbotron, `U` sad clap, `D` debug skeleton (`L` skip-to-LIVE is in the contract but not yet implemented).

## Workflow

One commit per ticket, titled `ID: summary (closes #N)`. `src/main.js` and `index.html` are shared between tracks, so keep edits there small and `git pull --rebase` first.
