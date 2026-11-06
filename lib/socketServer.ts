import type { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import { roomStore } from "./roomStore";
import { Room, RoomCallbacks } from "./gameEngine";
import {
  Avatar,
  ClientToServerEvents,
  ServerToClientEvents,
  SOCKET_PATH,
} from "./types";
import { filterProfanity } from "./profanity";
import { RateLimiter } from "./rateLimit";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const chatLimiter = new RateLimiter(8, 2); // 8 burst, refill 2/sec
const drawLimiter = new RateLimiter(60, 40); // 60 burst, refill 40/sec

interface SocketSession {
  roomCode: string;
  playerId: string;
}

const sessions: Map<string, SocketSession> = new Map();

function makeRoomCallbacks(io: IOServer, code: string): RoomCallbacks {
  return {
    onStateChange: (room: Room) => {
      io.to(code).emit("room:state", room.getPublicState());
    },
    onWordChoices: (playerId: string, choices: string[], expiresAt: number) => {
      const room = roomStore.get(code);
      const socketId = findSocketId(room, playerId);
      if (socketId) io.to(socketId).emit("word:choices", { choices, expiresAt });
    },
    onChat: (entry) => {
      io.to(code).emit("chat:new", entry);
    },
    onPrivateHint: (playerId: string, text: string) => {
      const room = roomStore.get(code);
      const socketId = findSocketId(room, playerId);
      if (socketId) io.to(socketId).emit("chat:privateHint", { text });
    },
    onLetterHint: (revealedMask: string) => {
      io.to(code).emit("turn:letterHint", { revealedMask });
    },
    onRoundReveal: (word, deltas, recording) => {
      io.to(code).emit("round:reveal", { word, deltas, recording });
    },
    onGameOver: (finalScoreboard) => {
      io.to(code).emit("game:over", { finalScoreboard });
    },
    onSfx: (name) => {
      io.to(code).emit("sfx", { name });
    },
    onPlayerRemoved: (playerId: string) => {
      for (const [sid, sess] of sessions) {
        if (sess.roomCode === code && sess.playerId === playerId) sessions.delete(sid);
      }
    },
    onSnitchAssigned: (playerId: string, sabotageWindowMs: number) => {
      const room = roomStore.get(code);
      const socketId = findSocketId(room, playerId);
      if (socketId) io.to(socketId).emit("snitch:assigned", { sabotageWindowMs });
    },
    onAlibiAssigned: (playerId: string, category: string) => {
      const room = roomStore.get(code);
      const socketId = findSocketId(room, playerId);
      if (socketId) io.to(socketId).emit("alibi:assigned", { category });
    },
  };
}

function findSocketId(room: Room | undefined, playerId: string): string | null {
  if (!room) return null;
  const player = room.players.get(playerId);
  return player?.socketId ?? null;
}

function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, 20) || "Suspect";
}

function sanitizeAvatar(raw: Avatar | undefined): Avatar {
  if (!raw || typeof raw.emoji !== "string" || typeof raw.bg !== "string") {
    return { emoji: "🕵️", bg: "#f2c200" };
  }
  return { emoji: raw.emoji.slice(0, 8), bg: raw.bg.slice(0, 16) };
}

