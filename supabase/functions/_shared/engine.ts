import {
  CARDS,
  DECK_COUNTS,
  type CardDefinition,
  type CardEffect,
} from './cards.ts'
export {
  CARDS,
  type CardDefinition,
  type CardKind,
  type CardEffect,
} from './cards.ts'

export const ECONOMY = {
  startingCredits: 1000,
  refillCredits: 200,
  creditCap: 1000,
}
export const MAX_PLAYERS = 16

export interface CardInstance {
  instanceId: string
  definitionId: string
}
// Keep queued effects from saved games readable.
export type PendingEffect = CardEffect | 'freeze' | 'outage' | 'caveman'
export interface PlayerState {
  id: string
  isAI?: boolean
  name: string
  seat: number
  credits: number
  tokens: number
  hand: CardInstance[]
  actionsUsed: number
  actionLimit: number
  costMultiplier: number
  yieldMultiplier: number
  engineeringCardsSlotCost?: number
  unlimitedEngineering: boolean
  mustEmptyHand: boolean
  modelBlocked: boolean
  pending: PendingEffect[]
  pairProgramming?: boolean
}
export interface GameEvent {
  id: number
  text: string
  tone: CardDefinition['tone'] | 'neutral'
  cardId?: string
  playerId?: string
  discarded?: boolean
  cardInstanceId?: string
  stolenFromId?: string
  creditRefill?: number
  economics?: { cost: number; tokens: number }
  turn: number
}
interface QueuedCard {
  cardId: string
  targetIds: string[]
}
interface TurnUndo {
  player: PlayerState
  discardPile: string[]
  events: GameEvent[]
  direction: 1 | -1
  queuedCards: QueuedCard[]
  cardInstanceId: string
}
export interface GameState {
  direction?: 1 | -1
  queuedCards?: QueuedCard[]
  undoHistory?: TurnUndo[]
  replenishing?: boolean
  status: 'lobby' | 'playing' | 'finished'
  hostId: string
  players: PlayerState[]
  activePlayerId?: string
  winnerId?: string
  drawPile: string[]
  discardPile: string[]
  turn: number
  revision: number
  victoryTarget: number
  rng: number
  nextCardNumber: number
  nextEventNumber: number
  events: GameEvent[]
}
export type GameAction =
  | { type: 'play'; cardInstanceId: string }
  | { type: 'discard'; cardInstanceId: string }
  | { type: 'end-turn' }
  | { type: 'undo' }
  | { type: 'finish-replenishing' }
  | { type: 'take-card'; cardInstanceId: string }

function random(state: GameState) {
  let x = state.rng || 1
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  state.rng = x >>> 0
  return state.rng / 4294967296
}

function shuffle(state: GameState, values: string[]) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

function draw(state: GameState, player: PlayerState, count: number) {
  while (count-- > 0) {
    if (!state.drawPile.length && state.discardPile.length) {
      state.drawPile = shuffle(state, state.discardPile.splice(0))
    }
    const definitionId = state.drawPile.pop()
    if (!definitionId) return
    player.hand.push({ instanceId: `c${state.nextCardNumber++}`, definitionId })
  }
}

function addEvent(
  state: GameState,
  text: string,
  tone: GameEvent['tone'] = 'neutral',
  cardId?: string,
  playerId?: string,
  discarded = false,
  economics?: GameEvent['economics'],
) {
  state.events.unshift({
    id: state.nextEventNumber++,
    text,
    tone,
    cardId,
    playerId,
    discarded,
    economics,
    turn: state.turn,
  })
}

export function createGame(
  hostId: string,
  hostName: string,
  seed = Date.now(),
): GameState {
  return {
    status: 'lobby',
    hostId,
    players: [newPlayer(hostId, hostName, 0)],
    drawPile: [],
    discardPile: [],
    turn: 0,
    revision: 0,
    victoryTarget: 10_000,
    rng: seed >>> 0,
    nextCardNumber: 1,
    nextEventNumber: 1,
    events: [],
  }
}

