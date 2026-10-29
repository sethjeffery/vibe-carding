import { useEffect, useState } from 'react'
import {
  FiActivity,
  FiArrowRight,
  FiAward,
  FiCheck,
  FiClock,
  FiCode,
  FiEye,
  FiLayers,
  FiLoader,
  FiTarget,
  FiTrash2,
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

function format(value: number) {
  return value.toLocaleString()
}
function Timer({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.ceil(((deadline ?? now) - now) / 1000))
  return (
    <span className={`turn-timer ${seconds < 30 ? 'timer-low' : ''}`}>
      <FiClock />
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  )
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
  const [selectedId, select] = useState<string | null>(null)
  const selected = me.hand?.find(
    (instance) => instance.instanceId === selectedId,
  )
  const latestPlays = game.events
    .filter((event) => event.cardId && event.turn === game.turn)
    .slice(0, 4)
    .reverse()
  const next = game.players[(me.seat + 1) % game.players.length]
  const remaining = Math.max(0, me.actionLimit - me.actionsUsed)

  function legality(cardId: string) {
    const card = CARDS[cardId]
    const playable = canPlay(game, me, card)
    const free =
      playable && me.unlimitedEngineering && card.kind === 'engineering'
    return {
      playable,
      allowed: isTurn && !busy && (remaining > 0 || free || me.mustEmptyHand),
      free,
    }
  }
  const selectedLegality = selected ? legality(selected.definitionId) : null

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
            <span>
              TURN {String(game.turn).padStart(2, '0')}
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
              <span className="hero-tag">SPRINT COMPLETE</span>
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
              <div className="turn-announcement">
                <span className={isTurn ? 'text-lime' : ''}>
                  {isTurn ? 'Your move.' : `${active?.name} is cooking.`}
                </span>
                <Timer deadline={game.turnDeadline} />
              </div>
              <div className="played-cards" aria-label="Cards played this turn">
                {latestPlays.length ? (
                  latestPlays.map((event, index) => (
                    <div
                      key={event.id}
                      className="played-card"
                      style={{
                        transform: `rotate(${(index - (latestPlays.length - 1) / 2) * 7}deg)`,
                      }}
                    >
                      <Card card={CARDS[event.cardId!]} compact />
                      <span className="play-number">{index + 1}</span>
                    </div>
                  ))
                ) : (
                  <div className="table-empty">
                    <div className="table-empty-icon">
                      <FiCode />
                    </div>
                    <span>THE ROADMAP IS YOURS</span>
                    <p>
                      {isTurn
                        ? 'Select a card to make your first questionable decision.'
                        : 'Take a breath. Pretend to review a pull request.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="table-bottomline">
                <span>
                  <FiLayers />
                  {game.deckCount} in the stack
                  <span className="table-separator">/</span>
                  {game.discardCount} in the bin
                </span>
                <span>
                  git status: <strong>chaotic</strong>
                </span>
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
                <div>
                  <small>TURN {String(event.turn).padStart(2, '0')}</small>
                  <p>{event.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="activity-footer">
            <span className="status-dot" />
            {game.status === 'finished'
              ? 'BUILD SUCCEEDED. SOMEHOW.'
              : 'NO INTERRUPTS. JUST CONSEQUENCES.'}
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
                <span className="effect-danger">RALPH: EMPTY YOUR HAND</span>
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
              onClick={() => {
                select(null)
                onAction({ type: 'end-turn' })
              }}
            >
              {busy ? <FiLoader className="spin" /> : <FiCheck />}End turn
              <FiArrowRight />
            </button>
          </div>
        </div>
        <div className="hand-cards">
          {me.hand?.map((instance) => {
            const { playable, allowed, free } = legality(instance.definitionId)
            return (
              <button
                key={instance.instanceId}
                className={`hand-card ${selectedId === instance.instanceId ? 'selected' : ''} ${!playable ? 'unplayable' : ''}`}
                onClick={() =>
                  select(
                    selectedId === instance.instanceId
                      ? null
                      : instance.instanceId,
                  )
                }
                aria-pressed={selectedId === instance.instanceId}
                aria-label={`${instance.card.name}${!playable ? ', discardable' : ''}${free ? ', bonus play' : ''}`}
                data-card-id={instance.instanceId}
              >
                <Card card={instance.card} player={me} />
                <span className="card-hover-label">
                  {!isTurn
                    ? 'INSPECT'
                    : !playable
                      ? 'DISCARDABLE'
                      : free
                        ? 'BONUS PLAY'
                        : allowed
                          ? 'SELECT CARD'
                          : 'NO ACTIONS'}
                </span>
              </button>
            )
          })}
        </div>
        {selected && selectedLegality ? (
          <div className="card-action-bar">
            <div>
              <strong>{selected.card.name}</strong>
              <span>
                {!isTurn
                  ? 'Waiting for your turn'
                  : !selectedLegality.playable
                    ? 'No legal effect — spend an action to discard'
                    : selectedLegality.free
                      ? 'Engineering bonus · no action used'
                      : 'Uses 1 action'}
                {selected.card.kind === 'sabotage'
                  ? ` · Target: ${next.name}`
                  : ''}
              </span>
            </div>
            <button
              className={
                selectedLegality.playable
                  ? 'button-primary'
                  : 'button-secondary'
              }
              disabled={!selectedLegality.allowed}
              onClick={() => {
                onAction({
                  type: selectedLegality.playable ? 'play' : 'discard',
                  cardInstanceId: selected.instanceId,
                })
                select(null)
              }}
            >
              {selectedLegality.playable ? <FiZap /> : <FiTrash2 />}
              {selectedLegality.playable ? 'Play card' : 'Discard card'}
              <FiArrowRight />
            </button>
          </div>
        ) : (
          <p className="hand-hint">
            {me.mustEmptyHand && me.handCount
              ? 'Ralph is driving. Resolve every remaining card.'
              : isTurn
                ? remaining
                  ? 'Select a card. Order matters. Consequences vary.'
                  : 'Out of actions. End your turn to refill your hand.'
                : game.status === 'finished'
                  ? 'The sprint is over. The backlog is forever.'
                  : 'Plan your next move while your rival burns the budget.'}
          </p>
        )}
      </section>
      {me.revealPlayerIds.length ? (
        <section className="revealed-section">
          <h2>
            <FiEye />
            Observability: {next.name}’s hand
          </h2>
          <div>
            {next.hand?.map((instance) => (
              <Card key={instance.instanceId} card={instance.card} compact />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
