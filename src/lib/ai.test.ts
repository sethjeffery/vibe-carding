import { expect, it } from 'vitest'
import { chooseAIAction } from './ai'
import {
  changeAISeat,
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  resolveClientAction,
  startGame,
  type GameState,
} from '../../supabase/functions/_shared/engine'

function scenario(cards: string[], credits = 1000) {
  const state = createGame('host', 'Human', 42)
  changeAISeat(state, 'host')
  startGame(state, 'host')
  resolveAction(state, 'host', { type: 'end-turn' })
  const ai = state.players[1]
  ai.hand = cards.map((definitionId, i) => ({
    definitionId,
    instanceId: `c${100 + i}`,
  }))
  ai.credits = credits
  return state
}

function playTurn(state: GameState) {
  const ai = state.players[1]
  const played: string[] = []
  for (
    let i = 0;
    i < 9 && state.status === 'playing' && state.activePlayerId === ai.id;
    i++
  ) {
    const view = projectGame(state, 'host')
    const before = structuredClone(view)
    const action = chooseAIAction(view)
    expect(view).toEqual(before)
    expect(action).not.toBeNull()
    if (action?.type === 'play')
      played.push(
        ai.hand.find((c) => c.instanceId === action.cardInstanceId)!
          .definitionId,
      )
    resolveClientAction(state, 'host', action!, ai.id)
  }
  expect(state.activePlayerId).not.toBe(ai.id)
  return played
}

it('plays yield multipliers before engineering and keeps valuable unused cards', () => {
  const state = scenario(['mvp', 'fable', 'fix-regression', 'opus'])
  const played = playTurn(state)
  expect(played.indexOf('fable')).toBeLessThan(played.indexOf('mvp'))
  expect(state.players[1].tokens).toBeGreaterThanOrEqual(3375)
})

it('finds a seven-card credit-free combo beyond the normal action limit', () => {
  const state = scenario(
    ['mvp', 'mvp', 'fable', 'beta', 'yolo', 'max', 'loop'],
    0,
  )
  const played = playTurn(state)
  expect(played).toContain('beta')
  expect(played).toContain('fable')
  expect(played).toContain('max')
  expect(state.players[1].tokens).toBe(10200)
  expect(state.players[1].credits).toBe(0)
})

it('spends credits before resetting them and uses the refill to ship again', () => {
  const state = scenario(['mvp', 'reset', 'mvp'])
  expect(playTurn(state)).toEqual(['mvp', 'reset', 'mvp'])
  expect(state.players[1].tokens).toBe(1700)
  expect(state.players[1].credits).toBe(150)
})

it('commits a winning swap and never swaps its lead away', () => {
  const winning = scenario(['swap', 'mvp'])
  winning.players[0].tokens = 10100
  winning.players[1].tokens = 100
  playTurn(winning)
  expect(winning.winnerId).toBe(winning.players[1].id)
  const leading = scenario(['swap'])
  leading.players[1].tokens = 5000
  leading.players[0].tokens = 100
  expect(playTurn(leading)).not.toContain('swap')
  expect(leading.players[1].tokens).toBe(5000)
})

it('clears mandatory Ralph hands even when models are blocked and tasks unaffordable', () => {
  const state = scenario(['fable', 'mvp', 'swap'], 0)
  Object.assign(state.players[1], {
    mustEmptyHand: true,
    modelBlocked: true,
    actionsUsed: 3,
  })
  playTurn(state)
  expect(state.players[1].hand).toHaveLength(0)
  resolveAction(state, 'host', { type: 'end-turn' })
  expect(state.players[1].hand).toHaveLength(7)
})

it('bins dead cards, preserves useful combo pieces, and ends when out of actions', () => {
  const state = scenario(['mvp', 'fable'], 0)
  playTurn(state)
  expect(state.players[1].hand.some((c) => c.instanceId === 'c100')).toBe(false)
  expect(state.players[1].hand.some((c) => c.instanceId === 'c101')).toBe(true)
  const exhausted = scenario(['mvp'])
  exhausted.players[1].actionsUsed = 3
  expect(chooseAIAction(projectGame(exhausted, 'host'))).toEqual({
    type: 'end-turn',
  })
})

