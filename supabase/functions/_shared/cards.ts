export type CardKind = 'engineering' | 'model' | 'mode' | 'utility' | 'sabotage'
export type CardEffect =
  | 'engineer'
  | 'opus'
  | 'sonnet'
  | 'max'
  | 'cache'
  | 'yolo'
  | 'ralph'
  | 'new-squad'
  | 'loop'
  | 'credit-reset'
  | 'halve-next'
  | 'steal-next'
  | 'swap-next'
  | 'freeze-next'
  | 'outage-next'
  | 'caveman-next'
  | 'observe-next'

export interface CardDefinition {
  id: string
  name: string
  kind: CardKind
  effect: CardEffect
  cost: number
  yield: number
  copy: string
  tone: 'cyan' | 'pink' | 'lime' | 'orange' | 'violet'
}

const CARD_TONES: Record<CardKind, CardDefinition['tone']> = {
  engineering: 'cyan',
  model: 'violet',
  mode: 'orange',
  utility: 'lime',
  sabotage: 'pink',
}

const definitions: Array<
  [
    id: string,
    name: string,
    kind: CardKind,
    effect: CardEffect,
    cost: number,
    copy: string,
  ]
> = [
  [
    'bug',
    'Fix a Bug',
    'engineering',
    'engineer',
    50,
    'Closed as “works on my machine”.',
  ],
  [
    'div',
    'Centre a Div',
    'engineering',
    'engineer',
    80,
    'Only took six prompts.',
  ],
  [
    'dark',
    'Add Dark Mode',
    'engineering',
    'engineer',
    120,
    'Roadmap complete.',
  ],
  [
    'refactor',
    'Refactor',
    'engineering',
    'engineer',
    200,
    'Same bugs, better folders.',
  ],
  ['api', 'Ship an API', 'engineering', 'engineer', 300, 'REST-ish.'],
  [
    'backend',
    'Rewrite Backend',
    'engineering',
    'engineer',
    500,
    'The old one had context.',
  ],
  [
    'mvp',
    'Vibe Code MVP',
    'engineering',
    'engineer',
    650,
    'Production is the test suite.',
  ],
  ['sonnet', 'Sonnet', 'model', 'sonnet', 0, 'Tasks yield ×1.5 this turn.'],
  ['opus', 'Opus', 'model', 'opus', 0, 'Tasks yield ×3 this turn.'],
  [
    'max',
    'MAX Mode',
    'mode',
    'max',
    0,
    'Tasks cost ×2 and yield ×2 this turn.',
  ],
  [
    'cache',
    'Context Caching',
    'model',
    'cache',
    0,
    'Tasks cost ×0.5 this turn.',
  ],
  [
    'yolo',
    'YOLO Mode',
    'mode',
    'yolo',
    0,
    'Engineering plays use no actions this turn.',
  ],
  [
    'ralph',
    'Ralph Wiggum',
    'mode',
    'ralph',
    0,
    'Resolve your whole hand before ending your turn.',
  ],
  [
    'squad',
    'New Squad',
    'utility',
    'new-squad',
    0,
    'Discard the rest of your hand.',
  ],
  ['loop', '/loop', 'utility', 'loop', 0, 'Add two actions this turn.'],
  [
    'reset',
    'Credit Reset',
    'utility',
    'credit-reset',
    0,
    'Return to 300 credits.',
  ],
  [
    'direction',
    'New Design Direction',
    'sabotage',
    'halve-next',
    0,
    'Halve the next team’s tokens.',
  ],
  [
    'webinar',
    'Forced Webinar',
    'sabotage',
    'steal-next',
    0,
    'Steal up to 200 tokens from the next team.',
  ],
  [
    'swap',
    'Swap Teams',
    'sabotage',
    'swap-next',
    0,
    'Swap tokens with the next team.',
  ],
  [
    'freeze',
    'Budget Freeze',
    'sabotage',
    'freeze-next',
    0,
    'Next team gets no credit refill next turn.',
  ],
  [
    'outage',
    'API Outage',
    'sabotage',
    'outage-next',
    0,
    'Next team can’t use models next turn.',
  ],
  [
    'caveman',
    'Caveman',
    'sabotage',
    'caveman-next',
    0,
    'Next team’s tasks yield ×0.5 next turn.',
  ],
  [
    'observe',
    'Observability',
    'utility',
    'observe-next',
    0,
    'Reveal the next team’s hand until your turn ends.',
  ],
]

export const CARDS: Record<string, CardDefinition> = Object.fromEntries(
  definitions.map(([id, name, kind, effect, cost, copy]) => [
    id,
    { id, name, kind, effect, cost, yield: cost, copy, tone: CARD_TONES[kind] },
  ]),
)

export const DECK_COUNTS: Record<string, number> = {
  bug: 6,
  div: 5,
  dark: 5,
  refactor: 5,
  api: 4,
  backend: 3,
  mvp: 2,
  sonnet: 3,
  opus: 2,
  max: 3,
  cache: 2,
  yolo: 2,
  ralph: 2,
  squad: 2,
  loop: 2,
  reset: 2,
  observe: 2,
  direction: 2,
  webinar: 2,
  swap: 1,
  freeze: 1,
  outage: 1,
  caveman: 1,
}
