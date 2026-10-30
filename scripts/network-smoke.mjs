import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { DECK_COUNTS } from '../supabase/functions/_shared/cards.ts'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
assert(url && key, 'Load .env.local before running this live Supabase test.')

const sessions = []
for (let seat = 0; seat < 6; seat++) {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInAnonymously()
  assert.ifError(error)
  sessions.push(data.session)
}

async function invoke(seat, body, expectedStatus = 200) {
  const result = await fetch(`${url}/functions/v1/game`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${sessions[seat].access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }),
  })
  const data = await result.json()
  assert.equal(result.status, expectedStatus, JSON.stringify(data))
  return data
}

const created = await invoke(0, { op: 'create', name: 'Smoke Alpha' })
assert.equal(created.game.players[0].credits, 1000)
const { code } = created
await Promise.all(
  [1, 2, 3, 4, 5].map(async (seat) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`${url}/functions/v1/game`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${sessions[seat].access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'join',
          code,
          requestId: crypto.randomUUID(),
          name: `Smoke ${seat}`,
        }),
      })
      if (response.status === 409) continue
      assert.equal(response.status, 200, await response.text())
      return
    }
    assert.fail('Concurrent join did not converge.')
  }),
)
let snapshot = await invoke(0, { op: 'state', code })
assert.equal(snapshot.game.players.length, 6)
snapshot = await invoke(0, {
  op: 'start',
  code,
  target: 3000,
  expectedRevision: snapshot.game.revision,
})
assert(snapshot.game.players.every((player) => player.credits === 1000))
assert.equal(
  snapshot.game.deckCount + 6 * 7,
  Object.values(DECK_COUNTS).reduce((sum, count) => sum + count, 0) *
    Math.ceil(snapshot.game.players.length / 4),
)
assert.equal(snapshot.game.players[0].hand.length, 7)
assert(snapshot.game.players.slice(1).every((p) => p.hand === null))
for (const forbidden of ['drawPile', 'discardPile', 'rng'])
  assert(!(forbidden in snapshot.game))
await invoke(
  1,
  {
    op: 'action',
    code,
    expectedRevision: snapshot.game.revision,
    action: { type: 'end-turn' },
  },
  400,
)

const previousRevision = snapshot.game.revision
const requestId = crypto.randomUUID()
const action = {
  op: 'action',
  code,
  requestId,
  expectedRevision: previousRevision,
  action: { type: 'end-turn' },
}
const [first, duplicate] = await Promise.all([
  invoke(0, action),
  invoke(0, action),
])
assert.equal(first.game.revision, duplicate.game.revision)
await invoke(0, { ...action, requestId: crypto.randomUUID() }, 409)

const headers = {
  apikey: key,
  Authorization: `Bearer ${sessions[0].access_token}`,
}
for (const table of ['games', 'game_actions']) {
  const result = await fetch(`${url}/rest/v1/${table}?select=*`, { headers })
  assert.equal(result.status, 403)
}
const notifications = await fetch(`${url}/rest/v1/game_updates?select=*`, {
  headers,
}).then((r) => r.json())
assert.equal(notifications.length, 1)
assert.equal(notifications[0].user_id, sessions[0].user.id)
console.info(
  JSON.stringify({
    gameCode: code,
    players: 6,
    checks: [
      'concurrent joins',
      'hidden hands',
      'server turn ownership',
      'concurrent duplicate actions',
      'stale revisions',
      'RLS isolation',
    ],
  }),
)
