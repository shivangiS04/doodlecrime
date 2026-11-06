import { nanoid } from "nanoid";
import {
  Avatar,
  AlibiVoteState,
  BRIBE_COSTS,
  CanvasId,
  ChatEntry,
  DIRTY_INK_PER_GUESS,
  DrawingAction,
  GamePhase,
  PlayerPublic,
  RoomSettings,
  RoomStatePublic,
  ScoreDelta,
  ScoreReason,
  SentenceId,
  SENTENCE_IDS,
  SnitchVoteState,
  TrialStage,
  TrialVerdict,
  TurnRecording,
  DEFAULT_SETTINGS,
} from "./types";
import { matchGuess } from "./guessMatch";
import { drawerPoints, guessPoints } from "./scoring";
import { pickWordChoices, PROMPT_PACKS } from "./prompts";
import { generateVerdicts } from "./trialJudge";

const RECONNECT_GRACE_MS = 60_000;
const PICK_WORD_DEADLINE_MS = 12_000;
const ROUND_REVEAL_MS = 5_000;
const SNITCH_VOTE_MS = 9_000;
const SNITCH_REVEAL_PAUSE_MS = 4_000;
const SABOTAGE_WINDOW_MS = 3_000;
const SNITCH_ACCUSER_POINTS = 60;
const SNITCH_SURVIVOR_POINTS = 90;
const ALIBI_VOTE_MS = 9_000;
const ALIBI_REVEAL_PAUSE_MS = 4_000;
const ALIBI_ACCUSER_POINTS = 60;
const ALIBI_SURVIVOR_POINTS = 90;
const BRIBE_CATCH_CHANCE = 0.2;
const LETTER_HINT_COUNT = 4;
const TRIAL_VOTE_MS = 20_000;
const TRIAL_DEFENSE_MS = 15_000;
const TRIAL_AUTO_CONTINUE_MS = 45_000;

interface PlayerInternal {
  id: string;
  socketId: string | null;
  nickname: string;
  avatar: Avatar;
  score: number;
  dirtyInk: number;
  isHost: boolean;
  connected: boolean;
  seat: number;
  guessedThisTurn: boolean;
  guessedAtMs: number | null;
  guessScoreForDisplay: number | null;
  guessScoreReason: ScoreReason;
  disconnectTimer: NodeJS.Timeout | null;
}

export interface RoomCallbacks {
  onStateChange: (room: Room) => void;
  onWordChoices: (playerId: string, choices: string[], expiresAt: number) => void;
  onChat: (entry: ChatEntry) => void;
  onPrivateHint: (playerId: string, text: string) => void;
  onLetterHint: (revealedMask: string) => void;
  onRoundReveal: (word: string, deltas: ScoreDelta[], recording: TurnRecording | null) => void;
  onGameOver: (finalScoreboard: PlayerPublic[]) => void;
  onSfx: (name: "typewriter" | "gavel" | "shutter" | "stamp" | "tada" | "snitch") => void;
  onPlayerRemoved: (playerId: string) => void;
  onSnitchAssigned: (playerId: string, sabotageWindowMs: number) => void;
  onAlibiAssigned: (playerId: string, category: string) => void;
}

export class Room {
  readonly code: string;
  phase: GamePhase = "LOBBY";
  settings: RoomSettings = { ...DEFAULT_SETTINGS };

  players: Map<string, PlayerInternal> = new Map();
  turnOrder: string[] = [];
  turnIndex = 0;
  round = 1;

  currentDrawerId: string | null = null;
  secretWord: string | null = null;
  wordLength: number | null = null;
  revealedIndices: Set<number> = new Set();
  usedWords: Set<string> = new Set();

  turnEndsAt: number | null = null;
  drawingHistory: DrawingAction[] = [];
  drawingHistoryB: DrawingAction[] = [];
  evidenceTape: TurnRecording[] = [];

  // Sentences (drawer handicaps)
  currentSentence: SentenceId | null = null;

  // The Snitch
  currentSnitchId: string | null = null;
  sabotageUsed = false;
  sabotageActiveUntil: number | null = null;
  sabotagePlayerId: string | null = null;
  snitchVotes: Map<string, string> = new Map();
  snitchVoteOpen = false;
  snitchVoteDeadline: number | null = null;

  // Alibi Mode
  aliasDrawerId: string | null = null;
  alibiVotes: Map<string, string> = new Map();
  alibiVoteOpen = false;
  alibiVoteDeadline: number | null = null;

