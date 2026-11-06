"use client";

import { PlayerPublic } from "@/lib/types";

export function PlayerList({
  players,
  currentDrawerId,
  myPlayerId,
  showDirtyInk,
}: {
  players: PlayerPublic[];
  currentDrawerId: string | null;
  myPlayerId: string | null;
  showDirtyInk?: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-charcoal-700 bg-charcoal-900 p-3">
      <h3 className="font-typewriter text-xs uppercase tracking-wider text-tape">Suspects</h3>
      <ul className="flex flex-col gap-1">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
              p.id === myPlayerId ? "bg-charcoal-800" : ""
            } ${!p.connected ? "opacity-40" : ""}`}
          >
            <span className="w-4 text-right text-xs text-paper/40">{i + 1}</span>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ backgroundColor: p.avatar.bg }}
            >
              {p.avatar.emoji}
            </span>
            <span className="flex-1 truncate">
              {p.nickname}
              {p.id === myPlayerId && <span className="text-paper/40"> (you)</span>}
            </span>
            {p.id === currentDrawerId && <span title="Drawing">✏️</span>}
            {p.guessedThisTurn && p.id !== currentDrawerId && <span title="Guessed">✅</span>}
            {p.isHost && <span title="Host">👑</span>}
            {showDirtyInk && (
              <span className="font-typewriter tabular-nums text-xs text-paper/50" title="Dirty Ink">
                🖋️{p.dirtyInk}
              </span>
            )}
            <span className="font-typewriter tabular-nums text-tape">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
