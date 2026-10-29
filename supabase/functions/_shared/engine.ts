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

export interface CardInstance {
  instanceId: string
  definitionId: string
}
// Keep queued effects from saved games readable.
export type PendingEffect = CardEffect | 'freeze' | 'outage' | 'caveman'
export interface PlayerState {
  id: string
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
  revealPlayerIds: string[]
}
export interface GameEvent {
  id: number
  text: string
  tone: CardDefinition['tone'] | 'neutral'
  cardId?: string
  playerId?: string
  discarded?: boolean
  economics?: { cost: number; tokens: number }
  turn: number
}
export interface GameState {
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
    revealPlayerIds: [],
  }
}

export function joinGame(state: GameState, id: string, name: string) {
  if (state.status !== 'lobby')
    throw new Error('This game has already started.')
  if (state.players.some((player) => player.id === id)) return state
  if (state.players.length >= 4) throw new Error('This game is full.')
  if (!name.trim()) throw new Error('Choose a player name.')
  state.players.push(newPlayer(id, name, state.players.length))
  state.revision++
  return state
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
      Array<string>(count).fill(id),
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

function nextPlayer<T>(state: { players: T[] }, current: { seat: number }) {
  return state.players[(current.seat + 1) % state.players.length]
}

function pendingEffect(effect: PendingEffect): CardEffect {
  if (effect === 'freeze') return { disableCredits: true }
  if (effect === 'outage') return { disableModels: true }
  if (effect === 'caveman') return { yieldMultiplier: 0.5 }
  return effect
}

function targets<T>(
  state: { players: T[] },
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
  state: { players: Array<Pick<PlayerState, 'tokens' | 'pending'>> },
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
    | 'revealPlayerIds'
  > & { hand: unknown[] | null },
  card: CardDefinition,
) {
  if (card.kind === 'engineering')
    return player.credits >= Math.ceil(card.cost * player.costMultiplier)
  if (card.kind === 'model' && player.modelBlocked) return false
  const effect = card.effect
  const affected = targets(state, player, effect)
  const external = effect.target === 'next' || effect.target === 'all'
  return Boolean(
    (effect.tokenMultiplier !== undefined &&
      affected.some(
        (p) => Math.floor(p.tokens * effect.tokenMultiplier!) !== p.tokens,
      )) ||
    (external && effect.stealTokens && affected.some((p) => p.tokens > 0)) ||
    (effect.swapTokens && affected.some((p) => p.tokens !== player.tokens)) ||
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
    (effect.observability && external && !player.revealPlayerIds.length),
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
  for (const target of targets(state, player, effect)) {
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
    if (
      effect.observability &&
      target.id !== player.id &&
      !player.revealPlayerIds.includes(target.id)
    )
      player.revealPlayerIds.push(target.id)
    const turnEffect: CardEffect = {
      costMultiplier: effect.costMultiplier,
      yieldMultiplier: effect.yieldMultiplier,
      engineeringCardsSlotCost: effect.engineeringCardsSlotCost,
      playAllCards: effect.playAllCards,
      disableModels: effect.disableModels,
      disableCredits: effect.disableCredits,
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

  if (action.type === 'end-turn') {
    if (player.mustEmptyHand && player.hand.length)
      throw new Error('Play your entire hand before ending your turn.')
    endTurn(state, player)
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
    action.type === 'play' && card.kind === 'engineering'
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

  player.hand.splice(index, 1)
  state.discardPile.push(instance.definitionId)
  player.actionsUsed += slotCost
  if (action.type === 'play') applyCard(state, player, card)
  else
    addEvent(
      state,
      `${player.name} binned ${card.name}.`,
      'neutral',
      card.id,
      player.id,
      true,
    )
  state.revision++
  checkVictory(state)
  return state
}

function endTurn(state: GameState, player: PlayerState) {
  draw(state, player, 7 - player.hand.length)
  player.actionsUsed = 0
  player.actionLimit = 3
  player.costMultiplier = 1
  player.yieldMultiplier = 1
  player.unlimitedEngineering = false
  player.engineeringCardsSlotCost = 1
  player.mustEmptyHand = false
  player.modelBlocked = false
  player.revealPlayerIds = []

  const next = nextPlayer(state, player)
  state.activePlayerId = next.id
  state.turn++
  const pending = next.pending.splice(0).map(pendingEffect)
  for (const effect of pending) applyTurnEffect(next, effect)
  if (!pending.some((effect) => effect.disableCredits))
    next.credits = Math.min(
      ECONOMY.creditCap,
      next.credits + ECONOMY.refillCredits,
    )
  addEvent(state, `${next.name} has the keyboard.`)
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
> {
  players: PlayerView[]
  deckCount: number
  discardCount: number
  meId: string
}

export function projectGame(state: GameState, userId: string): GameView {
  const me = state.players.find((player) => player.id === userId)
  if (!me) throw new Error('You are not in this game.')
  return {
    status: state.status,
    hostId: state.hostId,
    activePlayerId: state.activePlayerId,
    winnerId: state.winnerId,
    turn: state.turn,
    revision: state.revision,
    victoryTarget: state.victoryTarget,
    events: state.events.slice(0, 30),
    meId: userId,
    deckCount: state.drawPile.length,
    discardCount: state.discardPile.length,
    players: state.players.map((player) => ({
      ...player,
      handCount: player.hand.length,
      hand:
        player.id === userId || me.revealPlayerIds.includes(player.id)
          ? player.hand.map((instance) => ({
              ...instance,
              card: CARDS[instance.definitionId],
            }))
          : null,
    })),
  }
}
