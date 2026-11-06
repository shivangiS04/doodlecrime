"use client";

import { useEffect, useState } from "react";
import { RoomStatePublic } from "@/lib/types";
import { useGame } from "./GameProvider";

export function SnitchVotePanel({
  roomState,
  isSnitchThisTurn,
  myPlayerId,
}: {
  roomState: RoomStatePublic;
  isSnitchThisTurn: boolean;
  myPlayerId: string;
}) {
  const { castSnitchVote } = useGame();
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const vote = roomState.snitchVote;

  useEffect(() => {
    if (!vote) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((vote.deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [vote]);

  if (!vote) return null;

  if (isSnitchThisTurn) {
    return (
      <div className="mt-3 rounded-sm border border-blood bg-blood/10 p-3 text-center text-sm">
        The room is voting on who the Snitch was. Sit tight ({remaining}s)...
      </div>
    );
  }

  if (!vote.eligibleVoterIds.includes(myPlayerId)) return null;

  const candidates = roomState.players.filter((p) => p.id !== roomState.currentDrawerId && p.id !== myPlayerId);

  return (
    <div className="mt-3 rounded-sm border border-charcoal-950/10 bg-charcoal-950/5 p-3">
      <p className="text-center font-typewriter text-xs uppercase tracking-wider text-blood">
        Who was the Snitch? ({remaining}s)
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setVotedFor(p.id);
              castSnitchVote(p.id);
            }}
            className={`flex items-center gap-1 rounded-full border-2 px-2 py-1 text-xs ${
              votedFor === p.id ? "border-blood bg-blood/10" : "border-charcoal-950/20"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: p.avatar.bg }}>
              {p.avatar.emoji}
            </span>
            {p.nickname}
          </button>
        ))}
      </div>
      {votedFor && <p className="mt-2 text-center text-xs italic text-charcoal-600">Vote locked in.</p>}
    </div>
  );
}
