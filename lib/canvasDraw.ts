import { getStroke } from "perfect-freehand";
import { DrawingAction, FillAction, Stroke } from "./types";

export const CANVAS_W = 800;
export const CANVAS_H = 560;
export const PAPER_COLOR = "#ece6d6";

export function isFillAction(a: DrawingAction): a is FillAction {
  return (a as FillAction).type === "fill";
}

function getSvgPathFromStroke(points: number[][]): string {
  const len = points.length;
  if (len < 4) {
    if (len === 0) return "";
    const [x, y] = points[0];
    return `M${x.toFixed(2)},${y.toFixed(2)} L${x.toFixed(2)},${y.toFixed(2)}`;
  }
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${(
    (b[0] + c[0]) / 2
  ).toFixed(2)},${((b[1] + c[1]) / 2).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${((a[0] + b[0]) / 2).toFixed(2)},${((a[1] + b[1]) / 2).toFixed(2)} `;
  }
  result += "Z";
  return result;
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0];
    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.arc(x, y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.5,
  });
  if (outline.length === 0) return;
  const pathData = getSvgPathFromStroke(outline);
  const path = new Path2D(pathData);
  ctx.fillStyle = stroke.color;
  ctx.fill(path);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b, 255];
}

function colorsMatch(a: Uint8ClampedArray | number[], b: number[], tolerance: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance &&
    Math.abs(a[3] - b[3]) <= tolerance
  );
}

export function applyFill(ctx: CanvasRenderingContext2D, action: FillAction) {
  const { width, height } = ctx.canvas;
  const startX = Math.round(action.x);
  const startY = Math.round(action.y);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const idx = (startY * width + startX) * 4;
  const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  const fillColor = hexToRgba(action.color);
  if (colorsMatch(target, fillColor, 8)) return;

  const stack: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);

  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const vIdx = y * width + x;
    if (visited[vIdx]) continue;
    const i = vIdx * 4;
    if (!colorsMatch([data[i], data[i + 1], data[i + 2], data[i + 3]], target, 32)) continue;
    visited[vIdx] = 1;
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = 255;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

export function paintAction(ctx: CanvasRenderingContext2D, action: DrawingAction) {
  if (isFillAction(action)) applyFill(ctx, action);
  else drawStroke(ctx, action);
}

export function clearToBlank(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export const PALETTE = [
  "#0c0c0d", "#ffffff", "#9e1b1b", "#f2c200",
  "#1d3557", "#2a9d8f", "#e76f51", "#6a4c93",
  "#f4a261", "#264653", "#8d99ae", "#d4a800",
];
