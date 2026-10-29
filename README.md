# Vibe Carding

A desktop multiplayer card game about spending AI credits and accumulating technical debt. React, TypeScript, Tailwind CSS, React Icons, procedural Web Audio, and Supabase.

## Play

Run `pnpm dev` and open [the local game](http://127.0.0.1:4173/). Create a game, copy its invite link, and have 1–3 friends join. The host chooses a 3,000, 5,000, or 10,000 token target and starts. Separate players need separate browsers, browser profiles, or private windows. Two tabs in one profile share the same player session.

Click a card to play it immediately. Clicking a card with no legal effect discards it, using an action. End your turn to keep unplayed cards and refill to seven. The in-game README explains modifiers, YOLO, Ralph, and sabotage.

The play area shows the full current turn and outlined spaces for the active player's remaining normal actions. End Turn sits on its right. Your credit meter is beside the bottom-docked hand. Discarded cards retain their grey, diagonal strike on every player's screen, and played status cards stay visible until the turn ends. Long turns scroll horizontally.

Your anonymous session is saved in this browser. Refreshing or returning to the same invite restores your seat. Clearing browser storage removes that identity; there is deliberately no account recovery or public matchmaking in v0.1.

## Development

Use Node 22.18+ and pnpm 11. The latest compatible TypeScript 6 release is used because TypeScript ESLint does not yet support TypeScript 7’s compiler API.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

The example environment points to this game's configured Supabase project and contains only a browser-safe publishable key. No service-role key belongs in a `VITE_` variable.

```sh
pnpm check          # ESLint, rules tests, simulations, TypeScript, build, formatting
pnpm format         # Prettier, including Tailwind class ordering
pnpm test:network   # Live four-player Supabase test; creates anonymous players and a test match
pnpm dlx deno@2.9.6 check supabase/functions/game/index.ts
```

The network test covers concurrent joins, hidden hands, turn ownership, concurrent duplicate actions, stale revisions, and RLS isolation. The deterministic test suite also simulates 2,000 matches. Browser verification used two isolated Playwright sessions through a complete match and reload/reconnect.

## Code map

- `supabase/functions/_shared/cards.ts`: typed card catalogue and the 60-card supply.
- `supabase/functions/_shared/engine.ts`: deterministic rules, legality, scoring, draws, and private views. Mutates a server-owned state; callers must persist it only after successful resolution.
- `supabase/functions/_shared/request.ts`: validates untrusted API input.
- `supabase/functions/game/index.ts`: authenticates requests and commits authoritative transitions.
- `supabase/migrations/`: tables, RLS, and the transactional compare-and-swap commit function.
- `src/hooks/useGame.ts`: session restore, realtime subscriptions, polling fallback, and mutation locking.
- `src/components/`: cards, table, and rules dialog.
- `src/lib/sound.ts`: small synthesized card, turn, and victory cues.

## Supabase and deployment

The configured project is **Vibe Carding**, ref `fgvcucvvjhrxgwwrrphs`, in London. Its schema, anonymous sign-in, Realtime publication, and Edge Function are already deployed. Its migration history matches the local migration.

For a fresh project, set your frontend URL and publishable key, enable anonymous sign-in, and apply the migration:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy game --project-ref YOUR_PROJECT_REF --use-api --no-verify-jwt
```

The gateway JWT flag is disabled because the function itself validates every bearer token with `auth.getUser()`, supporting modern Supabase signing keys. It never accepts an unauthenticated gameplay request. Service credentials come exclusively from the Edge Function runtime.

`pnpm build` produces a static `dist/` directory for hosting. Supabase provides all shared state; no local game server is needed in production. Hosting metadata for the connected Sites deployment is in `.openai/hosting.json`.

## Rules decisions for this prototype

The source specification's locked rules are implemented. Provisional choices remain adjustable in the catalogue, `ECONOMY`, and the lobby target:

- 300 starting credits, +100 on later turn starts, a 1,000-credit cap, and no extra refill on the first turn.
- Three actions, seven-card hands, multiplicative modifiers, cost rounded up, yield rounded down.
- Every engineering card has a 1:1 base credit cost and token yield. Its large printed number is the base amount; active modifiers are reflected in its description.
- Sabotage targets the next seat. Direction halves tokens with downward rounding; Webinar steals up to 200; Swap Players exchanges scores. Freeze prevents one refill, Outage blocks models for one turn, and Caveman halves task yield for one turn. Repeated Caveman effects stack.
- YOLO frees engineering plays, but discards still spend actions. Ralph overrides the action limit and permits legal discards; New Squad can clear Ralph's remaining hand.
- Observability reveals the next player's hand only to its caster until that turn ends. Playing it opens a dismissible modal; clicking your Observability card on the table reopens it.
- Turns have no timer and never end automatically. Existing matches ignore their old stored deadlines.
- A card that changes no state, such as a 300-credit reset at exactly 300 credits, is discardable. Affordable tasks remain playable regardless of strategic value.

Authoritative state, deck order, RNG state, and unrevealed hands are never sent to clients or Realtime. A transaction commits each state revision, action receipt, and per-player notification together. Duplicate action IDs cannot spend a card twice.

## Remaining production work

Balance is provisional: automated heuristics establish termination and invariants, not human fairness or match duration. Public matchmaking, progression, permanent card ownership, constructed decks, chat, and account recovery are outside v0.1.

Anonymous signups have Supabase's configured rate limit. Creation is capped when a player has joined 30 games in the last hour. Persistent match and guest-account cleanup and larger-scale load testing should be added before a broad public launch. Supabase security advisories concerning anonymous access are expected for the user-scoped notification policy; the state/receipt tables intentionally have no client policies. Password/MFA advisories do not apply to this guest-only interface.