function newPlayer(id: string, name: string, seat: number): PlayerState {
  return {
    id,
    name: name.trim().slice(0, 20),
    seat,
    credits: ECONOMY.startingCredits,
    tokens: 0,
    hand: [],
    actionsUsed: 0,
    actionLimit: 3,
    costMultiplier: 1,
    yieldMultiplier: 1,
    unlimitedEngineering: false,
    mustEmptyHand: false,
    modelBlocked: false,
    pending: [],
  }
}

export function joinGame(state: GameState, id: string, name: string) {
  if (state.status !== 'lobby')
    throw new Error('This game has already started.')
  if (state.players.some((player) => player.id === id)) return state
  if (state.players.length >= MAX_PLAYERS) throw new Error('This game is full.')
  if (!name.trim()) throw new Error('Choose a player name.')
  state.players.push(newPlayer(id, name, state.players.length))
  state.revision++
  return state
}

const AI_NAMES = [
  'Claude',
  'GPT',
  'Gemini',
  'Llama',
  'Mistral',
  'DeepSeek',
  'Qwen',
  'Grok',
  'Nova',
  'Phi',
  'Command',
  'Falcon',
  'Dolly',
  'Jamba',
  'Granite',
  'Solar',
]

export function changeAISeat(
  state: GameState,
  userId: string,
  playerId?: string,
) {
  if (userId !== state.hostId)
    throw new Error('Only the host can change AI seats.')
  if (state.status !== 'lobby')
    throw new Error('Seats can only change in the lobby.')
  if (playerId !== undefined) {
    const index = state.players.findIndex((p) => p.id === playerId && p.isAI)
    if (index < 0) throw new Error('Choose an AI seat to empty.')
    state.players.splice(index, 1)
    state.players.forEach((player, seat) => {
      player.seat = seat
    })
    state.revision++
  } else {
    if (state.players.length >= MAX_PLAYERS)
      throw new Error('This game is full.')
    const names = AI_NAMES.filter(
      (name) => !state.players.some((p) => p.name === name),
    )
    const name = names[Math.floor(random(state) * names.length)] ?? 'LLM'
    let number = 0
    while (state.players.some((p) => p.id === `ai-${number}`)) number++
    const id = `ai-${number}`
    joinGame(state, id, name)
    state.players[state.players.length - 1].isAI = true
  }
  return state
}

export function resolveClientAction(
  state: GameState,
  userId: string,
  action: GameAction,
  aiPlayerId?: string,
) {
  if (
    aiPlayerId !== undefined &&
    (userId !== state.hostId ||
      !state.players.some((p) => p.id === aiPlayerId && p.isAI))
  )
    throw new Error('Only the host can control AI players.')
  return resolveAction(state, aiPlayerId ?? userId, action)
}

export function startGame(state: GameState, userId: string, target = 10_000) {
  if (userId !== state.hostId)
    throw new Error('Only the host can start the game.')
  if (state.status !== 'lobby')
    throw new Error('This game has already started.')
  if (state.players.length < 2)
    throw new Error('Invite at least one rival first.')
  if (![3000, 5000, 10000].includes(target))
    throw new Error('Choose a valid token target.')
  state.victoryTarget = target
  state.drawPile = shuffle(
    state,
    Object.entries(DECK_COUNTS).flatMap(([id, count]) =>
      Array<string>(count * Math.ceil(state.players.length / 4)).fill(id),
    ),
  )
  state.players.forEach((player) => draw(state, player, 7))
  state.status = 'playing'
  state.activePlayerId = state.players[0].id
  state.turn = 1
  state.revision++
  addEvent(state, `${state.players[0].name} owns the roadmap.`)
  return state
}

function nextPlayer<T>(
  state: { players: T[]; direction?: 1 | -1 },
  current: { seat: number },
) {
  return state.players[
    (current.seat + (state.direction ?? 1) + state.players.length) %
      state.players.length
  ]
}

function pendingEffect(effect: PendingEffect): CardEffect {
  if (effect === 'freeze') return { disableCredits: true }
  if (effect === 'outage') return { disableModels: true }
  if (effect === 'caveman') return { yieldMultiplier: 0.5 }
  return effect
}

