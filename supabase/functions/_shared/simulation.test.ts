import { expect, it } from 'vitest'
import {
  CARDS,
  ECONOMY,
  canPlay,
  createGame,
  joinGame,
  resolveAction,
  startGame,
  type GameState,
} from './engine'

function choose(state: GameState) {
  const player = state.players.find((p) => p.id === state.activePlayerId)!
  const remaining = player.actionLimit - player.actionsUsed
  const tasks = player.hand.filter(
    (c) => CARDS[c.definitionId].kind === 'engineering',
  )
  const ranked = player.hand
    .map((instance) => {
      const card = CARDS[instance.definitionId]
      const playable = canPlay(state, player, card)
      if (!playable) return { instance, playable, rank: -10 }
      if (card.kind === 'engineering')
        return {
          instance,
          playable,
          rank: (card.yield ?? 0) * player.yieldMultiplier,
        }
      const rank = card.effect.resetCredits
        ? (ECONOMY.creditCap - player.credits) * 2
        : card.effect.addCredits
          ? Math.min(
              card.effect.addCredits!,
              ECONOMY.creditCap - player.credits,
            ) * 2
          : (card.effect.costMultiplier !== undefined ||
                card.effect.yieldMultiplier !== undefined) &&
              remaining > 1 &&
              tasks.length
            ? 800
            : card.effect.engineeringCardsSlotCost === 0 && tasks.length > 1
              ? 700
              : card.effect.addActions && player.hand.length > 2
                ? 650
                : card.kind === 'sabotage'
                  ? 100
                  : card.effect.discardHand &&
                      !tasks.some((c) =>
                        canPlay(state, player, CARDS[c.definitionId]),
                      )
                    ? 50
                    : 0
      return { instance, playable, rank }
    })
    .filter(
      ({ instance }) =>
        player.mustEmptyHand ||
        remaining > 0 ||
        (player.unlimitedEngineering &&
          CARDS[instance.definitionId].kind === 'engineering'),
    )
  ranked.sort((a, b) => b.rank - a.rank)
  const choice = ranked[0]
  if (!choice || (!player.mustEmptyHand && choice.rank === 0))
    return { type: 'end-turn' } as const
  return {
    type: choice.playable ? 'play' : 'discard',
    cardInstanceId: choice.instance.instanceId,
  } as const
}

it('finishes 2,000 seeded matches without negative balances, duplicate cards or hand deadlocks', () => {
  let completed = 0
  let turns = 0
  let maxTurns = 0
  const wins = [0, 0, 0, 0]
  for (let seed = 1; seed <= 2000; seed++) {
    const state = createGame('p0', 'Player 0', seed)
    const playerCount = seed % 2 ? 2 : 4
    for (let seat = 1; seat < playerCount; seat++)
      joinGame(state, `p${seat}`, `Player ${seat}`)
    startGame(state, 'p0', 3000)
    for (
      let action = 0;
      action < 2500 && state.status === 'playing';
      action++
    ) {
      resolveAction(state, state.activePlayerId!, choose(state))
      for (const player of state.players) {
        if (player.credits < 0 || player.tokens < 0 || player.hand.length > 7)
          throw new Error(`Invalid economy, seed ${seed}`)
      }
    }
    if (state.status === 'finished') {
      completed++
      turns += state.turn
      maxTurns = Math.max(maxTurns, state.turn)
      wins[state.players.find((p) => p.id === state.winnerId)!.seat]++
    }
    const instances = state.players.flatMap((p) =>
      p.hand.map((c) => c.instanceId),
    )
    expect(new Set(instances).size).toBe(instances.length)
  }
  console.info(
    JSON.stringify({
      matches: 2000,
      completed,
      averageTurns: Math.round(turns / completed),
      maxTurns,
      winsBySeat: wins,
    }),
  )
  expect(completed).toBe(2000)
}, 30_000)
