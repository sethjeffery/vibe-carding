import { expect, it } from 'vitest'
import {
  changeAISeat,
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  resolveClientAction,
  startGame,
} from './engine'

it('fills six seats with distinct AI names, empties a middle seat, and allows a human to join', () => {
  const state = createGame('host', 'Human', 42)
  for (let i = 0; i < 5; i++) changeAISeat(state, 'host')
  expect(new Set(state.players.map((p) => p.name)).size).toBe(6)
  expect(() => changeAISeat(state, 'host')).toThrow('full')
  expect(() => joinGame(state, 'extra', 'Extra')).toThrow('full')
  changeAISeat(state, 'host', state.players[2].id)
  changeAISeat(state, 'host')
  expect(new Set(state.players.map((p) => p.id)).size).toBe(6)
  changeAISeat(state, 'host', state.players[2].id)
  joinGame(state, 'human', 'Guest')
  expect(state.players.map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5])
  startGame(state, 'host')
  expect(state.players.every((p) => p.hand.length === 7)).toBe(true)
})

it('only lets the host change AI seats in the lobby and never removes human seats', () => {
  const state = createGame('host', 'Human', 42)
  joinGame(state, 'guest', 'Guest')
  expect(() => changeAISeat(state, 'guest')).toThrow('Only the host')
  expect(() => changeAISeat(state, 'host', 'guest')).toThrow('AI seat')
  startGame(state, 'host')
  expect(() => changeAISeat(state, 'host')).toThrow('lobby')
})

it('allows host AI actions only for the active bot and keeps human turn ownership', () => {
  const state = createGame('host', 'Human', 42)
  changeAISeat(state, 'host')
  joinGame(state, 'guest', 'Guest')
  startGame(state, 'host')
  const ai = state.players[1].id
  const end = { type: 'end-turn' } as const
  expect(() => resolveClientAction(state, 'host', end, ai)).toThrow(
    'Wait for your turn',
  )
  resolveClientAction(state, 'host', end)
  expect(() => resolveClientAction(state, 'guest', end, ai)).toThrow(
    'Only the host',
  )
  expect(() => resolveClientAction(state, 'host', end, 'guest')).toThrow(
    'Only the host',
  )
  resolveClientAction(state, 'host', end, ai)
  expect(state.activePlayerId).toBe('guest')
  expect(() => resolveClientAction(state, 'host', end)).toThrow(
    'Wait for your turn',
  )
})

it('shares only the active AI hand with its host and keeps human and inactive bot hands private', () => {
  const state = createGame('host', 'Human', 42)
  changeAISeat(state, 'host')
  changeAISeat(state, 'host')
  joinGame(state, 'guest', 'Guest')
  startGame(state, 'host')
  expect(projectGame(state, 'host').aiHand).toBeUndefined()
  resolveAction(state, 'host', { type: 'end-turn' })
  expect(projectGame(state, 'host').aiHand).toEqual(state.players[1].hand)
  expect(projectGame(state, 'guest').aiHand).toBeUndefined()
  expect(
    projectGame(state, 'host')
      .players.slice(1)
      .every((p) => p.hand === null),
  ).toBe(true)
})
