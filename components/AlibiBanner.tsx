"use client";

import { useEffect, useState } from "react";

export function AlibiBanner({ turnKey, category }: { turnKey: string; category: string | null }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(id);
  }, [turnKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center">
      <span className="stamp animate-stamp-in border-blood bg-charcoal-950 px-4 py-2 text-lg text-blood shadow-lg">
        ALIBI MODE — one of these two is lying{category ? ` (your category: ${category})` : ""}
      </span>
    </div>
  );
}
