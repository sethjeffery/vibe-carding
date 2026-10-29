import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  CARDS,
  createGame,
  projectGame,
} from '../../supabase/functions/_shared/engine'
import { Card } from './Card'

it('shows the base engineering amount and conversion label without a footer', () => {
  const html = renderToStaticMarkup(
    createElement(Card, { card: CARDS.refactor }),
  )
  expect(html).toContain('<strong>200</strong>')
  expect(html).toContain('CREDITS → TOKENS')
  expect(html).not.toContain('card-bottom')
  expect(html).not.toContain('&lt;/&gt;')
})

it('explains effective cost and yield in the description when modifiers apply', () => {
  const player = projectGame(createGame('a', 'Alpha', 1), 'a').players[0]
  player.costMultiplier = 0.5
  player.yieldMultiplier = 3
  const html = renderToStaticMarkup(
    createElement(Card, { card: CARDS.refactor, player }),
  )
  expect(html).toContain('<strong>200</strong>')
  expect(html).toContain('This turn: 100 credits → 600 tokens.')
})

it('removes footers from every card type', () => {
  for (const card of Object.values(CARDS)) {
    const html = renderToStaticMarkup(createElement(Card, { card }))
    expect(html).not.toContain('card-bottom')
    expect(html).toContain(card.copy)
  }
})

it('marks a discarded engineering card unavailable without needing the player’s balance', () => {
  const html = renderToStaticMarkup(
    createElement(Card, { card: CARDS.backend, discarded: true }),
  )
  expect(html).toContain('card-unavailable')
})

it('uses the modified cost to grey out an unaffordable hand card', () => {
  const player = projectGame(createGame('a', 'Alpha', 1), 'a').players[0]
  player.costMultiplier = 2
  expect(
    renderToStaticMarkup(createElement(Card, { card: CARDS.refactor, player })),
  ).toContain('card-unavailable')
  player.credits = 400
  expect(
    renderToStaticMarkup(createElement(Card, { card: CARDS.refactor, player })),
  ).not.toContain('card-unavailable')
})
