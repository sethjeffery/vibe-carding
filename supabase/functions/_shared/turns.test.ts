import { expect, it } from 'vitest'
import { CARDS, DECK_COUNTS } from './cards'
import {
  createGame,
  joinGame,
  startGame,
  resolveAction,
  projectGame,
} from './engine'

function game(count = 3) {
  const state = createGame('p0', 'Player 0', 42)
  for (let i = 1; i < count; i++) joinGame(state, `p${i}`, `Player ${i}`)
  startGame(state, 'p0')
  return state
}
function hand(state: ReturnType<typeof game>, ids: string[]) {
  state.players[0].hand = ids.map((definitionId, i) => ({
    definitionId,
    instanceId: `c${1000 + i}`,
  }))
}
function play(state: ReturnType<typeof game>, i = 0) {
  resolveAction(state, 'p0', { type: 'play', cardInstanceId: `c${1000 + i}` })
}

it.each(Object.keys(CARDS))(
  'undo fully restores a %s play or discard',
  (id) => {
    const state = game()
    state.players[0].credits = 500
    state.players[1].tokens = 500
    hand(state, [id, 'bug'])
    const before = structuredClone(state)
    try {
      play(state)
    } catch {
      resolveAction(state, 'p0', { type: 'discard', cardInstanceId: 'c1000' })
    }
    expect(projectGame(state, 'p1')).not.toHaveProperty('undoHistory')
    expect(state.players.slice(1)).toEqual(before.players.slice(1))
    resolveAction(state, 'p0', { type: 'undo' })
    expect(state.players).toEqual(before.players)
    expect(state.discardPile).toEqual(before.discardPile)
    expect(state.drawPile).toEqual(before.drawPile)
    expect(state.events).toEqual(before.events)
    expect(state.revision).toBe(before.revision + 2)
    expect(projectGame(state, 'p0').undoCardInstanceId).toBeUndefined()
  },
)

it('undo unwinds the sequence, including action limits, multipliers and New Squad', () => {
  const state = game()
  hand(state, ['yolo', 'fable', 'bug', 'squad', 'mvp'])
  const before = structuredClone(state.players[0])
  for (let i = 0; i < 4; i++) play(state, i)
  expect(state.players[0].hand).toHaveLength(0)
  for (let i = 0; i < 4; i++) resolveAction(state, 'p0', { type: 'undo' })
  expect(state.players[0]).toEqual(before)
  expect(() => resolveAction(state, 'p0', { type: 'undo' })).toThrow('no card')
})

it('checks victory only after commitment and allows undo above the target', () => {
  const state = game()
  hand(state, ['bug'])
  state.players[0].tokens = 9999
  play(state)
  expect(state.status).toBe('playing')
  resolveAction(state, 'p0', { type: 'undo' })
  expect(state.players[0].tokens).toBe(9999)
  play(state)
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.winnerId).toBe('p0')
})

it('Pivot records sabotage targets in order and undo restores direction', () => {
  const state = game()
  hand(state, ['freeze', 'pivot', 'outage'])
  play(state, 0)
  play(state, 1)
  expect(state.direction).toBe(-1)
  resolveAction(state, 'p0', { type: 'undo' })
  expect(state.direction).toBe(1)
  play(state, 1)
  play(state, 2)
  expect(state.players[1].pending).toEqual([])
  expect(state.players[2].pending).toEqual([])
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.activePlayerId).toBe('p2')
  expect(state.players[2].modelBlocked).toBe(true)
  expect(state.players[1].pending).toEqual([{ disableCredits: true }])
})

it('Pivot alternates normally with two players and survives multiple turns', () => {
  const state = game(2)
  hand(state, ['pivot'])
  play(state)
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.activePlayerId).toBe('p1')
  resolveAction(state, 'p1', { type: 'end-turn' })
  expect(state.activePlayerId).toBe('p0')
  expect(state.direction).toBe(-1)
})

