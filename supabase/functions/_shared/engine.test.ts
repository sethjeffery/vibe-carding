import { describe, expect, it } from 'vitest'
import {
  CARDS,
  canPlay,
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  startGame,
} from './engine'

function started() {
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  startGame(state, 'a')
  return state
}

describe('game rules', () => {
  it('publishes resolved engineering economics to every player', () => {
    const state = started()
    const me = state.players[0]
    me.costMultiplier = 0.5
    me.yieldMultiplier = 3
    me.hand = [{ instanceId: 'task', definitionId: 'refactor' }]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'task' })
    me.costMultiplier = 2
    me.yieldMultiplier = 1
    for (const id of ['a', 'b']) {
      expect(projectGame(state, id).events[0].economics).toEqual({
        cost: 100,
        tokens: 600,
      })
    }
  })
  it.each(Object.values(CARDS).filter((card) => card.kind === 'engineering'))(
    'converts $name credits to tokens at 1:1 before modifiers',
    (card) => {
      const state = started()
      const me = state.players[0]
      me.credits = 1000
      me.hand = [{ instanceId: 'task', definitionId: card.id }]
      expect(card.yield).toBe(card.cost)
      resolveAction(state, 'a', { type: 'play', cardInstanceId: 'task' })
      expect(me.credits).toBe(1000 - card.cost)
      expect(me.tokens).toBe(card.cost)
    },
  )
  it('keeps modifiers forward-only and enforces three actions', () => {
    const state = started()
    const me = state.players[0]
    me.hand = [
      { instanceId: 'task-one', definitionId: 'bug' },
      { instanceId: 'opus', definitionId: 'opus' },
      { instanceId: 'task-two', definitionId: 'bug' },
      { instanceId: 'fourth', definitionId: 'div' },
    ]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'task-one' })
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'opus' })
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'task-two' })
    expect(me.tokens).toBe((CARDS.bug.yield ?? 0) * 4)
    expect(() =>
      resolveAction(state, 'a', { type: 'play', cardInstanceId: 'fourth' }),
    ).toThrow('No actions left')
  })

  it('only discards cards without a legal effect', () => {
    const state = started()
    const me = state.players[0]
    me.hand = [
      { instanceId: 'cheap', definitionId: 'bug' },
      { instanceId: 'expensive', definitionId: 'mvp' },
    ]
    expect(() =>
      resolveAction(state, 'a', { type: 'discard', cardInstanceId: 'cheap' }),
    ).toThrow('must be played')
    resolveAction(state, 'a', { type: 'discard', cardInstanceId: 'expensive' })
    expect(me.hand).toHaveLength(1)
    expect(state.events[0].discarded).toBe(true)
    expect(projectGame(state, 'b').events[0].discarded).toBe(true)
  })

  it('makes YOLO engineering plays free but not mandatory', () => {
    const state = started()
    const me = state.players[0]
    me.credits = 2000
    me.hand = [
      { instanceId: 'yolo', definitionId: 'yolo' },
      ...Array.from({ length: 4 }, (_, index) => ({
        instanceId: `t${index}`,
        definitionId: 'bug',
      })),
    ]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'yolo' })
    for (let index = 0; index < 4; index++) {
      resolveAction(state, 'a', { type: 'play', cardInstanceId: `t${index}` })
    }
    expect(me.actionsUsed).toBe(1)
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(state.activePlayerId).toBe('b')
  })

  it('does not make YOLO discards free', () => {
    const state = started()
    const me = state.players[0]
    me.unlimitedEngineering = true
    me.actionsUsed = 3
    me.hand = [{ instanceId: 'expensive', definitionId: 'mvp' }]
    expect(() =>
      resolveAction(state, 'a', {
        type: 'discard',
        cardInstanceId: 'expensive',
      }),
    ).toThrow('No actions left')
  })

  it.each([0, 1, 6])('supports YOLO with %i remaining tasks', (count) => {
    const state = started()
    const me = state.players[0]
    me.credits = 1000
    me.hand = [
      { instanceId: 'yolo', definitionId: 'yolo' },
      ...Array.from({ length: count }, (_, i) => ({
        instanceId: `t${i}`,
        definitionId: 'bug',
      })),
    ]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'yolo' })
    for (let i = 0; i < count; i++)
      resolveAction(state, 'a', { type: 'play', cardInstanceId: `t${i}` })
    expect(me.actionsUsed).toBe(1)
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(me.hand).toHaveLength(7)
  })

  it('stacks multipliers and checks full modified affordability', () => {
    const state = started()
    const me = state.players[0]
    me.hand = ['opus', 'max', 'refactor'].map((id) => ({
      instanceId: id,
      definitionId: id,
    }))
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'opus' })
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'max' })
    expect(() =>
      resolveAction(state, 'a', { type: 'play', cardInstanceId: 'refactor' }),
    ).toThrow('no legal effect')
    expect(me.credits).toBe(300)
    me.credits = 400
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'refactor' })
    expect(me.tokens).toBe(1200)
    expect(me.credits).toBe(0)
  })

  it('rounds cost up and yield down', () => {
    const state = started()
    const me = state.players[0]
    me.costMultiplier = 0.333
    me.yieldMultiplier = 1.333
    me.hand = [{ instanceId: 'bug', definitionId: 'bug' }]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'bug' })
    expect(me.credits).toBe(283)
    expect(me.tokens).toBe(66)
  })

  it('forces Ralph to clear unaffordable and nested special cards without deadlock', () => {
    const state = started()
    const me = state.players[0]
    me.actionsUsed = 2
    me.hand = ['ralph', 'mvp', 'loop', 'squad', 'bug'].map((id) => ({
      instanceId: id,
      definitionId: id,
    }))
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'ralph' })
    expect(() => resolveAction(state, 'a', { type: 'end-turn' })).toThrow(
      'Ralph',
    )
    resolveAction(state, 'a', { type: 'discard', cardInstanceId: 'mvp' })
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'loop' })
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'squad' })
    expect(me.hand).toHaveLength(0)
    expect(me.tokens).toBe(0)
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(me.hand).toHaveLength(7)
    expect(me.mustEmptyHand).toBe(false)
    expect(me.actionLimit).toBe(3)
  })

  it('retains unplayed cards and reshuffles the discard pile', () => {
    const state = started()
    const me = state.players[0]
    const retained = me.hand.slice(0, 5)
    me.hand = [...retained]
    state.drawPile = []
    state.discardPile = ['bug', 'opus']
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(me.hand.slice(0, 5)).toEqual(retained)
    expect(me.hand).toHaveLength(7)
    expect(state.discardPile).toHaveLength(0)
  })

  it('applies next-turn effects before refill, then expires them', () => {
    const state = started()
    const rival = state.players[1]
    rival.pending = ['freeze', 'outage', 'caveman']
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(rival.credits).toBe(300)
    expect(rival.pending).toEqual([])
    expect(rival.yieldMultiplier).toBe(0.5)
    expect(rival.modelBlocked).toBe(true)
    expect(canPlay(state, rival, CARDS.opus)).toBe(false)
    resolveAction(state, 'b', { type: 'end-turn' })
    expect(rival.yieldMultiplier).toBe(1)
    expect(rival.modelBlocked).toBe(false)
  })

  it('resolves score attacks and immediate victory atomically', () => {
    const state = started()
    const [me, rival] = state.players
    me.hand = ['direction', 'swap', 'webinar'].map((id) => ({
      instanceId: id,
      definitionId: id,
    }))
    rival.tokens = 3001
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'direction' })
    expect(rival.tokens).toBe(1500)
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'swap' })
    expect([me.tokens, rival.tokens]).toEqual([1500, 0])
    me.tokens = 9900
    rival.tokens = 200
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'webinar' })
    expect(me.tokens).toBe(10100)
    expect(rival.tokens).toBe(0)
    expect(state.winnerId).toBe('a')
    expect(() => resolveAction(state, 'a', { type: 'end-turn' })).toThrow(
      'not active',
    )
  })

  it('projects only authorised hands and never leaks deck order or RNG', () => {
    const state = started()
    let view = projectGame(state, 'a')
    expect(view.players[0].hand).toHaveLength(7)
    expect(view.players[1].hand).toBeNull()
    expect(view).not.toHaveProperty('drawPile')
    expect(view).not.toHaveProperty('discardPile')
    expect(view).not.toHaveProperty('rng')
    state.players[0].hand = [{ instanceId: 'observe', definitionId: 'observe' }]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'observe' })
    view = projectGame(state, 'a')
    expect(view.players[1].hand).toHaveLength(7)
    expect(projectGame(state, 'b').players[0].hand).toBeNull()
    resolveAction(state, 'a', { type: 'end-turn' })
    expect(projectGame(state, 'a').players[1].hand).toBeNull()
  })

  it('allows a player to resume a legacy timed turn without losing cards', () => {
    const state = started()
    Object.assign(state, { turnDeadline: 1 })
    const me = state.players[0]
    me.mustEmptyHand = true
    me.hand = [{ instanceId: 'bug', definitionId: 'bug' }]
    resolveAction(state, 'a', { type: 'play', cardInstanceId: 'bug' })
    expect(state.activePlayerId).toBe('a')
    expect(me.tokens).toBe(50)
    expect(projectGame(state, 'a')).not.toHaveProperty('turnDeadline')
  })

  it('uses one colour for every card in a type', () => {
    for (const kind of [
      'engineering',
      'model',
      'mode',
      'utility',
      'sabotage',
    ]) {
      expect(
        new Set(
          Object.values(CARDS)
            .filter((card) => card.kind === kind)
            .map((card) => card.tone),
        ).size,
      ).toBe(1)
    }
  })

  it('rejects non-active players without mutating state', () => {
    const state = started()
    const before = structuredClone(state)
    expect(() => resolveAction(state, 'b', { type: 'end-turn' })).toThrow(
      'Wait for your turn',
    )
    expect(state).toEqual(before)
  })

  it('deals a deterministic 60-card pool with unique card instances', () => {
    const first = started()
    const second = started()
    expect(
      first.drawPile.length +
        first.players.reduce((n, p) => n + p.hand.length, 0),
    ).toBe(60)
    expect(first.drawPile).toEqual(second.drawPile)
    expect(
      new Set(first.players.flatMap((p) => p.hand.map((c) => c.instanceId)))
        .size,
    ).toBe(14)
  })
})
