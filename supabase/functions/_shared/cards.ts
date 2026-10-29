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
    yieldAmount: number,
    copy: string,
  ]
> = [
  [
    'bug',
    'Fix a Bug',
    'engineering',
    'engineer',
    50,
    50,
    'Closed as “works on my machine”.',
  ],
  [
    'div',
    'Centre a Div',
    'engineering',
    'engineer',
    80,
    100,
    'Only took six prompts.',
  ],
  [
    'dark',
    'Add Dark Mode',
    'engineering',
    'engineer',
    120,
    160,
    'Roadmap complete.',
  ],
  [
    'refactor',
    'Refactor',
    'engineering',
    'engineer',
    200,
    200,
    'Same bugs, better folders.',
  ],
  ['api', 'Ship an API', 'engineering', 'engineer', 300, 400, 'REST-ish.'],
  [
    'backend',
    'Rewrite Backend',
    'engineering',
    'engineer',
    500,
    500,
    'The old one had context.',
  ],
  [
    'mvp',
    'Vibe Code MVP',
    'engineering',
    'engineer',
    650,
    950,
    'Production is the test suite.',
  ],
  ['sonnet', 'Sonnet', 'model', 'sonnet', 0, 0, 'Next tasks yield ×1.5.'],
  ['opus', 'Opus', 'model', 'opus', 0, 0, 'Next tasks yield ×3.'],
  ['max', 'MAX Mode', 'mode', 'max', 0, 0, 'Next tasks cost ×2 and yield ×2.'],
  ['cache', 'Context Caching', 'model', 'cache', 0, 0, 'Next tasks cost ×0.5.'],
  [
    'yolo',
    'YOLO Mode',
    'mode',
    'yolo',
    0,
    0,
    'Engineering cards stop using actions.',
  ],
  [
    'ralph',
    'Ralph Wiggum',
    'mode',
    'ralph',
    0,
    0,
    'Empty your hand. No take-backs.',
  ],
  [
    'squad',
    'New Squad',
    'utility',
    'new-squad',
    0,
    0,
    'Bin the remaining hand.',
  ],
  ['loop', '/loop', 'utility', 'loop', 0, 0, 'Add two normal actions.'],
  [
    'reset',
    'Credit Reset',
    'utility',
    'credit-reset',
    0,
    0,
    'Return to 300 credits.',
  ],
  [
    'direction',
    'New Design Direction',
    'sabotage',
    'halve-next',
    0,
    0,
    'Halve the next team’s tokens.',
  ],
  [
    'webinar',
    'Forced Webinar',
    'sabotage',
    'steal-next',
    0,
    0,
    'Steal up to 200 tokens.',
  ],
  [
    'swap',
    'Swap Teams',
    'sabotage',
    'swap-next',
    0,
    0,
    'Swap tokens with the next team.',
  ],
  [
    'freeze',
    'Budget Freeze',
    'sabotage',
    'freeze-next',
    0,
    0,
    'No refill next turn.',
  ],
  [
    'outage',
    'API Outage',
    'sabotage',
    'outage-next',
    0,
    0,
    'No model cards next turn.',
  ],
  [
    'caveman',
    'Caveman',
    'sabotage',
    'caveman-next',
    0,
    0,
    'Next turn’s task yield ×0.5.',
  ],
  [
    'observe',
    'Observability',
    'utility',
    'observe-next',
    0,
    0,
    'Reveal the next team’s hand.',
  ],
]

export const CARDS: Record<string, CardDefinition> = Object.fromEntries(
  definitions.map(([id, name, kind, effect, cost, yieldAmount, copy]) => [
    id,
    {
      id,
      name,
      kind,
      effect,
      cost,
      yield: yieldAmount,
      copy,
      tone: CARD_TONES[kind],
    },
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