export function initSocketServer(httpServer: HTTPServer): IOServer {
  const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const io: IOServer = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: allowedOrigins.length > 1 || allowedOrigins[0] !== "*" ? allowedOrigins : "*" },
  });

  io.on("connection", (socket: IOSocket) => {
    socket.on("room:create", ({ nickname, avatar }, ack) => {
      try {
        const room = roomStore.createRoom((code) => makeRoomCallbacks(io, code));
        const playerId = nanoid(10);
        room.addPlayer(playerId, socket.id, sanitizeNickname(nickname), sanitizeAvatar(avatar));
        socket.join(room.code);
        sessions.set(socket.id, { roomCode: room.code, playerId });
        ack({ ok: true, code: room.code, playerId });
      } catch (e) {
        ack({ ok: false, error: "Could not create room." });
      }
    });

    socket.on("room:join", ({ code, nickname, avatar, rejoinPlayerId }, ack) => {
      const room = roomStore.get((code || "").toUpperCase());
      if (!room) return ack({ ok: false, error: "Room not found." });

      if (rejoinPlayerId && room.players.has(rejoinPlayerId)) {
        room.reconnectPlayer(rejoinPlayerId, socket.id);
        socket.join(room.code);
        sessions.set(socket.id, { roomCode: room.code, playerId: rejoinPlayerId });
        if (room.phase === "DRAWING") {
          socket.emit("draw:canvasSync", { a: room.drawingHistory, b: room.drawingHistoryB });
        }
        return ack({ ok: true, playerId: rejoinPlayerId });
      }

      if (room.phase !== "LOBBY") return ack({ ok: false, error: "Game already in progress." });
      if (room.players.size >= room.settings.maxPlayers) return ack({ ok: false, error: "Room is full." });

      const clean = sanitizeNickname(nickname);
      if (room.byNickname(clean)) return ack({ ok: false, error: "Nickname already taken in this room." });

      const playerId = nanoid(10);
      room.addPlayer(playerId, socket.id, clean, sanitizeAvatar(avatar));
      socket.join(room.code);
      sessions.set(socket.id, { roomCode: room.code, playerId });
      ack({ ok: true, playerId });
    });

    socket.on("room:leave", () => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      const room = roomStore.get(sess.roomCode);
      room?.removePlayer(sess.playerId);
      socket.leave(sess.roomCode);
      sessions.delete(socket.id);
      if (room) roomStore.deleteIfEmpty(room.code);
    });

    socket.on("lobby:updateSettings", (patch) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player?.isHost) return;
      room.updateSettings(patch);
    });

    socket.on("lobby:start", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player?.isHost) return;
      room.startGame();
    });

    socket.on("word:choose", ({ word }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.chooseWord(player.id, word);
    });

    socket.on("draw:action", (action, canvas) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player || !room.canDrawOnCanvas(player.id, canvas)) return;
      if (!drawLimiter.tryConsume(socket.id)) return;
      room.recordDrawAction(action, canvas);
      socket.to(room.code).emit("draw:action", action, canvas);
    });

    socket.on("draw:undo", (canvas) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player || !room.canDrawOnCanvas(player.id, canvas)) return;
      room.undoLastStroke(canvas);
      socket.to(room.code).emit("draw:undo", canvas);
    });

    socket.on("draw:clear", (canvas) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player || !room.canDrawOnCanvas(player.id, canvas)) return;
      room.clearDrawing(canvas);
      socket.to(room.code).emit("draw:clear", canvas);
    });

    socket.on("chat:send", ({ text, decoy }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      if (!chatLimiter.tryConsume(socket.id)) return;
      const trimmed = (text || "").slice(0, 200);
      if (!trimmed.trim()) return;
      const clean = filterProfanity(trimmed, room.settings.profanityFilter);
      if (decoy) room.handleDecoyGuess(player.id, clean);
      else room.handleGuess(player.id, clean);
    });

    socket.on("snitch:sabotage", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.activateSabotage(player.id);
    });

    socket.on("snitch:vote", ({ targetPlayerId }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.castSnitchVote(player.id, targetPlayerId);
    });

    socket.on("alibi:vote", ({ targetPlayerId }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.castAlibiVote(player.id, targetPlayerId);
    });

    socket.on("bribe:buyLetterHint", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.buyLetterHint(player.id);
    });

    socket.on("bribe:curseLeader", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.curseLeader(player.id);
    });

    socket.on("bribe:bribeJudge", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.bribeJudge(player.id);
    });

    socket.on("trial:vote", ({ targetPlayerId }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.castTrialVote(player.id, targetPlayerId);
    });

    socket.on("trial:defense", ({ text }) => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player) return;
      room.submitTrialDefense(player.id, (text || "").slice(0, 280));
    });

    socket.on("trial:continue", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player?.isHost) return;
      room.continueTrial();
    });

    socket.on("evidence:list", (ack) => {
      const { room } = getRoomAndPlayer(socket.id);
      ack(room ? room.evidenceTape : []);
    });

    socket.on("game:playAgain", () => {
      const { room, player } = getRoomAndPlayer(socket.id);
      if (!room || !player?.isHost) return;
      room.playAgain();
    });

    socket.on("disconnect", () => {
      const sess = sessions.get(socket.id);
      chatLimiter.drop(socket.id);
      drawLimiter.drop(socket.id);
      if (!sess) return;
      const room = roomStore.get(sess.roomCode);
      room?.markDisconnected(sess.playerId);
      sessions.delete(socket.id);
    });
  });

  function getRoomAndPlayer(socketId: string) {
    const sess = sessions.get(socketId);
    if (!sess) return { room: undefined, player: undefined };
    const room = roomStore.get(sess.roomCode);
    const player = room?.players.get(sess.playerId);
    return { room, player };
  }

  return io;
}
