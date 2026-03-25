import type { AppState } from './state';
import { computeCompositingLayout, render, setLoopParams, type CompositingInfo } from './renderer';

export interface VideoExportOptions {
  fps: number;         // frames per second (default 30)
  onProgress?: (progress: number) => void; // 0→1
}

/**
 * Records exactly one loop cycle of the animation as a WebM video.
 * Renders frames offline (not tied to rAF), so the result is smooth
 * regardless of actual rendering speed.
 *
 * Returns a Blob URL that auto-downloads.
 */
export async function exportVideo(
  canvas: HTMLCanvasElement,
  state: AppState,
  comp: CompositingInfo,
  options: VideoExportOptions = { fps: 30 },
): Promise<void> {
  const { fps, onProgress } = options;
  const duration = state.loopDuration; // seconds
  const totalFrames = Math.round(duration * fps);

  // Create an offscreen canvas at the same size for rendering frames
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;

  // Set up MediaRecorder on the offscreen canvas stream
  const stream = offscreen.captureStream(0); // 0 = manual frame capture
  const videoTrack = stream.getVideoTracks()[0];

  // Try VP9 first, fall back to VP8
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000, // 8 Mbps for good quality
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Save original layer times
  const originalTimes = state.layers.map(l => l.time);

  // Frame interval in ms — MediaRecorder uses wall-clock time between
  // requestFrame() calls to set each frame's duration in the output video.
  // We must wait this long between frames so the video plays at the right speed.
  const frameInterval = 1000 / fps;

  // Render each frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const phase = frame / totalFrames; // 0 → just-under-1

    // Set all layer times to the current phase
    for (const layer of state.layers) {
      // Each layer's speed is relative (normalized around 50 = 1x)
      layer.time = (phase * (layer.noiseSpeed / 50)) % 1;
    }

    // Render the frame to the offscreen canvas
    render(offscreen, state, comp);

    // Request a frame from the stream
    // @ts-expect-error requestFrame exists on CanvasCaptureMediaStreamTrack
    if (videoTrack.requestFrame) {
      // @ts-expect-error
      videoTrack.requestFrame();
    }

    // Report progress
    onProgress?.((frame + 1) / totalFrames);

    // Wait for the frame interval so MediaRecorder timestamps are correct.
    // This means a 4s video takes ~4s to export — unavoidable with MediaRecorder.
    await new Promise(r => setTimeout(r, frameInterval));
  }

  // Restore original times
  state.layers.forEach((l, i) => { l.time = originalTimes[i]; });

  recorder.stop();
  const blob = await done;

  // Download the file
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `wks-loop-${duration}s.webm`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