it('does not use the host human hand or run on a guest machine or human turn', () => {
  const state = scenario(['fable', 'mvp', 'swap'])
  const first = chooseAIAction(projectGame(state, 'host'))
  state.players[0].hand = [{ instanceId: 'c900', definitionId: 'fable' }]
  expect(chooseAIAction(projectGame(state, 'host'))).toEqual(first)
  expect(
    chooseAIAction({ ...projectGame(state, 'host'), meId: 'guest' }),
  ).toBeNull()
  state.activePlayerId = 'host'
  expect(chooseAIAction(projectGame(state, 'host'))).toBeNull()
})

it('completes seeded six-player games without an illegal action or stalled AI turn', () => {
  for (const seed of [7, 42, 2026]) {
    const state = createGame('host', 'Human', seed)
    for (let i = 0; i < 5; i++) changeAISeat(state, 'host')
    startGame(state, 'host', 3000)
    let actions = 0
    while (state.status === 'playing' && actions++ < 2000) {
      const ai = state.players.find((p) => p.id === state.activePlayerId)!
      if (!ai.isAI) resolveAction(state, 'host', { type: 'end-turn' })
      else {
        const action = chooseAIAction(projectGame(state, 'host'))
        expect(action).not.toBeNull()
        resolveClientAction(state, 'host', action!, ai.id)
      }
    }
    expect(state.status).toBe('finished')
  }
})

it('plays Rate Limited to skip a rival turn', () => {
  const state = scenario(['rate-limited'])
  expect(chooseAIAction(projectGame(state, 'host'))).toEqual({
    type: 'play',
    cardInstanceId: 'c100',
  })
  const ai = state.players[1]
  resolveClientAction(
    state,
    'host',
    { type: 'play', cardInstanceId: 'c100' },
    ai.id,
  )
  resolveClientAction(state, 'host', { type: 'end-turn' }, ai.id)
  expect(state.activePlayerId).toBe(ai.id)
})

it('chooses face-up cards for Pair Programming until its hand is replenished', () => {
  const state = scenario(['pair-programming'])
  const ai = state.players[1]
  resolveClientAction(
    state,
    'host',
    { type: 'play', cardInstanceId: 'c100' },
    ai.id,
  )
  resolveClientAction(state, 'host', { type: 'end-turn' }, ai.id)
  expect(state.replenishing).toBeFalsy()
  resolveAction(state, 'host', { type: 'end-turn' })
  expect(state.replenishing).toBe(true)
  for (let i = 0; state.replenishing && i < 7; i++) {
    const action = chooseAIAction(projectGame(state, 'host'))
    expect(action?.type).toBe('take-card')
    resolveClientAction(state, 'host', action!, ai.id)
  }
  expect(state.replenishing).toBe(false)
  expect(ai.hand).toHaveLength(7)
})

it('only takes the next player’s cards even when the host can see a stronger human hand', () => {
  const state = createGame('host', 'Human', 42)
  changeAISeat(state, 'host')
  joinGame(state, 'guest', 'Guest')
  startGame(state, 'host')
  resolveAction(state, 'host', { type: 'end-turn' })
  const ai = state.players[1]
  ai.hand = [{ instanceId: 'c100', definitionId: 'pair-programming' }]
  state.players[0].hand = [{ instanceId: 'c200', definitionId: 'fable' }]
  state.players[2].hand = [{ instanceId: 'c300', definitionId: 'centre-div' }]
  resolveClientAction(
    state,
    'host',
    { type: 'play', cardInstanceId: 'c100' },
    ai.id,
  )
  resolveClientAction(state, 'host', { type: 'end-turn' }, ai.id)
  resolveAction(state, 'guest', { type: 'end-turn' })
  state.players[0].hand = [{ instanceId: 'c200', definitionId: 'fable' }]
  state.players[2].hand = [{ instanceId: 'c300', definitionId: 'centre-div' }]
  resolveAction(state, 'host', { type: 'end-turn' })
  const view = projectGame(state, 'host')
  expect(view.players[0].hand).not.toBeNull()
  expect(chooseAIAction(view)).toEqual({
    type: 'take-card',
    cardInstanceId: 'c300',
  })
  resolveClientAction(state, 'host', chooseAIAction(view)!, ai.id)
  expect(state.replenishing).toBe(false)
  expect(ai.hand).toEqual([{ instanceId: 'c300', definitionId: 'centre-div' }])
})
