import {
  FiActivity,
  FiArrowUpRight,
  FiCode,
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
  engineering: FiCode,
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
  const Icon =
    card.effect === 'observe-next'
      ? FiEye
      : card.effect === 'swap-next'
        ? FiShuffle
        : card.effect === 'loop'
          ? FiRefreshCw
          : icons[card.kind]
  const cost = Math.ceil((card.cost ?? 0) * (player?.costMultiplier ?? 1))
  const earned = Math.floor((card.yield ?? 0) * (player?.yieldMultiplier ?? 1))
  return (
    <div
      className={`game-card tone-${card.tone} ${compact ? 'card-compact' : ''} ${className}`}
    >
      <div className="card-top">
        <span>{card.kind}</span>
        <Icon aria-hidden="true" />
      </div>
      <div className={`card-art art-${card.effect}`} aria-hidden="true">
        <div className="art-orbit" />
        <div className="art-orbit orbit-two" />
        <span className="art-code">
          {card.kind === 'engineering'
            ? '</>'
            : card.kind === 'model'
              ? 'AI'
              : card.effect === 'yolo'
                ? '!!'
                : card.effect === 'ralph'
                  ? ':)'
                  : ''}
        </span>
        {card.kind !== 'engineering' &&
        card.kind !== 'model' &&
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
      <div className="card-title">{card.name}</div>
      <p className="card-copy">{card.copy}</p>
      <div className="card-bottom">
        {card.kind === 'engineering' ? (
          <>
            <span>
              <FiZap />
              {cost}
              <small>cr</small>
            </span>
            <FiArrowUpRight />
            <span>
              {earned}
              <small>tk</small>
            </span>
          </>
        ) : (
          <>
            <span className="card-effect-label">
              {card.kind === 'sabotage' ? 'NEXT TEAM' : 'THIS TURN'}
            </span>
            <FiActivity />
          </>
        )}
      </div>
    </div>
  )
}
