# Doodle Crimes

Noir-themed real-time drawing & guessing party game. Server is authoritative — the secret word is only ever sent to the current drawer's socket.

**Live:** https://doodlecrime.vercel.app (Next.js frontend on Vercel + Socket.IO server on Render — see "Deployment" below for why it's split).

- Phase 1: rooms, lobby, canvas sync, guessing, scoring, the full game state machine (`LOBBY → PICK_WORD → DRAWING → ROUND_REVEAL → ... → GAME_OVER`).
- Phase 2: Sentences (drawer handicaps), The Snitch, Evidence Tape replay/export.

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in multiple browser tabs (or windows/devices on the same network using your machine's local IP instead of `localhost`).

## Test the loop locally with multiple tabs

1. Tab 1: click **New Case**, enter a nickname, pick an avatar → you land in the lobby as host.
2. Copy the 6-character code (or the **Copy Link** button).
3. Tabs 2 and 3 (or more — need 3+ players to start): click **Join Case**, paste the code, pick a nickname/avatar.
4. In Tab 1 (host), adjust rounds/draw time/prompt pack if you like, then click **Start the Case**.
5. The drawer (whoever's turn it is) gets a word-choice popup with a 12s countdown; everyone else sees a masked word and waits.
6. Drawer draws with the toolbar (brush colors, size, eraser, fill bucket, undo, clear) — strokes sync live to all other tabs.
7. Other tabs type guesses in the chat box. Exact matches score points based on speed; near-misses (edit distance ≤ 2) get a private "close!" hint instead of being shown to everyone.
8. When everyone guesses (or time runs out), an "EXHIBIT A" reveal shows the word and the score deltas, then the turn passes to the next player.
9. After all rounds, a "Case Closed" scoreboard appears; the host can click **Reopen the Case** to play again with the same lobby.

### Things worth poking at while testing
- **Reconnect**: refresh a guesser's tab mid-game — it should silently rejoin the same seat (60s grace window) via the identity saved in `localStorage`.
- **Host migration**: close the host's tab — the next-seated player becomes host automatically.
- **Mid-game join attempt**: joining after `lobby:start` is rejected ("Game already in progress").
- **Rate limits**: spamming chat or strokes is throttled server-side.
- **Custom prompts**: in the lobby, set the pack to "Custom" and paste a comma-separated word list.

## Phase 2 features (behind lobby toggles)

- **Sentences**: a random drawer handicap each turn — ink meter (limited total stroke length), one continuous line, blind canvas (drawer can't see their own sheet), mirrored input, jitter ("the shakes"), or a canvas that shrinks every 10s. Shown to everyone with a stamp-animated banner.
- **The Snitch**: one guesser is secretly assigned as the Snitch each turn. They get one 3-second sabotage stroke (briefly takes over drawing rights) and can send "decoy" guesses that look like real ones. At round end, everyone votes on who they think the Snitch was — correct accusers and an undetected Snitch both score bonus points.
- **Evidence Tape**: every completed drawing is recorded and replayable as a timelapse ("EXHIBIT A" stamp + watermark), exportable as a GIF, and browsable after the game in the "Evidence Locker."

## What's implemented vs. deferred

Built now: Socket.IO server-authoritative rooms (in-memory store — see `lib/roomStore.ts`), the full state machine (`lib/gameEngine.ts`), guess matching with Levenshtein "close" hints, progressive letter hints, speed-based scoring, 6 prompt packs (100 phrases each) + custom packs, canvas sync via compressed stroke/fill actions (not images), drawing tools (brush, eraser, 12-color palette, fill bucket, undo, clear), chat/draw rate limiting, a profanity filter toggle, reconnect-with-grace-period, and the three Phase 2 features above.

Deferred to later phases per the build order: Redis-backed room state (currently in-process `Map`, fine for a single server instance — swap `lib/roomStore.ts` for a Redis-backed version when you need multi-instance scaling), Postgres/Supabase persistence (Rap Sheet, Lore Engine), Bribe Economy, Alibi Mode, The Trial + AI judge, and real audio assets (current SFX are synthesized WebAudio beeps as placeholders for the described typewriter/gavel/shutter sounds).

Known gap: the purely visual/client-only Phase 2 bits (mirrored/jitter/shrinking-canvas rendering, GIF export output) haven't been eyeballed in a real browser — this was built in an environment with no browser automation available. Everything server-authoritative was verified directly via live socket simulations, including against the production deployment.

## Deployment

The app is split across two services because Socket.IO needs a persistent process with in-memory room state, which serverless platforms (Vercel) don't support:

- **Frontend** (`doodlecrime.vercel.app`): the Next.js app, deployed to Vercel from this repo as usual (`vercel --prod`). Reads `NEXT_PUBLIC_SOCKET_URL` at build time to know where the socket server lives.
- **Socket server** (`doodlecrime-socket.onrender.com`): `server/socket-only.ts`, a bare Socket.IO server with no Next.js, deployed to Render from this same repo (see `render.yaml`). Configured via `ALLOWED_ORIGIN` (CORS) and runs `npm run start:socket`.

To redeploy either side after a change:
```bash
# Frontend
vercel --prod

# Socket server — Render auto-deploys on push to main (autoDeployTrigger: commit)
git push origin main
```

For local dev, `npm run dev` runs both together in one combined process (`server/index.ts`) — no split needed locally. To test the split setup locally, run `npm run dev:socket` (socket server on :4000) alongside `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000 npx next dev -p 3001`.