function targets<T>(
  state: { players: T[]; direction?: 1 | -1 },
  player: { seat: number },
  effect: CardEffect,
): T[] {
  if (effect.target === 'all')
    return state.players.filter((_, seat) => seat !== player.seat)
  return [
    effect.target === 'next'
      ? nextPlayer(state, player)
      : state.players[player.seat],
  ]
}

export function canPlay(
  state: {
    players: Array<
      Pick<PlayerState, 'tokens' | 'pending'> & {
        id?: string
        hand?: unknown[] | null
        handCount?: number
      }
    >
    direction?: 1 | -1
    queuedCards?: QueuedCard[]
  },
  player: Pick<
    PlayerState,
    | 'seat'
    | 'credits'
    | 'costMultiplier'
    | 'modelBlocked'
    | 'tokens'
    | 'unlimitedEngineering'
    | 'engineeringCardsSlotCost'
    | 'mustEmptyHand'
    | 'pairProgramming'
  > & { hand: unknown[] | null },
  card: CardDefinition,
) {
  if (card.kind === 'engineering')
    return player.credits >= Math.ceil(card.cost * player.costMultiplier)
  if (card.kind === 'model' && player.modelBlocked) return false
  const effect = card.effect
  const preview = {
    ...state,
    players: state.players.map((p) => ({ ...p, pending: [...p.pending] })),
  }
  let ownTokens = player.tokens
  for (const queued of state.queuedCards ?? []) {
    const queuedEffect = CARDS[queued.cardId].effect
    for (const [seat, target] of preview.players.entries()) {
      const id = state.players[seat].id
      if (!id || !queued.targetIds.includes(id)) continue
      if (queuedEffect.tokenMultiplier !== undefined)
        target.tokens = Math.floor(target.tokens * queuedEffect.tokenMultiplier)
      if (queuedEffect.stealTokens) {
        const stolen = Math.min(queuedEffect.stealTokens, target.tokens)
        target.tokens -= stolen
        ownTokens += stolen
      }
      if (queuedEffect.swapTokens)
        [ownTokens, target.tokens] = [target.tokens, ownTokens]
      target.pending.push(queuedEffect)
    }
  }
  const affected = targets(preview, player, effect)
  const external = effect.target === 'next' || effect.target === 'all'
  return Boolean(
    (effect.tokenMultiplier !== undefined &&
      affected.some(
        (p) => Math.floor(p.tokens * effect.tokenMultiplier!) !== p.tokens,
      )) ||
    (external && effect.stealTokens && affected.some((p) => p.tokens > 0)) ||
    (effect.swapTokens && affected.some((p) => p.tokens !== ownTokens)) ||
    ((effect.resetCredits || effect.addCredits) &&
      (external || player.credits < ECONOMY.creditCap)) ||
    (effect.costMultiplier !== undefined &&
      effect.costMultiplier !== 1 &&
      (effect.costMultiplier !== 0 ||
        external ||
        player.costMultiplier !== 0)) ||
    (effect.yieldMultiplier !== undefined && effect.yieldMultiplier !== 1) ||
    (effect.engineeringCardsSlotCost !== undefined &&
      (external ||
        effect.engineeringCardsSlotCost !==
          (player.engineeringCardsSlotCost ??
            (player.unlimitedEngineering ? 0 : 1)))) ||
    (effect.playAllCards && (external || !player.mustEmptyHand)) ||
    (effect.discardHand && (external || (player.hand?.length ?? 0) > 1)) ||
    effect.addActions ||
    (effect.disableModels &&
      affected.some(
        (p) => !p.pending.some((e) => pendingEffect(e).disableModels),
      )) ||
    (effect.disableCredits &&
      affected.some(
        (p) => !p.pending.some((e) => pendingEffect(e).disableCredits),
      )) ||
    (effect.skipTurn &&
      affected.some(
        (p) => !p.pending.some((e) => pendingEffect(e).skipTurn),
      )) ||
    effect.reverseDirection ||
    (effect.replenishFromPlayers &&
      !player.pairProgramming &&
      (nextPlayer(state, player).handCount ??
        nextPlayer(state, player).hand?.length ??
        0) > 0),
  )
}

