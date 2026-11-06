import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents, SOCKET_PATH } from "./types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (typeof window === "undefined") {
    throw new Error("getSocket() must be called in the browser");
  }
  if (!socket) {
    // When the socket server is deployed separately from the Next.js app (e.g. Vercel
    // frontend + Railway/Render/Fly socket server), set NEXT_PUBLIC_SOCKET_URL to its
    // public URL. Left unset, it connects same-origin (used by the combined local dev server).
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    const opts = { path: SOCKET_PATH, transports: ["websocket", "polling"] };
    socket = url ? io(url, opts) : io(opts);
  }
  return socket;
}

export interface StoredIdentity {
  playerId: string;
  roomCode: string;
  nickname: string;
  avatar: { emoji: string; bg: string };
}

const STORAGE_KEY = "doodlecrimes_identity";

export function saveIdentity(identity: StoredIdentity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore
  }
}

export function loadIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearIdentity() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
