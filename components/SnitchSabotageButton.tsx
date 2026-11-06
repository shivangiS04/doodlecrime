"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";

export function SnitchSabotageButton() {
  const { snitchAssignment, activateSabotage } = useGame();
  const [used, setUsed] = useState(false);
  const [activeUntil, setActiveUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!activeUntil) {
      setRemaining(0);
      return;
    }
    const id = setInterval(() => {
      const r = Math.max(0, activeUntil - Date.now());
      setRemaining(r);
      if (r <= 0) setActiveUntil(null);
    }, 100);
    return () => clearInterval(id);
  }, [activeUntil]);

  function handleClick() {
    if (used || !snitchAssignment) return;
    setUsed(true);
    setActiveUntil(Date.now() + snitchAssignment.sabotageWindowMs);
    activateSabotage();
  }

  return (
    <div className="rounded-sm border border-blood bg-charcoal-900 p-3 text-center">
      <p className="font-typewriter text-xs uppercase tracking-wider text-blood">You are the Snitch 🐀</p>
      <p className="mt-1 text-[11px] text-paper/50">
        Grab the pen for {Math.round((snitchAssignment?.sabotageWindowMs ?? 0) / 1000)}s of sabotage, or send a
        decoy guess from the chat box.
      </p>
      <button
        onClick={handleClick}
        disabled={used}
        className="stamp mt-2 w-full border-blood text-sm text-blood disabled:opacity-40"
      >
        {activeUntil ? `Sabotaging... ${(remaining / 1000).toFixed(1)}s` : used ? "Pen Used" : "Grab the Pen"}
      </button>
    </div>
  );
}
