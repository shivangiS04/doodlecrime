"use client";

import { useEffect, useRef, useState } from "react";
import { RoomStatePublic, TurnRecording } from "@/lib/types";
import { CANVAS_H, CANVAS_W, clearToBlank, paintAction } from "@/lib/canvasDraw";
import { useGame } from "./GameProvider";

function MiniDrawing({ recording }: { recording: TurnRecording | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    clearToBlank(ctx);
    if (recording) for (const action of recording.actions) paintAction(ctx, action);
  }, [recording]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full rounded-sm border border-charcoal-950/10"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    />
  );
}

export function CourtroomScene({
  roomState,
  myPlayerId,
  isHost,
}: {
  roomState: RoomStatePublic;
  myPlayerId: string | null;
  isHost: boolean;
}) {
  const { castTrialVote, submitTrialDefense, continueTrial, fetchEvidenceTape } = useGame();
  const [recordings, setRecordings] = useState<TurnRecording[]>([]);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [defenseText, setDefenseText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    fetchEvidenceTape().then(setRecordings);
  }, [fetchEvidenceTape]);

  useEffect(() => {
    setSubmitted(false);
    setDefenseText("");
  }, [roomState.trialCurrentDefendantId]);

  useEffect(() => {
    if (!roomState.trialDeadline) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((roomState.trialDeadline! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [roomState.trialDeadline]);

  function latestRecordingFor(playerId: string): TurnRecording | undefined {
    return [...recordings].reverse().find((r) => r.drawerId === playerId);
  }

  function handleVote(targetPlayerId: string) {
    setVotedFor(targetPlayerId);
    castTrialVote(targetPlayerId);
  }

  function handleSubmitDefense(e: React.FormEvent) {
    e.preventDefault();
    submitTrialDefense(defenseText);
    setSubmitted(true);
  }

  const defendants = roomState.trialDefendants
    .map((id) => roomState.players.find((p) => p.id === id))
    .filter(Boolean) as NonNullable<(typeof roomState.players)[number]>[];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-950/95 p-4">
      <div className="mx-auto max-w-2xl py-8">
        <h2 className="text-center font-typewriter text-2xl uppercase tracking-widest text-blood">The Trial</h2>
        <p className="mt-1 text-center text-xs uppercase tracking-wider text-paper/40">
          caution-tape courtroom · case closing arguments
        </p>

        {roomState.trialStage === "VOTING" && (
          <div className="paper-sheet mt-6 rounded-sm p-6 text-charcoal-950">
            <p className="text-center font-typewriter text-sm uppercase tracking-wider text-charcoal-700">
              Nominate the three worst drawings of the game ({remaining}s)
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {roomState.players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  className={`flex flex-col items-center gap-1 rounded-sm border-2 p-2 ${
                    votedFor === p.id ? "border-blood bg-blood/10" : "border-charcoal-950/15"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: p.avatar.bg }}>
                    {p.avatar.emoji}
                  </span>
                  <span className="text-xs">{p.nickname}</span>
                </button>
              ))}
            </div>
            {votedFor && <p className="mt-3 text-center text-xs italic text-charcoal-600">Vote locked in.</p>}
          </div>
        )}

        {roomState.trialStage === "DEFENSE" && (
          <div className="paper-sheet mt-6 rounded-sm p-6 text-charcoal-950">
            <p className="text-center font-typewriter text-xs uppercase tracking-wider text-charcoal-600">
              Closing arguments
            </p>
            {defendants.map((d) => {
              const isCurrent = d.id === roomState.trialCurrentDefendantId;
              const hasDefended = roomState.trialDefenses[d.id] != null;
              if (!isCurrent && !hasDefended) return null;
              return (
                <div key={d.id} className={`mt-3 rounded-sm border p-3 ${isCurrent ? "border-blood" : "border-charcoal-950/10"}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: d.avatar.bg }}>
                      {d.avatar.emoji}
                    </span>
                    <span className="font-semibold">{d.nickname}</span>
                    {isCurrent && <span className="ml-auto font-typewriter text-xs text-blood">{remaining}s</span>}
                  </div>
                  <div className="mt-2 max-w-[240px]">
                    <MiniDrawing recording={latestRecordingFor(d.id)} />
                  </div>
                  {hasDefended ? (
                    <p className="mt-2 text-sm italic">&ldquo;{roomState.trialDefenses[d.id] || "(said nothing)"}&rdquo;</p>
                  ) : isCurrent && myPlayerId === d.id && !submitted ? (
                    <form onSubmit={handleSubmitDefense} className="mt-2 flex gap-2">
                      <input
                        value={defenseText}
                        onChange={(e) => setDefenseText(e.target.value)}
                        maxLength={280}
                        placeholder="Your honor, let me explain..."
                        className="flex-1 rounded-sm border border-charcoal-950/20 bg-paper px-2 py-1 text-sm outline-none focus:border-blood"
                      />
                      <button type="submit" className="rounded-sm bg-blood px-3 py-1 text-sm text-paper">
                        Submit
                      </button>
                    </form>
                  ) : (
                    <p className="mt-2 text-sm italic text-charcoal-600">
                      {isCurrent ? "pleading their case..." : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {roomState.trialStage === "VERDICT" && (
          <div className="space-y-4">
            {roomState.trialVerdicts == null && (
              <p className="paper-sheet mt-6 rounded-sm p-6 text-center italic text-charcoal-700">
                The judge is deliberating...
              </p>
            )}
            {roomState.trialVerdicts?.map((v) => {
              const defendant = roomState.players.find((p) => p.id === v.playerId);
              return (
                <div key={v.playerId} className="paper-sheet rounded-sm p-5 text-charcoal-950">
                  <div className="flex items-center gap-2">
                    {defendant && (
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ backgroundColor: defendant.avatar.bg }}
                      >
                        {defendant.avatar.emoji}
                      </span>
                    )}
                    <span className="font-typewriter uppercase tracking-wide text-blood">{v.nickname}</span>
                  </div>
                  <div className="mt-2 max-w-[200px]">
                    <MiniDrawing recording={latestRecordingFor(v.playerId)} />
                  </div>
                  <p className="mt-2 text-sm">{v.verdict}</p>
                  <p className="mt-1 text-sm font-semibold text-blood">{v.sentence}</p>
                </div>
              );
            })}

            {roomState.trialVerdicts && isHost && (
              <button
                onClick={continueTrial}
                className="stamp mx-auto block border-tape text-center text-tape"
              >
                Proceed to Scoreboard
              </button>
            )}
            {roomState.trialVerdicts && !isHost && (
              <p className="text-center text-sm italic text-paper/50">
                Waiting for the host to proceed to the final scoreboard...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
