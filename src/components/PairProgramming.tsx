import { useEffect, useRef } from 'react'
import type { PlayerView } from '../../supabase/functions/_shared/engine'
import { Card } from './Card'

export function PairProgramming({
  players,
  remaining,
  busy,
  onTake,
  onFinish,
}: {
  players: PlayerView[]
  remaining: number
  busy: boolean
  onTake: (cardInstanceId: string) => void
  onFinish: () => void
}) {
  const count = Math.min(
    remaining,
    players.reduce((sum, player) => sum + player.handCount, 0),
  )
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="pair-dialog"
      aria-labelledby="pair-title"
      aria-describedby="pair-description"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="pair-title">Pair Programming</h2>
      <p id="pair-description">
        Choose up to {count} more {count === 1 ? 'card' : 'cards'} to add to
        your hand.
      </p>
      {players
        .filter((p) => p.handCount > 0)
        .map((player) => (
          <section key={player.id} aria-label={`${player.name}’s hand`}>
            <h3>{player.name}</h3>
            <div className="pair-cards">
              {player.hand?.map((instance) => (
                <button
                  type="button"
                  key={instance.instanceId}
                  disabled={busy}
                  aria-label={`Take ${instance.card.name} from ${player.name}`}
                  onClick={(event) => {
                    if (
                      !matchMedia('(prefers-reduced-motion: reduce)').matches
                    ) {
                      const button = event.currentTarget
                      const rect = button.getBoundingClientRect()
                      const leaving = button.cloneNode(
                        true,
                      ) as HTMLButtonElement
                      leaving.className = 'pair-card-flight'
                      leaving.disabled = true
                      leaving.inert = true
                      leaving.setAttribute('aria-hidden', 'true')
                      Object.assign(leaving.style, {
                        left: `${rect.left}px`,
                        top: `${rect.top}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                      })
                      ;(count === 1 ? document.body : ref.current)?.append(
                        leaving,
                      )
                      leaving.animate(
                        [
                          { opacity: 1, transform: 'translate(0, 0) scale(1)' },
                          {
                            opacity: 0,
                            transform:
                              'translate(70px, 100px) rotate(8deg) scale(.6)',
                          },
                        ],
                        { duration: 180, easing: 'ease-in', fill: 'forwards' },
                      ).onfinish = () => leaving.remove()
                    }
                    onTake(instance.instanceId)
                  }}
                >
                  <Card card={instance.card} />
                </button>
              ))}
            </div>
          </section>
        ))}
      <button
        type="button"
        className="button-primary pair-finish"
        disabled={busy}
        onClick={onFinish}
      >
        Finish
      </button>
    </dialog>
  )
}
