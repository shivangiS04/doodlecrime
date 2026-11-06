"use client";

import { useEffect, useState } from "react";
import { RoomStatePublic } from "@/lib/types";

export function TopBar({
  roomState,
  isDrawer,
  myWord,
}: {
  roomState: RoomStatePublic;
  isDrawer: boolean;
  myWord: string | null;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!roomState.turnEndsAt) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((roomState.turnEndsAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [roomState.turnEndsAt]);

  const drawer = roomState.players.find((p) => p.id === roomState.currentDrawerId);
  const displayWord = isDrawer && myWord ? myWord : roomState.revealedMask;

  return (
    <div className="caution-tape flex items-center justify-between rounded-sm px-4 py-2 text-charcoal-950">
      <div className="rounded-sm bg-charcoal-950 px-3 py-1 font-typewriter text-xs text-tape">
        Round {roomState.round}/{roomState.totalRounds}
      </div>

      <div className="rounded-sm bg-charcoal-950 px-4 py-1 text-center font-typewriter text-lg tracking-[0.3em] text-paper">
        {displayWord ? displayWord.split("").join(" ") : "..."}
      </div>

      <div className="rounded-sm bg-charcoal-950 px-3 py-1 font-typewriter text-xs text-tape">
        {drawer ? `${drawer.nickname} drawing` : ""} {roomState.turnEndsAt ? `· ${remaining}s` : ""}
      </div>
    </div>
  );
}
