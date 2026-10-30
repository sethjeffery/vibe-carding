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
function render(state: GameState, userId: string, busy = false) {
  return renderToStaticMarkup(
    createElement(GameTable, {
      room: {
        code: 'ABC234',
        gameId: 'test',
        game: projectGame(state, userId),
      },
      busy,
      onAction: () => {},
      onHome: () => {},
    }),
  )
}

it.each([[], [0], [-2, 2], [-2, 0, 2], [-2, -1, 0, 1, 2]])(
  'fans the hand evenly with angles %j',
  (...angles: number[]) => {
    const state = started()
    state.players[0].hand = angles.map((_, index) => ({
      instanceId: `card-${index}`,
      definitionId: 'bug',
    }))
    const rotations = [
      ...render(state, 'a').matchAll(/style="rotate:([^";]+)deg;/g),
    ]
    expect(rotations.map((match) => Number(match[1]))).toEqual(angles)
  },
)

it.each([[], [0], [6, 6], [6, 0, 6], [6, 1.5, 0, 1.5, 6]])(
  'curves the hand with vertical offsets %j',
  (...offsets: number[]) => {
    const state = started()
    state.players[0].hand = offsets.map((_, index) => ({
      instanceId: `card-${index}`,
      definitionId: 'bug',
    }))
    const translations = [
      ...render(state, 'a').matchAll(/translate:0 ([\d.]+)px/g),
    ]
    expect(translations.map((match) => Number(match[1]))).toEqual(offsets)
  },
)

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
      'title="Next turn: API Outage, Budget Freeze, API Outage, Caveman, Rate Limited"',
    )
    expect(html).toContain(
      '! API Outage · Budget Freeze · API Outage · Caveman · Rate Limited</span>',
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
    expect(html).toContain('--play-count:9')
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
      const label = `aria-label="${userId === 'a' ? 'Undo' : 'Discarded'} ${CARDS.backend.name}"`
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

it('shows only the next player’s hand in the end-of-turn Pair Programming picker', () => {
  const state = createGame('a', 'Alpha', 42)
  joinGame(state, 'b', 'Beta')
  joinGame(state, 'c', 'Gamma')
  startGame(state, 'a')
  state.players[0].hand = [
    { instanceId: 'pair', definitionId: 'pair-programming' },
  ]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'pair' })
  expect(render(state, 'a')).not.toContain('pair-dialog')
  resolveAction(state, 'a', { type: 'end-turn' })
  const html = render(state, 'a')
  expect(html).toContain('pair-dialog')
  expect(html).toContain('aria-label="Beta’s hand"')
  expect(html).not.toContain('aria-label="Gamma’s hand"')
  expect(render(state, 'b')).not.toContain('pair-dialog')
})

