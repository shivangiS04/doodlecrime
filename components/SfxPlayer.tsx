"use client";

import { useEffect, useRef } from "react";
import { useGame } from "./GameProvider";
import { playSfx } from "@/lib/sfx";

export function SfxPlayer() {
  const { sfxEvent } = useGame();
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!sfxEvent || sfxEvent.nonce === lastNonce.current) return;
    lastNonce.current = sfxEvent.nonce;
    playSfx(sfxEvent.name);
  }, [sfxEvent]);

  return null;
}
