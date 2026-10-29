import { useEffect, useRef } from 'react'
import { FiEye, FiX } from 'react-icons/fi'
import type { PlayerView } from '../../supabase/functions/_shared/engine'
import { Card } from './Card'

export function RevealedHand({
  player,
  onClose,
}: {
  player: PlayerView
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
          {player.name}’s hand
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
      <div className="observed-cards">
        {player.hand?.map((instance) => (
          <Card key={instance.instanceId} card={instance.card} />
        ))}
      </div>
      <p>Click anywhere to dismiss · Reopen from Observability on the table</p>
    </dialog>
  )
}