it.each([2, 4, 5, 8, 9, 12, 13, 16])(
  'scales the deck for %i players and deals full unique hands',
  (count) => {
    const state = game(count)
    const hands = state.players.flatMap((p) => p.hand)
    const pool = [...state.drawPile, ...hands.map((c) => c.definitionId)]
    expect(state.players.every((p) => p.hand.length === 7)).toBe(true)
    expect(new Set(hands.map((c) => c.instanceId)).size).toBe(7 * count)
    for (const [id, copies] of Object.entries(DECK_COUNTS))
      expect(pool.filter((definitionId) => definitionId === id)).toHaveLength(
        copies * Math.ceil(count / 4),
      )
    expect(pool).not.toContain('observe')
    if (count === 16)
      expect(() =>
        joinGame({ ...state, status: 'lobby' }, 'extra', 'Extra'),
      ).toThrow('full')
  },
)

it('reports actual credit refill and respects the cap and Budget Freeze', () => {
  const state = game()
  state.players[1].credits = 950
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.events[0].creditRefill).toBe(50)
  state.players[2].credits = 100
  state.players[2].pending = [{ disableCredits: true }]
  resolveAction(state, 'p1', { type: 'end-turn' })
  expect(state.events[0].creditRefill).toBe(0)
})

it('keeps played cards out of the hand until the next turn begins', () => {
  const state = game()
  const original = [...state.players[0].hand]
  state.players[0].hand = [
    { instanceId: 'c1000', definitionId: 'bug' },
    ...original.slice(1),
  ]
  play(state)
  const remaining = [...state.players[0].hand]
  const deckSize = state.drawPile.length
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.players[0].hand).toEqual(remaining)
  expect(state.drawPile).toHaveLength(deckSize)
  resolveAction(state, 'p1', { type: 'end-turn' })
  expect(state.players[0].hand).toEqual(remaining)
  resolveAction(state, 'p2', { type: 'end-turn' })
  expect(state.players[0].hand.slice(0, 6)).toEqual(remaining)
  expect(state.players[0].hand).toHaveLength(7)
  expect(state.drawPile).toHaveLength(deckSize - 1)
})

it('does not draw cards for skipped turns, but still draws under Budget Freeze', () => {
  const state = game()
  state.players[1].hand = state.players[1].hand.slice(0, 2)
  state.players[1].pending = [{ skipTurn: true }, { disableCredits: true }]
  state.players[1].credits = 100
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.activePlayerId).toBe('p2')
  expect(state.players[1].hand).toHaveLength(2)
  resolveAction(state, 'p2', { type: 'end-turn' })
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.activePlayerId).toBe('p1')
  expect(state.players[1].hand).toHaveLength(7)
  expect(state.players[1].credits).toBe(100)
})

it('Pair Programming opens at this turn’s end, and choosing cards then passes the turn', () => {
  const state = game()
  hand(state, ['pair-programming', 'bug'])
  const deck = [...state.drawPile]
  const victimHand = [...state.players[1].hand]
  play(state)
  expect(projectGame(state, 'p0').players[1].hand).toBeNull()
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.replenishing).toBe(true)
  expect(state.activePlayerId).toBe('p0')
  expect(state.players[0].hand).toHaveLength(1)
  expect(projectGame(state, 'p0').players[1].hand).not.toBeNull()
  expect(projectGame(state, 'p0').players[2].hand).toBeNull()
  for (const card of victimHand.slice(0, 5)) {
    resolveAction(state, 'p0', {
      type: 'take-card',
      cardInstanceId: card.instanceId,
    })
    expect(state.drawPile).toEqual(deck)
  }
  resolveAction(state, 'p0', {
    type: 'take-card',
    cardInstanceId: victimHand[5].instanceId,
  })
  expect(state.replenishing).toBe(false)
  expect(state.activePlayerId).toBe('p1')
  expect(state.players[0].hand).toEqual([
    { instanceId: 'c1001', definitionId: 'bug' },
    ...victimHand.slice(0, 6),
  ])
  expect(state.players[1].hand).toHaveLength(7)
  expect(state.players[1].hand[0]).toEqual(victimHand[6])
  expect(state.drawPile).toEqual(deck.slice(0, -6))
})