function applyTurnEffect(player: PlayerState, effect: CardEffect) {
  player.costMultiplier *= effect.costMultiplier ?? 1
  player.yieldMultiplier *= effect.yieldMultiplier ?? 1
  if (effect.engineeringCardsSlotCost !== undefined) {
    player.engineeringCardsSlotCost = effect.engineeringCardsSlotCost
    player.unlimitedEngineering = effect.engineeringCardsSlotCost === 0
  }
  if (effect.playAllCards) player.mustEmptyHand = true
  if (effect.disableModels) player.modelBlocked = true
  player.actionLimit += effect.addActions ?? 0
}

function applyCard(
  state: GameState,
  player: PlayerState,
  card: CardDefinition,
  targetIds?: string[],
) {
  if (card.kind === 'engineering') {
    const cost = Math.max(0, Math.ceil(card.cost * player.costMultiplier))
    const earned = Math.max(0, Math.floor(card.yield * player.yieldMultiplier))
    player.credits -= cost
    player.tokens += earned
    addEvent(
      state,
      `${player.name} shipped ${card.name} for ${earned.toLocaleString()} tokens.`,
      card.tone,
      card.id,
      player.id,
      false,
      { cost, tokens: earned },
    )
    return
  }
  const effect = card.effect
  if (effect.reverseDirection) state.direction = state.direction === -1 ? 1 : -1
  if (effect.replenishFromPlayers) player.pairProgramming = true
  for (const target of targetIds
    ? state.players.filter((p) => targetIds.includes(p.id))
    : targets(state, player, effect)) {
    if (effect.tokenMultiplier !== undefined)
      target.tokens = Math.floor(target.tokens * effect.tokenMultiplier)
    if (effect.stealTokens) {
      const amount = Math.min(effect.stealTokens, target.tokens)
      target.tokens -= amount
      player.tokens += amount
    }
    if (effect.swapTokens)
      [player.tokens, target.tokens] = [target.tokens, player.tokens]
    if (effect.resetCredits) target.credits = ECONOMY.creditCap
    if (effect.addCredits)
      target.credits = Math.min(
        ECONOMY.creditCap,
        target.credits + effect.addCredits,
      )
    if (effect.discardHand) {
      state.discardPile.push(...target.hand.map((item) => item.definitionId))
      target.hand = []
    }
    const turnEffect: CardEffect = {
      costMultiplier: effect.costMultiplier,
      yieldMultiplier: effect.yieldMultiplier,
      engineeringCardsSlotCost: effect.engineeringCardsSlotCost,
      playAllCards: effect.playAllCards,
      disableModels: effect.disableModels,
      disableCredits: effect.disableCredits,
      skipTurn: effect.skipTurn,
      addActions: effect.addActions,
    }
    if (target.id === player.id) {
      applyTurnEffect(target, turnEffect)
      if (effect.disableCredits) target.pending.push({ disableCredits: true })
    } else if (Object.values(turnEffect).some((value) => value !== undefined))
      target.pending.push(turnEffect)
  }
  addEvent(
    state,
    `${player.name} played ${card.name}.`,
    card.tone,
    card.id,
    player.id,
  )
}

function checkVictory(state: GameState) {
  const winner = state.players.find(
    (player) => player.tokens >= state.victoryTarget,
  )
  if (!winner) return
  state.status = 'finished'
  state.winnerId = winner.id
  state.activePlayerId = undefined
  addEvent(state, `${winner.name} shipped absolutely nothing. Victory!`, 'lime')
}