  // Bribe Economy
  pendingCurse: Map<string, SentenceId> = new Map();
  pendingBribe: Set<string> = new Set();

  // The Trial
  trialStage: TrialStage = null;
  trialDeadline: number | null = null;
  trialVotes: Map<string, string> = new Map();
  trialDefendants: string[] = [];
  trialDefenseIndex = 0;
  trialDefenses: Record<string, string> = {};
  trialVerdicts: TrialVerdict[] | null = null;

  lastRoundReveal: {
    word: string;
    deltas: ScoreDelta[];
    recording: TurnRecording | null;
    snitchReveal: { snitchId: string; nickname: string; caught: boolean } | null;
    alibiReveal: { fakeId: string; nickname: string; caught: boolean } | null;
  } | null = null;
  finalScoreboard: PlayerPublic[] | null = null;

  private timers: Set<NodeJS.Timeout> = new Set();
  private cb: RoomCallbacks;
  private nextSeat = 0;

  constructor(code: string, cb: RoomCallbacks) {
    this.code = code;
    this.cb = cb;
  }

  // ---------- helpers ----------

  private setTimer(fn: () => void, ms: number): NodeJS.Timeout {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  private clearAllTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  get connectedPlayers(): PlayerInternal[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  get guessers(): PlayerInternal[] {
    return this.connectedPlayers.filter((p) => p.id !== this.currentDrawerId);
  }

  getActiveDrawerId(): string | null {
    if (this.sabotageActiveUntil && Date.now() < this.sabotageActiveUntil) {
      return this.sabotagePlayerId;
    }
    return this.currentDrawerId;
  }

  getPublicState(): RoomStatePublic {
    const players: PlayerPublic[] = [...this.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        dirtyInk: p.dirtyInk,
        isHost: p.isHost,
        connected: p.connected,
        guessedThisTurn: p.guessedThisTurn,
        seat: p.seat,
      }));

    const snitchVote: SnitchVoteState | null = this.snitchVoteOpen
      ? {
          active: true,
          deadline: this.snitchVoteDeadline!,
          eligibleVoterIds: this.guessers.filter((p) => p.id !== this.currentSnitchId).map((p) => p.id),
        }
      : null;

    const alibiVote: AlibiVoteState | null = this.alibiVoteOpen
      ? {
          active: true,
          deadline: this.alibiVoteDeadline!,
          eligibleVoterIds: this.guessers.filter((p) => p.id !== this.aliasDrawerId).map((p) => p.id),
        }
      : null;

    return {
      code: this.code,
      phase: this.phase,
      settings: this.settings,
      players,
      round: this.round,
      totalRounds: this.settings.totalRounds,
      turnIndex: this.turnIndex,
      currentDrawerId: this.currentDrawerId,
      activeDrawerId: this.getActiveDrawerId(),
      aliasDrawerId: this.aliasDrawerId,
      turnStartedAt: this.turnEndsAt ? this.turnEndsAt - this.settings.drawTimeSec * 1000 : null,
      wordLength: this.wordLength,
      revealedMask: this.getRevealedMask(),
      turnEndsAt: this.turnEndsAt,
      currentSentence: this.currentSentence,
      snitchVote,
      alibiVote,
      lastRoundReveal: this.lastRoundReveal,
      finalScoreboard: this.finalScoreboard,
      trialStage: this.trialStage,
      trialDeadline: this.trialDeadline,
      trialDefendants: this.trialDefendants,
      trialCurrentDefendantId: this.trialDefendants[this.trialDefenseIndex] ?? null,
      trialDefenses: this.trialDefenses,
      trialVerdicts: this.trialVerdicts,
    };
  }

  private getRevealedMask(): string | null {
    if (!this.secretWord) return null;
    return this.secretWord
      .split("")
      .map((ch, i) => {
        if (ch === " ") return " ";
        return this.revealedIndices.has(i) ? ch : "_";
      })
      .join("");
  }

  private notify() {
    this.cb.onStateChange(this);
  }

  private systemChat(text: string) {
    this.cb.onChat({ id: nanoid(8), playerId: "system", nickname: "System", text, system: true });
  }

  // ---------- player management ----------

  addPlayer(id: string, socketId: string, nickname: string, avatar: Avatar): PlayerInternal {
    const isFirst = this.players.size === 0;
    const player: PlayerInternal = {
      id,
      socketId,
      nickname,
      avatar,
      score: 0,
      dirtyInk: 0,
      isHost: isFirst,
      connected: true,
      seat: this.nextSeat++,
      guessedThisTurn: false,
      guessedAtMs: null,
      guessScoreForDisplay: null,
      guessScoreReason: "guess",
      disconnectTimer: null,
    };
    this.players.set(id, player);
    this.systemChat(`${nickname} joined the crime scene.`);
    this.notify();
    return player;
  }

