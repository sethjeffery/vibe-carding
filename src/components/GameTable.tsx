import { useState } from 'react'
import {
  FiActivity,
  FiArrowRight,
  FiAward,
  FiCheck,
  FiCode,
  FiLayers,
  FiLoader,
  FiTarget,
  FiZap,
} from 'react-icons/fi'
import {
  CARDS,
  canPlay,
  type GameAction,
  type PlayerView,
} from '../../supabase/functions/_shared/engine'
import type { GameResponse } from '../lib/api'
import { Card } from './Card'
import { RevealedHand } from './RevealedHand'

function format(value: number) {
  return value.toLocaleString()
}
function PlayerTile({
  player,
  active,
  me,
  target,
}: {
  player: PlayerView
  active: boolean
  me: boolean
  target: number
}) {
  return (
    <div
      className={`player-tile seat-${player.seat} ${active ? 'player-active' : ''}`}
    >
      <div className="player-tile-top">
        <span className="player-avatar">
          {player.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2>
            {player.name}
            {me ? <small>YOU</small> : null}
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
                title={`Next turn: ${player.pending.join(', ')}`}
              >
                ! {player.pending.join(' · ')}
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
        <strong>{format(player.tokens)}</strong>
        <span>/ {format(target)} tk</span>
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
  connected,
  onAction,
  onHome,
}: {
  room: GameResponse
  busy: boolean
  connected: boolean
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
  const remaining = Math.max(0, me.actionLimit - me.actionsUsed)
  const revealed = game.players.find(
    (player) => me.revealPlayerIds.includes(player.id) && player.hand !== null,
  )
  const observeEvent = game.events.find(
    (event) =>
      event.cardId === 'observe' &&
      event.playerId === me.id &&
      event.turn === game.turn,
  )
  const [dismissedReveal, dismissReveal] = useState<number | null>(null)
  const turnPlays = game.events
    .filter((event) => event.cardId && event.turn === game.turn)
    .reverse()
  const latestPlays = turnPlays.slice(-4)
  if (revealed && observeEvent && !latestPlays.includes(observeEvent))
    latestPlays.unshift(observeEvent)

  return (
    <main className="game-view">
      <section className="players-row" aria-label="Teams">
        {game.players.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            active={active?.id === player.id}
            me={player.id === me.id}
            target={game.victoryTarget}
          />
        ))}
      </section>
      <div className="board-layout">
        <section className="table-space">
          <div className="table-topline">
            <span>
              <span
                className={`status-dot ${connected ? '' : 'status-amber'}`}
              />
              {connected ? 'LIVE TABLE' : 'RECONNECTING'}
            </span>
            <span className={`turn-announcement ${isTurn ? 'text-lime' : ''}`}>
              {winner
                ? 'Sprint complete.'
                : isTurn
                  ? 'Your move.'
                  : `${active?.name} is cooking.`}
            </span>
            <span>
              TURN {game.turn}
              <span className="table-separator">/</span>
              <FiTarget />
              {format(game.victoryTarget)}
            </span>
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
            <>
              <div className="played-cards" aria-label="Cards played this turn">
                {latestPlays.length ? (
                  latestPlays.map((event) => {
                    const number = turnPlays.indexOf(event) + 1
                    const canReveal = Boolean(
                      revealed && event.id === observeEvent?.id,
                    )
                    const content = (
                      <>
                        <Card card={CARDS[event.cardId!]} compact />
                        <span className="play-number">{number}</span>
                      </>
                    )
                    return canReveal ? (
                      <button
                        className="played-card reveal-card"
                        key={event.id}
                        onClick={() => dismissReveal(null)}
                        aria-label="View observed hand"
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={event.id} className="played-card">
                        {content}
                      </div>
                    )
                  })
                ) : (
                  <div className="table-empty">
                    <div className="table-empty-icon">
                      <FiCode />
                    </div>
                    <p>
                      {isTurn
                        ? 'Click a card to play.'
                        : 'Planning your next questionable decision?'}
                    </p>
                  </div>
                )}
              </div>
            </>
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
        <div className="hand-toolbar">
          <div className="hand-title">
            <h2>
              Your hand<span>{me.handCount}</span>
            </h2>
            <span className="credit-bank">
              <FiZap />
              {format(me.credits)}
              <small>credits</small>
            </span>
            <div className="active-effects">
              {me.costMultiplier !== 1 ? (
                <span>cost ×{me.costMultiplier}</span>
              ) : null}
              {me.yieldMultiplier !== 1 ? (
                <span>yield ×{me.yieldMultiplier}</span>
              ) : null}
              {me.unlimitedEngineering ? <span>YOLO</span> : null}
              {me.mustEmptyHand ? (
                <span className="effect-danger">EMPTY YOUR HAND</span>
              ) : null}
              {me.modelBlocked ? (
                <span className="effect-danger">API OUTAGE</span>
              ) : null}
            </div>
          </div>
          <div className="turn-controls">
            <div
              className="action-dots"
              aria-label={`${remaining} of ${me.actionLimit} actions remaining`}
            >
              {Array.from({ length: me.actionLimit }, (_, index) => (
                <span
                  key={index}
                  className={index < remaining ? 'available' : ''}
                />
              ))}
              <span>{remaining} actions</span>
            </div>
            <button
              className="button-primary end-turn"
              disabled={
                !isTurn || busy || (me.mustEmptyHand && me.handCount > 0)
              }
              onClick={() => onAction({ type: 'end-turn' })}
            >
              {busy ? <FiLoader className="spin" /> : <FiCheck />}End turn
              <FiArrowRight />
            </button>
          </div>
        </div>
        <div className="hand-cards">
          {me.hand?.map((instance) => {
            const playable = canPlay(game, me, instance.card)
            const free =
              playable &&
              me.unlimitedEngineering &&
              instance.card.kind === 'engineering'
            const allowed =
              isTurn && !busy && (remaining > 0 || free || me.mustEmptyHand)
            const action = playable ? 'Play' : 'Discard'
            return (
              <button
                key={instance.instanceId}
                className={`hand-card ${!playable ? 'unplayable' : ''}`}
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
                {(!playable && instance.card.kind !== 'engineering') || free ? (
                  <span className="card-badge">
                    {!playable ? 'Discard' : 'Bonus play'}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>
      {revealed && observeEvent && dismissedReveal !== observeEvent.id ? (
        <RevealedHand
          player={revealed}
          onClose={() => dismissReveal(observeEvent.id)}
        />
      ) : null}
    </main>
  )
}
