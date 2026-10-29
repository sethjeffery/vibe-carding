import { useEffect, useRef } from 'react'
import { FiX, FiZap, FiLayers, FiTarget } from 'react-icons/fi'

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
        <h2>Read the README.</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close rules"
        >
          <FiX />
        </button>
      </div>
      <p className="mt-3 text-zinc-400">
        The code quality is optional. The token count isn’t.
      </p>
      <div className="rule-row">
        <FiTarget />
        <div>
          <h3>Burn your way to the top</h3>
          <p>
            Reach the lobby’s token target to win immediately. Credits are your
            budget; tokens are your score.
          </p>
        </div>
      </div>
      <div className="rule-row">
        <FiLayers />
        <div>
          <h3>Seven cards. Three actions.</h3>
          <p>
            Play up to three cards, then end your turn. Keep unplayed cards and
            refill to seven. Only unplayable cards can be discarded, using an
            action.
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
      <div className="rules-special">
        <p>
          <strong>YOLO</strong> gives you free engineering plays.
        </p>
        <p>
          <strong>Credit Reset</strong> refills to 1,000 credits. PAYG adds 200,
          300, or 500 credits, up to that cap.
        </p>
        <p>
          <strong>Beta Tester</strong> makes subsequent tasks cost no credits
          this turn.
        </p>
        <p>
          <strong>Caveman</strong> halves subsequent engineering costs and token
          yields this turn.
        </p>
        <p>
          <strong>Ralph</strong> makes you empty your hand.
        </p>
        <p>
          <strong>Sabotage</strong> always hits the next player in seat order.
        </p>
        <p>
          <strong>Observability</strong> reveals that player’s hand until your
          turn ends.
        </p>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        Prototype economy: 1,000 starting credits, +200 at the start of each
        later turn, 1,000 cap. Modifiers expire at turn end. Take your time —
        turns have no countdown. Refreshing restores your seat in this browser.
      </p>
      <button className="button-primary mt-6 w-full" onClick={onClose}>
        Got it. Ship it.
      </button>
    </dialog>
  )
}
