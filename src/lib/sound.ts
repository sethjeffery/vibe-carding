import { CARDS } from '../../supabase/functions/_shared/cards'

let context: AudioContext | undefined
let enabled = localStorage.getItem('vibe-sound') !== 'off'

export function setSound(value: boolean) {
  enabled = value
  localStorage.setItem('vibe-sound', value ? 'on' : 'off')
}
export function isSoundEnabled() {
  return enabled
}

const cues = {
  card: [260, 520],
  turn: [440, 660],
  win: [523, 659, 784, 1046],
  buff: [330, 440, 554, 660],
  debuff: [110, 80, 110, 65],
  engineering: [392, 523, 784],
  snatch: [880, 440, 220],
  reset: [660, 440, 330, 660],
}

export function playCardSound(cardId: string, discarded = false) {
  const card = CARDS[cardId]
  if (discarded || !card) return playSound('card')
  if (card.kind === 'sabotage') return playSound('debuff')
  if (card.kind === 'engineering') return playSound('engineering')
  if (card.effect.discardHand) return playSound('reset')
  playSound('buff')
}

export function playSound(cue: keyof typeof cues) {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    void context.resume().catch(() => undefined)
    const notes = cues[cue]
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator()
      const gain = context!.createGain()
      const start =
        context!.currentTime + index * (cue === 'debuff' ? 0.14 : 0.085)
      oscillator.type = cue === 'debuff' ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(frequency, start)
      if (cue === 'debuff') {
        oscillator.frequency.setValueAtTime(frequency * 1.8, start)
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency,
          start + 0.08,
        )
      }
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
