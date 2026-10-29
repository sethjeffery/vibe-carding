import {
  FiCpu,
  FiEye,
  FiLayers,
  FiRefreshCw,
  FiShuffle,
  FiTarget,
  FiZap,
} from 'react-icons/fi'
import type {
  CardDefinition,
  PlayerView,
} from '../../supabase/functions/_shared/engine'

const icons = {
  engineering: FiZap,
  model: FiCpu,
  mode: FiZap,
  utility: FiLayers,
  sabotage: FiTarget,
}
export function Card({
  card,
  player,
  className = '',
  compact = false,
  discarded = false,
  economics,
}: {
  card: CardDefinition
  player?: PlayerView
  className?: string
  compact?: boolean
  discarded?: boolean
  economics?: { cost: number; tokens: number }
}) {
  const engineering = card.kind === 'engineering'
  const Icon = card.effect.observability
    ? FiEye
    : card.effect.swapTokens
      ? FiShuffle
      : card.effect.addActions
        ? FiRefreshCw
        : icons[card.kind]
  const cost =
    economics?.cost ?? Math.ceil(card.cost * (player?.costMultiplier ?? 1))
  const earned =
    economics?.tokens ?? Math.floor(card.yield * (player?.yieldMultiplier ?? 1))
  const unavailable =
    discarded || (engineering && player != null && cost > player.credits)
  return (
    <div
      className={`game-card tone-${card.tone} ${compact ? 'card-compact' : ''} ${unavailable ? 'card-unavailable' : ''} ${className}`}
    >
      <div className="card-top">
        <span>{card.kind}</span>
        <Icon aria-hidden="true" />
      </div>
      <div className="card-title">{card.name}</div>
      {engineering ? (
        <div className="card-art art-engineer">
          <div className="engineering-value">
            <strong>+{earned.toLocaleString()}</strong>
            <span>
              <FiCpu aria-hidden="true" /> TOKENS
            </span>
          </div>
        </div>
      ) : (
        <div className={`card-art art-${card.id}`} aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-orbit orbit-two" />
          <Icon className="art-icon" />
        </div>
      )}
      {engineering ? (
        <div className="card-footer">
          <div className="engineering-cost">
            <FiZap aria-hidden="true" />{' '}
            <span>{cost.toLocaleString()} credits</span>
          </div>
          <p className="card-copy">{card.copy}</p>
        </div>
      ) : (
        <div className="card-footer">
          <div className="engineering-cost">{card.copy}</div>
        </div>
      )}
    </div>
  )
}
