import { expect, it } from 'vitest'
import { parseRequest } from './request'

const valid = {
  op: 'action',
  requestId: '12345678-1234-1234-1234-123456789abc',
  code: 'ABC234',
  expectedRevision: 0,
  action: { type: 'play', cardInstanceId: 'c1' },
}
it.each([
  null,
  [],
  {},
  { ...valid, expectedRevision: -1 },
  { ...valid, requestId: 'bad' },
  { ...valid, action: { type: 'win' } },
  { ...valid, action: { type: 'play', cardInstanceId: '../bad' } },
  { ...valid, code: '<script>' },
  { ...valid, aiPlayerId: 'human-id' },
  { ...valid, aiPlayerId: null },
  { ...valid, op: 'ai-seat', playerId: 'human-id' },
])('rejects malformed or forged input %j', (input) => {
  expect(() => parseRequest(JSON.stringify(input))).toThrow()
})
it('accepts host AI seat and action requests and defaults starts to 10,000 tokens', () => {
  const aiAction = { ...valid, aiPlayerId: 'ai-1' }
  expect(parseRequest(JSON.stringify(aiAction))).toEqual(aiAction)
  const seat = {
    op: 'ai-seat',
    code: valid.code,
    expectedRevision: 0,
    requestId: valid.requestId,
  }
  expect(parseRequest(JSON.stringify(seat))).toEqual(seat)
  expect(parseRequest(JSON.stringify({ ...seat, playerId: 'ai-1' }))).toEqual({
    ...seat,
    playerId: 'ai-1',
  })
  expect(parseRequest(JSON.stringify({ ...seat, op: 'start' }))).toEqual({
    ...seat,
    op: 'start',
    target: 10000,
  })
})
it('normalises codes and drops untrusted state fields', () => {
  expect(
    parseRequest(JSON.stringify({ ...valid, code: 'abc234', tokens: 100000 })),
  ).toEqual(valid)
})
