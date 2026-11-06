"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useGame } from "./GameProvider";
import { DrawingAction, FillAction, INK_METER_BUDGET, Point, SentenceId, Stroke } from "@/lib/types";
import {
  CANVAS_W,
  CANVAS_H,
  PALETTE,
  applyFill,
  clearToBlank,
  drawStroke,
  isFillAction,
  paintAction,
} from "@/lib/canvasDraw";

type Tool = "brush" | "eraser" | "fill";

export function Canvas({
  isDrawer,
  applyHandicap,
  sentence,
  turnStartedAt,
  turnKey,
}: {
  isDrawer: boolean;
  applyHandicap: boolean;
  sentence: SentenceId | null;
  turnStartedAt: number | null;
  turnKey: string;
}) {
  const { socket, sendDrawAction, undo, clear } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visibleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const historyRef = useRef<DrawingAction[]>([]);
  const pendingRef = useRef<Stroke | null>(null);
  const isPointerDownRef = useRef(false);
  const lastSentRef = useRef(0);
  const inkUsedRef = useRef(0);
  const oneLineUsedRef = useRef(false);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(8);
  const [inkUsed, setInkUsed] = useState(0);
  const [shrinkScale, setShrinkScale] = useState(1);

  const handicap = applyHandicap ? sentence : null;

  const composite = useCallback(() => {
    const ctx = visibleCtxRef.current;
    const committed = committedCanvasRef.current;
    if (!ctx || !committed) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(committed, 0, 0);
    if (pendingRef.current) drawStroke(ctx, pendingRef.current);
  }, []);

  const rebuildCommittedFromScratch = useCallback(() => {
    const ctx = committedCtxRef.current;
    if (!ctx) return;
    clearToBlank(ctx);
    for (const action of historyRef.current) paintAction(ctx, action);
    composite();
  }, [composite]);

  const bakePending = useCallback(() => {
    const ctx = committedCtxRef.current;
    if (!ctx || !pendingRef.current) return;
    historyRef.current.push(pendingRef.current);
    paintAction(ctx, pendingRef.current);
    pendingRef.current = null;
  }, []);

  // init canvases
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    visibleCtxRef.current = canvas.getContext("2d");

    const committed = document.createElement("canvas");
    committed.width = CANVAS_W;
    committed.height = CANVAS_H;
    committedCanvasRef.current = committed;
    committedCtxRef.current = committed.getContext("2d");

    rebuildCommittedFromScratch();
  }, [rebuildCommittedFromScratch]);

  // fresh sheet for each new turn
  const isFirstTurnRef = useRef(true);
  useEffect(() => {
    if (isFirstTurnRef.current) {
      isFirstTurnRef.current = false;
      return;
    }
    historyRef.current = [];
    pendingRef.current = null;
    inkUsedRef.current = 0;
    oneLineUsedRef.current = false;
    setInkUsed(0);
    rebuildCommittedFromScratch();
  }, [turnKey, rebuildCommittedFromScratch]);

  // shrinking-canvas: everyone sees the scene shrink every 10s
  useEffect(() => {
    if (sentence !== "shrinking-canvas" || !turnStartedAt) {
      setShrinkScale(1);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - turnStartedAt;
      const steps = Math.floor(elapsed / 10_000);
      setShrinkScale(Math.max(0.45, 1 - steps * 0.12));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [sentence, turnStartedAt, turnKey]);

  // network sync
  useEffect(() => {
    function upsertRemote(action: DrawingAction) {
      if (isFillAction(action)) {
        if (pendingRef.current) bakePending();
        const ctx = committedCtxRef.current;
        if (ctx) {
          historyRef.current.push(action);
          applyFill(ctx, action);
        }
        composite();
        return;
      }
      if (pendingRef.current && pendingRef.current.id !== action.id) {
        bakePending();
      }
      pendingRef.current = action;
      composite();
    }

    function onAction(action: DrawingAction) {
      upsertRemote(action);
    }
    function onUndo() {
      if (pendingRef.current) {
        pendingRef.current = null;
      } else {
        historyRef.current.pop();
      }
      rebuildCommittedFromScratch();
    }
    function onClear() {
      historyRef.current = [];
      pendingRef.current = null;
      rebuildCommittedFromScratch();
    }
    function onSync({ actions }: { actions: DrawingAction[] }) {
      historyRef.current = actions;
      pendingRef.current = null;
      rebuildCommittedFromScratch();
    }

    socket.on("draw:action", onAction);
    socket.on("draw:undo", onUndo);
    socket.on("draw:clear", onClear);
    socket.on("draw:canvasSync", onSync);
    return () => {
      socket.off("draw:action", onAction);
      socket.off("draw:undo", onUndo);
      socket.off("draw:clear", onClear);
      socket.off("draw:canvasSync", onSync);
    };
  }, [socket, bakePending, composite, rebuildCommittedFromScratch]);

  function toLocalPoint(e: React.PointerEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    let y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (handicap === "mirrored") x = CANVAS_W - x;
    if (handicap === "jitter") {
      x += (Math.random() - 0.5) * 16;
      y += (Math.random() - 0.5) * 16;
    }
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, pressure];
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!isDrawer) return;
    if (handicap === "one-line" && oneLineUsedRef.current) return;
    if (handicap === "ink-meter" && inkUsedRef.current >= INK_METER_BUDGET) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const point = toLocalPoint(e);

    if (tool === "fill") {
      const action: FillAction = { id: nanoid(10), type: "fill", x: point[0], y: point[1], color };
      const ctx = committedCtxRef.current;
      if (ctx) {
        historyRef.current.push(action);
        applyFill(ctx, action);
      }
      composite();
      sendDrawAction(action);
      return;
    }

    if (pendingRef.current) bakePending();
    const stroke: Stroke = {
      id: nanoid(10),
      color: tool === "eraser" ? "#ece6d6" : color,
      size: tool === "eraser" ? size * 2.5 : size,
      tool,
      points: [point],
    };
    pendingRef.current = stroke;
    isPointerDownRef.current = true;
    composite();
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawer || !isPointerDownRef.current || !pendingRef.current) return;

    const next = toLocalPoint(e);
    const prev = pendingRef.current.points[pendingRef.current.points.length - 1];
    if (prev) {
      const dist = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
      inkUsedRef.current += dist;
      if (handicap === "ink-meter" && inkUsedRef.current >= INK_METER_BUDGET) {
        setInkUsed(inkUsedRef.current);
        handlePointerUp();
        return;
      }
    }

    pendingRef.current.points.push(next);
    composite();

    const now = Date.now();
    if (now - lastSentRef.current >= 45) {
      lastSentRef.current = now;
      setInkUsed(inkUsedRef.current);
      sendDrawAction({ ...pendingRef.current, points: [...pendingRef.current.points] });
    }
  }

  function handlePointerUp() {
    if (!isDrawer || !isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (handicap === "one-line") oneLineUsedRef.current = true;
    if (pendingRef.current) {
      sendDrawAction({ ...pendingRef.current, points: [...pendingRef.current.points] });
      bakePending();
      composite();
    }
  }

  function handleUndo() {
    if (pendingRef.current) {
      pendingRef.current = null;
    } else {
      historyRef.current.pop();
    }
    rebuildCommittedFromScratch();
    undo();
  }

  function handleClear() {
    historyRef.current = [];
    pendingRef.current = null;
    rebuildCommittedFromScratch();
    clear();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center transition-transform duration-500" style={{ transform: `scale(${shrinkScale})` }}>
        <div className="paper-sheet relative w-full max-w-[800px] overflow-hidden rounded-sm">
          <canvas
            ref={canvasRef}
            className="block w-full touch-none"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, cursor: isDrawer ? "crosshair" : "default" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {!isDrawer && (
            <div className="pointer-events-none absolute right-2 top-2 rounded-sm bg-charcoal-950/70 px-2 py-1 font-typewriter text-[10px] uppercase tracking-wider text-tape">
              Evidence Sheet — Do Not Touch
            </div>
          )}
          {handicap === "blind-canvas" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal-950">
              <p className="font-typewriter text-sm uppercase tracking-wider text-tape">
                Drawing blind — you can&apos;t see the sheet!
              </p>
            </div>
          )}
        </div>
      </div>

      {handicap === "ink-meter" && (
        <div className="mx-auto w-full max-w-[800px]">
          <div className="h-2 overflow-hidden rounded-full bg-charcoal-800">
            <div
              className="h-full bg-tape transition-all"
              style={{ width: `${Math.max(0, 100 - (inkUsed / INK_METER_BUDGET) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {isDrawer && (
        <div className="mx-auto flex w-full max-w-[800px] flex-wrap items-center gap-3 rounded-sm border border-charcoal-700 bg-charcoal-900 p-3">
          <div className="flex gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool((t) => (t === "eraser" ? "brush" : t));
                }}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  color === c && tool !== "eraser" ? "border-tape scale-110" : "border-charcoal-600"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={28}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-24"
            />
            <span className="h-2 w-2 rounded-full bg-paper" style={{ transform: `scale(${size / 10})` }} />
          </div>

          <div className="flex gap-1 font-typewriter text-xs uppercase">
            <button
              onClick={() => setTool("brush")}
              className={`rounded-sm px-2 py-1 ${tool === "brush" ? "bg-tape text-charcoal-950" : "bg-charcoal-800 text-paper"}`}
            >
              Brush
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`rounded-sm px-2 py-1 ${tool === "eraser" ? "bg-tape text-charcoal-950" : "bg-charcoal-800 text-paper"}`}
            >
              Eraser
            </button>
            <button
              onClick={() => setTool("fill")}
              className={`rounded-sm px-2 py-1 ${tool === "fill" ? "bg-tape text-charcoal-950" : "bg-charcoal-800 text-paper"}`}
            >
              Fill
            </button>
          </div>

          <div className="ml-auto flex gap-1 font-typewriter text-xs uppercase">
            <button onClick={handleUndo} className="rounded-sm bg-charcoal-800 px-3 py-1 text-paper hover:bg-charcoal-700">
              Undo
            </button>
            <button onClick={handleClear} className="rounded-sm bg-blood px-3 py-1 text-paper hover:bg-blood-light">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
