"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";

export function WordPicker({ choices, expiresAt }: { choices: string[]; expiresAt: number }) {
  const { chooseWord } = useGame();
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, expiresAt - Date.now())), 200);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/80 p-4">
      <div className="paper-sheet w-full max-w-md rounded-sm p-6 text-center text-charcoal-950">
        <p className="font-typewriter text-xs uppercase tracking-widest text-blood">
          You&apos;re up — pick your crime
        </p>
        <p className="mt-1 font-typewriter text-3xl tabular-nums text-charcoal-700">
          {Math.ceil(remaining / 1000)}s
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {choices.map((word) => (
            <button
              key={word}
              onClick={() => chooseWord(word)}
              className="stamp border-charcoal-950 text-charcoal-950 hover:border-blood hover:text-blood"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