it('keeps the last card undoable without connectors or explanatory labels', () => {
  const state = started()
  state.players[0].hand = ['bug', 'fable', 'bug'].map((definitionId, i) => ({
    instanceId: `c${100 + i}`,
    definitionId,
  }))
  for (const card of [...state.players[0].hand])
    resolveAction(state, 'a', { type: 'play', cardInstanceId: card.instanceId })
  const html = render(state, 'a')
  expect(html).not.toContain('combo-')
  expect(html).not.toContain('Click to undo')
  expect(html).not.toContain('undo-label')
  expect(html.match(/aria-label="Undo /g)).toHaveLength(1)
  expect(render(state, 'b')).not.toContain('aria-label="Undo ')
  expect(html).toContain(`${state.drawPile.length} cards left in the deck`)
})

it.each([1, -1] as const)(
  'joins player cards with arrows in direction %i',
  (direction) => {
    const state = createGame('a', 'Alpha', 42)
    joinGame(state, 'b', 'Beta')
    joinGame(state, 'c', 'Gamma')
    startGame(state, 'a')
    state.direction = direction
    const html = render(state, 'a')
    expect(html.match(/class="player-join"/g)).toHaveLength(2)
    expect(
      html.match(
        new RegExp(
          `aria-label="Play moves ${direction === -1 ? 'left' : 'right'}"`,
          'g',
        ),
      ),
    ).toHaveLength(2)
    expect(html).not.toContain('Play direction')
  },
)

it('keeps board cards as buttons while synchronizing and only disables undo', () => {
  const state = started()
  state.players[0].hand = [{ instanceId: 'c100', definitionId: 'bug' }]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'c100' })
  for (const busy of [false, true]) {
    const html = render(state, 'a', busy)
    expect(html).toMatch(/<button[^>]*class="played-card action-space/)
    expect(html).toContain(
      `${busy ? 'disabled="" ' : ''}aria-label="Undo ${CARDS.bug.name}"`,
    )
  }
})

it('shows refill particles only on the active viewer’s credit meter', () => {
  const state = started()
  state.players[1].credits = 500
  resolveAction(state, 'a', { type: 'end-turn' })
  expect(render(state, 'b')).toContain('class="credit-particles"')
  expect(render(state, 'a')).not.toContain('class="credit-particles"')
  expect(render(state, 'b')).not.toContain('credit-refill-burst')
  expect(render(state, 'b')).not.toContain('+200 credits')
  state.events[0].creditRefill = 0
  expect(render(state, 'b')).not.toContain('class="credit-particles"')
})

it('limits Pair Programming choices to the cards actually left in opponents’ hands', () => {
  const state = started()
  state.players[0].hand = [
    { instanceId: 'c1000', definitionId: 'pair-programming' },
  ]
  state.players[1].hand = state.players[1].hand.slice(0, 2)
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'c1000' })
  resolveAction(state, 'a', { type: 'end-turn' })
  const html = render(state, 'a')
  expect(html).toContain('Choose up to 2 more cards')
  expect(html).toContain('Finish</button>')
  expect(html.match(/aria-label="Take /g)).toHaveLength(2)
})

it('keeps an empty discard space, then shows only the latest completed turn for every viewer', () => {
  const state = started()
  expect(render(state, 'a')).toContain('aria-label="Discard pile, empty"')
  state.players[0].hand = [{ instanceId: 'c100', definitionId: 'bug' }]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'c100' })
  expect(render(state, 'a')).toContain('aria-label="Discard pile, empty"')
  resolveAction(state, 'a', { type: 'end-turn' })
  for (const userId of ['a', 'b']) {
    const html = render(state, userId)
    expect(html).toContain(`aria-label="Previous turn: ${CARDS.bug.name}"`)
    expect(html.match(/class="discard-card played-card"/g)).toHaveLength(1)
  }
  state.players[1].hand = [{ instanceId: 'c101', definitionId: 'backend' }]
  state.players[1].credits = 0
  resolveAction(state, 'b', { type: 'discard', cardInstanceId: 'c101' })
  resolveAction(state, 'b', { type: 'end-turn' })
  const html = render(state, 'a')
  expect(html).toContain(`aria-label="Previous turn: ${CARDS.backend.name}"`)
  expect(html.match(/class="discard-card played-card"/g)).toHaveLength(1)
  const pile = html.slice(
    html.indexOf('class="discard-pile"'),
    html.indexOf('class="played-cards"'),
  )
  expect(pile).toContain('card-unavailable')
  expect(pile).toContain('tabindex="0"')
})

it('keeps a single played card in one fixed track when no actions remain', () => {
  const state = started()
  state.players[0].hand = [{ instanceId: 'only', definitionId: 'bug' }]
  resolveAction(state, 'a', { type: 'play', cardInstanceId: 'only' })
  state.players[0].actionsUsed = state.players[0].actionLimit
  expect(render(state, 'a')).toContain(
    '--play-count:1;grid-template-columns:var(--played-card-width)',
  )
})

it.each([1, -1] as const)(
  'greys Pair Programming for an empty next hand in direction %i',
  (direction) => {
    const state = createGame('a', 'Alpha', 42)
    joinGame(state, 'b', 'Beta')
    joinGame(state, 'c', 'Gamma')
    startGame(state, 'a')
    state.direction = direction
    state.players[direction === 1 ? 1 : 2].hand = []
    state.players[0].hand = [
      { instanceId: 'c1000', definitionId: 'pair-programming' },
    ]
    const html = render(state, 'a')
    expect(html).toContain('aria-label="Discard Pair Programming"')
    expect(html).toContain('card-unavailable')
  },
)
