"use client";

import { useState } from "react";
import { RoomStatePublic } from "@/lib/types";
import { listPromptPacks } from "@/lib/prompts";
import { useGame } from "./GameProvider";
import { PlayerList } from "./PlayerList";

const PACKS = listPromptPacks();

export function Lobby({ roomState, isHost }: { roomState: RoomStatePublic; isHost: boolean }) {
  const { updateSettings, startGame, myPlayerId } = useGame();
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState(roomState.settings.customWords.join(", "));

  const link = typeof window !== "undefined" ? `${window.location.origin}/room/${roomState.code}` : "";

  function copyLink() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function applyCustomWords() {
    const words = customText
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    updateSettings({ customWords: words, promptPack: "custom" });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <div className="text-center">
        <p className="font-typewriter text-xs uppercase tracking-widest text-paper/50">Case Code</p>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="font-typewriter text-4xl text-tape tracking-widest">{roomState.code}</span>
          <button
            onClick={copyLink}
            className="rounded-sm border border-charcoal-700 bg-charcoal-900 px-3 py-1 font-typewriter text-xs uppercase text-paper hover:bg-charcoal-800"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <p className="mt-1 text-xs text-paper/40">{roomState.players.length}/{roomState.settings.maxPlayers} players</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlayerList players={roomState.players} currentDrawerId={null} myPlayerId={myPlayerId} />

        <div className="space-y-3 rounded-sm border border-charcoal-700 bg-charcoal-900 p-3">
          <h3 className="font-typewriter text-xs uppercase tracking-wider text-tape">House Rules</h3>

          <fieldset disabled={!isHost} className="space-y-3 disabled:opacity-60">
            <label className="flex items-center justify-between text-sm">
              Rounds
              <select
                value={roomState.settings.totalRounds}
                onChange={(e) => updateSettings({ totalRounds: Number(e.target.value) })}
                className="rounded-sm bg-charcoal-800 px-2 py-1"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between text-sm">
              Draw time
              <select
                value={roomState.settings.drawTimeSec}
                onChange={(e) => updateSettings({ drawTimeSec: Number(e.target.value) as 60 | 80 | 100 })}
                className="rounded-sm bg-charcoal-800 px-2 py-1"
              >
                <option value={60}>60s</option>
                <option value={80}>80s</option>
                <option value={100}>100s</option>
              </select>
            </label>

            <label className="flex items-center justify-between text-sm">
              Prompt pack
              <select
                value={roomState.settings.promptPack}
                onChange={(e) => updateSettings({ promptPack: e.target.value })}
                className="rounded-sm bg-charcoal-800 px-2 py-1"
              >
                {PACKS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="flex items-center justify-between text-sm">
              Profanity filter
              <input
                type="checkbox"
                checked={roomState.settings.profanityFilter}
                onChange={(e) => updateSettings({ profanityFilter: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between text-sm">
              Sentences (drawer handicaps)
              <input
                type="checkbox"
                checked={roomState.settings.sentencesEnabled}
                onChange={(e) => updateSettings({ sentencesEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between text-sm">
              The Snitch
              <input
                type="checkbox"
                checked={roomState.settings.snitchEnabled}
                onChange={(e) => updateSettings({ snitchEnabled: e.target.checked })}
              />
            </label>

            {roomState.settings.promptPack === "custom" && (
              <div>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="comma, separated, custom, words"
                  className="w-full rounded-sm bg-charcoal-800 p-2 text-sm"
                  rows={2}
                />
                <button
                  onClick={applyCustomWords}
                  className="mt-1 rounded-sm bg-charcoal-700 px-2 py-1 text-xs uppercase hover:bg-charcoal-600"
                >
                  Save words
                </button>
              </div>
            )}
          </fieldset>
        </div>
      </div>

      {isHost ? (
        <button
          onClick={startGame}
          disabled={roomState.players.length < 3}
          className="stamp mx-auto block border-tape text-center text-tape disabled:opacity-40"
        >
          {roomState.players.length < 3 ? "Need 3+ players" : "Start the Case"}
        </button>
      ) : (
        <p className="text-center text-sm italic text-paper/50">Waiting for the host to start...</p>
      )}
    </div>
  );
}
