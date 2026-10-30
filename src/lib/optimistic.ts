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
  beforeUndo?: GameView,
): GameView | null {
  if (action.type === 'undo') {
    if (
      !beforeUndo ||
      game.status !== 'playing' ||
      game.replenishing ||
      game.activePlayerId !== game.meId ||
      beforeUndo.meId !== game.meId ||
      beforeUndo.turn !== game.turn ||
      !game.undoCardInstanceId ||
      !beforeUndo.players
        .find((player) => player.id === game.meId)
        ?.hand?.some((card) => card.instanceId === game.undoCardInstanceId)
    )
      return null
    return { ...structuredClone(beforeUndo), revision: game.revision + 1 }
  }
  // Turn changes may draw private cards from the server.
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
    // Hidden cards are supplied only by the server.
    if (game.players[index].hand === null) player.hand = null
  })
  return next
}
