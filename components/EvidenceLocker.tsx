"use client";

import { useEffect, useState } from "react";
import { TurnRecording } from "@/lib/types";
import { useGame } from "./GameProvider";
import { EvidenceReplay } from "./EvidenceReplay";

export function EvidenceLocker({ onClose }: { onClose: () => void }) {
  const { fetchEvidenceTape } = useGame();
  const [recordings, setRecordings] = useState<TurnRecording[] | null>(null);
  const [selected, setSelected] = useState<TurnRecording | null>(null);

  useEffect(() => {
    fetchEvidenceTape().then(setRecordings);
  }, [fetchEvidenceTape]);

  if (selected) {
    return <EvidenceReplay recording={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/90 p-4">
      <div className="paper-sheet w-full max-w-md rounded-sm p-6 text-charcoal-950">
        <h2 className="text-center font-typewriter text-lg uppercase tracking-wider text-blood">Evidence Locker</h2>

        {!recordings && <p className="mt-4 text-center text-sm italic">Pulling case files...</p>}
        {recordings && recordings.length === 0 && (
          <p className="mt-4 text-center text-sm italic">No evidence was recorded this case.</p>
        )}

        <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {recordings?.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-charcoal-950/5"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                  style={{ backgroundColor: r.drawerAvatar.bg }}
                >
                  {r.drawerAvatar.emoji}
                </span>
                <span className="flex-1 truncate">
                  Round {r.round} — <span className="font-semibold">{r.word}</span>
                </span>
                <span className="text-xs text-charcoal-600">{r.drawerNickname}</span>
              </button>
            </li>
          ))}
        </ul>

        <button onClick={onClose} className="stamp mt-5 w-full border-charcoal-950 text-center text-charcoal-950">
          Close Locker
        </button>
      </div>
    </div>
  );
}