  reconnectPlayer(id: string, socketId: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    player.socketId = socketId;
    player.connected = true;
    this.systemChat(`${player.nickname} is back.`);
    this.notify();
    return true;
  }

  markDisconnected(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    this.notify();
    player.disconnectTimer = this.setTimer(() => {
      this.removePlayer(id);
    }, RECONNECT_GRACE_MS);
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.players.delete(id);
    this.turnOrder = this.turnOrder.filter((pid) => pid !== id);

    if (player.isHost) {
      const next = [...this.players.values()].sort((a, b) => a.seat - b.seat)[0];
      if (next) next.isHost = true;
    }

    this.cb.onPlayerRemoved(id);

    if (this.players.size === 0) {
      this.clearAllTimers();
      this.notify();
      return;
    }

    this.systemChat(`${player.nickname} left.`);

    if (this.currentDrawerId === id && (this.phase === "DRAWING" || this.phase === "PICK_WORD")) {
      this.endTurn();
    } else {
      this.notify();
    }
  }

  byNickname(nickname: string): boolean {
    return [...this.players.values()].some((p) => p.nickname.toLowerCase() === nickname.toLowerCase());
  }

  updateSettings(patch: Partial<RoomSettings>) {
    if (this.phase !== "LOBBY") return;
    this.settings = { ...this.settings, ...patch };
    this.notify();
  }

  // ---------- game flow ----------

  canStart(): boolean {
    return this.phase === "LOBBY" && this.players.size >= 3;
  }

  startGame() {
    if (!this.canStart()) return;
    this.round = 1;
    this.turnIndex = 0;
    this.usedWords.clear();
    this.evidenceTape = [];
    this.pendingCurse.clear();
    this.pendingBribe.clear();
    this.resetTrialState();
    for (const p of this.players.values()) p.score = 0;
    this.turnOrder = [...this.players.keys()].sort(() => Math.random() - 0.5);
    this.finalScoreboard = null;
    this.beginTurn();
  }

  private beginTurn() {
    this.clearAllTimers();
    this.drawingHistory = [];
    this.drawingHistoryB = [];
    this.revealedIndices.clear();
    this.secretWord = null;
    this.wordLength = null;
    this.lastRoundReveal = null;
    this.currentSentence = null;
    this.resetSnitchState();
    this.resetAlibiState();

    for (const p of this.players.values()) {
      p.guessedThisTurn = false;
      p.guessedAtMs = null;
      p.guessScoreForDisplay = null;
    }

    this.currentDrawerId = this.turnOrder[this.turnIndex] ?? null;
    if (!this.currentDrawerId || !this.players.has(this.currentDrawerId)) {
      this.advanceTurnPointer();
      return;
    }

    this.phase = "PICK_WORD";
    const choices = pickWordChoices(this.settings.promptPack, this.settings.customWords, this.usedWords, 3);
    const expiresAt = Date.now() + PICK_WORD_DEADLINE_MS;
    this.cb.onWordChoices(this.currentDrawerId, choices, expiresAt);
    this.cb.onSfx("typewriter");
    this.notify();

    this.setTimer(() => {
      if (this.phase === "PICK_WORD") this.chooseWord(this.currentDrawerId!, choices[0]);
    }, PICK_WORD_DEADLINE_MS);
  }

  private resetSnitchState() {
    this.currentSnitchId = null;
    this.sabotageUsed = false;
    this.sabotageActiveUntil = null;
    this.sabotagePlayerId = null;
    this.snitchVotes.clear();
    this.snitchVoteOpen = false;
    this.snitchVoteDeadline = null;
  }

  private resetAlibiState() {
    this.aliasDrawerId = null;
    this.alibiVotes.clear();
    this.alibiVoteOpen = false;
    this.alibiVoteDeadline = null;
  }

  private resetTrialState() {
    this.trialStage = null;
    this.trialDeadline = null;
    this.trialVotes.clear();
    this.trialDefendants = [];
    this.trialDefenseIndex = 0;
    this.trialDefenses = {};
    this.trialVerdicts = null;
  }