export function resolveAction(
  state: GameState,
  userId: string,
  action: GameAction,
) {
  if (state.status !== 'playing') throw new Error('The game is not active.')
  const player = state.players.find((item) => item.id === userId)
  if (!player || player.id !== state.activePlayerId)
    throw new Error('Wait for your turn.')

  if (state.replenishing) {
    if (action.type === 'finish-replenishing') {
      finishReplenishing(state, player)
      state.revision++
      return state
    }
    if (action.type !== 'take-card')
      throw new Error('Choose cards to finish replenishing your hand.')
    const victim = nextPlayer(state, player)
    if (!victim.hand.some((card) => card.instanceId === action.cardInstanceId))
      throw new Error('Choose a card from the next player.')
    const index = victim.hand.findIndex(
      (c) => c.instanceId === action.cardInstanceId,
    )
    const [card] = victim.hand.splice(index, 1)
    player.hand.push(card)
    addEvent(
      state,
      `${player.name} paired with ${victim.name} and took ${CARDS[card.definitionId].name}.`,
      'pink',
      card.definitionId,
      player.id,
    )
    Object.assign(state.events[0], {
      stolenFromId: victim.id,
      cardInstanceId: card.instanceId,
    })
    if (player.hand.length >= 7 || !victim.hand.length) {
      finishReplenishing(state, player)
    }
    state.revision++
    return state
  }

  if (action.type === 'undo') {
    const previous = state.undoHistory?.pop()
    if (!previous) throw new Error('There is no card to undo.')
    Object.assign(player, previous.player)
    player.pairProgramming = previous.player.pairProgramming
    player.engineeringCardsSlotCost = previous.player.engineeringCardsSlotCost
    state.discardPile = previous.discardPile
    state.events = previous.events
    state.direction = previous.direction
    state.queuedCards = previous.queuedCards
    state.revision++
    return state
  }

  if (action.type === 'take-card' || action.type === 'finish-replenishing')
    throw new Error('Pair Programming is not replenishing your hand.')

  if (action.type === 'end-turn') {
    if (player.mustEmptyHand && player.hand.length)
      throw new Error('Play your entire hand before ending your turn.')
    for (const queued of state.queuedCards ?? []) {
      applyCard(state, player, CARDS[queued.cardId], queued.targetIds)
      state.events.shift()
    }
    state.queuedCards = []
    state.undoHistory = []
    checkVictory(state)
    if (!state.winnerId) {
      state.replenishing = Boolean(
        player.pairProgramming &&
        player.hand.length < 7 &&
        nextPlayer(state, player).hand.length,
      )
      if (!state.replenishing) endTurn(state, player)
    }
    state.revision++
    return state
  }

  const index = player.hand.findIndex(
    (item) => item.instanceId === action.cardInstanceId,
  )
  if (index < 0) throw new Error('That card is no longer in your hand.')
  const instance = player.hand[index]
  const card = CARDS[instance.definitionId]
  const playable = canPlay(state, player, card)
  if (action.type === 'discard') {
    if (playable) throw new Error('Playable cards must be played.')
  } else {
    if (!playable) throw new Error('That card has no legal effect right now.')
  }
  const slotCost =
    card.kind === 'engineering'
      ? (player.engineeringCardsSlotCost ??
        (player.unlimitedEngineering ? 0 : 1))
      : 1
  const usesAction = slotCost > 0
  if (
    usesAction &&
    !player.mustEmptyHand &&
    player.actionsUsed + slotCost > player.actionLimit
  ) {
    throw new Error('No actions left. Ship the turn.')
  }

  // Snapshots contain private hands and must never be included in a client projection.
  ;(state.undoHistory ??= []).push(
    structuredClone({
      player,
      discardPile: state.discardPile,
      events: state.events,
      direction: state.direction ?? 1,
      queuedCards: state.queuedCards ?? [],
      cardInstanceId: instance.instanceId,
    }),
  )
  player.hand.splice(index, 1)
  state.discardPile.push(instance.definitionId)
  player.actionsUsed += slotCost
  if (action.type === 'play') {
    if (card.effect.target === 'next' || card.effect.target === 'all') {
      ;(state.queuedCards ??= []).push({
        cardId: card.id,
        targetIds: targets(state, player, card.effect).map((p) => p.id),
      })
      addEvent(
        state,
        `${player.name} queued ${card.name} for the end of the turn.`,
        card.tone,
        card.id,
        player.id,
      )
    } else applyCard(state, player, card)
  } else
    addEvent(
      state,
      `${player.name} binned ${card.name}.`,
      'neutral',
      card.id,
      player.id,
      true,
    )
  state.events[0].cardInstanceId = instance.instanceId
  state.revision++
  return state
}

