import { expect, it } from 'vitest'
import { CARDS, DECK_COUNTS } from './cards'
import { createGame, joinGame, startGame } from './engine'

it('includes every distinct card in the deck with its configured quantity', () => {
  expect(Object.keys(CARDS).sort()).toEqual(Object.keys(DECK_COUNTS).sort())
  for (const id of [
    'roll-forward',
    'fix-regression',
    'centre-div',
    'css-animations',
    'accessibility-audit',
    'documentation',
    'ship-api',
    'graphql-api',
    'rewrite-backend',
    'rewrite-rust',
    'auth-layer',
  ]) {
    expect(CARDS[id].id).toBe(id)
  }
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  startGame(state, 'a')
  const pool = [
    ...state.drawPile,
    ...state.players.flatMap((p) => p.hand.map((c) => c.definitionId)),
  ]
  for (const [id, count] of Object.entries(DECK_COUNTS)) {
    expect(Number.isInteger(count) && count > 0).toBe(true)
    expect(pool.filter((cardId) => cardId === id)).toHaveLength(count)
  }
})

it('resolves saved IDs without adding duplicate cards to the catalog', () => {
  for (const [legacyId, id] of Object.entries({
    bug: 'fix-regression',
    div: 'css-animations',
    dark: 'accessibility-audit',
    api: 'graphql-api',
    backend: 'auth-layer',
    rewrite: 'rewrite-rust',
  })) {
    expect(CARDS[legacyId]).toBe(CARDS[id])
    expect(Object.keys(CARDS)).not.toContain(legacyId)
  }
})
