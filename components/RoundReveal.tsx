"use client";

import { useState } from "react";
import { RoomStatePublic } from "@/lib/types";
import { useGame } from "./GameProvider";
import { EvidenceReplay } from "./EvidenceReplay";
import { SnitchVotePanel } from "./SnitchVotePanel";

export function RoundReveal({
  roomState,
  isSnitchThisTurn,
  myPlayerId,
}: {
  roomState: RoomStatePublic;
  isSnitchThisTurn: boolean;
  myPlayerId: string | null;
}) {
  const reveal = roomState.lastRoundReveal;
  const [showReplay, setShowReplay] = useState(false);

  if (!reveal) return null;

  if (showReplay && reveal.recording) {
    return <EvidenceReplay recording={reveal.recording} onClose={() => setShowReplay(false)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/85 p-4">
      <div className="paper-sheet w-full max-w-md rounded-sm p-6 text-charcoal-950">
        <div className="flex justify-center">
          <span className="stamp animate-stamp-in border-blood text-2xl text-blood">EXHIBIT A</span>
        </div>
        <p className="mt-4 text-center font-typewriter text-sm uppercase tracking-wider text-charcoal-600">
          The word was
        </p>
        <p className="text-center font-typewriter text-2xl text-charcoal-950">{reveal.word}</p>

        {reveal.recording && (
          <button
            onClick={() => setShowReplay(true)}
            className="mx-auto mt-2 block text-xs uppercase underline text-charcoal-600 hover:text-blood"
          >
            Watch the timelapse
          </button>
        )}

        <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-sm">
          {reveal.deltas.length === 0 && (
            <li className="text-center italic text-charcoal-600">Nobody cracked the case.</li>
          )}
          {reveal.deltas.map((d, i) => (
            <li key={`${d.playerId}-${i}`} className="flex justify-between border-b border-charcoal-950/10 py-1">
              <span>
                {d.nickname}
                {d.reason === "drawer" && <span className="text-charcoal-600"> (drawing)</span>}
                {d.reason === "snitch-accuser" && <span className="text-charcoal-600"> (caught the Snitch)</span>}
                {d.reason === "snitch-survivor" && <span className="text-charcoal-600"> (undetected Snitch)</span>}
              </span>
              <span className="font-semibold text-blood">+{d.points}</span>
            </li>
          ))}
        </ul>

        {roomState.snitchVote?.active && myPlayerId && (
          <SnitchVotePanel roomState={roomState} isSnitchThisTurn={isSnitchThisTurn} myPlayerId={myPlayerId} />
        )}

        {reveal.snitchReveal && (
          <p className="mt-3 text-center font-typewriter text-sm text-blood">
            The Snitch was {reveal.snitchReveal.nickname} —{" "}
            {reveal.snitchReveal.caught ? "caught red-handed!" : "got away with it."}
          </p>
        )}
      </div>
    </div>
  );
}