  chooseWord(playerId: string, word: string) {
    if (this.phase !== "PICK_WORD" || playerId !== this.currentDrawerId) return;
    this.clearAllTimers();

    this.secretWord = word;
    this.wordLength = word.replace(/\s/g, "").length;
    this.usedWords.add(word);
    this.phase = "DRAWING";
    const durationMs = this.settings.drawTimeSec * 1000;
    this.turnEndsAt = Date.now() + durationMs;

    const curse = this.pendingCurse.get(playerId);
    if (curse) {
      this.currentSentence = curse;
      this.pendingCurse.delete(playerId);
      this.cb.onSfx("stamp");
    } else if (this.settings.sentencesEnabled) {
      this.currentSentence = SENTENCE_IDS[Math.floor(Math.random() * SENTENCE_IDS.length)];
      this.cb.onSfx("stamp");
    }
    this.assignSnitchIfEnabled();
    this.assignAlibiIfEnabled();

    this.scheduleLetterHints(durationMs);
    this.setTimer(() => this.endTurn(), durationMs);
    this.notify();
  }

  private assignSnitchIfEnabled() {
    if (!this.settings.snitchEnabled) return;
    const candidates = this.guessers;
    if (candidates.length < 2) return; // need someone else left to vote
    const snitch = candidates[Math.floor(Math.random() * candidates.length)];
    this.currentSnitchId = snitch.id;
    this.cb.onSnitchAssigned(snitch.id, SABOTAGE_WINDOW_MS);
  }

  private assignAlibiIfEnabled() {
    if (!this.settings.alibiModeEnabled) return;
    const candidates = this.guessers;
    if (candidates.length < 1) return;
    const fake = candidates[Math.floor(Math.random() * candidates.length)];
    this.aliasDrawerId = fake.id;
    const pack = PROMPT_PACKS[this.settings.promptPack];
    const category = pack ? pack.name : this.settings.promptPack === "custom" ? "Custom Words" : "Mystery Category";
    this.cb.onAlibiAssigned(fake.id, category);
  }

  activateSabotage(playerId: string) {
    if (
      this.phase !== "DRAWING" ||
      playerId !== this.currentSnitchId ||
      this.sabotageUsed ||
      this.sabotageActiveUntil
    ) {
      return;
    }
    this.sabotageUsed = true;
    this.sabotagePlayerId = playerId;
    this.sabotageActiveUntil = Date.now() + SABOTAGE_WINDOW_MS;
    this.cb.onSfx("snitch");
    this.notify();

    this.setTimer(() => {
      this.sabotageActiveUntil = null;
      this.sabotagePlayerId = null;
      this.notify();
    }, SABOTAGE_WINDOW_MS);
  }

  handleDecoyGuess(playerId: string, text: string) {
    if (this.phase !== "DRAWING" || playerId !== this.currentSnitchId) return;
    const player = this.players.get(playerId);
    if (!player) return;
    this.cb.onChat({ id: nanoid(8), playerId, nickname: player.nickname, text });
    this.cb.onPrivateHint(playerId, "Decoy sent — nobody suspects a thing... yet.");
  }

  castSnitchVote(voterId: string, targetPlayerId: string) {
    if (!this.snitchVoteOpen) return;
    if (voterId === targetPlayerId || voterId === this.currentSnitchId) return;
    if (!this.players.has(targetPlayerId)) return;
    this.snitchVotes.set(voterId, targetPlayerId);
  }

  castAlibiVote(voterId: string, targetPlayerId: string) {
    if (!this.alibiVoteOpen) return;
    if (voterId === this.currentDrawerId || voterId === this.aliasDrawerId) return;
    if (!this.players.has(targetPlayerId)) return;
    this.alibiVotes.set(voterId, targetPlayerId);
  }

  // ---------- Bribe Economy ----------

  buyLetterHint(playerId: string) {
    if (!this.settings.bribeEconomyEnabled || this.phase !== "DRAWING" || !this.secretWord) return;
    const player = this.players.get(playerId);
    if (!player || playerId === this.getActiveDrawerId() || player.dirtyInk < BRIBE_COSTS.letterHint) return;

    const hiddenIndices = this.secretWord
      .split("")
      .map((ch, i) => (ch !== " " && !this.revealedIndices.has(i) ? i : -1))
      .filter((i) => i >= 0);
    if (hiddenIndices.length === 0) {
      this.cb.onPrivateHint(playerId, "There's nothing left to reveal!");
      return;
    }

    player.dirtyInk -= BRIBE_COSTS.letterHint;
    const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    this.cb.onPrivateHint(playerId, `Private tip: letter ${idx + 1} is "${this.secretWord[idx]}".`);
    this.notify();
  }

