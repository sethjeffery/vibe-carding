import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  createGame,
  joinGame,
  projectGame,
  resolveAction,
  startGame,
  type GameState,
} from '../_shared/engine.ts'
import { parseRequest } from '../_shared/request.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
function gameCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => alphabet[byte % alphabet.length],
  ).join('')
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return response({ error: 'Use POST.' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return response({ error: 'Sign in to continue.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser()
    if (authError || !user)
      return response(
        { error: 'Your session expired. Refresh and try again.' },
        401,
      )
    const raw = await request.text()
    if (raw.length > 2048) return response({ error: 'Request too large.' }, 413)
    const body = parseRequest(raw)
    const admin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )
    let code: string
    if (body.op === 'create') code = gameCode()
    else {
      code = body.code
    }
    let id: string
    let state: GameState
    let revision = -1
    if (body.op === 'create') {
      id = body.requestId
      const { data: existing, error } = await admin
        .from('games')
        .select('id, code, state')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (existing)
        return response({
          code: existing.code,
          gameId: existing.id,
          game: projectGame(existing.state as GameState, user.id),
        })
      state = createGame(
        user.id,
        body.name,
        crypto.getRandomValues(new Uint32Array(1))[0],
      )
    } else {
      const { data: game, error } = await admin
        .from('games')
        .select('id, state, revision')
        .eq('code', code)
        .maybeSingle()
      if (error) throw error
      if (!game)
        return response(
          { error: 'Game not found. Check the invite code.' },
          404,
        )
      id = game.id
      state = game.state as GameState
      revision = game.revision
      const isMember = state.players.some((player) => player.id === user.id)
      if (body.op === 'join' && isMember)
        return response({ code, gameId: id, game: projectGame(state, user.id) })
      if (body.op !== 'join' && !isMember)
        return response({ error: 'Join this game first.' }, 403)
      if (body.op !== 'state') {
        const { data: receipt, error: receiptError } = await admin
          .from('game_actions')
          .select('action_id')
          .eq('game_id', id)
          .eq('action_id', body.requestId)
          .maybeSingle()
        if (receiptError) throw receiptError
        if (receipt && isMember)
          return response({
            code,
            gameId: id,
            game: projectGame(state, user.id),
          })
      }
      if (body.op === 'state')
        return response({ code, gameId: id, game: projectGame(state, user.id) })
      if (body.op === 'join') joinGame(state, user.id, body.name)
      else {
        if (
          !Number.isInteger(body.expectedRevision) ||
          body.expectedRevision !== revision
        )
          return response(
            { error: 'The game changed. Syncing…', stale: true },
            409,
          )
        if (body.op === 'start') startGame(state, user.id, body.target)
        else {
          resolveAction(state, user.id, body.action)
        }
      }
    }
    const { data: committed, error: commitError } = await admin.rpc(
      'commit_game',
      {
        p_game_id: id,
        p_code: code,
        p_state: state,
        p_expected: revision,
        p_action_id: body.requestId,
        p_actor: user.id,
      },
    )
    if (commitError) throw commitError
    if (!committed)
      return response(
        { error: 'The game changed. Try again.', stale: true },
        409,
      )
    return response({ code, gameId: id, game: projectGame(state, user.id) })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The server hit a snag. Try again.'
    console.error('Game request failed:', message)
    return response({ error: message }, 400)
  }
})
