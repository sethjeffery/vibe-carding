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
          <p>
            Spend credits to burn LLM tokens. Reach the game’s token target at
            the end of your turn to win.
          </p>
        </div>
      </div>
      <div className="rule-row">
        <FiLayers />
        <div>
          <h3>Three cards per turn</h3>
          <p>
            Play up to three cards. Cards with no legal effect are discarded.
            Click the last card on the table to undo it. End turn commits your
            cards and applies sabotage. Refill to seven at the start of your
            next turn.
          </p>
        </div>
      </div>
      <div className="rule-row">
        <FiZap />
        <div>
          <h3>Order is everything</h3>
          <p>
            Models and modes affect engineering cards played after them.
            Multipliers stack. You must afford the full cost. Pivot reverses
            play direction; sabotage targets the next player in the direction
            when you place it.
          </p>
        </div>
      </div>
      <div className="rule-row">
        <FiLayers />
        <div>
          <h3>Pair Programming</h3>
          <p>
            At the end of this turn, take face-up cards from the next player
            until you have seven, their hand is empty, or you choose Finish.
            Hands are replenished at the start of each player’s turn.
          </p>
        </div>
      </div>
      <button className="button-primary mt-6 w-full" onClick={onClose}>
        LGTM.
      </button>
    </dialog>
  )
}
