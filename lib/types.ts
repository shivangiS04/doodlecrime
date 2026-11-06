// Shared types for Doodle Crimes — used by both server and client.
// Server is authoritative: the secret word is NEVER sent to guessers.

export type GamePhase =
  | "LOBBY"
  | "PICK_WORD"
  | "DRAWING"
  | "ROUND_REVEAL"
  | "TRIAL"
  | "GAME_OVER";

export type Point = [number, number, number]; // x, y, pressure

export interface Stroke {
  id: string;
  color: string;
  size: number;
  tool: "brush" | "eraser";
  points: Point[];
}

export interface FillAction {
  id: string;
  type: "fill";
  x: number;
  y: number;
  color: string;
}

export type DrawingAction = Stroke | FillAction;
export type CanvasId = "A" | "B";

export interface Avatar {
  emoji: string;
  bg: string;
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  dirtyInk: number;
  isHost: boolean;
  connected: boolean;
  guessedThisTurn: boolean;
  seat: number;
}

export interface RoomSettings {
  totalRounds: number;
  drawTimeSec: 60 | 80 | 100;
  promptPack: string;
  customWords: string[];
  profanityFilter: boolean;
  maxPlayers: number;
  sentencesEnabled: boolean;
  snitchEnabled: boolean;
  bribeEconomyEnabled: boolean;
  alibiModeEnabled: boolean;
  trialEnabled: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  totalRounds: 3,
  drawTimeSec: 80,
  promptPack: "classic",
  customWords: [],
  profanityFilter: true,
  maxPlayers: 12,
  sentencesEnabled: false,
  snitchEnabled: false,
  bribeEconomyEnabled: false,
  alibiModeEnabled: false,
  trialEnabled: false,
};

export interface ChatEntry {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  system?: boolean;
  guess?: "correct" | "close" | "wrong";
}

export type ScoreReason =
  | "guess"
  | "drawer"
  | "speed-bonus"
  | "snitch-accuser"
  | "snitch-survivor"
  | "alibi-accuser"
  | "alibi-survivor"
  | "bribe-payoff"
  | "bribe-caught";

export interface ScoreDelta {
  playerId: string;
  nickname: string;
  points: number;
  reason: ScoreReason;
}

// ---------- Sentences (drawer handicaps) ----------

export type SentenceId =
  | "ink-meter"
  | "one-line"
  | "blind-canvas"
  | "mirrored"
  | "jitter"
  | "shrinking-canvas";

export const SENTENCE_LABELS: Record<SentenceId, string> = {
  "ink-meter": "Ink Meter",
  "one-line": "One Continuous Line",
  "blind-canvas": "Blind Canvas",
  mirrored: "Mirrored Hands",
  jitter: "The Shakes",
  "shrinking-canvas": "Shrinking Scene",
};

export const SENTENCE_IDS: SentenceId[] = [
  "ink-meter",
  "one-line",
  "blind-canvas",
  "mirrored",
  "jitter",
  "shrinking-canvas",
];

export const INK_METER_BUDGET = 5200; // total stroke-length units allowed

// ---------- Bribe Economy ----------

export const BRIBE_COSTS = {
  letterHint: 40,
  curseLeader: 60,
  bribeJudge: 50,
} as const;

export const DIRTY_INK_PER_GUESS = 15;

// ---------- Evidence Tape ----------

export interface TurnRecording {
  id: string;
  round: number;
  word: string;
  drawerId: string;
  drawerNickname: string;
  drawerAvatar: Avatar;
  actions: DrawingAction[];
}

// ---------- The Trial ----------

export type TrialStage = "VOTING" | "DEFENSE" | "VERDICT" | null;

export interface TrialVerdict {
  playerId: string;
  nickname: string;
  verdict: string;
  sentence: string;
}

// ---------- Room public state ----------

export interface SnitchVoteState {
  active: boolean;
  deadline: number;
  eligibleVoterIds: string[];
}

export interface AlibiVoteState {
  active: boolean;
  deadline: number;
  eligibleVoterIds: string[];
}