it.each([1, -1] as const)(
  'Pair Programming targets only the next player in direction %i',
  (direction) => {
    const state = game()
    state.direction = direction
    hand(state, ['pair-programming'])
    play(state)
    resolveAction(state, 'p0', { type: 'end-turn' })
    const target = state.players[direction === 1 ? 1 : 2]
    const other = state.players[direction === 1 ? 2 : 1]
    const view = projectGame(state, 'p0')
    expect(view.pairProgrammingTargetId).toBe(target.id)
    expect(view.players.find((p) => p.id === target.id)!.hand).not.toBeNull()
    expect(view.players.find((p) => p.id === other.id)!.hand).toBeNull()
    const before = structuredClone(state)
    expect(() =>
      resolveAction(state, 'p0', {
        type: 'take-card',
        cardInstanceId: other.hand[0].instanceId,
      }),
    ).toThrow('next player')
    expect(state).toEqual(before)
  },
)

it('stops when the target runs out without taking from any other player', () => {
  const state = game()
  hand(state, ['pair-programming'])
  state.players[1].hand = state.players[1].hand.slice(0, 2)
  const available = [...state.players[1].hand]
  const untouched = structuredClone(state.players[2].hand)
  play(state)
  resolveAction(state, 'p0', { type: 'end-turn' })
  for (const card of available)
    resolveAction(state, 'p0', {
      type: 'take-card',
      cardInstanceId: card.instanceId,
    })
  expect(state.replenishing).toBe(false)
  expect(state.activePlayerId).toBe('p1')
  expect(state.players[0].hand).toEqual(available)
  expect(state.players[1].hand).toHaveLength(7)
  expect(state.players[2].hand).toEqual(untouched)
})

it.each([0, 2])(
  'Finish after choosing %i cards ends the selection and passes play',
  (count) => {
    const state = game()
    hand(state, ['pair-programming'])
    play(state)
    resolveAction(state, 'p0', { type: 'end-turn' })
    for (const card of [...state.players[1].hand].slice(0, count))
      resolveAction(state, 'p0', {
        type: 'take-card',
        cardInstanceId: card.instanceId,
      })
    resolveAction(state, 'p0', { type: 'finish-replenishing' })
    expect(state.replenishing).toBe(false)
    expect(state.activePlayerId).toBe('p1')
    expect(state.players[0].hand).toHaveLength(count)
    expect(state.players[0].pairProgramming).toBe(false)
    expect(state.players[1].hand).toHaveLength(7)
  },
)

it('only allows the active player to Finish', () => {
  const state = game()
  hand(state, ['pair-programming'])
  play(state)
  resolveAction(state, 'p0', { type: 'end-turn' })
  const before = structuredClone(state)
  expect(() =>
    resolveAction(state, 'p1', { type: 'finish-replenishing' }),
  ).toThrow('Wait for your turn')
  expect(state).toEqual(before)
})

it.each([1, -1] as const)(
  'makes Pair Programming unplayable if the next player is empty in direction %i',
  (direction) => {
    const state = game()
    state.direction = direction
    const target = state.players[direction === 1 ? 1 : 2]
    target.hand = []
    hand(state, ['pair-programming'])
    const before = structuredClone(state)
    expect(() => play(state)).toThrow('no legal effect')
    expect(state).toEqual(before)
    resolveAction(state, 'p0', { type: 'discard', cardInstanceId: 'c1000' })
    expect(state.players[0].pairProgramming).toBeFalsy()
    resolveAction(state, 'p0', { type: 'end-turn' })
    expect(state.replenishing).toBeFalsy()
    expect(state.activePlayerId).toBe(target.id)
  },
)

it('skips selection if Pivot changes the target to an empty hand after Pair Programming', () => {
  const state = game()
  state.players[2].hand = []
  hand(state, ['pair-programming', 'pivot'])
  play(state)
  play(state, 1)
  resolveAction(state, 'p0', { type: 'end-turn' })
  expect(state.replenishing).toBe(false)
  expect(state.activePlayerId).toBe('p2')
  expect(state.players[0].hand).toHaveLength(0)
})

it('keeps already-open turn-start selections from older games playable', () => {
  const state = game()
  state.replenishing = true
  state.players[0].pairProgramming = false
  resolveAction(state, 'p0', { type: 'finish-replenishing' })
  expect(state.activePlayerId).toBe('p0')
  expect(state.replenishing).toBe(false)
})
