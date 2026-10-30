import { expect, it } from 'vitest'
import {
  CARDS,
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  startGame,
  type GameAction,
} from '../../supabase/functions/_shared/engine'
import { optimisticCardAction } from './optimistic'

function scenario(definitionId = 'bug') {
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  joinGame(state, 'c', 'Gamma')
  startGame(state, 'a')
  state.players[0].hand = [
    { instanceId: 'chosen', definitionId },
    { instanceId: 'other', definitionId: 'bug' },
  ]
  state.players[0].tokens = 1500
  state.players[1].tokens = 2500
  return state
}

it.each(Object.keys(CARDS))(
  'previews %s with the server rules without mutating state or revealing hidden cards',
  (definitionId) => {
    const state = scenario(definitionId)
    const game = structuredClone(projectGame(state, 'a'))
    const before = structuredClone(game)
    let action: GameAction = { type: 'play', cardInstanceId: 'chosen' }
    try {
      resolveAction(structuredClone(state), 'a', action)
    } catch {
      action = { type: 'discard', cardInstanceId: 'chosen' }
    }
    const preview = optimisticCardAction(game, action)!
    resolveAction(state, 'a', action)
    const expected = projectGame(state, 'a')
    expected.players.forEach((player, index) => {
      if (game.players[index].hand === null) player.hand = null
    })
    expect(preview).toEqual(expected)
    expect(game).toEqual(before)
  },
)

it('previews tokens without declaring victory until the turn commits', () => {
  const state = scenario()
  state.players[0].tokens = state.victoryTarget - 1
  const preview = optimisticCardAction(projectGame(state, 'a'), {
    type: 'play',
    cardInstanceId: 'chosen',
  })!
  expect(preview.status).toBe('playing')
  expect(preview.winnerId).toBeUndefined()
})

it('previews discarding an unaffordable card with no credits or tokens earned', () => {
  const state = scenario('backend')
  state.players[0].credits = 0
  const preview = optimisticCardAction(projectGame(state, 'a'), {
    type: 'discard',
    cardInstanceId: 'chosen',
  })!
  expect(preview.players[0]).toMatchObject({
    credits: 0,
    tokens: 1500,
    handCount: 1,
    actionsUsed: 1,
  })
  expect(preview.events[0]).toMatchObject({
    cardId: CARDS.backend.id,
    discarded: true,
  })
})

it('waits for the server for end-turn and invalid actions', () => {
  const state = scenario()
  const game = projectGame(state, 'a')
  expect(optimisticCardAction(game, { type: 'end-turn' })).toBeNull()
  expect(
    optimisticCardAction(game, { type: 'play', cardInstanceId: 'missing' }),
  ).toBeNull()
  state.players[0].actionsUsed = state.players[0].actionLimit
  expect(
    optimisticCardAction(projectGame(state, 'a'), {
      type: 'play',
      cardInstanceId: 'chosen',
    }),
  ).toBeNull()
  expect(
    optimisticCardAction(projectGame(state, 'b'), {
      type: 'play',
      cardInstanceId: 'chosen',
    }),
  ).toBeNull()
})

it.each(Object.keys(CARDS))(
  'optimistically undoes %s with its original hand order and effects',
  (definitionId) => {
    const state = scenario(definitionId)
    const before = projectGame(state, 'a')
    let action: GameAction = { type: 'play', cardInstanceId: 'chosen' }
    try {
      resolveAction(structuredClone(state), 'a', action)
    } catch {
      action = { type: 'discard', cardInstanceId: 'chosen' }
    }
    resolveAction(state, 'a', action)
    const played = projectGame(state, 'a')
    const unchanged = structuredClone(played)
    const preview = optimisticCardAction(played, { type: 'undo' }, before)
    resolveAction(state, 'a', { type: 'undo' })
    expect(preview).toEqual(projectGame(state, 'a'))
    expect(played).toEqual(unchanged)
  },
)

it('waits for authoritative undo when no matching local snapshot exists', () => {
  const state = scenario()
  const before = projectGame(state, 'a')
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'chosen' })
  const played = projectGame(state, 'a')
  expect(optimisticCardAction(played, { type: 'undo' })).toBeNull()
  expect(
    optimisticCardAction(
      { ...played, replenishing: true },
      { type: 'undo' },
      before,
    ),
  ).toBeNull()
  expect(
    optimisticCardAction({ ...played, meId: 'b' }, { type: 'undo' }, before),
  ).toBeNull()
  expect(
    optimisticCardAction(
      { ...played, turn: played.turn + 1 },
      { type: 'undo' },
      before,
    ),
  ).toBeNull()
})

it('optimistically takes visible cards and finishes Pair Programming without exposing other hands', () => {
  const state = scenario('pair-programming')
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'chosen' })
  resolveAction(state, 'a', { type: 'end-turn' })
  resolveAction(state, 'b', { type: 'end-turn' })
  resolveAction(state, 'c', { type: 'end-turn' })
  const game = projectGame(state, 'a')
  const before = structuredClone(game)
  const action = {
    type: 'take-card',
    cardInstanceId: state.players[1].hand[0].instanceId,
  } as const
  const preview = optimisticCardAction(game, action)
  resolveAction(state, 'a', action)
  expect(preview).toEqual(projectGame(state, 'a'))
  expect(preview!.players[2].hand).toBeNull()
  expect(game).toEqual(before)
  const finish = optimisticCardAction(preview!, { type: 'finish-replenishing' })
  resolveAction(state, 'a', { type: 'finish-replenishing' })
  expect(finish).toEqual(projectGame(state, 'a'))
  expect(finish!.replenishing).toBe(false)
  expect(finish!.activePlayerId).toBe('a')
})

it('optimistically closes the picker when the last available card is taken', () => {
  const state = scenario('pair-programming')
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'chosen' })
  resolveAction(state, 'a', { type: 'end-turn' })
  resolveAction(state, 'b', { type: 'end-turn' })
  state.players[1].hand = state.players[1].hand.slice(0, 1)
  resolveAction(state, 'c', { type: 'end-turn' })
  const action = {
    type: 'take-card',
    cardInstanceId: state.players[1].hand[0].instanceId,
  } as const
  const preview = optimisticCardAction(projectGame(state, 'a'), action)
  resolveAction(state, 'a', action)
  expect(preview).toEqual(projectGame(state, 'a'))
  expect(preview!.replenishing).toBe(false)
})
