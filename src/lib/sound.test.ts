import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('plays effect-specific notes, keeps discards neutral, and respects mute', async () => {
  const frequencies: number[] = []
  const ramps: number[] = []
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal(
    'AudioContext',
    class {
      currentTime = 0
      destination = {}
      resume = () => Promise.resolve()
      createOscillator() {
        return {
          frequency: {
            setValueAtTime: (value: number) => frequencies.push(value),
            exponentialRampToValueAtTime: (value: number) => ramps.push(value),
          },
          connect: (gain: unknown) => gain,
          start() {},
          stop() {},
          disconnect() {},
        }
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        }
      }
    },
  )
  const { playCardSound, setSound } = await import('./sound')
  for (const id of [
    'opus',
    'cache',
    'max',
    'caveman',
    'loop',
    'reset',
    'payg-200',
  ]) {
    frequencies.length = 0
    playCardSound(id)
    expect(frequencies).toEqual([330, 440, 554, 660])
  }
  for (const id of ['direction', 'webinar', 'swap', 'freeze', 'outage']) {
    ramps.length = 0
    playCardSound(id)
    expect(ramps).toEqual([110, 80, 110, 65])
  }
  for (const [id, notes] of [
    ['bug', [392, 523, 784]],
    ['observe', [880, 1320, 880]],
    ['squad', [660, 440, 330, 660]],
    ['unknown', [260, 520]],
  ] as const) {
    frequencies.length = 0
    playCardSound(id)
    expect(frequencies).toEqual(notes)
  }
  frequencies.length = 0
  playCardSound('webinar', true)
  expect(frequencies).toEqual([260, 520])
  setSound(false)
  frequencies.length = 0
  playCardSound('opus')
  expect(frequencies).toEqual([])
})
