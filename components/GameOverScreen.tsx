"use client";

import { useState } from "react";
import { PlayerPublic } from "@/lib/types";
import { useGame } from "./GameProvider";
import { EvidenceLocker } from "./EvidenceLocker";

export function GameOverScreen({
  finalScoreboard,
  isHost,
}: {
  finalScoreboard: PlayerPublic[];
  isHost: boolean;
}) {
  const { playAgain } = useGame();
  const [showLocker, setShowLocker] = useState(false);

  if (showLocker) return <EvidenceLocker onClose={() => setShowLocker(false)} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/90 p-4">
      <div className="paper-sheet w-full max-w-md rounded-sm p-6 text-charcoal-950">
        <div className="flex justify-center">
          <span className="stamp animate-stamp-in border-blood text-3xl text-blood">CASE CLOSED</span>
        </div>

        <ol className="mt-6 space-y-2">
          {finalScoreboard.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-sm px-3 py-2 ${
                i === 0 ? "bg-tape/40 font-semibold" : "bg-charcoal-950/5"
              }`}
            >
              <span className="w-6 text-center font-typewriter">{i + 1}</span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: p.avatar.bg }}
              >
                {p.avatar.emoji}
              </span>
              <span className="flex-1 truncate">{p.nickname}</span>
              <span className="font-typewriter tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={() => setShowLocker(true)}
          className="mt-4 w-full rounded-sm border border-charcoal-950 py-2 text-sm uppercase tracking-wide text-charcoal-950 hover:bg-charcoal-950/5"
        >
          📁 Open Evidence Locker
        </button>

        {isHost ? (
          <button
            onClick={playAgain}
            className="stamp mt-4 w-full border-blood text-center text-blood"
          >
            Reopen the Case
          </button>
        ) : (
          <p className="mt-6 text-center text-sm italic text-charcoal-600">
            Waiting for the host to start a new case...
          </p>
        )}
      </div>
    </div>
  );
}
