"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame } from "@/components/GameProvider";
import { loadIdentity } from "@/lib/socketClient";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { Lobby } from "@/components/Lobby";
import { TopBar } from "@/components/TopBar";
import { Canvas } from "@/components/Canvas";
import { PlayerList } from "@/components/PlayerList";
import { ChatPanel } from "@/components/ChatPanel";
import { WordPicker } from "@/components/WordPicker";
import { RoundReveal } from "@/components/RoundReveal";
import { GameOverScreen } from "@/components/GameOverScreen";
import { SfxPlayer } from "@/components/SfxPlayer";
import { SentenceBanner } from "@/components/SentenceBanner";
import { SnitchSabotageButton } from "@/components/SnitchSabotageButton";
import { AlibiBanner } from "@/components/AlibiBanner";
import { BribeShop } from "@/components/BribeShop";
import { CourtroomScene } from "@/components/CourtroomScene";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code as string).toUpperCase();
  const router = useRouter();

  const {
    roomState,
    myPlayerId,
    joinRoom,
    leaveRoom,
    wordChoices,
    myWord,
    chatLog,
    connected,
    isSnitchThisTurn,
    isAlibiFakeThisTurn,
    alibiCategory,
  } = useGame();

  const [joinAttempted, setJoinAttempted] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connected || myPlayerId || joinAttempted) return;
    const identity = loadIdentity();
    if (identity && identity.roomCode === code) {
      setJoinAttempted(true);
      setNickname(identity.nickname);
      setAvatar(identity.avatar);
      joinRoom(code, identity.nickname, identity.avatar, identity.playerId).then((res) => {
        if (!res.ok) setJoinError(res.error);
      });
    }
  }, [connected, myPlayerId, joinAttempted, code, joinRoom]);

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) {
      setJoinError("Every suspect needs a name.");
      return;
    }
    setBusy(true);
    setJoinError(null);
    const res = await joinRoom(code, nickname, avatar);
    setBusy(false);
    if (!res.ok) setJoinError(res.error);
    setJoinAttempted(true);
  }

  function handleLeave() {
    leaveRoom();
    router.push("/");
  }

  if (!myPlayerId || !roomState) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <h1 className="font-typewriter text-3xl text-tape">Case {code}</h1>
        <div className="paper-sheet mt-6 w-full max-w-md rounded-sm p-6 text-charcoal-950">
          <form onSubmit={handleJoinSubmit} className="space-y-4">
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
            <div>
              <label className="mb-1 block font-typewriter text-xs uppercase tracking-wider text-charcoal-700">
                Disguise
              </label>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            {joinError && <p className="text-sm font-semibold text-blood">{joinError}</p>}
            <button
              type="submit"
              disabled={busy || !connected}
              className="stamp w-full border-blood text-center text-blood disabled:opacity-50"
            >
              {busy ? "..." : "Enter Scene"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const isRealDrawer = roomState.currentDrawerId === myPlayerId;
  const canDraw = roomState.activeDrawerId === myPlayerId;
  const canDrawFakeCanvas = roomState.aliasDrawerId === myPlayerId;
  const isHost = roomState.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const isAlibiTurn = roomState.aliasDrawerId != null;
  const turnKey = `${roomState.round}-${roomState.turnIndex}`;
  const isGuesser = !isRealDrawer && !canDrawFakeCanvas;

  return (
    <main className="min-h-screen px-3 py-4">
      <SfxPlayer />
      <div className="mx-auto flex max-w-6xl items-center justify-between pb-3">
        <h1 className="font-typewriter text-xl text-tape">DOODLE CRIMES</h1>
        <button onClick={handleLeave} className="text-xs uppercase text-paper/50 hover:text-blood">
          Leave case
        </button>
      </div>

      {roomState.phase === "LOBBY" && <Lobby roomState={roomState} isHost={isHost} />}

      {roomState.phase !== "LOBBY" && roomState.phase !== "TRIAL" && (
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <TopBar roomState={roomState} isDrawer={isRealDrawer} myWord={myWord} />
          {roomState.phase === "DRAWING" && roomState.currentSentence && (
            <SentenceBanner sentence={roomState.currentSentence} turnKey={turnKey} />
          )}
          {roomState.phase === "DRAWING" && isAlibiTurn && (
            <AlibiBanner turnKey={turnKey} category={alibiCategory} />
          )}
          <div className="grid gap-3 lg:grid-cols-[220px_1fr_280px]">
            <div className="order-2 lg:order-1 space-y-3">
              <PlayerList
                players={roomState.players}
                currentDrawerId={roomState.currentDrawerId}
                myPlayerId={myPlayerId}
                showDirtyInk={roomState.settings.bribeEconomyEnabled}
              />
              {roomState.phase === "DRAWING" && isSnitchThisTurn && <SnitchSabotageButton />}
              {roomState.settings.bribeEconomyEnabled && roomState.phase !== "PICK_WORD" && myPlayerId && (
                <BribeShop
                  myDirtyInk={roomState.players.find((p) => p.id === myPlayerId)?.dirtyInk ?? 0}
                  canBuyHint={isGuesser && roomState.phase === "DRAWING"}
                />
              )}
            </div>
            <div className="order-1 lg:order-2">
              {isAlibiTurn ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Canvas
                    isDrawer={canDraw}
                    applyHandicap={isRealDrawer}
                    sentence={roomState.currentSentence}
                    turnStartedAt={roomState.turnStartedAt}
                    turnKey={turnKey}
                    canvasId="A"
                    label={roomState.players.find((p) => p.id === roomState.currentDrawerId)?.nickname ?? "Drawer A"}
                  />
                  <Canvas
                    isDrawer={canDrawFakeCanvas}
                    applyHandicap={false}
                    sentence={null}
                    turnStartedAt={roomState.turnStartedAt}
                    turnKey={turnKey}
                    canvasId="B"
                    label={roomState.players.find((p) => p.id === roomState.aliasDrawerId)?.nickname ?? "Drawer B"}
                  />
                </div>
              ) : (
                <Canvas
                  isDrawer={canDraw}
                  applyHandicap={isRealDrawer}
                  sentence={roomState.currentSentence}
                  turnStartedAt={roomState.turnStartedAt}
                  turnKey={turnKey}
                />
              )}
            </div>
            <div className="order-3 h-[320px] lg:h-auto">
              <ChatPanel
                chatLog={chatLog}
                disabled={isRealDrawer || roomState.phase !== "DRAWING"}
                placeholder={isRealDrawer ? "You're drawing..." : "Type your guess..."}
                isSnitch={isSnitchThisTurn && roomState.phase === "DRAWING"}
              />
            </div>
          </div>
        </div>
      )}

      {roomState.phase === "PICK_WORD" && isRealDrawer && wordChoices && (
        <WordPicker choices={wordChoices.choices} expiresAt={wordChoices.expiresAt} />
      )}

      {roomState.phase === "ROUND_REVEAL" && (
        <RoundReveal
          roomState={roomState}
          isSnitchThisTurn={isSnitchThisTurn}
          isAlibiFakeThisTurn={isAlibiFakeThisTurn}
          myPlayerId={myPlayerId}
        />
      )}

      {roomState.phase === "TRIAL" && (
        <CourtroomScene roomState={roomState} myPlayerId={myPlayerId} isHost={isHost} />
      )}

      {roomState.phase === "GAME_OVER" && roomState.finalScoreboard && (
        <GameOverScreen finalScoreboard={roomState.finalScoreboard} isHost={isHost} />
      )}
    </main>
  );
}