export interface RoomStatePublic {
  code: string;
  phase: GamePhase;
  settings: RoomSettings;
  players: PlayerPublic[];
  round: number;
  totalRounds: number;
  turnIndex: number;
  currentDrawerId: string | null;
  activeDrawerId: string | null; // normally === currentDrawerId; swaps to the Snitch during a sabotage window
  aliasDrawerId: string | null; // Alibi Mode's second ("fake") drawer for this turn, if any
  turnStartedAt: number | null;
  wordLength: number | null;
  revealedMask: string | null; // e.g. "_ _ t _ e"
  turnEndsAt: number | null; // epoch ms
  currentSentence: SentenceId | null;
  snitchVote: SnitchVoteState | null;
  alibiVote: AlibiVoteState | null;
  lastRoundReveal: {
    word: string;
    deltas: ScoreDelta[];
    recording: TurnRecording | null;
    snitchReveal: { snitchId: string; nickname: string; caught: boolean } | null;
    alibiReveal: { fakeId: string; nickname: string; caught: boolean } | null;
  } | null;
  finalScoreboard: PlayerPublic[] | null;

  // The Trial (end-of-game only)
  trialStage: TrialStage;
  trialDeadline: number | null;
  trialDefendants: string[];
  trialCurrentDefendantId: string | null;
  trialDefenses: Record<string, string>;
  trialVerdicts: TrialVerdict[] | null;
}

// ---------- Client -> Server events ----------

export interface ClientToServerEvents {
  "room:create": (
    payload: { nickname: string; avatar: Avatar },
    ack: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void
  ) => void;

  "room:join": (
    payload: { code: string; nickname: string; avatar: Avatar; rejoinPlayerId?: string },
    ack: (res: { ok: true; playerId: string } | { ok: false; error: string }) => void
  ) => void;

  "room:leave": () => void;

  "lobby:updateSettings": (payload: Partial<RoomSettings>) => void;

  "lobby:start": () => void;

  "word:choose": (payload: { word: string }) => void;

  "draw:action": (payload: DrawingAction, canvas: CanvasId) => void;
  "draw:undo": (canvas: CanvasId) => void;
  "draw:clear": (canvas: CanvasId) => void;

  "chat:send": (payload: { text: string; decoy?: boolean }) => void;

  "snitch:sabotage": () => void;
  "snitch:vote": (payload: { targetPlayerId: string }) => void;
  "alibi:vote": (payload: { targetPlayerId: string }) => void;

  "bribe:buyLetterHint": () => void;
  "bribe:curseLeader": () => void;
  "bribe:bribeJudge": () => void;

  "trial:vote": (payload: { targetPlayerId: string }) => void;
  "trial:defense": (payload: { text: string }) => void;
  "trial:continue": () => void;

  "evidence:list": (ack: (recordings: TurnRecording[]) => void) => void;

  "game:playAgain": () => void;
}

// ---------- Server -> Client events ----------

export interface ServerToClientEvents {
  "room:state": (state: RoomStatePublic) => void;
  "room:error": (payload: { error: string }) => void;

  "word:choices": (payload: { choices: string[]; expiresAt: number }) => void;

  "draw:action": (payload: DrawingAction, canvas: CanvasId) => void;
  "draw:undo": (canvas: CanvasId) => void;
  "draw:clear": (canvas: CanvasId) => void;
  "draw:canvasSync": (payload: { a: DrawingAction[]; b: DrawingAction[] }) => void;

  "chat:new": (entry: ChatEntry) => void;
  "chat:privateHint": (payload: { text: string }) => void;

  "turn:letterHint": (payload: { revealedMask: string }) => void;

  "round:reveal": (payload: {
    word: string;
    deltas: ScoreDelta[];
    recording: TurnRecording | null;
  }) => void;

  "game:over": (payload: { finalScoreboard: PlayerPublic[] }) => void;

  "sfx": (payload: { name: "typewriter" | "gavel" | "shutter" | "stamp" | "tada" | "snitch" }) => void;

  "snitch:assigned": (payload: { sabotageWindowMs: number }) => void;
  "alibi:assigned": (payload: { category: string }) => void;
}

export const SOCKET_PATH = "/api/socket";