  curseLeader(playerId: string) {
    if (!this.settings.bribeEconomyEnabled) return;
    if (this.phase === "LOBBY" || this.phase === "GAME_OVER" || this.phase === "TRIAL") return;
    const buyer = this.players.get(playerId);
    if (!buyer || buyer.dirtyInk < BRIBE_COSTS.curseLeader) return;

    const leader = [...this.players.values()].sort((a, b) => b.score - a.score)[0];
    if (!leader || leader.id === playerId) {
      this.cb.onPrivateHint(playerId, "You're already in the lead — nobody to curse!");
      return;
    }

    buyer.dirtyInk -= BRIBE_COSTS.curseLeader;
    const sentence = SENTENCE_IDS[Math.floor(Math.random() * SENTENCE_IDS.length)];
    this.pendingCurse.set(leader.id, sentence);
    this.systemChat(`${buyer.nickname} cursed ${leader.nickname}! Their next turn won't be easy...`);
    this.cb.onSfx("stamp");
    this.notify();
  }

  bribeJudge(playerId: string) {
    if (!this.settings.bribeEconomyEnabled) return;
    if (this.phase === "LOBBY" || this.phase === "GAME_OVER" || this.phase === "TRIAL") return;
    const buyer = this.players.get(playerId);
    if (!buyer || buyer.dirtyInk < BRIBE_COSTS.bribeJudge || this.pendingBribe.has(playerId)) return;

    buyer.dirtyInk -= BRIBE_COSTS.bribeJudge;
    this.pendingBribe.add(playerId);
    this.cb.onPrivateHint(playerId, "Bribe placed. Fingers crossed...");
    this.cb.onSfx("stamp");
    this.notify();
  }

  private scheduleLetterHints(durationMs: number) {
    if (!this.secretWord) return;
    const letterIndices = this.secretWord
      .split("")
      .map((ch, i) => (ch !== " " ? i : -1))
      .filter((i) => i >= 0);

    const maxHints = Math.min(LETTER_HINT_COUNT, Math.max(0, letterIndices.length - 1));
    if (maxHints <= 0) return;

    const shuffled = [...letterIndices].sort(() => Math.random() - 0.5).slice(0, maxHints);
    for (let h = 0; h < shuffled.length; h++) {
      const delay = durationMs * ((h + 1) / (maxHints + 1));
      this.setTimer(() => {
        this.revealedIndices.add(shuffled[h]);
        this.cb.onLetterHint(this.getRevealedMask()!);
      }, delay);
    }
  }

  handleGuess(playerId: string, rawText: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    const entry: ChatEntry = { id: nanoid(8), playerId, nickname: player.nickname, text: rawText };

    if (this.phase !== "DRAWING" || playerId === this.currentDrawerId || player.guessedThisTurn || !this.secretWord) {
      this.cb.onChat(entry);
      return;
    }

    const result = matchGuess(rawText, this.secretWord);

    if (result === "correct") {
      const elapsed = Date.now() - (this.turnEndsAt! - this.settings.drawTimeSec * 1000);
      let points = guessPoints(elapsed, this.settings.drawTimeSec * 1000);
      let reason: ScoreReason = "guess";

      if (this.settings.bribeEconomyEnabled && this.pendingBribe.has(playerId)) {
        this.pendingBribe.delete(playerId);
        if (Math.random() < BRIBE_CATCH_CHANCE) {
          points = 0;
          this.systemChat(`${player.nickname}'s bribe was discovered by the judge! No points this round.`);
          reason = "bribe-caught";
        } else {
          points *= 2;
          this.systemChat(`${player.nickname}'s bribe paid off — double points!`);
          reason = "bribe-payoff";
        }
      }

      player.score += points;
      player.dirtyInk += DIRTY_INK_PER_GUESS;
      player.guessedThisTurn = true;
      player.guessedAtMs = Date.now();
      player.guessScoreForDisplay = points;
      player.guessScoreReason = reason;

      this.cb.onChat({ ...entry, text: `${player.nickname} guessed the word!`, guess: "correct" });
      this.cb.onSfx("shutter");

      const drawer = this.players.get(this.currentDrawerId!);
      if (drawer) drawer.score += drawerPoints(1);

      this.notify();

      if (this.guessers.every((p) => p.guessedThisTurn)) {
        this.endTurn();
      }
      return;
    }

    if (result === "close") {
      this.cb.onPrivateHint(playerId, `"${rawText}" is close!`);
      entry.guess = "close";
    } else {
      entry.guess = "wrong";
    }
    this.cb.onChat(entry);
  }

