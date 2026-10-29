import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  startGame,
  type GameState,
} from '../../supabase/functions/_shared/engine'
import { GameTable } from './GameTable'

function started() {
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  return startGame(state, 'a')
}
function render(state: GameState, userId: string) {
  return renderToStaticMarkup(
    createElement(GameTable, {
      room: {
        code: 'ABC234',
        gameId: 'test',
        game: projectGame(state, userId),
      },
      busy: false,
      onAction: () => {},
      onHome: () => {},
    }),
  )
}

it('keeps Ralph and YOLO visible after more than four cards, with identical remaining spaces for both players', () => {
  const state = started()
  const me = state.players[0]
  me.credits = 1000
  me.hand = ['yolo', 'loop', 'ralph', 'bug', 'bug', 'bug', 'bug'].map(
    (id, i) => ({ instanceId: `c${100 + i}`, definitionId: id }),
  )
  for (const card of [...me.hand])
    resolveAction(state, 'a', { type: 'play', cardInstanceId: card.instanceId })
  for (const userId of ['a', 'b']) {
    const html = render(state, userId)
    expect(html.match(/class="played-card action-space/g)).toHaveLength(7)
    expect(html).toContain('data-card-id="yolo"')
    expect(html).toContain('data-card-id="ralph"')
    expect(html).toContain('aria-label="YOLO: free engineering actions"')
    expect(html).toContain('aria-label="Ralph: play your entire hand"')
    expect(html.match(/empty-action-space/g)).toHaveLength(2)
    expect(html).toContain('aria-valuenow=')
    expect(html).not.toContain('action-dots')
    expect(html).not.toContain('LIVE TABLE')
    expect(html).not.toContain('hand-toolbar')
  }
  expect(render(state, 'a')).toContain('table-active')
  expect(render(state, 'b')).toContain('table-waiting')
})

it('renders discarded cards grey in both players’ play area, including legacy events', () => {
  const state = started()
  state.players[0].hand = [{ instanceId: 'c100', definitionId: 'backend' }]
  resolveAction(state, 'a', { type: 'discard', cardInstanceId: 'c100' })
  for (const legacy of [false, true]) {
    if (legacy) delete state.events[0].discarded
    for (const userId of ['a', 'b']) {
      const html = render(state, userId)
      const discarded = html.slice(
        html.indexOf('aria-label="Discarded Rewrite Backend"'),
        html.indexOf('aria-label="Discarded Rewrite Backend"') + 300,
      )
      expect(discarded).toContain('card-unavailable')
    }
  }
})
