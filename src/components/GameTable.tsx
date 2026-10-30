import { useState } from 'react'
import {
  FiActivity,
  FiArrowRight,
  FiAward,
  FiCpu,
  FiAlertTriangle,
  FiRepeat,
  FiFastForward,
  FiLayers,
  FiLoader,
  FiZap,
} from 'react-icons/fi'
import {
  CARDS,
  ECONOMY,
  canPlay,
  type GameAction,
  type PlayerView,
} from '../../supabase/functions/_shared/engine'
import type { GameResponse } from '../lib/api'
import { Card } from './Card'
import { RevealedHand } from './RevealedHand'
import { TokenScore } from './TokenScore'

function format(value: number) {
  return value.toLocaleString()
}
function PlayerTile({
  player,
  active,
  winner,
  me,
  target,
}: {
  player: PlayerView
  active: boolean
  winner: boolean
  me: boolean
  target: number
}) {
  const pendingLabels = player.pending.map((effect) =>
    typeof effect === 'string'
      ? CARDS[effect].name
      : effect.skipTurn
        ? 'Rate Limited'
        : effect.disableCredits
          ? 'Budget Freeze'
          : effect.disableModels
            ? 'API Outage'
            : 'Next-turn effect',
  )
  return (
    <div
      className={`player-tile seat-${player.seat} ${active ? 'player-active' : ''} ${winner ? 'player-winner' : ''}`}
    >
      <div className="player-tile-top">
        <span className="player-avatar">
          {player.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2>
            <span className="player-name" title={player.name}>
              {player.name}
            </span>
            {me ? <small>YOU</small> : player.isAI ? <small>AI</small> : null}
          </h2>
          <div className="player-resources">
            <span>
              <FiZap />
              {format(player.credits)}
            </span>
            <span>
              <FiLayers />
              {player.handCount}
            </span>
            {player.pending.length ? (
              <span
                className="pending-chip"
                title={`Next turn: ${pendingLabels.join(', ')}`}
              >
                ! {pendingLabels.join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
        {active ? (
          <span className="turn-indicator">
            <span className="status-dot" />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="player-score">
        <TokenScore tokens={player.tokens} />
        <span>
          / {format(target)} <FiCpu aria-label="tokens" />
        </span>
      </div>
      <div className="score-track">
        <div
          style={{ width: `${Math.min(100, (player.tokens / target) * 100)}%` }}
        />
      </div>
    </div>
  )
}

export function GameTable({
  room,
  busy,
  onAction,
  onHome,
}: {
  room: GameResponse
  busy: boolean
  onAction: (action: GameAction) => void
  onHome: () => void
}) {
  const { game } = room
  const me = game.players.find((player) => player.id === game.meId)!
  const active = game.players.find(
    (player) => player.id === game.activePlayerId,
  )
  const winner = game.players.find((player) => player.id === game.winnerId)
  const isTurn = active?.id === me.id && game.status === 'playing'
  const remaining = active
    ? Math.max(0, active.actionLimit - active.actionsUsed)
    : 0
  const ownRemaining = Math.max(0, me.actionLimit - me.actionsUsed)
  const revealed = game.players.filter(
    (player) => me.revealPlayerIds.includes(player.id) && player.hand !== null,
  )
  const observeEvent = game.events.find(
    (event) =>
      event.cardId &&
      CARDS[event.cardId]?.effect.observability &&
      !event.discarded &&
      event.playerId === me.id &&
      event.turn === game.turn,
  )
  const [dismissedReveal, dismissReveal] = useState<number | null>(null)
  const turnPlays = game.events
    .filter((event) => event.cardId && event.turn === game.turn)
    .reverse()

  return (
    <main className="game-view">
      <section
        className={`players-row ${winner ? 'players-celebrating' : ''}`}
        aria-label="Players"
        tabIndex={0}
      >
        {game.players.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            active={active?.id === player.id}
            winner={winner?.id === player.id}
            me={player.id === me.id}
            target={game.victoryTarget}
          />
        ))}
      </section>
      <div className="board-layout">
        <section
          className={`table-space ${isTurn ? 'table-active' : 'table-waiting'}`}
          aria-label="Play area"
        >
          <div className="table-topline">
            <span className="turn-announcement">
              {winner
                ? null
                : isTurn
                  ? 'Your move.'
                  : `${active?.name} is cooking.`}
            </span>
            <div className="active-effects">
              {active?.costMultiplier !== undefined &&
              active.costMultiplier !== 1 ? (
                <span
                  title={`Credit cost ×${active.costMultiplier}`}
                  aria-label={`Credit cost ×${active.costMultiplier}`}
                >
                  <FiZap /> Credit cost ×{active.costMultiplier}
                </span>
              ) : null}
              {active?.yieldMultiplier !== undefined &&
              active.yieldMultiplier !== 1 ? (
                <span
                  title={`Token yield ×${active.yieldMultiplier}`}
                  aria-label={`Token yield ×${active.yieldMultiplier}`}
                >
                  <FiCpu /> Token yield ×{active.yieldMultiplier}
                </span>
              ) : null}
              {active?.modelBlocked ? (
                <span
                  className="effect-danger"
                  title="Models blocked"
                  aria-label="Models blocked"
                >
                  <FiAlertTriangle /> Models blocked
                </span>
              ) : null}
              {active?.unlimitedEngineering ? (
                <span
                  title="Engineering uses no actions"
                  aria-label="Engineering uses no actions"
                >
                  <FiFastForward /> Engineering uses no actions
                </span>
              ) : null}
              {active?.mustEmptyHand ? (
                <span
                  title="Play your entire hand"
                  aria-label="Play your entire hand"
                >
                  <FiRepeat /> Play your entire hand
                </span>
              ) : null}
            </div>
          </div>
          {winner ? (
            <div className="victory-panel">
              <span className="winner-icon">
                <FiAward />
              </span>
              <h1>
                {winner.id === me.id
                  ? 'You shipped it.'
                  : `${winner.name} shipped it.`}
              </h1>
              <p>
                {format(winner.tokens)} tokens. Unmeasurable technical debt.
              </p>
              <button className="button-primary" onClick={onHome}>
                Run it back
                <FiArrowRight />
              </button>
            </div>
          ) : (
            <div className="play-surface">
              <div
                className="played-cards"
                role="group"
                aria-label={`Cards played this turn, ${remaining} normal actions remaining`}
              >
                {turnPlays.map((event, index) => {
                  const card = CARDS[event.cardId!]
                  const discarded =
                    event.discarded ??
                    event.text.endsWith(` binned ${card.name}.`)
                  const canReveal =
                    !discarded &&
                    Boolean(revealed.length && event.id === observeEvent?.id)
                  const content = (
                    <>
                      <Card
                        card={card}
                        compact
                        discarded={discarded}
                        economics={event.economics}
                      />
                      <span className="play-number">{index + 1}</span>
                    </>
                  )
                  const className = `played-card action-space ${!discarded && (card.kind === 'mode' || card.kind === 'model') ? 'status-card' : ''}`
                  return canReveal ? (
                    <button
                      className={`${className} reveal-card`}
                      key={event.id}
                      onClick={() => dismissReveal(null)}
                      aria-label="View observed hand"
                      data-card-id={card.id}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={event.id}
                      className={className}
                      data-card-id={card.id}
                      aria-label={`${discarded ? 'Discarded' : 'Played'} ${card.name}`}
                    >
                      {content}
                    </div>
                  )
                })}
                {Array.from({ length: remaining }, (_, index) => (
                  <div
                    key={`space-${index}`}
                    className="action-space empty-action-space"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="play-controls">
                <button
                  className="button-primary end-turn"
                  disabled={
                    !isTurn || busy || (me.mustEmptyHand && me.handCount > 0)
                  }
                  onClick={() => onAction({ type: 'end-turn' })}
                >
                  End turn
                  {busy ? <FiLoader className="spin" /> : <FiArrowRight />}
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="activity-panel">
          <div className="activity-heading">
            <FiActivity />
            <h2>The changelog</h2>
            <span className="status-dot" />
          </div>
          <div
            className="activity-list"
            aria-live="polite"
            aria-relevant="additions"
          >
            {game.events.slice(0, 12).map((event) => (
              <div
                className={`activity-event event-${event.tone}`}
                key={event.id}
              >
                <span className="event-marker" />
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <section className="hand-section" aria-label="Your hand">
        <div
          className="credits-meter"
          role="meter"
          aria-label="Available credits"
          aria-valuemin={0}
          aria-valuemax={ECONOMY.creditCap}
          aria-valuenow={me.credits}
        >
          <div className="credits-track">
            <div
              className="credits-fill"
              style={{
                height: `${Math.max(0, Math.min(1, me.credits / ECONOMY.creditCap)) * 100}%`,
              }}
            />
          </div>
          <strong>{format(me.credits)}</strong>
          <span>credits</span>
        </div>
        <div className="hand-cards">
          {me.hand?.map((instance, index, hand) => {
            const angle =
              hand.length > 1 ? -2 + (index * 4) / (hand.length - 1) : 0
            const playable = canPlay(game, me, instance.card)
            const slotCost =
              instance.card.kind === 'engineering'
                ? (me.engineeringCardsSlotCost ??
                  (me.unlimitedEngineering ? 0 : 1))
                : 1
            const free = slotCost === 0
            const allowed =
              isTurn && !busy && (ownRemaining >= slotCost || me.mustEmptyHand)
            const action = playable ? 'Play' : 'Discard'
            return (
              <button
                key={instance.instanceId}
                className={`hand-card ${!playable ? 'unplayable' : ''}`}
                style={{
                  rotate: `${angle}deg`,
                  translate: `0 ${angle ** 2 * 1.5}px`,
                }}
                disabled={!allowed}
                onClick={() =>
                  onAction({
                    type: playable ? 'play' : 'discard',
                    cardInstanceId: instance.instanceId,
                  })
                }
                aria-label={`${action} ${instance.card.name}${free ? ', bonus play' : ''}`}
                title={
                  !isTurn
                    ? 'Waiting for your turn'
                    : `${action} ${instance.card.name}${!playable ? ' — no legal effect' : ''}`
                }
                data-card-id={instance.instanceId}
              >
                <Card card={instance.card} player={me} />
              </button>
            )
          })}
        </div>
      </section>
      {revealed.length > 0 &&
      observeEvent &&
      dismissedReveal !== observeEvent.id ? (
        <RevealedHand
          players={revealed}
          onClose={() => dismissReveal(observeEvent.id)}
        />
      ) : null}
    </main>
  )
}