  private recordEvidence(word: string) {
    if (!this.currentDrawerId || this.drawingHistory.length === 0) return;
    const drawer = this.players.get(this.currentDrawerId);
    if (!drawer) return;
    this.evidenceTape.push({
      id: nanoid(8),
      round: this.round,
      word,
      drawerId: drawer.id,
      drawerNickname: drawer.nickname,
      drawerAvatar: drawer.avatar,
      actions: [...this.drawingHistory],
    });
  }

  private endTurn() {
    if (this.phase === "GAME_OVER" || this.phase === "ROUND_REVEAL") return;
    this.clearAllTimers();

    const word = this.secretWord ?? "???";
    const deltas: ScoreDelta[] = [];

    for (const p of this.guessers) {
      if (p.guessedThisTurn && p.guessScoreForDisplay != null && p.guessScoreForDisplay > 0) {
        deltas.push({
          playerId: p.id,
          nickname: p.nickname,
          points: p.guessScoreForDisplay,
          reason: p.guessScoreReason,
        });
      }
    }
    const correctCount = this.guessers.filter((p) => p.guessedThisTurn).length;
    if (this.currentDrawerId && correctCount > 0) {
      const drawer = this.players.get(this.currentDrawerId);
      if (drawer) {
        deltas.push({
          playerId: drawer.id,
          nickname: drawer.nickname,
          points: drawerPoints(correctCount),
          reason: "drawer",
        });
      }
    }

    this.recordEvidence(word);
    const recording = this.evidenceTape[this.evidenceTape.length - 1] ?? null;

    this.phase = "ROUND_REVEAL";
    this.turnEndsAt = null;
    this.lastRoundReveal = { word, deltas, recording, snitchReveal: null, alibiReveal: null };
    this.cb.onRoundReveal(word, deltas, recording);
    this.cb.onSfx("gavel");
    this.notify();

    this.runPostRevealSequence();
  }

  private runPostRevealSequence() {
    if (this.settings.snitchEnabled && this.currentSnitchId && this.players.has(this.currentSnitchId)) {
      this.openSnitchVote();
    } else if (this.settings.alibiModeEnabled && this.aliasDrawerId && this.players.has(this.aliasDrawerId)) {
      this.openAlibiVote();
    } else {
      this.setTimer(() => this.advanceTurnPointer(), ROUND_REVEAL_MS);
    }
  }

  private openSnitchVote() {
    this.snitchVoteOpen = true;
    this.snitchVoteDeadline = Date.now() + SNITCH_VOTE_MS;
    this.notify();
    this.setTimer(() => this.resolveSnitchVote(), SNITCH_VOTE_MS);
  }

  private resolveSnitchVote() {
    if (!this.lastRoundReveal || !this.currentSnitchId) {
      this.setTimer(() => this.advanceTurnPointer(), 0);
      return;
    }
    this.snitchVoteOpen = false;

    const tally: Map<string, number> = new Map();
    for (const target of this.snitchVotes.values()) {
      tally.set(target, (tally.get(target) ?? 0) + 1);
    }

    let topTarget: string | null = null;
    let topVotes = 0;
    for (const [target, votes] of tally) {
      if (votes > topVotes) {
        topVotes = votes;
        topTarget = target;
      }
    }

    const caught = topTarget === this.currentSnitchId && topVotes > 0;
    const extraDeltas: ScoreDelta[] = [];

    if (caught) {
      for (const [voterId, target] of this.snitchVotes) {
        if (target !== this.currentSnitchId) continue;
        const voter = this.players.get(voterId);
        if (!voter) continue;
        voter.score += SNITCH_ACCUSER_POINTS;
        extraDeltas.push({ playerId: voter.id, nickname: voter.nickname, points: SNITCH_ACCUSER_POINTS, reason: "snitch-accuser" });
      }
    } else {
      const snitch = this.players.get(this.currentSnitchId);
      if (snitch) {
        snitch.score += SNITCH_SURVIVOR_POINTS;
        extraDeltas.push({ playerId: snitch.id, nickname: snitch.nickname, points: SNITCH_SURVIVOR_POINTS, reason: "snitch-survivor" });
      }
    }

    const snitchPlayer = this.players.get(this.currentSnitchId);
    this.lastRoundReveal = {
      ...this.lastRoundReveal,
      deltas: [...this.lastRoundReveal.deltas, ...extraDeltas],
      snitchReveal: snitchPlayer ? { snitchId: snitchPlayer.id, nickname: snitchPlayer.nickname, caught } : null,
    };
    this.cb.onSfx("snitch");
    this.notify();

    this.setTimer(() => {
      if (this.settings.alibiModeEnabled && this.aliasDrawerId && this.players.has(this.aliasDrawerId)) {
        this.openAlibiVote();
      } else {
        this.advanceTurnPointer();
      }
    }, SNITCH_REVEAL_PAUSE_MS);
  }

