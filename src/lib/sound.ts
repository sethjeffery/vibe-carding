let context: AudioContext | undefined
let enabled = localStorage.getItem('vibe-sound') !== 'off'

export function setSound(value: boolean) {
  enabled = value
  localStorage.setItem('vibe-sound', value ? 'on' : 'off')
}
export function isSoundEnabled() {
  return enabled
}

export function playSound(cue: 'card' | 'turn' | 'win') {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    void context.resume().catch(() => undefined)
    const notes =
      cue === 'win'
        ? [523, 659, 784, 1046]
        : cue === 'turn'
          ? [440, 660]
          : [260, 520]
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator()
      const gain = context!.createGain()
      const start = context!.currentTime + index * 0.085
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.055, start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
      oscillator.connect(gain).connect(context!.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.16)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  } catch {
    /* Audio is optional when a browser has no audio device. */
  }
}
