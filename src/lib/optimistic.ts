import {
  projectGame,
  resolveAction,
  type GameAction,
  type GameState,
  type GameView,
} from '../../supabase/functions/_shared/engine'

export function optimisticCardAction(
  game: GameView,
  action: GameAction,
): GameView | null {
  // Ending a turn draws private cards, so wait for the server for that action.
  if (action.type === 'end-turn') return null
  const state: GameState = structuredClone({
    ...game,
    players: game.players.map((player) => ({
      ...player,
      // Preserve hidden hand sizes for effects that discard opponents' hands.
      hand:
        player.hand ??
        Array.from({ length: player.handCount }, () => ({
          instanceId: '',
          definitionId: '',
        })),
    })),
    drawPile: [],
    discardPile: [],
    rng: 1,
    nextCardNumber: 1,
    nextEventNumber: Math.max(0, ...game.events.map((event) => event.id)) + 1,
  })
  try {
    resolveAction(state, game.meId, action)
  } catch {
    return null
  }
  const next = projectGame(state, game.meId)
  next.deckCount = game.deckCount
  next.discardCount += game.discardCount
  next.players.forEach((player, index) => {
    // Observability can reveal real cards only after the server responds.
    if (game.players[index].hand === null) player.hand = null
  })
  return next
}