  private openAlibiVote() {
    this.alibiVoteOpen = true;
    this.alibiVoteDeadline = Date.now() + ALIBI_VOTE_MS;
    this.notify();
    this.setTimer(() => this.resolveAlibiVote(), ALIBI_VOTE_MS);
  }

  private resolveAlibiVote() {
    if (!this.lastRoundReveal || !this.aliasDrawerId) {
      this.setTimer(() => this.advanceTurnPointer(), 0);
      return;
    }
    this.alibiVoteOpen = false;

    const tally: Map<string, number> = new Map();
    for (const target of this.alibiVotes.values()) {
      tally.set(target, (tally.get(target) ?? 0) + 1);
    }

    let topTarget: string | null = null;
    let topVotes = 0;
    for (const [target, votes] of tally) {
      if (votes > topVotes) {
        topVotes = votes;
        topTarget = target;
      }
    }

    const caught = topTarget === this.aliasDrawerId && topVotes > 0;
    const extraDeltas: ScoreDelta[] = [];

    if (caught) {
      for (const [voterId, target] of this.alibiVotes) {
        if (target !== this.aliasDrawerId) continue;
        const voter = this.players.get(voterId);
        if (!voter) continue;
        voter.score += ALIBI_ACCUSER_POINTS;
        extraDeltas.push({ playerId: voter.id, nickname: voter.nickname, points: ALIBI_ACCUSER_POINTS, reason: "alibi-accuser" });
      }
    } else {
      const fake = this.players.get(this.aliasDrawerId);
      if (fake) {
        fake.score += ALIBI_SURVIVOR_POINTS;
        extraDeltas.push({ playerId: fake.id, nickname: fake.nickname, points: ALIBI_SURVIVOR_POINTS, reason: "alibi-survivor" });
      }
    }

    const fakePlayer = this.players.get(this.aliasDrawerId);
    this.lastRoundReveal = {
      ...this.lastRoundReveal,
      deltas: [...this.lastRoundReveal.deltas, ...extraDeltas],
      alibiReveal: fakePlayer ? { fakeId: fakePlayer.id, nickname: fakePlayer.nickname, caught } : null,
    };
    this.cb.onSfx("snitch");
    this.notify();

    this.setTimer(() => this.advanceTurnPointer(), ALIBI_REVEAL_PAUSE_MS);
  }

  private advanceTurnPointer() {
    this.turnIndex += 1;
    if (this.turnIndex >= this.turnOrder.length) {
      this.turnIndex = 0;
      this.round += 1;
    }

    if (this.round > this.settings.totalRounds || this.turnOrder.length === 0) {
      if (this.settings.trialEnabled && this.turnOrder.length > 0 && this.evidenceTape.length > 0) {
        this.beginTrial();
      } else {
        this.endGame();
      }
      return;
    }

    this.beginTurn();
  }

  // ---------- The Trial ----------

  private beginTrial() {
    this.clearAllTimers();
    this.phase = "TRIAL";
    this.resetTrialState();
    this.trialStage = "VOTING";
    this.trialDeadline = Date.now() + TRIAL_VOTE_MS;
    this.cb.onSfx("gavel");
    this.notify();
    this.setTimer(() => this.resolveTrialVoting(), TRIAL_VOTE_MS);
  }

  castTrialVote(voterId: string, targetPlayerId: string) {
    if (this.phase !== "TRIAL" || this.trialStage !== "VOTING") return;
    if (!this.players.has(voterId) || !this.players.has(targetPlayerId)) return;
    this.trialVotes.set(voterId, targetPlayerId);
  }

