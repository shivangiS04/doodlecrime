"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSocket, GameSocket, saveIdentity, StoredIdentity } from "@/lib/socketClient";
import {
  Avatar,
  ChatEntry,
  DrawingAction,
  RoomSettings,
  RoomStatePublic,
  TurnRecording,
} from "@/lib/types";

interface WordChoicesState {
  choices: string[];
  expiresAt: number;
}

interface GameContextValue {
  socket: GameSocket;
  connected: boolean;
  roomState: RoomStatePublic | null;
  chatLog: ChatEntry[];
  wordChoices: WordChoicesState | null;
  privateHint: string | null;
  myPlayerId: string | null;
  sfxEvent: { name: string; nonce: number } | null;
  myWord: string | null;
  snitchAssignment: { sabotageWindowMs: number } | null;
  isSnitchThisTurn: boolean;

  createRoom: (nickname: string, avatar: Avatar) => Promise<{ ok: true; code: string } | { ok: false; error: string }>;
  joinRoom: (
    code: string,
    nickname: string,
    avatar: Avatar,
    rejoinPlayerId?: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  leaveRoom: () => void;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendChat: (text: string, decoy?: boolean) => void;
  sendDrawAction: (action: DrawingAction) => void;
  undo: () => void;
  clear: () => void;
  playAgain: () => void;
  activateSabotage: () => void;
  castSnitchVote: (targetPlayerId: string) => void;
  fetchEvidenceTape: () => Promise<TurnRecording[]>;
}

const GameContext = createContext<GameContextValue | null>(null);

const MAX_CHAT = 200;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  if (!socketRef.current && typeof window !== "undefined") {
    socketRef.current = getSocket();
  }

  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomStatePublic | null>(null);
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [wordChoices, setWordChoices] = useState<WordChoicesState | null>(null);
  const [privateHint, setPrivateHint] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [sfxEvent, setSfxEvent] = useState<{ name: string; nonce: number } | null>(null);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [snitchAssignment, setSnitchAssignment] = useState<{ sabotageWindowMs: number } | null>(null);
  const [isSnitchThisTurn, setIsSnitchThisTurn] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomState = (state: RoomStatePublic) => {
      setRoomState(state);
      if (state.phase === "PICK_WORD") {
        setMyWord(null);
        setSnitchAssignment(null);
        setIsSnitchThisTurn(false);
        if (state.currentDrawerId !== myPlayerId) setWordChoices(null);
      }
    };
    const onChat = (entry: ChatEntry) => {
      setChatLog((prev) => [...prev.slice(-(MAX_CHAT - 1)), entry]);
    };
    const onWordChoices = (payload: WordChoicesState) => setWordChoices(payload);
    const onPrivateHint = (payload: { text: string }) => {
      setPrivateHint(payload.text);
      setTimeout(() => setPrivateHint(null), 2500);
    };
    const onLetterHint = (payload: { revealedMask: string }) => {
      setRoomState((prev) => (prev ? { ...prev, revealedMask: payload.revealedMask } : prev));
    };
    const onRoundReveal = () => {
      setWordChoices(null);
      setSnitchAssignment(null);
    };
    const onSfx = (payload: { name: string }) => setSfxEvent({ name: payload.name, nonce: Date.now() });
    const onSnitchAssigned = (payload: { sabotageWindowMs: number }) => {
      setSnitchAssignment(payload);
      setIsSnitchThisTurn(true);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoomState);
    socket.on("chat:new", onChat);
    socket.on("word:choices", onWordChoices);
    socket.on("chat:privateHint", onPrivateHint);
    socket.on("turn:letterHint", onLetterHint);
    socket.on("round:reveal", onRoundReveal);
    socket.on("sfx", onSfx);
    socket.on("snitch:assigned", onSnitchAssigned);

    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onRoomState);
      socket.off("chat:new", onChat);
      socket.off("word:choices", onWordChoices);
      socket.off("chat:privateHint", onPrivateHint);
      socket.off("turn:letterHint", onLetterHint);
      socket.off("round:reveal", onRoundReveal);
      socket.off("sfx", onSfx);
      socket.off("snitch:assigned", onSnitchAssigned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlayerId]);

  const createRoom = useCallback(
    (nickname: string, avatar: Avatar) =>
      new Promise<{ ok: true; code: string } | { ok: false; error: string }>((resolve) => {
        socketRef.current!.emit("room:create", { nickname, avatar }, (res) => {
          if (res.ok) {
            setMyPlayerId(res.playerId);
            saveIdentity({ playerId: res.playerId, roomCode: res.code, nickname, avatar });
            resolve({ ok: true, code: res.code });
          } else {
            resolve(res);
          }
        });
      }),
    []
  );

  const joinRoom = useCallback(
    (code: string, nickname: string, avatar: Avatar, rejoinPlayerId?: string) =>
      new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
        socketRef.current!.emit(
          "room:join",
          { code: code.toUpperCase(), nickname, avatar, rejoinPlayerId },
          (res) => {
            if (res.ok) {
              setMyPlayerId(res.playerId);
              saveIdentity({ playerId: res.playerId, roomCode: code.toUpperCase(), nickname, avatar });
              resolve({ ok: true });
            } else {
              resolve(res);
            }
          }
        );
      }),
    []
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave");
    setRoomState(null);
    setChatLog([]);
    setMyPlayerId(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<RoomSettings>) => {
    socketRef.current?.emit("lobby:updateSettings", patch);
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit("lobby:start");
  }, []);

  const chooseWord = useCallback((word: string) => {
    socketRef.current?.emit("word:choose", { word });
    setWordChoices(null);
    setMyWord(word);
  }, []);

  const sendChat = useCallback((text: string, decoy?: boolean) => {
    socketRef.current?.emit("chat:send", { text, decoy });
  }, []);

  const sendDrawAction = useCallback((action: DrawingAction) => {
    socketRef.current?.emit("draw:action", action);
  }, []);

  const undo = useCallback(() => {
    socketRef.current?.emit("draw:undo");
  }, []);

  const clear = useCallback(() => {
    socketRef.current?.emit("draw:clear");
  }, []);

  const playAgain = useCallback(() => {
    socketRef.current?.emit("game:playAgain");
  }, []);

  const activateSabotage = useCallback(() => {
    socketRef.current?.emit("snitch:sabotage");
  }, []);

  const castSnitchVote = useCallback((targetPlayerId: string) => {
    socketRef.current?.emit("snitch:vote", { targetPlayerId });
  }, []);

  const fetchEvidenceTape = useCallback(
    () =>
      new Promise<TurnRecording[]>((resolve) => {
        socketRef.current!.emit("evidence:list", (recordings) => resolve(recordings));
      }),
    []
  );

  const value = useMemo<GameContextValue>(
    () => ({
      socket: socketRef.current!,
      connected,
      roomState,
      chatLog,
      wordChoices,
      privateHint,
      myPlayerId,
      sfxEvent,
      myWord,
      snitchAssignment,
      isSnitchThisTurn,
      createRoom,
      joinRoom,
      leaveRoom,
      updateSettings,
      startGame,
      chooseWord,
      sendChat,
      sendDrawAction,
      undo,
      clear,
      playAgain,
      activateSabotage,
      castSnitchVote,
      fetchEvidenceTape,
    }),
    [
      connected,
      roomState,
      chatLog,
      wordChoices,
      privateHint,
      myPlayerId,
      sfxEvent,
      myWord,
      snitchAssignment,
      isSnitchThisTurn,
      createRoom,
      joinRoom,
      leaveRoom,
      updateSettings,
      startGame,
      chooseWord,
      sendChat,
      sendDrawAction,
      undo,
      clear,
      playAgain,
      activateSabotage,
      castSnitchVote,
      fetchEvidenceTape,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export type { StoredIdentity };
