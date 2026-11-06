import { TurnRecording } from "./types";
import { CANVAS_H, CANVAS_W, PAPER_COLOR, clearToBlank, paintAction } from "./canvasDraw";

const SCALE = 0.5; // smaller export canvas keeps GIF file size reasonable
const EXPORT_W = Math.round(CANVAS_W * SCALE);
const EXPORT_H = Math.round(CANVAS_H * SCALE);
const FRAME_DELAY_MS = 180;
const HOLD_FRAMES = 6;

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(12,12,13,0.55)";
  ctx.textBaseline = "bottom";
  ctx.fillText("DOODLE CRIMES", 8, EXPORT_H - 6);
  ctx.restore();

  ctx.save();
  ctx.translate(EXPORT_W - 10, 14);
  ctx.rotate(-0.14);
  ctx.font = "bold 13px monospace";
  ctx.strokeStyle = "#9e1b1b";
  ctx.lineWidth = 2;
  ctx.textAlign = "right";
  ctx.strokeText("EXHIBIT A", 0, 0);
  ctx.fillStyle = "#9e1b1b";
  ctx.fillText("EXHIBIT A", 0, 0);
  ctx.restore();
}

export async function exportRecordingAsGif(
  recording: TurnRecording,
  onProgress?: (fraction: number) => void
): Promise<Blob> {
  const { default: GIF } = await import("gif.js");

  const full = document.createElement("canvas");
  full.width = CANVAS_W;
  full.height = CANVAS_H;
  const fullCtx = full.getContext("2d")!;
  clearToBlank(fullCtx);

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = EXPORT_W;
  exportCanvas.height = EXPORT_H;
  const exportCtx = exportCanvas.getContext("2d")!;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: EXPORT_W,
    height: EXPORT_H,
    workerScript: "/gif.worker.js",
    repeat: 0,
  });

  function snapshotFrame(delay: number) {
    exportCtx.clearRect(0, 0, EXPORT_W, EXPORT_H);
    exportCtx.fillStyle = PAPER_COLOR;
    exportCtx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    exportCtx.drawImage(full, 0, 0, CANVAS_W, CANVAS_H, 0, 0, EXPORT_W, EXPORT_H);
    drawWatermark(exportCtx);
    gif.addFrame(exportCtx, { copy: true, delay });
  }

  const actions = recording.actions;
  for (let i = 0; i < actions.length; i++) {
    paintAction(fullCtx, actions[i]);
    snapshotFrame(FRAME_DELAY_MS);
    onProgress?.(((i + 1) / (actions.length + HOLD_FRAMES)) * 0.7);
  }
  for (let h = 0; h < HOLD_FRAMES; h++) {
    snapshotFrame(300);
    onProgress?.(0.7 + (h / HOLD_FRAMES) * 0.1);
  }

  return new Promise((resolve) => {
    gif.on("progress", (p) => onProgress?.(0.8 + p * 0.2));
    gif.on("finished", (blob) => resolve(blob));
    gif.render();
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