  private resolveTrialVoting() {
    const tally: Map<string, number> = new Map();
    for (const target of this.trialVotes.values()) tally.set(target, (tally.get(target) ?? 0) + 1);

    let ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

    if (ranked.length === 0) {
      const seen = new Set<string>();
      for (const rec of this.evidenceTape) {
        if (!seen.has(rec.drawerId) && this.players.has(rec.drawerId)) {
          seen.add(rec.drawerId);
          ranked.push(rec.drawerId);
        }
      }
    }

    this.trialDefendants = ranked.filter((id) => this.players.has(id)).slice(0, 3);
    if (this.trialDefendants.length === 0) {
      this.endGame();
      return;
    }

    this.trialStage = "DEFENSE";
    this.trialDefenseIndex = 0;
    this.startDefenseTimer();
    this.notify();
  }

  private startDefenseTimer() {
    this.trialDeadline = Date.now() + TRIAL_DEFENSE_MS;
    this.setTimer(() => this.advanceDefense(), TRIAL_DEFENSE_MS);
  }

  submitTrialDefense(playerId: string, text: string) {
    if (this.phase !== "TRIAL" || this.trialStage !== "DEFENSE") return;
    const current = this.trialDefendants[this.trialDefenseIndex];
    if (!current || playerId !== current) return;
    this.trialDefenses[playerId] = text.slice(0, 280);
    this.notify();
    this.clearAllTimers();
    this.advanceDefense();
  }

  private advanceDefense() {
    this.trialDefenseIndex += 1;
    if (this.trialDefenseIndex >= this.trialDefendants.length) {
      void this.runVerdicts();
    } else {
      this.startDefenseTimer();
      this.notify();
    }
  }

  private async runVerdicts() {
    this.trialStage = "VERDICT";
    this.trialDeadline = null;
    this.notify();

    const inputs = this.trialDefendants.map((id) => {
      const p = this.players.get(id);
      const rec = [...this.evidenceTape].reverse().find((r) => r.drawerId === id);
      return {
        playerId: id,
        nickname: p?.nickname ?? "Unknown",
        word: rec?.word ?? "something indescribable",
        defenseText: this.trialDefenses[id] ?? "",
      };
    });

    const verdicts = await generateVerdicts(inputs);
    if (this.phase !== "TRIAL") return; // room moved on while we awaited the API call

    this.trialVerdicts = verdicts;
    this.cb.onSfx("gavel");
    this.notify();

    this.setTimer(() => this.endGame(), TRIAL_AUTO_CONTINUE_MS);
  }

  continueTrial() {
    if (this.phase !== "TRIAL" || this.trialStage !== "VERDICT") return;
    this.clearAllTimers();
    this.endGame();
  }

  private endGame() {
    this.clearAllTimers();
    this.phase = "GAME_OVER";
    this.currentDrawerId = null;
    this.turnEndsAt = null;
    this.finalScoreboard = [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        dirtyInk: p.dirtyInk,
        isHost: p.isHost,
        connected: p.connected,
        guessedThisTurn: p.guessedThisTurn,
        seat: p.seat,
      }));
    this.cb.onGameOver(this.finalScoreboard);
    this.cb.onSfx("tada");
    this.notify();
  }

  playAgain() {
    if (this.phase !== "GAME_OVER") return;
    this.phase = "LOBBY";
    this.finalScoreboard = null;
    this.lastRoundReveal = null;
    this.resetTrialState();
    for (const p of this.players.values()) {
      p.score = 0;
      p.dirtyInk = 0;
    }
    this.notify();
  }

  // ---------- drawing ----------

  canDrawOnCanvas(playerId: string, canvas: CanvasId): boolean {
    if (this.phase !== "DRAWING") return false;
    if (canvas === "A") return playerId === this.getActiveDrawerId();
    return this.aliasDrawerId != null && playerId === this.aliasDrawerId;
  }

  recordDrawAction(action: DrawingAction, canvas: CanvasId) {
    const history = canvas === "A" ? this.drawingHistory : this.drawingHistoryB;
    const idx = history.findIndex((a) => a.id === action.id);
    if (idx >= 0) history[idx] = action;
    else history.push(action);
  }

  undoLastStroke(canvas: CanvasId) {
    const history = canvas === "A" ? this.drawingHistory : this.drawingHistoryB;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].id) {
        history.splice(i, 1);
        break;
      }
    }
  }

  clearDrawing(canvas: CanvasId) {
    if (canvas === "A") this.drawingHistory = [];
    else this.drawingHistoryB = [];
  }

  getPlayerBySocket(socketId: string): PlayerInternal | undefined {
    return [...this.players.values()].find((p) => p.socketId === socketId);
  }

  destroy() {
    this.clearAllTimers();
  }
}
