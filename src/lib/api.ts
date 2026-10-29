import { createClient } from '@supabase/supabase-js'
import type {
  GameAction,
  GameView,
} from '../../supabase/functions/_shared/engine'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null

export interface GameResponse {
  code: string
  gameId: string
  game: GameView
}
export interface GameRequest {
  op: 'create' | 'join' | 'state' | 'start' | 'action'
  code?: string
  name?: string
  target?: number
  expectedRevision?: number
  action?: GameAction
}
export class GameError extends Error {
  constructor(
    message: string,
    public stale = false,
  ) {
    super(message)
  }
}

export async function gameRequest(body: GameRequest): Promise<GameResponse> {
  if (!supabase) throw new Error('The game server is not configured.')
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw new Error(error.message)
    session = data.session
  }
  if (!session) throw new Error('Could not open your player session.')
  const requestId = crypto.randomUUID()
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: Response
    try {
      result = await fetch(`${url}/functions/v1/game`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, requestId }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      if (attempt === 0) continue
      throw new Error(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Connection timed out. Please try again.'
          : 'Connection lost. Check your network and try again.',
        { cause: error },
      )
    }
    const data = await result.json()
    if (!result.ok)
      throw new GameError(
        data.error ?? data.message ?? 'The server hit a snag.',
        data.stale,
      )
    return data as GameResponse
  }
  throw new Error('Could not reach the server.')
}
