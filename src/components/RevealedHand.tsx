import { useEffect, useRef } from 'react'
import { FiEye, FiX } from 'react-icons/fi'
import type { PlayerView } from '../../supabase/functions/_shared/engine'
import { Card } from './Card'

export function RevealedHand({
  players,
  onClose,
}: {
  players: PlayerView[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="observability-dialog"
      aria-labelledby="observed-hand-title"
      onCancel={onClose}
      onClick={onClose}
    >
      <div className="observability-heading">
        <h2 id="observed-hand-title">
          <FiEye />
          {players.length === 1
            ? `${players[0].name}’s hand`
            : 'Observed hands'}
        </h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close revealed hand"
          autoFocus
        >
          <FiX />
        </button>
      </div>
      {players.map((player) => (
        <section key={player.id} aria-label={`${player.name}’s hand`}>
          {players.length > 1 ? <h3>{player.name}</h3> : null}
          <div className="observed-cards">
            {player.hand?.map((instance) => (
              <Card key={instance.instanceId} card={instance.card} />
            ))}
          </div>
        </section>
      ))}
    </dialog>
  )
}
