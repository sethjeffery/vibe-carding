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
])('rejects malformed or forged input %j', (input) => {
  expect(() => parseRequest(JSON.stringify(input))).toThrow()
})
it('normalises codes and drops untrusted state fields', () => {
  expect(
    parseRequest(JSON.stringify({ ...valid, code: 'abc234', tokens: 100000 })),
  ).toEqual(valid)
})
