"use client";

import { useEffect, useRef, useState } from "react";
import { TurnRecording } from "@/lib/types";
import { CANVAS_H, CANVAS_W, clearToBlank, paintAction } from "@/lib/canvasDraw";
import { downloadBlob, exportRecordingAsGif } from "@/lib/gifExport";

const STEP_MS = 180;

export function EvidenceReplay({ recording, onClose }: { recording: TurnRecording; onClose?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    clearToBlank(ctx);
    for (let i = 0; i < index; i++) paintAction(ctx, recording.actions[i]);
  }, [index, recording.actions]);

  useEffect(() => {
    if (!playing) return;
    if (index >= recording.actions.length) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, index, recording.actions.length]);

  function restart() {
    setIndex(0);
    setPlaying(true);
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportRecordingAsGif(recording, setExportProgress);
      downloadBlob(blob, `doodle-crimes-${recording.word.replace(/\s+/g, "-")}.gif`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/90 p-4">
      <div className="paper-sheet w-full max-w-md rounded-sm p-4 text-charcoal-950">
        <div className="relative overflow-hidden rounded-sm border border-charcoal-950/10">
          <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }} />
          <div className="pointer-events-none absolute right-2 top-2 rotate-[-8deg] rounded-sm border-2 border-blood px-2 py-0.5 font-typewriter text-xs text-blood">
            EXHIBIT A
          </div>
          <div className="pointer-events-none absolute bottom-1 left-2 font-typewriter text-[10px] text-charcoal-950/40">
            DOODLE CRIMES
          </div>
        </div>

        <p className="mt-2 text-center text-sm">
          Round {recording.round} — <span className="font-semibold">{recording.word}</span> by{" "}
          {recording.drawerNickname}
        </p>

        <div className="mt-3 flex items-center justify-center gap-2 font-typewriter text-xs uppercase">
          <button onClick={restart} className="rounded-sm bg-charcoal-950 px-3 py-1.5 text-paper">
            Replay
          </button>
          <button onClick={() => setPlaying((p) => !p)} className="rounded-sm bg-charcoal-950 px-3 py-1.5 text-paper">
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-sm bg-blood px-3 py-1.5 text-paper disabled:opacity-50"
          >
            {exporting ? `Exporting ${Math.round(exportProgress * 100)}%` : "Download GIF"}
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-sm border border-charcoal-950 px-3 py-1.5">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
