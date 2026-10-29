import { CARDS, DECK_COUNTS, type CardDefinition } from './cards.ts'
export {
  CARDS,
  type CardDefinition,
  type CardKind,
  type CardEffect,
} from './cards.ts'

export const ECONOMY = {
  startingCredits: 300,
  refillCredits: 100,
  creditCap: 1000,
}

export interface CardInstance {
  instanceId: string
  definitionId: string
}
export type PendingEffect = 'freeze' | 'outage' | 'caveman'
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
    | 'mustEmptyHand'
    | 'revealPlayerIds'
  > & { hand: unknown[] | null },
  card: CardDefinition,
) {
  const rival = nextPlayer(state, player)
  if (card.kind === 'engineering')
    return player.credits >= Math.ceil((card.cost ?? 0) * player.costMultiplier)
  if (card.kind === 'model' && player.modelBlocked) return false
  if (card.effect === 'halve-next') return rival.tokens > 0
  if (card.effect === 'steal-next') return rival.tokens > 0
  if (card.effect === 'swap-next') return rival.tokens !== player.tokens
  if (card.effect === 'credit-reset') return player.credits !== 300
  if (card.effect === 'yolo') return !player.unlimitedEngineering
  if (card.effect === 'ralph') return !player.mustEmptyHand
  if (card.effect === 'new-squad') return (player.hand?.length ?? 0) > 1
  if (card.effect === 'freeze-next') return !rival.pending.includes('freeze')
  if (card.effect === 'outage-next') return !rival.pending.includes('outage')
  if (card.effect === 'observe-next') return !player.revealPlayerIds.length
  return true
}

function applyCard(
  state: GameState,
  player: PlayerState,
  card: CardDefinition,
) {
  const rival = nextPlayer(state, player)
  switch (card.effect) {
    case 'engineer': {
      const cost = Math.max(
        0,
        Math.ceil((card.cost ?? 0) * player.costMultiplier),
      )
      const earned = Math.max(
        0,
        Math.floor((card.yield ?? 0) * player.yieldMultiplier),
      )
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
      break
    }
    case 'sonnet':
      player.yieldMultiplier *= 1.5
      break
    case 'opus':
      player.yieldMultiplier *= 3
      break
    case 'max':
      player.costMultiplier *= 2
      player.yieldMultiplier *= 2
      break
    case 'cache':
      player.costMultiplier *= 0.5
      break
    case 'yolo':
      player.unlimitedEngineering = true
      break
    case 'ralph':
      player.mustEmptyHand = true
      break
    case 'new-squad':
      state.discardPile.push(...player.hand.map((item) => item.definitionId))
      player.hand = []
      break
    case 'loop':
      player.actionLimit += 2
      break
    case 'credit-reset':
      player.credits = 300
      break
    case 'halve-next':
      rival.tokens = Math.floor(rival.tokens / 2)
      break
    case 'steal-next': {
      const amount = Math.min(200, rival.tokens)
      rival.tokens -= amount
      player.tokens += amount
      break
    }
    case 'swap-next':
      ;[player.tokens, rival.tokens] = [rival.tokens, player.tokens]
      break
    case 'freeze-next':
      rival.pending.push('freeze')
      break
    case 'outage-next':
      rival.pending.push('outage')
      break
    case 'caveman-next':
      rival.pending.push('caveman')
      break
    case 'observe-next':
      player.revealPlayerIds = [rival.id]
      break
  }
  if (card.effect !== 'engineer')
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
      throw new Error('Ralph says the hand must go.')
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
  const usesAction = !(
    action.type === 'play' &&
    card.kind === 'engineering' &&
    player.unlimitedEngineering
  )
  if (
    usesAction &&
    !player.mustEmptyHand &&
    player.actionsUsed >= player.actionLimit
  ) {
    throw new Error('No actions left. Ship the turn.')
  }

  player.hand.splice(index, 1)
  state.discardPile.push(instance.definitionId)
  if (usesAction) player.actionsUsed++
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
  player.mustEmptyHand = false
  player.modelBlocked = false
  player.revealPlayerIds = []

  const next = nextPlayer(state, player)
  state.activePlayerId = next.id
  state.turn++
  const pending = next.pending.splice(0)
  next.modelBlocked = pending.includes('outage')
  next.yieldMultiplier *=
    0.5 ** pending.filter((effect) => effect === 'caveman').length
  if (!pending.includes('freeze'))
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