function finishReplenishing(state: GameState, player: PlayerState) {
  // Keep already-open turn-start pickers from older games playable.
  const endingTurn = player.pairProgramming === true
  state.replenishing = false
  player.pairProgramming = false
  if (endingTurn) endTurn(state, player)
}

function endTurn(state: GameState, player: PlayerState) {
  player.actionsUsed = 0
  player.actionLimit = 3
  player.costMultiplier = 1
  player.yieldMultiplier = 1
  player.unlimitedEngineering = false
  player.engineeringCardsSlotCost = 1
  player.mustEmptyHand = false
  player.modelBlocked = false
  player.pairProgramming = false

  let next = nextPlayer(state, player)
  state.turn++
  while (next.pending.some((effect) => pendingEffect(effect).skipTurn)) {
    next.pending = next.pending.flatMap((queued) => {
      const effect = { ...pendingEffect(queued) }
      delete effect.skipTurn
      return Object.values(effect).some((value) => value !== undefined)
        ? [effect]
        : []
    })
    addEvent(
      state,
      `${next.name} is rate limited and skips their turn.`,
      'pink',
    )
    next = nextPlayer(state, next)
    state.turn++
  }
  state.activePlayerId = next.id
  draw(state, next, 7 - next.hand.length)
  const pending = next.pending.splice(0).map(pendingEffect)
  for (const effect of pending) applyTurnEffect(next, effect)
  const beforeCredits = next.credits
  if (!pending.some((effect) => effect.disableCredits))
    next.credits = Math.min(
      ECONOMY.creditCap,
      next.credits + ECONOMY.refillCredits,
    )
  addEvent(state, `${next.name} has the keyboard.`)
  state.events[0].playerId = next.id
  state.events[0].creditRefill = next.credits - beforeCredits
}

export interface PlayerView extends Omit<PlayerState, 'hand'> {
  hand: Array<CardInstance & { card: CardDefinition }> | null
  handCount: number
}
export interface GameView extends Omit<
  GameState,
  | 'players'
  | 'drawPile'
  | 'discardPile'
  | 'rng'
  | 'nextCardNumber'
  | 'nextEventNumber'
  | 'undoHistory'
> {
  players: PlayerView[]
  deckCount: number
  discardCount: number
  meId: string
  aiHand?: CardInstance[]
  undoCardInstanceId?: string
  pairProgrammingTargetId?: string
}

export function projectGame(state: GameState, userId: string): GameView {
  const me = state.players.find((player) => player.id === userId)
  if (!me) throw new Error('You are not in this game.')
  const active = state.players.find(
    (player) => player.id === state.activePlayerId,
  )
  const pairProgrammingTargetId =
    state.replenishing && active ? nextPlayer(state, active).id : undefined
  return {
    direction: state.direction ?? 1,
    replenishing: state.replenishing ?? false,
    pairProgrammingTargetId,
    queuedCards: state.queuedCards ?? [],
    undoCardInstanceId: state.undoHistory?.at(-1)?.cardInstanceId,
    status: state.status,
    hostId: state.hostId,
    activePlayerId: state.activePlayerId,
    winnerId: state.winnerId,
    turn: state.turn,
    revision: state.revision,
    victoryTarget: state.victoryTarget,
    events: state.events.slice(0, 30),
    meId: userId,
    ...(userId === state.hostId &&
    state.players.some((p) => p.id === state.activePlayerId && p.isAI)
      ? {
          aiHand: state.players.find((p) => p.id === state.activePlayerId)!
            .hand,
        }
      : {}),
    deckCount: state.drawPile.length,
    discardCount: state.discardPile.length,
    players: state.players.map((player) => ({
      ...player,
      handCount: player.hand.length,
      hand:
        player.id === userId ||
        (player.id === pairProgrammingTargetId &&
          (state.activePlayerId === userId ||
            (userId === state.hostId &&
              state.players.some(
                (p) => p.id === state.activePlayerId && p.isAI,
              ))))
          ? player.hand.map((instance) => ({
              ...instance,
              card: CARDS[instance.definitionId],
            }))
          : null,
    })),
  }
}
