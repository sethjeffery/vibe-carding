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

it('previews a winning play', () => {
  const state = scenario()
  state.players[0].tokens = state.victoryTarget - 1
  const preview = optimisticCardAction(projectGame(state, 'a'), {
    type: 'play',
    cardInstanceId: 'chosen',
  })!
  expect(preview.status).toBe('finished')
  expect(preview.winnerId).toBe('a')
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
