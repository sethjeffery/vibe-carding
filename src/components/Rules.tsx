import { useEffect, useRef } from 'react'
import { FiZap, FiLayers, FiTarget } from 'react-icons/fi'

export function Rules({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="rules-dialog"
    >
      <div className="flex items-center justify-between">
        <h2>README.md</h2>
      </div>
      <p className="text-zinc-400">
        Well kudos to you, actually reading the documentation!
      </p>
      <div className="rule-row">
        <FiTarget />
        <div>
          <h3>Burn your way to the top</h3>
          <p>Spend credits to burn LLM tokens. The first to 10,000 wins!</p>
        </div>
      </div>
      <div className="rule-row">
        <FiLayers />
        <div>
          <h3>Three cards per turn</h3>
          <p>
            Play up to three cards. If you cannot afford a card due to low
            credits, it has no effect and is discarded.
          </p>
        </div>
      </div>
      <div className="rule-row">
        <FiZap />
        <div>
          <h3>Order is everything</h3>
          <p>
            Models and modes affect engineering cards played after them.
            Multipliers stack. You must afford the full cost.
          </p>
        </div>
      </div>
      <button className="button-primary mt-6 w-full" onClick={onClose}>
        LGTM.
      </button>
    </dialog>
  )
}
