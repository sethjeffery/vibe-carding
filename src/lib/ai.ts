import {
  CARDS,
  ECONOMY,
  canPlay,
  resolveAction,
  type CardDefinition,
  type GameAction,
  type GameState,
  type GameView,
} from '../../supabase/functions/_shared/engine'

function reserveValue(card: CardDefinition) {
  const effect = card.effect
  if (card.kind === 'engineering') return Math.min(110, card.yield * 0.2)
  return (
    Math.max(0, (effect.yieldMultiplier ?? 1) - 1) * 130 +
    (effect.costMultiplier === 0
      ? 180
      : (effect.costMultiplier ?? 1) < 1
        ? 100
        : 0) +
    (effect.engineeringCardsSlotCost === 0 ? 140 : 0) +
    (effect.addActions ? 140 : 0) +
    (effect.resetCredits ? 150 : 0) +
    (effect.addCredits ?? 0) * 0.25 +
    (card.kind === 'sabotage' ? 100 : 0)
  )
}

function evaluate(state: GameState, playerId: string) {
  if (state.winnerId) return state.winnerId === playerId ? 1e9 : -1e9
  const me = state.players.find((p) => p.id === playerId)!
  const rivals = state.players.filter((p) => p.id !== playerId)
  const leader = Math.max(...rivals.map((p) => p.tokens))
  const pressure = rivals.reduce((total, player) => {
    const weight = player.tokens === leader ? 0.65 : 0.15
    const disruption = player.pending.reduce((value, effect) => {
      const freeze =
        effect === 'freeze' ||
        (typeof effect !== 'string' && effect.disableCredits)
      const outage =
        effect === 'outage' ||
        (typeof effect !== 'string' && effect.disableModels)
      return (
        value +
        (freeze
          ? Math.min(
              ECONOMY.refillCredits,
              ECONOMY.creditCap - player.credits,
            ) * 0.4
          : 0) +
        (outage ? 90 : 0) +
        (typeof effect !== 'string' && effect.skipTurn ? 300 : 0)
      )
    }, 0)
    return total + weight * (player.tokens - disruption)
  }, 0)
  // A vacated hand slot draws a fresh card; preserve strong combo pieces for later turns.
  const reserves = me.hand.reduce((sum, instance) => {
    const card = CARDS[instance.definitionId]
    const usableNextTurn =
      card.kind !== 'engineering' ||
      card.cost <= me.credits + ECONOMY.refillCredits
    return sum + reserveValue(card) * (usableNextTurn ? 1 : 0.5) - 90
  }, 0)
  return me.tokens - pressure + me.credits * 0.22 + reserves
}

/** Search this turn's legal orders using the actual rules, without unseen hands or deck order. */
export function chooseAIAction(game: GameView): GameAction | null {
  const active = game.players.find((p) => p.id === game.activePlayerId)
  if (
    game.status !== 'playing' ||
    game.meId !== game.hostId ||
    !active?.isAI ||
    !game.aiHand
  )
    return null
  if (game.replenishing) {
    const choices = game.players
      .filter((p) => p.id === game.pairProgrammingTargetId)
      .flatMap((p) => p.hand ?? [])
      .sort((a, b) => reserveValue(b.card) - reserveValue(a.card))
    return choices[0]
      ? { type: 'take-card', cardInstanceId: choices[0].instanceId }
      : null
  }
  const state: GameState = {
    ...game,
    players: game.players.map((p) => ({
      ...p,
      // The host's human hand must never inform an AI's decisions.
      hand: p.id === active.id ? game.aiHand! : [],
    })),
    drawPile: [],
    discardPile: [],
    rng: 1,
    nextCardNumber: 1,
    nextEventNumber: 1,
    events: [],
  }
  let best: GameAction | null = null
  let bestScore = -Infinity
  const seen = new Set<string>()
  function search(current: GameState, first?: GameAction) {
    const me = current.players[active!.seat]
    const committed = structuredClone(current)
    if (!me.mustEmptyHand || !me.hand.length)
      resolveAction(committed, me.id, { type: 'end-turn' })
    committed.players.find((p) => p.id === me.id)!.hand = me.hand
    const score =
      evaluate(committed, me.id) + (committed.turn - current.turn - 1) * 300
    if (
      (!me.mustEmptyHand || !me.hand.length || current.status === 'finished') &&
      score > bestScore
    ) {
      bestScore = score
      best = first ?? { type: 'end-turn' }
    }
    if (current.status === 'finished') return
    const key = JSON.stringify([
      current.players,
      current.queuedCards,
      current.direction,
    ])
    if (seen.has(key)) return
    seen.add(key)
    const definitions = new Set<string>()
    for (const instance of me.hand) {
      if (definitions.has(instance.definitionId)) continue
      definitions.add(instance.definitionId)
      const card = CARDS[instance.definitionId]
      const playable = canPlay(current, me, card)
      const cost =
        card.kind === 'engineering'
          ? (me.engineeringCardsSlotCost ?? (me.unlimitedEngineering ? 0 : 1))
          : 1
      if (!me.mustEmptyHand && me.actionsUsed + cost > me.actionLimit) continue
      const action: GameAction = {
        type: playable ? 'play' : 'discard',
        cardInstanceId: instance.instanceId,
      }
      const next = structuredClone(current)
      resolveAction(next, me.id, action)
      next.events = []
      next.undoHistory = []
      search(next, first ?? action)
    }
  }
  // shortcut: searches the current hand only, add opponent rollout if stronger play is needed.
  search(state)
  return best
}
