// MediaPipe Pose Landmarker loading and detection. CV-2 vendors these assets and switches to the full model.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export async function loadPose() {
  const { FilesetResolver, PoseLandmarker } = await import(VISION + '/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(VISION + '/wasm');
  const make = delegate => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
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
