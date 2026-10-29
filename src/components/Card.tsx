import {
  FiCpu,
  FiEye,
  FiGitBranch,
  FiLayers,
  FiRefreshCw,
  FiShuffle,
  FiTarget,
  FiTerminal,
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
}: {
  card: CardDefinition
  player?: PlayerView
  className?: string
  compact?: boolean
}) {
  const engineering = card.kind === 'engineering'
  const Icon =
    card.effect === 'observe-next'
      ? FiEye
      : card.effect === 'swap-next'
        ? FiShuffle
        : card.effect === 'loop'
          ? FiRefreshCw
          : icons[card.kind]
  const cost = Math.ceil(card.cost * (player?.costMultiplier ?? 1))
  const earned = Math.floor(card.yield * (player?.yieldMultiplier ?? 1))
  const description =
    engineering && (cost !== card.cost || earned !== card.yield)
      ? `This turn: ${cost.toLocaleString()} credits → ${earned.toLocaleString()} tokens.`
      : card.copy
  return (
    <div
      className={`game-card tone-${card.tone} ${compact ? 'card-compact' : ''} ${className}`}
    >
      <div className="card-top">
        <span>{card.kind}</span>
        <Icon aria-hidden="true" />
      </div>
      {engineering ? (
        <div className="card-art art-engineer">
          <div className="engineering-value">
            <strong>{card.cost.toLocaleString()}</strong>
            <span>CREDITS → TOKENS</span>
          </div>
        </div>
      ) : (
        <div className={`card-art art-${card.effect}`} aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-orbit orbit-two" />
          <span className="art-code">
            {card.kind === 'model'
              ? 'AI'
              : card.effect === 'yolo'
                ? '!!'
                : card.effect === 'ralph'
                  ? ':)'
                  : ''}
          </span>
          {card.kind !== 'model' &&
          card.effect !== 'yolo' &&
          card.effect !== 'ralph' ? (
            <Icon className="art-icon" />
          ) : null}
          <span className="art-corner corner-one">
            <FiTerminal />
          </span>
          <span className="art-corner corner-two">
            <FiGitBranch />
          </span>
        </div>
      )}
      <div className="card-title">{card.name}</div>
      <p className="card-copy">{description}</p>
    </div>
  )
}
