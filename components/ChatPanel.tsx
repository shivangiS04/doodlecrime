"use client";

import { useEffect, useRef, useState } from "react";
import { ChatEntry } from "@/lib/types";
import { useGame } from "./GameProvider";

export function ChatPanel({
  chatLog,
  disabled,
  placeholder,
  isSnitch,
}: {
  chatLog: ChatEntry[];
  disabled: boolean;
  placeholder: string;
  isSnitch?: boolean;
}) {
  const { sendChat, privateHint } = useGame();
  const [text, setText] = useState("");
  const [decoy, setDecoy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatLog]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    sendChat(text, isSnitch && decoy);
    setText("");
  }

  return (
    <div className="flex h-full flex-col rounded-sm border border-charcoal-700 bg-charcoal-900">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        {chatLog.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.system
                ? "text-xs italic text-paper/40"
                : entry.guess === "correct"
                ? "font-semibold text-tape"
                : entry.guess === "close"
                ? "text-blood-light"
                : "text-paper/90"
            }
          >
            {!entry.system && entry.guess !== "correct" && (
              <span className="font-semibold text-paper/60">{entry.nickname}: </span>
            )}
            {entry.text}
          </div>
        ))}
      </div>

      {privateHint && (
        <div className="px-3 py-1 text-xs font-semibold text-blood-light">{privateHint}</div>
      )}

      {isSnitch && (
        <label className="flex items-center gap-2 border-t border-charcoal-700 px-3 py-1.5 text-xs text-paper/70">
          <input type="checkbox" checked={decoy} onChange={(e) => setDecoy(e.target.checked)} />
          Send as decoy (looks like a normal guess, fools the room)
        </label>
      )}

      <form onSubmit={handleSubmit} className="flex border-t border-charcoal-700 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder={placeholder}
          className="flex-1 rounded-sm bg-charcoal-800 px-3 py-2 text-sm text-paper outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={disabled}
          className="ml-2 rounded-sm bg-tape px-3 py-2 text-sm font-semibold text-charcoal-950 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
