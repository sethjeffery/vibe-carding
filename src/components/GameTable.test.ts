import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  CARDS,
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

it('celebrates only the winning tile for every viewer', () => {
  const state = started()
  expect(render(state, 'a')).not.toContain('player-winner')
  state.status = 'finished'
  state.winnerId = state.players[1].id
  for (const userId of ['a', 'b']) {
    const html = render(state, userId)
    const tiles = html.match(/class="player-tile [^"]*"/g)!
    const winners = tiles.filter((tile) => tile.includes('player-winner'))
    expect(winners).toHaveLength(1)
    expect(winners[0]).toContain(`seat-${state.players[1].seat}`)
    expect(html).toContain('players-celebrating')
  }
})

it('renders readable pending sabotage labels and tooltips for current and legacy effects', () => {
  const state = started()
  state.players[0].hand = [{ instanceId: 'freeze', definitionId: 'freeze' }]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'freeze' })
  state.players[1].pending.push(
    { disableModels: true },
    'freeze',
    'outage',
    'caveman',
    { skipTurn: true },
  )
  for (const userId of ['a', 'b']) {
    const html = render(state, userId)
    expect(html).toContain(
      'title="Next turn: Budget Freeze, API Outage, Budget Freeze, API Outage, Caveman, Rate Limited"',
    )
    expect(html).toContain(
      '! Budget Freeze · API Outage · Budget Freeze · API Outage · Caveman · Rate Limited</span>',
    )
    expect(html).not.toContain('[object Object]')
  }
})

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
    expect(html).toContain('aria-label="Engineering uses no actions"')
    expect(html).toContain('aria-label="Play your entire hand"')
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
  state.players[0].credits = 300
  state.players[0].hand = [{ instanceId: 'c100', definitionId: 'backend' }]
  resolveAction(state, 'a', { type: 'discard', cardInstanceId: 'c100' })
  for (const legacy of [false, true]) {
    if (legacy) delete state.events[0].discarded
    for (const userId of ['a', 'b']) {
      const html = render(state, userId)
      const label = `aria-label="Discarded ${CARDS.backend.name}"`
      const discarded = html.slice(
        html.indexOf(label),
        html.indexOf(label) + 300,
      )
      expect(discarded).toContain('card-unavailable')
    }
  }
})

it('shows visible text for every active effect alongside its icon', () => {
  const state = started()
  Object.assign(state.players[0], {
    costMultiplier: 2,
    yieldMultiplier: 3,
    modelBlocked: true,
    unlimitedEngineering: true,
    mustEmptyHand: true,
  })
  const html = render(state, 'a')
  for (const label of [
    'Credit cost ×2',
    'Token yield ×3',
    'Models blocked',
    'Engineering uses no actions',
    'Play your entire hand',
  ]) {
    expect(html).toContain(`</svg> ${label}</span>`)
  }
})

it('disables engineering plays when their configured slot cost exceeds the remaining actions', () => {
  const state = started()
  Object.assign(state.players[0], {
    engineeringCardsSlotCost: 2,
    actionsUsed: 2,
    hand: [{ instanceId: 'task', definitionId: 'bug' }],
  })
  const html = render(state, 'a')
  expect(html).toContain(`disabled="" aria-label="Play ${CARDS.bug.name}"`)
})

it('allows grey unaffordable engineering cards under YOLO even without actions remaining', () => {
  const state = started()
  const me = state.players[0]
  me.credits = 70
  me.hand = ['yolo', 'roll-forward', 'accessibility-audit'].map((id) => ({
    instanceId: id,
    definitionId: id,
  }))
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'yolo' })
  me.actionsUsed = me.actionLimit
  const html = render(state, 'a')
  expect(html).toContain(CARDS.yolo.copy)
  expect(html).toContain('Engineering uses no actions')
  expect(html.match(/card-unavailable/g)).toHaveLength(2)
  for (const id of ['roll-forward', 'accessibility-audit']) {
    expect(html).toContain(`aria-label="Discard ${CARDS[id].name}, bonus play"`)
    expect(html).not.toContain(
      `disabled="" aria-label="Discard ${CARDS[id].name}, bonus play"`,
    )
  }
})

it('shows every observed opponent hand in the reveal dialog', () => {
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  joinGame(state, 'c', 'Gamma')
  startGame(state, 'a')
  state.players[0].hand = [{ instanceId: 'observe', definitionId: 'observe' }]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'observe' })
  state.players[0].revealPlayerIds.push('c')
  const html = render(state, 'a')
  expect(html).toContain('Observed hands')
  expect(html).toContain('aria-label="Beta’s hand"')
  expect(html).toContain('aria-label="Gamma’s hand"')
})
