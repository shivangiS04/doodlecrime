"use client";

import { AVATAR_OPTIONS } from "@/lib/avatars";
import { Avatar } from "@/lib/types";

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Avatar;
  onChange: (a: Avatar) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATAR_OPTIONS.map((a) => {
        const selected = a.emoji === value.emoji && a.bg === value.bg;
        return (
          <button
            key={a.emoji}
            type="button"
            onClick={() => onChange(a)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
              selected ? "ring-2 ring-blood ring-offset-2 ring-offset-paper scale-110" : "opacity-80 hover:opacity-100"
            }`}
            style={{ backgroundColor: a.bg }}
            aria-label={`Avatar ${a.emoji}`}
          >
            {a.emoji}
          </button>
        );
      })}
    </div>
  );
}
