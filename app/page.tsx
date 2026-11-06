"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/components/GameProvider";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AVATAR_OPTIONS } from "@/lib/avatars";

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom } = useGame();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Every suspect needs a name.");
      return;
    }
    setBusy(true);
    setError(null);

    if (mode === "create") {
      const res = await createRoom(nickname, avatar);
      setBusy(false);
      if (res.ok) router.push(`/room/${res.code}`);
      else setError(res.error);
    } else {
      if (code.trim().length !== 6) {
        setBusy(false);
        setError("Room codes are 6 characters.");
        return;
      }
      const res = await joinRoom(code, nickname, avatar);
      setBusy(false);
      if (res.ok) router.push(`/room/${code.toUpperCase()}`);
      else setError(res.error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="caution-tape mb-8 h-3 w-full max-w-md rounded-sm animate-tape-flutter" />

      <h1 className="font-typewriter text-4xl text-tape sm:text-5xl text-center">
        DOODLE CRIMES
      </h1>
      <p className="mt-2 text-sm text-paper/60 tracking-wide text-center">
        A party game for people who can&apos;t draw, but can definitely lie.
      </p>

      <div className="paper-sheet mt-8 w-full max-w-md rounded-sm p-6 text-charcoal-950">
        <div className="mb-5 flex gap-2 font-typewriter text-sm">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`flex-1 rounded-sm border-2 border-charcoal-950 py-2 ${
              mode === "create" ? "bg-blood text-paper" : "bg-transparent"
            }`}
          >
            New Case
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`flex-1 rounded-sm border-2 border-charcoal-950 py-2 ${
              mode === "join" ? "bg-blood text-paper" : "bg-transparent"
            }`}
          >
            Join Case
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-typewriter text-xs uppercase tracking-wider text-charcoal-700">
              Alias
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="e.g. Detective Doodle"
              className="w-full rounded-sm border-2 border-charcoal-950 bg-paper px-3 py-2 outline-none focus:border-blood"
            />
          </div>

          {mode === "join" && (
            <div>
              <label className="mb-1 block font-typewriter text-xs uppercase tracking-wider text-charcoal-700">
                Case Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="w-full rounded-sm border-2 border-charcoal-950 bg-paper px-3 py-2 font-typewriter uppercase tracking-widest outline-none focus:border-blood"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block font-typewriter text-xs uppercase tracking-wider text-charcoal-700">
              Disguise
            </label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          {error && <p className="text-sm font-semibold text-blood">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="stamp w-full border-blood text-blood text-center text-lg disabled:opacity-50"
          >
            {busy ? "..." : mode === "create" ? "Open Case" : "Enter Scene"}
          </button>
        </form>
      </div>

      <p className="mt-6 max-w-md text-center text-xs text-paper/40">
        3–12 players. Server never reveals the word to guessers. Draw, lie, snitch, repeat.
      </p>
    </main>
  );
}
