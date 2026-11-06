"use client";

import { useEffect, useState } from "react";
import { SENTENCE_LABELS, SentenceId } from "@/lib/types";

export function SentenceBanner({ sentence, turnKey }: { sentence: SentenceId; turnKey: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(id);
  }, [turnKey, sentence]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center">
      <span className="stamp animate-stamp-in border-blood bg-charcoal-950 px-4 py-2 text-xl text-blood shadow-lg">
        SENTENCE: {SENTENCE_LABELS[sentence]}
      </span>
    </div>
  );
}
