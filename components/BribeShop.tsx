"use client";

import { BRIBE_COSTS } from "@/lib/types";
import { useGame } from "./GameProvider";

export function BribeShop({ myDirtyInk, canBuyHint }: { myDirtyInk: number; canBuyHint: boolean }) {
  const { buyLetterHint, curseLeader, bribeJudge } = useGame();

  return (
    <div className="rounded-sm border border-charcoal-700 bg-charcoal-900 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-typewriter text-xs uppercase tracking-wider text-tape">Bribe Shop</h3>
        <span className="font-typewriter text-xs text-paper/60">🖋️ {myDirtyInk}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5 text-xs">
        <button
          onClick={buyLetterHint}
          disabled={!canBuyHint || myDirtyInk < BRIBE_COSTS.letterHint}
          className="flex items-center justify-between rounded-sm bg-charcoal-800 px-2 py-1.5 text-paper hover:bg-charcoal-700 disabled:opacity-30"
        >
          <span>Buy letter hint</span>
          <span className="font-typewriter text-tape">{BRIBE_COSTS.letterHint}🖋️</span>
        </button>
        <button
          onClick={curseLeader}
          disabled={myDirtyInk < BRIBE_COSTS.curseLeader}
          className="flex items-center justify-between rounded-sm bg-charcoal-800 px-2 py-1.5 text-paper hover:bg-charcoal-700 disabled:opacity-30"
        >
          <span>Curse the leader</span>
          <span className="font-typewriter text-tape">{BRIBE_COSTS.curseLeader}🖋️</span>
        </button>
        <button
          onClick={bribeJudge}
          disabled={myDirtyInk < BRIBE_COSTS.bribeJudge}
          className="flex items-center justify-between rounded-sm bg-charcoal-800 px-2 py-1.5 text-paper hover:bg-charcoal-700 disabled:opacity-30"
        >
          <span>Bribe the judge (2x, risky)</span>
          <span className="font-typewriter text-tape">{BRIBE_COSTS.bribeJudge}🖋️</span>
        </button>
      </div>
    </div>
  );
}
