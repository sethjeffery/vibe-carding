export type CardKind = 'engineering' | 'model' | 'mode' | 'utility' | 'sabotage'
export interface CardEffect {
  costMultiplier?: number
  yieldMultiplier?: number
  target?: 'current' | 'next' | 'all'
  playAllCards?: boolean
  engineeringCardsSlotCost?: number
  disableModels?: boolean
  disableCredits?: boolean
  stealTokens?: number
  addCredits?: number
  resetCredits?: boolean
  observability?: boolean
  tokenMultiplier?: number
  swapTokens?: boolean
  discardHand?: boolean
  addActions?: number
}

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
  ['bug', 'Roll Forward', 'engineering', {}, 150, 'Rolling back is so 2025.'],
  [
    'bug',
    'Fix a Regression',
    'engineering',
    {},
    100,
    'Closed as “works on my machine”.',
  ],
  ['div', 'Centre a Div', 'engineering', {}, 100, 'Only took six prompts.'],
  [
    'dark',
    'Accessibility Audit',
    'engineering',
    {},
    180,
    '3% of users complained.',
  ],
  [
    'div',
    'CSS Animations',
    'engineering',
    {},
    200,
    'CEO specifically asked for it.',
  ],
  [
    'refactor',
    'Refactor',
    'engineering',
    {},
    250,
    'Same bugs, now in folders.',
  ],
  [
    'documentation',
    'Documentation',
    'engineering',
    {},
    450,
    'Bloat for the next AI to summarize.',
  ],
  ['api', 'Ship an API', 'engineering', {}, 350, 'Microservices!'],
  ['api', 'Ship an API', 'engineering', {}, 500, 'We need GraphQL!'],
  [
    'backend',
    'Rewrite Backend',
    'engineering',
    {},
    600,
    'The old one had too much context.',
  ],
  [
    'rewrite',
    'Rewrite in Rust',
    'engineering',
    {},
    750,
    "Everything's better in Rust!",
  ],
  [
    'backend',
    'Auth Layer',
    'engineering',
    {},
    500,
    'Includes x-backdoor header.',
  ],
  [
    'mvp',
    'Vibe Code MVP',
    'engineering',
    {},
    750,
    'Production is the test suite.',
  ],
  [
    'sonnet',
    'Sonnet',
    'model',
    { yieldMultiplier: 1.5 },
    0,
    'Yield ×1.5 this turn.',
  ],
  ['opus', 'Opus', 'model', { yieldMultiplier: 3 }, 0, 'Yield ×3 this turn.'],
  [
    'max',
    'MAX Mode',
    'mode',
    { costMultiplier: 2, yieldMultiplier: 2 },
    0,
    'Cost and yield doubled this turn.',
  ],
  [
    'cache',
    'Context Caching',
    'model',
    { costMultiplier: 0.5 },
    0,
    'Cost halved this turn.',
  ],
  [
    'yolo',
    'YOLO Mode',
    'mode',
    { engineeringCardsSlotCost: 0 },
    0,
    'Play as many engineering cards as you want this turn.',
  ],
  [
    'ralph',
    'Ralph Wiggum',
    'mode',
    { playAllCards: true },
    0,
    'You must play your whole hand before ending your turn.',
  ],
  [
    'squad',
    'New Squad',
    'utility',
    { discardHand: true },
    0,
    'Discard the rest of your hand.',
  ],
  [
    'loop',
    '/loop',
    'utility',
    { addActions: 2 },
    0,
    'Add two actions this turn.',
  ],
  [
    'reset',
    'Credit Reset',
    'utility',
    { resetCredits: true },
    0,
    'Refill to the full 1,000 credits.',
  ],
  [
    'payg-200',
    'PAYG 200',
    'utility',
    { addCredits: 200 },
    0,
    'Add 200 credits, up to the cap.',
  ],
  [
    'payg-300',
    'PAYG 300',
    'utility',
    { addCredits: 300 },
    0,
    'Add 300 credits, up to the cap.',
  ],
  [
    'payg-500',
    'PAYG 500',
    'utility',
    { addCredits: 500 },
    0,
    'Add 500 credits, up to the cap.',
  ],
  [
    'beta',
    'Beta Tester',
    'mode',
    { costMultiplier: 0 },
    0,
    'Zero credit cost this turn.',
  ],
  [
    'direction',
    'New Design Direction',
    'sabotage',
    { target: 'next', tokenMultiplier: 0.8 },
    0,
    'Reduce the next player’s tokens by 20%.',
  ],
  [
    'webinar',
    'Forced Webinar',
    'sabotage',
    { target: 'next', stealTokens: 200 },
    0,
    'Steal up to 200 tokens from the next player.',
  ],
  [
    'swap',
    'Swap Players',
    'sabotage',
    { target: 'next', swapTokens: true },
    0,
    'Swap tokens with the next player.',
  ],
  [
    'freeze',
    'Budget Freeze',
    'sabotage',
    { target: 'next', disableCredits: true },
    0,
    'Next player gets no credit refill one turn.',
  ],
  [
    'outage',
    'API Outage',
    'sabotage',
    { target: 'next', disableModels: true },
    0,
    'Next player can’t use models one turn.',
  ],
  [
    'caveman',
    'Caveman',
    'mode',
    { costMultiplier: 0.5, yieldMultiplier: 0.5 },
    0,
    'Cost and yield both halved this turn.',
  ],
  [
    'observe',
    'Observability',
    'utility',
    { target: 'next', observability: true },
    0,
    'Reveal the next player’s hand until your turn ends.',
  ],
]

export const CARDS: Record<string, CardDefinition> = Object.fromEntries(
  definitions.map(([id, name, kind, effect, cost, copy]) => [
    id,
    {
      id,
      name,
      kind,
      effect,
      cost,
      yield: cost,
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
  reset: 1,
  'payg-200': 2,
  'payg-300': 2,
  'payg-500': 2,
  beta: 2,
  observe: 2,
  direction: 2,
  webinar: 2,
  swap: 1,
  freeze: 1,
  outage: 1,
  caveman: 1,
}
