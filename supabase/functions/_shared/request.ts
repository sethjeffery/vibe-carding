import type { GameAction } from './engine.ts'

type Mutation = { requestId: string }
type Room = { code: string }
export type ClientRequest =
  | ({ op: 'create'; name: string } & Mutation)
  | ({ op: 'join'; name: string } & Room & Mutation)
  | ({ op: 'state' } & Room)
  | ({ op: 'start'; target: number; expectedRevision: number } & Room &
      Mutation)
  | ({ op: 'action'; action: GameAction; expectedRevision: number } & Room &
      Mutation)

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRequest(raw: string): ClientRequest {
  if (raw.length > 2048) throw new Error('Request too large.')
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new Error('Send a valid JSON request.')
  }
  if (!record(body)) throw new Error('Invalid request.')
  const op = body.op
  if (!['create', 'join', 'state', 'start', 'action'].includes(String(op)))
    throw new Error('Unknown operation.')
  if (
    op !== 'state' &&
    (typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.requestId,
      ))
  )
    throw new Error('Invalid request ID.')
  const requestId = body.requestId as string
  let name = ''
  if (op === 'create' || op === 'join') {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 20
    )
      throw new Error('Choose a team name, up to 20 characters.')
    name = body.name.trim()
  }
  if (op === 'create') return { op, requestId, name }
  if (
    typeof body.code !== 'string' ||
    !/^[A-Z2-9]{6}$/.test(body.code.toUpperCase())
  )
    throw new Error('Enter a six-character game code.')
  const code = body.code.toUpperCase()
  if (op === 'state') return { op, code }
  if (op === 'join') return { op, code, name, requestId }
  if (
    typeof body.expectedRevision !== 'number' ||
    !Number.isSafeInteger(body.expectedRevision) ||
    body.expectedRevision < 0
  )
    throw new Error('Invalid game revision.')
  const expectedRevision = body.expectedRevision
  if (op === 'start') {
    if (
      typeof body.target !== 'number' ||
      ![3000, 5000, 10000].includes(body.target)
    )
      throw new Error('Choose a valid token target.')
    return { op, code, requestId, expectedRevision, target: body.target }
  }
  if (!record(body.action)) throw new Error('Invalid action.')
  const action = body.action
  if (action.type === 'end-turn')
    return {
      op: 'action',
      code,
      requestId,
      expectedRevision,
      action: { type: 'end-turn' },
    }
  if (
    (action.type !== 'play' && action.type !== 'discard') ||
    typeof action.cardInstanceId !== 'string' ||
    !/^c[1-9]\d{0,9}$/.test(action.cardInstanceId)
  )
    throw new Error('Invalid card action.')
  return {
    op: 'action',
    code,
    requestId,
    expectedRevision,
    action: { type: action.type, cardInstanceId: action.cardInstanceId },
  }
}
