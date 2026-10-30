# Vibe Carding

A desktop multiplayer card game about spending AI credits and accumulating technical debt. React, TypeScript, Tailwind CSS, React Icons, procedural Web Audio, and Supabase.

## Play

Run `pnpm dev` and open [the local game](http://127.0.0.1:4173/). Create a game, copy its invite link, and have up to five friends join, or use **Add AI** to fill open seats with randomly named LLM rivals. The host can empty AI seats before starting. Games need 2–6 players and the first to 10,000 tokens wins. Separate players need separate browsers, browser profiles, or private windows. Two tabs in one profile share the same player session.

Click a card to play it immediately. Clicking a card with no legal effect discards it, using its action cost. End your turn to keep unplayed cards and refill to seven. The in-game README explains modifiers, YOLO, Ralph, and sabotage.

The play area shows the full current turn and outlined spaces for the active player's remaining normal actions. End Turn sits on its right. Your credit meter is beside the bottom-docked hand. Discarded cards retain their grey, diagonal strike on every player's screen, and played status cards stay visible until the turn ends. Long turns scroll horizontally.

AI decisions run in the host’s browser, with a short pause between cards. Keep that browser open; AI turns pause when the host leaves and resume on return. AI players search legal card orders for combinations, credit efficiency, sabotage, and score swaps, while retaining useful cards for later. They use their own hand and public scores, without seeing human hands or the deck.

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
pnpm test:network   # Live six-player Supabase test; creates anonymous players and a test match
pnpm dlx deno@2.9.6 check supabase/functions/game/index.ts
```

The network test covers concurrent joins, hidden hands, turn ownership, concurrent duplicate actions, stale revisions, and RLS isolation. The deterministic test suite also simulates 2,000 matches. Browser verification used two isolated Playwright sessions through a complete match and reload/reconnect.

## Code map

- `supabase/functions/_shared/cards.ts`: typed card catalogue and the card supply.
- `supabase/functions/_shared/engine.ts`: deterministic rules, legality, scoring, draws, and private views. Mutates a server-owned state; callers must persist it only after successful resolution.
- `supabase/functions/_shared/request.ts`: validates untrusted API input.
- `supabase/functions/game/index.ts`: authenticates requests and commits authoritative transitions.
- `supabase/migrations/`: tables, RLS, and the transactional compare-and-swap commit function.
- `src/hooks/useGame.ts`: session restore, realtime subscriptions, polling fallback, and mutation locking.
- `src/components/`: cards, table, and rules dialog.
- `src/lib/ai.ts`: local turn search and strategic evaluation using the shared rules engine.
- `src/lib/sound.ts`: small synthesized card, turn, and victory cues.

## Supabase and deployment

Vercel uses `vercel.json` to build the frontend, then deploy the `game` Edge Function for production builds only. Add `SUPABASE_ACCESS_TOKEN` as a secret in the Vercel project's **Production** environment variables (a Supabase personal access token, never a `VITE_` variable). Preview builds skip function deployment. The CLI is pinned in dev dependencies and deploys through the API without Docker. Missing credentials or a failed function deployment fail the production build.

The function goes live before Vercel publishes the frontend. Keep backend changes compatible with the currently live frontend; Vercel rollback does not roll back Supabase functions. Database migrations are not applied by this build.

The configured project is **Vibe Carding**, ref `fgvcucvvjhrxgwwrrphs`, in London. Its schema, anonymous sign-in, Realtime publication, and Edge Function are already deployed. Migration `20261030111321_notify_human_players_only.sql` is applied for AI seat support: notification rows reference real auth users, so AI seats must be excluded.

For a fresh project, set your frontend URL and publishable key, enable anonymous sign-in, and apply the migration:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy game --project-ref YOUR_PROJECT_REF --use-api --no-verify-jwt
```

The gateway JWT flag is disabled because the function itself validates every bearer token with `auth.getUser()`, supporting modern Supabase signing keys. It never accepts an unauthenticated gameplay request. Service credentials come exclusively from the Edge Function runtime.

`pnpm build` produces a static `dist/` directory for hosting. Supabase provides all shared state; no local game server is needed in production. Hosting metadata for the connected Sites deployment is in `.openai/hosting.json`.

## Rules decisions for this prototype

The source specification's locked rules are implemented. Provisional choices remain adjustable in the catalogue, `ECONOMY`, and the victory target:

- 1000 starting credits, +200 on later turn starts, a 1,000-credit cap, and no extra refill on the first turn.
- Three actions, seven-card hands, multiplicative modifiers, cost rounded up, yield rounded down.
- Every engineering card has a 1:1 base credit cost and token yield. Its large printed number is the base amount; active modifiers are reflected in its description.
- Sabotage targets the next seat. Direction halves tokens with downward rounding; Webinar steals up to 200; Swap Players exchanges scores. Freeze prevents one refill and Outage blocks models for one turn. Rate Limited skips the next player’s turn, with no draw or credit refill; other queued effects wait for their next actual turn (one copy). Caveman is a mode that halves subsequent engineering cost and yield for the current turn.
- YOLO removes action costs for all engineering cards, including unaffordable cards, which are discarded without spending credits or earning tokens. Other discards still spend an action. Ralph overrides the action limit and permits legal discards; New Squad can clear Ralph's remaining hand.
- Observability reveals the next player's hand only to its caster until that turn ends. Playing it opens a dismissible modal; clicking your Observability card on the table reopens it.
- Turns have no timer and never end automatically. Existing matches ignore their old stored deadlines.
- A card that changes no state, such as a credit reset or PAYG top-up at the 1,000-credit cap, is discardable. Affordable tasks remain playable regardless of strategic value.

Authoritative state, deck order, RNG state, and unrevealed human hands are never sent to other clients or Realtime. Only the host receives the active AI’s hand for local decision making; all moves still pass server validation. AI seats have no auth accounts or notification rows. A transaction commits each state revision, action receipt, and per-player notification together. Duplicate action IDs cannot spend a card twice.

## Remaining production work

Balance is provisional: automated heuristics establish termination and invariants, not human fairness or match duration. Public matchmaking, progression, permanent card ownership, constructed decks, chat, and account recovery are outside v0.1.

Anonymous signups have Supabase's configured rate limit. Creation is capped when a player has joined 30 games in the last hour. Persistent match and guest-account cleanup and larger-scale load testing should be added before a broad public launch. Supabase security advisories concerning anonymous access are expected for the user-scoped notification policy; the state/receipt tables intentionally have no client policies. Password/MFA advisories do not apply to this guest-only interface.

Credit Reset refills to 1,000 credits (one copy). PAYG 200, 300, and 500 top up credits to the cap (two copies each). Beta Tester makes subsequent tasks free for the rest of the turn (two copies).

### Configuring card mechanics

Edit `effect` objects in `supabase/functions/_shared/cards.ts`; names and IDs do not select game behavior. For example, Caveman uses `{ costMultiplier: 0.5, yieldMultiplier: 0.5 }`. Update the card's descriptive copy when changing its mechanics.

| Field                               | Meaning                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `costMultiplier`, `yieldMultiplier` | Multiply subsequent engineering cost/yield; stack multiplicatively and expire at turn end. Defaults: 1. |
| `target`                            | `current` (default), `next` seat, or `all` opponents in seat order.                                     |
| `playAllCards`                      | Require an empty hand to end the turn; allow plays/discards beyond the action limit.                    |
| `engineeringCardsSlotCost`          | Actions used per engineering card, including discards (default 1; 0 for YOLO). Other discards cost 1.   |
| `skipTurn`                          | Skip the target’s next turn without drawing or refilling credits; does not stack.                       |
| `disableModels`                     | Block model plays for the affected turn.                                                                |
| `disableCredits`                    | Skip the target's next automatic credit refill; does not block credit cards.                            |
| `stealTokens`                       | Transfer up to this many tokens from each target to the player.                                         |
| `addCredits`, `resetCredits`        | Add credits up to the economy cap, or refill to that cap.                                               |
| `observability`                     | Reveal targeted opponents' hands to the player until the player's turn ends.                            |
| `tokenMultiplier`                   | Immediately multiply existing token balances, rounded down (Direction: 0.5).                            |
| `swapTokens`                        | Exchange tokens with each target in seat order.                                                         |
| `discardHand`                       | Discard the target's remaining hand (New Squad).                                                        |
| `addActions`                        | Increase the affected turn's action limit (/loop).                                                      |

Effects compose: any component with a legal effect makes a card playable. Balances, theft, swaps, hand discards and reveals resolve immediately. Turn modifiers apply immediately to the current player or queue for each opponent's next turn. Costs round up; earned tokens round down. Queued effects in saved games from the earlier engine remain supported.
