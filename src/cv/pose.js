// MediaPipe Pose Landmarker. All assets are vendored in vendor/mediapipe (tasks-vision 0.10.35,
// pose_landmarker_full) so the app runs with networking off.
const BASE = new URL('../../vendor/mediapipe/', import.meta.url).href;
const MODEL = BASE + 'pose_landmarker_full.task';

// Confidence knobs, exported for live tuning.
export const CONF = 0.65;

export async function loadPose() {
  const { FilesetResolver, PoseLandmarker } = await import(BASE + 'vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(BASE + 'wasm');
  const make = delegate => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: CONF,
    minPosePresenceConfidence: CONF,
    minTrackingConfidence: CONF
  });
  try { return await make('GPU'); }
  catch (e) { console.warn('GPU failed, using CPU', e); return await make('CPU'); }
}

// Runs detection and returns 33 mirrored display-space {x,y,v} landmarks, or null.
export function detect(landmarker, video, nowMs, W, H) {
  const res = landmarker.detectForVideo(video, nowMs);
  const L = res && res.landmarks && res.landmarks[0];
  if (!L) return null;
  return L.map(p => ({ x: (1 - p.x) * W, y: p.y * H, v: p.visibility == null ? 1 : p.visibility }));
}
